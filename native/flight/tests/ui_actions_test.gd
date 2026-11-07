extends SceneTree
const Bindings=preload("res://core/input_bindings.gd")
var failures=0
var checks=0
func _initialize():call_deferred("run")
func check(ok,label):
 checks+=1
 if not ok:failures+=1;printerr("FAIL ",label)
func key(code,pressed=true):
 var e=InputEventKey.new();e.physical_keycode=code;e.keycode=code;e.pressed=pressed;return e
func run():
 var app=load("res://game/main.tscn").instantiate();root.add_child(app)
 for i in range(8):await process_frame
 Bindings.install({"rotate_yaw":["button:5"],"undo_build":["mouse:8"],"orbit":["key:79"]})
 var joy=InputEventJoypadButton.new();joy.button_index=5;joy.pressed=true
 app._unhandled_input(joy)
 check(app.rotation_quarters.y==90,"workshop rotation executes rebound gamepad action")
 var old=app.history.current.paint;app._paint("315b70")
 var mouse=InputEventMouseButton.new();mouse.button_index=8;mouse.pressed=true
 app._unhandled_input(mouse)
 check(app.history.current.paint==old,"workshop undo executes rebound mouse action")
 app._unhandled_input(key(KEY_O));check(app._dragging,"keyboard orbit starts mouse-drag orbit")
 app._unhandled_input(key(KEY_O,false));check(not app._dragging,"keyboard orbit release ends drag")
 check(not Bindings.label("undo_build").is_empty() and not Bindings.label("rotate_yaw").is_empty(),"mouse and gamepad assignments have readable labels")
 Bindings.install({});app._show_settings()
 var button=app._binding_buttons.pitch_up
 button.grab_focus();button.pressed.emit()
 Input.parse_input_event(key(KEY_LEFT))
 await process_frame
 check(app.profile.settings.bindings.get("pitch_up",[])==["key:%d"%KEY_LEFT],"focused settings captures navigation key before GUI")
 Input.parse_input_event(key(KEY_LEFT,false))
 button=app._binding_buttons.pitch_up;button.grab_focus();button.pressed.emit()
 Input.parse_input_event(key(KEY_R));await process_frame
 check(not app.profile.settings.bindings.get("pitch_up",[]).has("key:%d"%KEY_R),"conflicting Retry binding is rejected")
 Input.parse_input_event(key(KEY_R,false))
 Input.parse_input_event(key(KEY_ESCAPE));await process_frame
 check(app._bind_action.is_empty(),"Escape cancels pending rebind")
 Input.parse_input_event(key(KEY_ESCAPE,false))
 app._show_settings();app._binding_buttons.pitch_up.pressed.emit()
 var click=InputEventMouseButton.new();click.button_index=MOUSE_BUTTON_LEFT;click.pressed=true
 click.position=app._binding_buttons.pitch_up.get_global_rect().get_center()
 Input.parse_input_event(click);await process_frame
 check(app.profile.settings.bindings.get("pitch_up",[])==["mouse:1"],"focused settings captures mouse gesture before button GUI")
 click.pressed=false;Input.parse_input_event(click)
 app._show_settings();app._binding_buttons.pitch_up.pressed.emit();app._resume()
 check(app._bind_action.is_empty(),"leaving settings clears pending capture")
 Bindings.install({"retry":["key:84"],"interact":["key:85"],"pitch_up":["key:76"]})
 app.start_flight();app._update_hud()
 check(app.find_child("RetryButton",true,false).text.contains("T") and not app.find_child("RetryButton",true,false).text.contains("[R]"),"retry button reflects active remap")
 check(app.unload_button.text.contains("U") and app.assist_hint.text.contains("L"),"flight and unload hints reflect active remaps")
 app.return_to_hangar()
 var original_folder=app.folder
 var blocked=original_folder+"/not-a-folder"
 var f=FileAccess.open(blocked,FileAccess.WRITE);f.store_string("test-only directory blocker");f.close()
 app.folder=blocked
 var saved=app._save_profile()
 check(saved is bool and not saved,"save result is propagated to callers")
 app._save_design()
 check(app.message_label.text.to_lower().contains("save failed"),"failed design save is not reported as success")
 app._notice("ordinary gameplay notice",1)
 var status=app.get("save_status")
 check(status!=null and status.visible and not status.text.is_empty(),"save failure survives later gameplay notices")
 check(not auto_accept_quit,"window closure is routed through the save gate")
 if saved is bool and not saved:
  app._quit();await process_frame
  check(app.is_inside_tree() and app.pause_panel.visible,"failed save keeps game open for retry or explicit discard")
 app.folder=original_folder
 app.queue_free();await process_frame;OS.delay_msec(250);await process_frame
 print("UI action checks: ",checks-failures,"/",checks)
 quit(1 if failures else 0)
