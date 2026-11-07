extends SceneTree
const World=preload("res://game/world.gd")
var failures=0
func _initialize():call_deferred("run")
func check(ok,label):
 if not ok:failures+=1;printerr("FAIL ",label)
func run():
 var app=load("res://game/main.tscn").instantiate();root.add_child(app)
 for i in range(4):await physics_frame
 app.start_flight();Input.action_press("throttle_up");Input.action_press("pitch_up",.6)
 for i in range(1800):await physics_frame
 Input.action_release("throttle_up");Input.action_release("pitch_up")
 await process_frame
 app.return_to_hangar()
 for i in range(6):await physics_frame
 for i in range(3):await process_frame
 var expected=World.HOME+Vector3(30,1.5,10)
 print("RESET_POSITION ",str(app.aircraft.craft_origin())," expected ",expected)
 check(app.mode=="build" and app.aircraft.craft_origin().distance_to(expected)<.01,"return to workshop remains at the home apron after physics synchronization")
 app.start_flight()
 for i in range(120):await physics_frame
 app.retry()
 for i in range(4):await physics_frame
 check(app.aircraft.craft_origin().distance_to(World.HOME+Vector3(0,1.55,88))<.4,"retry remains at the launch runway after synchronization")
 var folder=app.folder
 var blocked=folder+"/close-blocker";var file=FileAccess.open(blocked,FileAccess.WRITE);file.store_string("test");file.close();app.folder=blocked
 app.pause_panel.hide()
 root.close_requested.emit()
 await process_frame
 check(app.pause_panel.visible,"native window close reaches the save gate")
 app.folder=folder
 app.queue_free()
 for i in range(3):await process_frame
 OS.delay_msec(400)
 await process_frame
 print("Reset lifecycle checks: ",3-failures,"/3")
 quit(1 if failures else 0)
