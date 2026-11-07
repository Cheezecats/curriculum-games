extends Node
# Test-only performance workload. Main owns normal gameplay; guidance only drives
# its real Input actions after a normal ground launch. No state/velocity warps.
const Blueprint = preload("res://core/blueprint.gd")
const Mass = preload("res://core/mass_properties.gd")
const TARGET_SIZE = Vector2i(1920,1080)
const ACTIONS: Array[String] = ["pitch_up","pitch_down","roll_left","roll_right","yaw_left","yaw_right","throttle_up","throttle_down","brake"]
var app: Node
var output: String = ""
var requested_seconds: float = 600
var warmup_seconds: float = 3
var smoke: bool = false
var running: bool = false
var finished: bool = false
var started_us: int = 0
var previous_frame_us: int = 0
var initial_drawn_frames: int = 0
var initial_physics_frames: int = 0
var physics_ticks: int = 0
var process_callbacks: int = 0
var airborne_seconds: float = 0
var takeoff_seconds: float = -1
var max_clearance: float = 0
var waypoint_index: int = 0
var frame_ms: Array[float] = []
var process_ms: Array[float] = []
var physics_ms: Array[float] = []
var gpu_ms: Array[float] = []
var render_cpu_ms: Array[float] = []
var draw_calls: Array[float] = []
var trace: Array[Dictionary] = []
var trace_time: float = -1
var checkpoint_time: float = -1
var resolution_proof: Dictionary = {}
var hardware: Dictionary = {}
var configuration: Dictionary = {}
var last_controls: Dictionary = {}
var path: Array[Vector2] = [Vector2(80,180),Vector2(-280,-100),Vector2(0,-420),Vector2(360,-100)]

func _ready() -> void:
 app = get_parent()
 if app.has_meta("quality_benchmark_active"):
  queue_free()
  return
 app.set_meta("quality_benchmark_active",true)
 process_physics_priority = -100
 process_priority = 100
 set_process(false)
 set_physics_process(false)
 call_deferred("_begin")

static func benchmark_blueprint() -> Dictionary:
 var bp: Dictionary = Blueprint.starter()
 bp.name = "128-part endurance lattice"
 # Eight large wing panels and a flat beam lattice keep this heavy workload's
 # centre of mass near the stock craft. Four extra motors and twenty-four packs
 # provide real ground takeoff capability and ten-minute electrical endurance.
 for z in [-1.125,-.275,.575,1.425]:
  for x in [-1.7,1.7]:
   _part(bp,"large_wing",Vector3(x,-.2,z))
 for x in [-1.8,-.8,.8,1.8]:
  _part(bp,"motor",Vector3(x,-.2,-1.925))
 for x in [-2.4,-1.6,-.8,.8,1.6,2.4]:
  for z in [-1.0,-.2,.6,1.4]:
   _part(bp,"battery",Vector3(x,.12,z))
 # Sixty-eight physically connected longitudinal struts form the compact grid.
 for y in [-.1,.1,.3]:
  for x in [-1.2,-.8,-.4,.4,.8,1.2]:
   for z in [-1.25,-.35,.55,1.45]:
    if is_equal_approx(y,.3) and is_equal_approx(absf(x),.8) and (is_equal_approx(z,-1.25) or is_equal_approx(z,1.45)):
     continue
    _part(bp,"strut",Vector3(x,y,z))
 for x in [-2.6,-1.6,1.6,2.6]:
  _part(bp,"aileron",Vector3(x,-.2,1.95))
 for x in [-1.1,1.1]:
  _part(bp,"elevator",Vector3(x,0,2.8))
 _part(bp,"rudder",Vector3(0,1.25,2.65))
 for x in [-1.2,1.2]:
  _part(bp,"gear",Vector3(x,-.55,.15))
 return bp

static func _part(bp: Dictionary, kind: String, p: Vector3, r: Vector3 = Vector3.ZERO) -> void:
 bp.parts.append({"id":"qa_%03d" % bp.parts.size(),"kind":kind,"p":[p.x,p.y,p.z],"r":[r.x,r.y,r.z]})

