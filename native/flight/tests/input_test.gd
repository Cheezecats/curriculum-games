extends SceneTree
const Bindings = preload("res://core/input_bindings.gd")
var checks: int = 0
var failures: int = 0
var observer: InputObserver

class InputObserver:
 extends Node
 var events: Array[InputEventKey] = []
 func _unhandled_input(event: InputEvent) -> void:
  if event is InputEventKey:
   events.append(event.duplicate())

func _initialize() -> void:
 call_deferred("run_tests")

func expect(value: bool, message: String) -> void:
 checks += 1
 if not value:
  failures += 1
  print("FAIL: ",message)

func key_event(code: int, physical: bool, pressed: bool = true) -> InputEventKey:
 var event = InputEventKey.new()
 if physical:
  event.physical_keycode = code
 else:
  event.keycode = code
 event.pressed = pressed
 return event

func check_key(action: String, code: int, physical: bool, expected: bool = true) -> void:
 var event: InputEventKey = key_event(code,physical)
 var description: String = "%s %s key %d" % [action,"physical" if physical else "logical",code]
 var normalized: InputEvent = Bindings.normalize_event(event)
 expect(normalized.is_action_pressed(action) == expected,description + " normalized event maps to action")
 expect((event.physical_keycode == code) if physical else (event.physical_keycode == 0),description + " original input is not mutated")
 var before: int = observer.events.size()
 Input.parse_input_event(event)
 Input.flush_buffered_events()
 expect(Input.is_action_pressed(action) == expected,description + " real Input state updates")
 var release: InputEventKey = key_event(code,physical,false)
 Input.parse_input_event(release)
 Input.flush_buffered_events()
 expect(not Input.is_action_pressed(action),description + " real Input release clears action")
 if observer.events.size() - before != 2:
  print("PIPELINE DEBUG ",description," delivered=",observer.events.size()-before)
  for delivered in observer.events.slice(before):
   print(" event physical=",delivered.physical_keycode," logical=",delivered.keycode," pressed=",delivered.pressed)
 expect(observer.events.size() - before == 2,description + " pipeline dispatches one press and one release")
 if observer.events.size() - before == 2:
  expect(observer.events[before].physical_keycode == code and observer.events[before+1].physical_keycode == code,description + " gameplay receives normalized physical keys")

