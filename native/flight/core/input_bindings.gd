extends RefCounted
const DEFAULTS = {
 "pitch_up":["key:83","axis:1:1"],"pitch_down":["key:87","axis:1:-1"],
 "roll_left":["key:65","axis:0:-1"],"roll_right":["key:68","axis:0:1"],
 "yaw_left":["key:81","button:9"],"yaw_right":["key:69","button:10"],
 "throttle_up":["key:4194325","key:4194320","axis:5:1"],"throttle_down":["key:4194326","key:4194322","axis:4:1"],
 "brake":["key:32","button:0"],"hangar":["key:4194306","button:2"],
 "retry":["key:82","button:3"],"interact":["key:70","button:1"],
 "pause_game":["key:4194305","button:6"],"inspect":["key:73"],
 "overlay":["key:71"],"rotate_yaw":["key:88"],"rotate_pitch":["key:67"],"rotate_roll":["key:86"],"orbit":["mouse:2"],"undo_build":["key:90"],"redo_build":["key:89"]}

static func install(saved: Dictionary) -> void:
 for action in DEFAULTS:
  if not InputMap.has_action(action):
   InputMap.add_action(action,.18)
  InputMap.action_erase_events(action)
  var entries = saved.get(action,DEFAULTS[action])
  var events: Array[InputEvent] = _parse_entries(entries)
  if events.is_empty():
   events = _parse_entries(DEFAULTS[action])
  for event in events:
   InputMap.action_add_event(action,event)

static func _parse_entries(entries: Variant) -> Array[InputEvent]:
 var events: Array[InputEvent] = []
 if not entries is Array or entries.size() > 16:
  return events
 for token in entries:
  if not token is String:
   continue
  var event: InputEvent = parse_token(token)
  if event != null:
   events.append(event)
 return events

static func parse_token(token: String) -> InputEvent:
 if token.length() > 64:
  return null
 var pieces: PackedStringArray = token.split(":")
 if pieces.size() < 2 or pieces[1].length() > 10 or not pieces[1].is_valid_int():
  return null
 var value: int = int(pieces[1])
 if pieces[0] == "key" and pieces.size() == 2 and _valid_key(value):
  var event = InputEventKey.new()
  event.physical_keycode = value
  return event
 if pieces[0] == "button" and pieces.size() == 2 and value >= 0 and value < 32:
  var event = InputEventJoypadButton.new()
  event.button_index = value
  return event
 if pieces[0] == "mouse" and pieces.size() == 2 and value > 0 and value < 10:
  var event = InputEventMouseButton.new()
  event.button_index = value
  return event
 if pieces[0] == "axis" and value >= 0 and value < JOY_AXIS_MAX and pieces.size() == 3 and pieces[2] in ["-1","1"]:
  var event = InputEventJoypadMotion.new()
  event.axis = value
  event.axis_value = float(pieces[2])
  return event
 return null

static func _valid_key(value: int) -> bool:
 if value <= KEY_NONE or value >= KEY_UNKNOWN or value == KEY_SPECIAL:
  return false
 var text: String = OS.get_keycode_string(value)
 return not text.is_empty() and OS.find_keycode_from_string(text) == value

static func event_label(event:InputEvent)->String:
 if event is InputEventKey:
  return OS.get_keycode_string(event.physical_keycode if event.physical_keycode else event.keycode)
 if event is InputEventMouseButton:
  return {1:"Mouse left",2:"Mouse right",3:"Mouse middle",4:"Wheel up",5:"Wheel down"}.get(event.button_index,"Mouse %d"%event.button_index)
 if event is InputEventJoypadButton:
  return {0:"Pad A",1:"Pad B",2:"Pad X",3:"Pad Y",6:"Pad Start",9:"Pad LB",10:"Pad RB"}.get(event.button_index,"Pad button %d"%event.button_index)
 if event is InputEventJoypadMotion:
  if event.axis==4:return "Pad LT"
  if event.axis==5:return "Pad RT"
  return "Pad "+({0:("LS left" if event.axis_value<0 else "LS right"),1:("LS up" if event.axis_value<0 else "LS down")}.get(event.axis,"axis %d%s"%[event.axis,"−" if event.axis_value<0 else "+"]))
 return ""

static func label(action: String) -> String:
 var labels:PackedStringArray=[]
 for event in InputMap.action_get_events(action):
  var value=event_label(event)
  if not value.is_empty() and not labels.has(value):labels.append(value)
 return " / ".join(labels)

static func short_label(action:String)->String:
 var events=InputMap.action_get_events(action)
 for event in events:
  if event is InputEventKey and event.physical_keycode not in [KEY_SHIFT,KEY_CTRL,KEY_ALT,KEY_META]:return event_label(event)
 return event_label(events[0]) if not events.is_empty() else "Unassigned"

static func conflict_for(action:String,token:String)->String:
 var event=parse_token(token)
 if event==null:return ""
 for other in DEFAULTS:
  if other!=action and InputMap.event_is_action(event,other,true):return other
 return ""

static func token_for(event: InputEvent) -> String:
 var token: String = ""
 if event is InputEventKey and event.pressed and not event.echo:
  var code: int = event.physical_keycode if _valid_key(event.physical_keycode) else event.keycode
  if _valid_key(code):
   token = "key:%d" % code
 elif event is InputEventJoypadButton and event.pressed:
  token = "button:%d" % event.button_index
 elif event is InputEventJoypadMotion and is_finite(event.axis_value) and absf(event.axis_value) > .65:
  token = "axis:%d:%d" % [event.axis,-1 if event.axis_value < 0 else 1]
 elif event is InputEventMouseButton and event.pressed:
  token = "mouse:%d" % event.button_index
 return token if not token.is_empty() and parse_token(token) != null else ""

static func normalize_event(event: InputEvent) -> InputEvent:
 # Real hardware location always wins. Only accessibility/synthetic events
 # lacking a physical code are copied into the positional binding convention.
 if not event is InputEventKey or event.physical_keycode != 0 or not _valid_key(event.keycode):
  return event
 var normalized: InputEventKey = event.duplicate()
 normalized.physical_keycode = event.keycode
 return normalized