func _begin() -> void:
 var boot: Node = get_node_or_null("/root/Boot")
 output = "/private/tmp/flight-islands-quality/benchmark-%d.json" % int(Time.get_unix_time_from_system())
 var hardware_path: String = ""
 for arg in OS.get_cmdline_user_args():
  if arg == "--quality-smoke": smoke = true
  elif arg.begins_with("--quality-output="): output = arg.trim_prefix("--quality-output=")
  elif arg.begins_with("--quality-hardware="): hardware_path = arg.trim_prefix("--quality-hardware=")
 if smoke:
  requested_seconds = 6
  warmup_seconds = .2
 for arg in OS.get_cmdline_user_args():
  if arg.begins_with("--quality-duration="):
   requested_seconds = arg.trim_prefix("--quality-duration=").to_float()
  elif arg.begins_with("--quality-warmup="):
   warmup_seconds = arg.trim_prefix("--quality-warmup=").to_float()
 if boot == null or not boot.test_mode or AudioServer.get_driver_name() != "Dummy" or not AudioServer.is_bus_mute(0):
  _finish("unsafe_audio_or_non_test_session",false)
  return
 if not is_finite(requested_seconds) or requested_seconds <= 0 or requested_seconds > 3600 or not is_finite(warmup_seconds) or warmup_seconds < 0 or warmup_seconds > 60:
  _finish("invalid_benchmark_duration",false)
  return
 if smoke and DisplayServer.get_name() != "headless":
  _finish("smoke_mode_requires_headless_output",false)
  return
 if DisplayServer.get_name() == "headless" and not smoke:
  _finish("gpu_benchmark_requires_real_display_and_renderer",false)
  return
 if Engine.physics_ticks_per_second != 120 or Engine.time_scale != 1:
  _finish("requires_120hz_physics_and_normal_time_scale",false)
  return
 if not hardware_path.is_empty() and FileAccess.file_exists(hardware_path):
  var parsed = JSON.parse_string(FileAccess.get_file_as_string(hardware_path))
  if parsed is Dictionary: hardware = parsed
 var bp: Dictionary = benchmark_blueprint()
 var validation: Dictionary = Blueprint.validate(bp)
 var catalog_counts: Dictionary = {}
 for part in bp.parts: catalog_counts[part.kind] = catalog_counts.get(part.kind,0)+1
 configuration = {"blueprint":bp,"validation":validation,"part_count":bp.parts.size(),"catalog_counts":catalog_counts,"payload_kg":2.0}
 if not validation.ok or bp.parts.size() != 128:
  _finish("invalid_128_part_benchmark_blueprint",false)
  return
 var properties: Dictionary = Mass.compute(bp,2)
 configuration["mass_kg"] = properties.get("mass",0)
 if properties.is_empty():
  _finish("invalid_benchmark_mass_properties",false)
  return
 var window: Window = get_tree().root
 window.content_scale_mode = Window.CONTENT_SCALE_MODE_VIEWPORT
 window.content_scale_size = TARGET_SIZE
 if not smoke:
  window.size = TARGET_SIZE
  DisplayServer.window_set_vsync_mode(DisplayServer.VSYNC_DISABLED)
  RenderingServer.viewport_set_measure_render_time(window.get_viewport_rid(),true)
 Engine.max_fps = 120 if smoke else 0
 OS.low_processor_usage_mode = false
 app._load_blueprint(bp)
 app.launch_payload = true
 app._rebuild()
 configuration["electrical_capacity_j"] = app.aircraft.capacity
 configuration["aircraft_mesh_instances"] = app.aircraft.find_children("*","MeshInstance3D",true,false).size()
 # Warmup is excluded from all measurement arrays and occurs before ground launch.
 await get_tree().create_timer(warmup_seconds).timeout
 if smoke:
  resolution_proof = {"verified":false,"reason":"headless smoke has no rendered GPU image","requested_width":1920,"requested_height":1080}
 else:
  await RenderingServer.frame_post_draw
  var image: Image = window.get_texture().get_image()
  if image == null or image.is_empty():
   _finish("renderer_produced_no_viewport_image",false)
   return
  var proof_path: String = output.get_basename()+"-viewport.png"
  DirAccess.make_dir_recursive_absolute(proof_path.get_base_dir())
  var saved: Error = image.save_png(proof_path)
  resolution_proof = {"verified":image.get_width()==1920 and image.get_height()==1080 and saved==OK,"actual_width":image.get_width(),"actual_height":image.get_height(),"png":proof_path,"save_error":error_string(saved)}
  if not resolution_proof.verified:
   _finish("rendered_viewport_is_not_saved_full_1920x1080",false)
   return
 _release_controls()
 app.start_flight()
 started_us = Time.get_ticks_usec()
 previous_frame_us = 0
 initial_drawn_frames = Engine.get_frames_drawn()
 initial_physics_frames = Engine.get_physics_frames()
 running = true
 set_process(true)
 set_physics_process(true)
 print("QUALITY BENCHMARK START ",JSON.stringify({"seconds":requested_seconds,"parts":128,"mass":properties.mass,"mode":"headless_smoke" if smoke else "GPU1080p","output":output}))