func run_tests() -> void:
 observer = InputObserver.new()
 root.add_child(observer)
 await process_frame
 Input.use_accumulated_input = false
 Bindings.install({})
 check_key("pitch_up",KEY_S,true)
 check_key("pitch_up",KEY_S,false)
 check_key("pause_game",KEY_ESCAPE,true)
 check_key("pause_game",KEY_ESCAPE,false)
 check_key("throttle_up",KEY_SHIFT,true)
 check_key("throttle_up",KEY_SHIFT,false)
 check_key("throttle_down",KEY_CTRL,true)
 check_key("throttle_down",KEY_CTRL,false)
 check_key("throttle_up",KEY_UP,true)
 check_key("throttle_up",KEY_UP,false)
 check_key("throttle_down",KEY_DOWN,true)
 check_key("throttle_down",KEY_DOWN,false)
 var dual_default: InputEventKey = key_event(KEY_S,true)
 dual_default.keycode = KEY_S
 Input.parse_input_event(dual_default)
 Input.flush_buffered_events()
 expect(is_equal_approx(Input.get_action_strength("pitch_up"),1.0),"normal dual-code key has one unit of action strength")
 var dual_release: InputEventKey = key_event(KEY_S,true,false)
 dual_release.keycode = KEY_S
 Input.parse_input_event(dual_release)
 Input.flush_buffered_events()
 expect(not Input.is_action_pressed("pitch_up"),"dual-code release clears action")
 var before_count: int = InputMap.action_get_events("pitch_up").size()
 Bindings.install({})
 expect(InputMap.action_get_events("pitch_up").size() == before_count,"reinstall does not accumulate key mappings")
 for action in Bindings.DEFAULTS:
  for token in Bindings.DEFAULTS[action]:
   expect(Bindings.parse_token(token) != null,"every authored default token is valid")
 # Hardware layout semantics: physical Q with logical A must only yaw, never also roll.
 var azerty = key_event(KEY_Q,true)
 azerty.keycode = KEY_A
 Input.parse_input_event(azerty)
 Input.flush_buffered_events()
 expect(Input.is_action_pressed("yaw_left"),"hardware physical Q activates yaw on alternate layout")
 expect(not Input.is_action_pressed("roll_left"),"hardware logical A cannot activate a second action")
 var azerty_release = key_event(KEY_Q,true,false)
 azerty_release.keycode = KEY_A
 Input.parse_input_event(azerty_release)
 Input.flush_buffered_events()
 expect(not Input.is_action_pressed("yaw_left") and not Input.is_action_pressed("roll_left"),"alternate layout release leaves no stuck actions")
 var s_labels: PackedStringArray = Bindings.label("pitch_up").split(" / ")
 expect(s_labels.size() == 1 and s_labels[0] == OS.get_keycode_string(KEY_S),"logical fallback does not duplicate UI key label")
 var up_labels: PackedStringArray = Bindings.label("throttle_up").split(" / ")
 expect(up_labels.has(OS.get_keycode_string(KEY_UP)) and up_labels.has(OS.get_keycode_string(KEY_SHIFT)),"throttle UI exposes arrow and modifier choices")
 var helper_source: InputEventKey = key_event(KEY_S,false)
 helper_source.shift_pressed = true
 helper_source.unicode = 115
 var helper_normalized: InputEventKey = Bindings.normalize_event(helper_source)
 expect(helper_normalized != helper_source and helper_source.physical_keycode == 0,"normalizer copies logical-only source without mutating it")
 expect(helper_normalized.physical_keycode == KEY_S and helper_normalized.keycode == KEY_S and helper_normalized.shift_pressed and helper_normalized.unicode == 115,"normalizer preserves logical code, Unicode, and modifiers")
 expect(Bindings.normalize_event(helper_normalized) == helper_normalized,"normalization is idempotent and stops redispatch recursion")
 var hardware: InputEventKey = key_event(KEY_Q,true)
 hardware.keycode = KEY_A
 expect(Bindings.normalize_event(hardware) == hardware,"physical hardware event is preserved even when logical code differs")
 var no_key = InputEventKey.new()
 expect(Bindings.normalize_event(no_key) == no_key,"empty logical event is not redispatched")
 var logical: InputEventKey = key_event(KEY_F,false)
 expect(Bindings.token_for(logical) == "key:%d" % KEY_F,"logical-only rebinding produces valid key token")
 var dual: InputEventKey = key_event(KEY_A,true)
 dual.keycode = KEY_Q
 expect(Bindings.token_for(dual) == "key:%d" % KEY_A,"rebinding prefers physical location when present")
 var echo: InputEventKey = key_event(KEY_F,false)
 echo.echo = true
 expect(Bindings.token_for(echo).is_empty(),"key echo is not a rebind gesture")
 expect(Bindings.token_for(InputEventKey.new()).is_empty(),"empty key event cannot save key zero")
 var saved = {"pitch_up":["key:%d" % KEY_F]}
 Bindings.install(saved)
 check_key("pitch_up",KEY_F,true)
 check_key("pitch_up",KEY_F,false)
 check_key("pitch_up",KEY_S,true,false)
 check_key("pitch_up",KEY_S,false,false)
 expect(Bindings.label("pitch_up") == OS.get_keycode_string(KEY_F),"rebound logical and physical keys share one UI label")
 expect(saved.pitch_up == ["key:%d" % KEY_F],"install preserves persisted token format and caller data")
 for invalid in ["axis:1:0","axis:1:garbage","axis:1:2","axis:-1:1","axis:99:1","axis:1:1:extra","key:0","key:1","key:97","key:4194304","key:8388607","key:-1","key:999999999999","key:83:extra","key:nope","button:1:extra","mouse:2:extra"]:
  expect(Bindings.parse_token(invalid) == null,"invalid token rejected: " + invalid)
 Bindings.install({"pitch_up":["key:0","axis:1:garbage"]})
 check_key("pitch_up",KEY_S,true)
 check_key("pitch_up",KEY_S,false)
 var positive: InputEvent = Bindings.parse_token("axis:1:1")
 var negative: InputEvent = Bindings.parse_token("axis:1:-1")
 expect(positive is InputEventJoypadMotion and positive.axis == 1 and positive.axis_value == 1,"positive axis token retains direction")
 expect(negative is InputEventJoypadMotion and negative.axis == 1 and negative.axis_value == -1,"negative axis token retains direction")
 # Real analog events remain functional after keyboard compatibility mapping.
 Bindings.install({})
 var axis = InputEventJoypadMotion.new()
 axis.axis = JOY_AXIS_LEFT_Y
 axis.axis_value = .8
 Input.parse_input_event(axis)
 Input.flush_buffered_events()
 expect(Input.is_action_pressed("pitch_up"),"real analog motion still reaches action state")
 var neutral = InputEventJoypadMotion.new()
 neutral.axis = JOY_AXIS_LEFT_Y
 neutral.axis_value = 0
 Input.parse_input_event(neutral)
 Input.flush_buffered_events()
 expect(not Input.is_action_pressed("pitch_up"),"analog neutral clears action")
 print("INPUT TESTS: %d checks, %d failures" % [checks,failures])
 quit(1 if failures else 0)