func _physics_process(dt: float) -> void:
 if not running or finished: return
 physics_ticks += 1
 var plane = app.aircraft
 var t: Dictionary = plane.telemetry()
 var position_value: Vector3 = t.position
 var ground: float = app.world.terrain_height(position_value.x,position_value.z)
 var clearance: float = position_value.y-ground
 max_clearance = maxf(max_clearance,clearance)
 var now: float = _elapsed()
 if not t.grounded and clearance > 3:
  airborne_seconds += dt
  if takeoff_seconds < 0: takeoff_seconds = now
 if t.crashed or app.mode == "crashed":
  _finish("aircraft_crashed: "+str(t.get("crash_message","unknown impact")),false)
  return
 if takeoff_seconds >= 0 and now-takeoff_seconds > 10 and t.grounded:
  _finish("unexpected_ground_contact_after_takeoff",false)
  return
 if t.energy <= 0:
  _finish("battery_exhausted_during_measured_flight",false)
  return
 if now > 45 and takeoff_seconds < 0:
  _finish("128_part_ground_takeoff_timeout",false)
  return
 if absf(position_value.x) > 980 or absf(position_value.z) > 980:
  _finish("guidance_left_safe_region_bounds",false)
  return
 var target: Vector2 = path[waypoint_index]
 var horizontal = Vector2(position_value.x,position_value.z)
 if horizontal.distance_to(target) < 100:
  waypoint_index = (waypoint_index+1)%path.size()
  target = path[waypoint_index]
 var delta: Vector2 = target-horizontal
 var forward: Vector3 = -plane.craft_basis().z
 var current_heading: float = atan2(-forward.x,-forward.z)
 var desired_heading: float = atan2(-delta.x,-delta.y)
 var error: float = wrapf(desired_heading-current_heading,-PI,PI)
 var roll: float = clampf(-error*.75,-.34,.34) if takeoff_seconds >= 0 else 0.0
 var altitude_target: float = 185.0
 var pitch: float = clampf((altitude_target-position_value.y)*.006-float(t.vertical_speed)*.08+absf(float(t.bank))*.4,-.8,1.0)
 if clearance < 35 and position_value.y < 100: pitch = 1.0
 if takeoff_seconds < 0:
  pitch = .9 if t.speed > 9 else .05
 var desired_throttle: float = clampf(.53+(13.5-float(t.speed))*.055+maxf(0,pitch)*.18,.30,.95)
 if takeoff_seconds < 0 or position_value.y < 160 or clearance < 35: desired_throttle = 1.0
 _axis("pitch_down","pitch_up",pitch)
 _axis("roll_left","roll_right",roll)
 _axis("yaw_left","yaw_right",0)
 _axis("throttle_down","throttle_up",clampf((desired_throttle-float(t.throttle))/.10,-1,1))
 Input.action_release("brake")
 last_controls = {"pitch":pitch,"roll":roll,"desired_throttle":desired_throttle,"waypoint":waypoint_index}
 if now-trace_time >= 1:
  trace_time = now
  trace.append({"wall_seconds":now,"simulated_seconds":t.elapsed,"position":[position_value.x,position_value.y,position_value.z],"speed":t.speed,"vertical_speed":t.vertical_speed,"pitch_deg":rad_to_deg(float(t.pitch)),"bank_deg":rad_to_deg(float(t.bank)),"energy_j":t.energy,"grounded":t.grounded,"clearance_m":clearance,"controls":last_controls.duplicate()})

func _process(_dt: float) -> void:
 if not running or finished: return
 var now_us: int = Time.get_ticks_usec()
 process_callbacks += 1
 var sample_ms: float = (now_us-previous_frame_us)/1000.0 if previous_frame_us > 0 else 0.0
 previous_frame_us = now_us
 if sample_ms > 0: frame_ms.append(sample_ms)
 process_ms.append(Performance.get_monitor(Performance.TIME_PROCESS)*1000.0)
 physics_ms.append(Performance.get_monitor(Performance.TIME_PHYSICS_PROCESS)*1000.0)
 if not smoke:
  var viewport: RID = get_viewport().get_viewport_rid()
  render_cpu_ms.append(RenderingServer.viewport_get_measured_render_time_cpu(viewport))
  var gpu: float = RenderingServer.viewport_get_measured_render_time_gpu(viewport)
  if gpu > 0: gpu_ms.append(gpu)
  draw_calls.append(Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME))
 var now: float = _elapsed()
 if now-checkpoint_time >= 10:
  checkpoint_time = now
  _write_json(output+".progress.json",{"status":"running","elapsed_wall_seconds":now,"frames":frame_ms.size(),"physics_callbacks":physics_ticks,"airborne_simulated_seconds":airborne_seconds,"last_trace":trace[-1] if not trace.is_empty() else {}})
  print("QUALITY PROGRESS ",JSON.stringify({"seconds":now,"frames":frame_ms.size(),"airborne_seconds":airborne_seconds,"last":trace[-1] if not trace.is_empty() else {}}))
 if now >= requested_seconds:
  _finish("requested_duration_reached",true)

func _axis(negative: String, positive: String, value: float) -> void:
 Input.action_release(negative)
 Input.action_release(positive)
 if value > .001: Input.action_press(positive,minf(1,value))
 elif value < -.001: Input.action_press(negative,minf(1,-value))

func _release_controls() -> void:
 for action in ACTIONS:
  if InputMap.has_action(action): Input.action_release(action)

func _elapsed() -> float:
 return (Time.get_ticks_usec()-started_us)/1000000.0 if started_us > 0 else 0.0

static func percentile(values: Array[float], quantile: float) -> float:
 if values.is_empty(): return 0
 var sorted: Array[float] = values.duplicate()
 sorted.sort()
 var where: float = clampf(quantile,0,1)*(sorted.size()-1)
 var lower: int = int(floor(where))
 var upper: int = int(ceil(where))
 return lerpf(sorted[lower],sorted[upper],where-lower)

static func summarize(values: Array[float]) -> Dictionary:
 if values.is_empty(): return {"count":0,"available":false}
 var total: float = 0
 for value in values: total += value
 return {"available":true,"count":values.size(),"mean":total/values.size(),"p50":percentile(values,.5),"p95":percentile(values,.95),"p99":percentile(values,.99),"maximum":values.max()}

func _finish(reason: String, completed: bool) -> void:
 if finished: return
 finished = true
 running = false
 set_process(false)
 set_physics_process(false)
 _release_controls()
 var duration: float = _elapsed()
 var fps: Array[float] = []
 for value in frame_ms:
  if value > 0: fps.append(1000.0/value)
 var pacing: Dictionary = summarize(frame_ms)
 var fps_at_pacing: Dictionary = {}
 for key in ["p50","p95","p99"]:
  fps_at_pacing[key] = 1000.0/pacing[key] if pacing.get(key,0) > 0 else 0
 var interval_span: float = 0
 for value in frame_ms: interval_span += value/1000.0
 var average_fps: float = frame_ms.size()/interval_span if interval_span > 0 else 0
 var full_duration: bool = duration >= 600 and requested_seconds >= 600
 var real_gpu: bool = not smoke and resolution_proof.get("verified",false)
 var sustained_flight: bool = takeoff_seconds >= 0 and airborne_seconds >= requested_seconds*.8
 var performance_target: bool = average_fps >= 60 and fps_at_pacing.get("p95",0) >= 60
 var qualified: bool = completed and full_duration and real_gpu and sustained_flight and performance_target
 var final_state: Dictionary = {}
 if is_instance_valid(app) and app.get("aircraft") != null:
  var last: Dictionary = app.aircraft.telemetry()
  var p: Vector3 = last.position
  final_state = {"position":[p.x,p.y,p.z],"speed":last.speed,"energy_j":last.energy,"grounded":last.grounded,"crashed":last.crashed,"simulated_seconds":last.elapsed,"crash_message":last.crash_message}
 var result = {
  "schema_version":1,"status":"headless_smoke_complete" if smoke and completed else ("completed" if completed else "failed"),"reason":reason,
  "gpu_1080p_10min_128part_60fps_qualified":qualified,"smoke_only":smoke,"requested_wall_seconds":requested_seconds,"elapsed_wall_seconds":duration,
  "measured_process_callbacks":process_callbacks,"measured_frame_intervals":frame_ms.size(),"frame_interval_span_seconds":interval_span,"measured_rendered_frames":Engine.get_frames_drawn()-initial_drawn_frames if started_us else 0,"physics_callbacks":physics_ticks,"engine_physics_frames":Engine.get_physics_frames()-initial_physics_frames if started_us else 0,
  "average_fps":average_fps,"frame_time_ms":pacing,"instantaneous_fps":summarize(fps),"fps_at_frame_time_percentiles":fps_at_pacing,
  "process_cpu_ms":summarize(process_ms),"physics_process_cpu_ms":summarize(physics_ms),"viewport_render_cpu_ms":summarize(render_cpu_ms),"viewport_gpu_ms":summarize(gpu_ms),"draw_calls_per_frame":summarize(draw_calls),
  "takeoff_wall_seconds":takeoff_seconds,"airborne_simulated_seconds":airborne_seconds,"max_clearance_m":max_clearance,"final_aircraft_state":final_state,"flight_trace_1hz":trace,
  "gates":{"completed_requested_duration":completed,"full_ten_minutes":full_duration,"actual_1920x1080_gpu_image":real_gpu,"sustained_flight":sustained_flight,"average_and_p95_at_least_60fps":performance_target},
  "viewport_proof":resolution_proof,"workload":configuration,"hardware":hardware,
  "runtime":{"engine":Engine.get_version_info(),"os":OS.get_name(),"display_server":DisplayServer.get_name(),"renderer":RenderingServer.get_current_rendering_method(),"driver":RenderingServer.get_current_rendering_driver_name(),"gpu":RenderingServer.get_video_adapter_name(),"gpu_vendor":RenderingServer.get_video_adapter_vendor(),"gpu_api":RenderingServer.get_video_adapter_api_version(),"physics_hz":Engine.physics_ticks_per_second,"time_scale":Engine.time_scale,"max_fps":Engine.max_fps,"window_size":[get_tree().root.size.x,get_tree().root.size.y],"content_scale_size":[get_tree().root.content_scale_size.x,get_tree().root.content_scale_size.y],"vsync_disabled_for_gpu_test":not smoke,"audio_driver":AudioServer.get_driver_name(),"master_muted":AudioServer.is_bus_mute(0)},
  "notes":["Frame percentiles use measured wall intervals between process callbacks; p95/p99 frame times express slow-frame pacing.","Instantaneous FPS percentiles are direct reciprocals per frame; fps_at_frame_time_percentiles gives the corresponding slow-frame FPS.","CPU monitors are Godot Performance last-frame process/physics values, sampled each process callback. GPU measurements are renderer-native viewport timestamps when supported.","A smoke run cannot qualify GPU performance. This workload is automated Input guidance, not human handling acceptance."]}
 var write_error: Error = _write_json(output,result)
 print("QUALITY BENCHMARK RESULT ",JSON.stringify({"status":result.status,"reason":reason,"qualified":qualified,"frames":frame_ms.size(),"seconds":duration,"average_fps":average_fps,"output":output,"write_error":error_string(write_error)}))
 call_deferred("_shutdown",0 if completed and write_error==OK else 2)

func _shutdown(exit_code: int) -> void:
 var tree: SceneTree = get_tree()
 # Let Main release native audio/scene resources before the engine tears down.
 # Reparent the test node so its cleanup coroutine survives Main being freed.
 if is_instance_valid(app):
  reparent(tree.root)
  app.queue_free()
 await tree.process_frame
 await tree.process_frame
 # Dummy still has an audio mixer thread; let stopped WAV playbacks drain.
 await tree.create_timer(.15).timeout
 tree.quit(exit_code)

static func _write_json(path_value: String, data: Dictionary) -> Error:
 var directory_error: Error = DirAccess.make_dir_recursive_absolute(path_value.get_base_dir())
 if directory_error != OK: return directory_error
 var file: FileAccess = FileAccess.open(path_value+".tmp",FileAccess.WRITE)
 if file == null: return FileAccess.get_open_error()
 file.store_string(JSON.stringify(data,"  ",true,true))
 file.flush()
 var error: Error = file.get_error()
 file.close()
 if error != OK: return error
 return DirAccess.rename_absolute(path_value+".tmp",path_value)
