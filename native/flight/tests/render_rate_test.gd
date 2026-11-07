extends SceneTree
# Uses the actual Jolt world and Aircraft implementation; no production shortcuts.
const BP = preload("res://core/blueprint.gd")
const RATES: Array[int] = [15,30,60,144]
const TRAJECTORY_STEPS: int = 150
var checks: int = 0
var failures: int = 0

class FreeBody:
 extends RigidBody3D
 var force_value = Vector3.ZERO
 var torque_value = Vector3.ZERO
 var samples: Array[Dictionary] = []
 var limit: int = 121
 func _integrate_forces(state: PhysicsDirectBodyState3D) -> void:
  if samples.size() >= limit:
   return
  samples.append({"p":state.transform.origin,"v":state.linear_velocity,"w":state.angular_velocity,"dt":state.step})
  state.apply_central_force(force_value)
  state.apply_torque(torque_value)

class InstrumentedAircraft:
 extends "res://game/aircraft.gd"
 var samples: Array[Dictionary] = []
 var render_samples: Array[Dictionary] = []
 var limit: int = 151
 func _integrate_forces(state: PhysicsDirectBodyState3D) -> void:
  if samples.size() >= limit:
   return
  super._integrate_forces(state)
  samples.append({"p":state.transform.origin,"basis":state.transform.basis,"v":state.linear_velocity,"w":state.angular_velocity,"energy":energy,"elapsed":elapsed,"dt":state.step})
 func _process(dt: float) -> void:
  super._process(dt)
  if flying and samples.size() < limit:
   render_samples.append({"step":samples.size(),"p":global_position,"energy":energy})

func _initialize() -> void:
 call_deferred("run")

func check(ok: bool, label: String) -> void:
 checks += 1
 if not ok:
  failures += 1
  printerr("FAIL: ",label)

func near(actual: float, expected: float, tolerance: float, label: String) -> void:
 check(absf(actual-expected) <= tolerance,"%s (actual %.6f expected %.6f tolerance %.6f)" % [label,actual,expected,tolerance])

func body_at(position_value: Vector3, body_mass: float = 12.0) -> FreeBody:
 var body = FreeBody.new()
 body.mass = body_mass
 body.inertia = Vector3(2,3,4)
 body.can_sleep = false
 body.collision_layer = 0
 body.collision_mask = 0
 body.linear_damp_mode = RigidBody3D.DAMP_MODE_REPLACE
 body.angular_damp_mode = RigidBody3D.DAMP_MODE_REPLACE
 body.linear_damp = 0
 body.angular_damp = 0
 var collision = CollisionShape3D.new()
 var shape = BoxShape3D.new()
 shape.size = Vector3.ONE
 collision.shape = shape
 body.add_child(collision)
 root.add_child(body)
 body.global_position = position_value
 return body

func wait_body(body: FreeBody) -> void:
 for _i in range(500):
  if body.samples.size() >= body.limit:
   return
  await physics_frame
 check(false,"free body completed its requested actual Jolt steps")

func wait_aircraft(plane: InstrumentedAircraft) -> void:
 for _i in range(500):
  if plane.samples.size() >= plane.limit:
   return
  await physics_frame
 check(false,"aircraft completed its requested actual Jolt steps")

func run() -> void:
 var old_cap: int = Engine.max_fps
 Engine.max_fps = 144
 check(Engine.physics_ticks_per_second == 120,"project uses fixed 120 Hz physics")
 check(ProjectSettings.get_setting("physics/3d/physics_engine","") == "Jolt Physics","project selects the native Jolt backend")
 check(AudioServer.get_driver_name() == "Dummy" and AudioServer.is_bus_mute(0),"physics verification is silent from startup")
 await test_free_bodies()
 await test_electrical_energy()
 await test_render_rates()
 Engine.max_fps = old_cap
 print("RENDER/RIGID PHYSICS TESTS: %d checks, %d failures" % [checks,failures])
 quit(1 if failures else 0)

func test_free_bodies() -> void:
 # Each body runs in the same real world but collision masks isolate the fixtures.
 var ballistic: FreeBody = body_at(Vector3(30,120,0))
 ballistic.linear_velocity = Vector3(3,5,-4)
 var driven: FreeBody = body_at(Vector3(-30,120,0))
 driven.gravity_scale = 0
 driven.force_value = Vector3(24,0,0)
 driven.torque_value = Vector3(0,0,8)
 var heavy: FreeBody = body_at(Vector3(-60,120,0),24)
 heavy.gravity_scale = 0
 heavy.force_value = Vector3(24,0,0)
 await wait_body(ballistic)
 await wait_body(driven)
 await wait_body(heavy)
 var first: Dictionary = ballistic.samples[0]
 var last: Dictionary = ballistic.samples[-1]
 var dt: float = first.dt
 var duration: float = (ballistic.samples.size()-1)*dt
 near(dt,1.0/120.0,.0000001,"actual Jolt step duration")
 near(duration,1,.00001,"analytic fixture spans one simulated second")
 var delta: Vector3 = last.p-first.p
 var dv: Vector3 = last.v-first.v
 near(dv.y,-9.81*duration,.003,"Jolt gravity changes velocity by g times time")
 near(dv.x,0,.001,"ballistic horizontal velocity remains constant")
 near(dv.z,0,.001,"ballistic forward velocity remains constant")
 near(delta.x,first.v.x*duration,.003,"ballistic horizontal displacement")
 near(delta.z,first.v.z*duration,.003,"ballistic forward displacement")
 # Native semi-implicit integration may differ from continuous position by half a step*g*T.
 near(delta.y,first.v.y*duration-.5*9.81*duration*duration,.05,"ballistic height agrees within one fixed-step integration error")
 var start_energy: float = .5*ballistic.mass*first.v.length_squared()+ballistic.mass*9.81*first.p.y
 var end_energy: float = .5*ballistic.mass*last.v.length_squared()+ballistic.mass*9.81*last.p.y
 check(absf(end_energy-start_energy) < ballistic.mass*9.81*9.81*duration*dt,"ballistic mechanical energy error is bounded by fixed-step truncation")
 var driven_first: Dictionary = driven.samples[0]
 var driven_last: Dictionary = driven.samples[-1]
 var heavy_first: Dictionary = heavy.samples[0]
 var heavy_last: Dictionary = heavy.samples[-1]
 var driven_dv: Vector3 = driven_last.v-driven_first.v
 var heavy_dv: Vector3 = heavy_last.v-heavy_first.v
 near(driven_dv.x,24.0/12.0*duration,.003,"actual central force produces F/m acceleration")
 near(heavy_dv.x,24.0/24.0*duration,.003,"doubling mass halves actual acceleration")
 near(driven_dv.x/heavy_dv.x,2,.003,"inverse mass response measured across two real bodies")
 near((driven_last.w-driven_first.w).z,8.0/4.0*duration,.003,"actual torque follows specified principal inertia")
 near(driven_last.w.x,0,.001,"principal torque introduces no spurious x rotation")
 near(driven_last.w.y,0,.001,"principal torque introduces no spurious y rotation")
 var translation_work: float = driven.force_value.dot(driven_last.p-driven_first.p)
 var kinetic_gain: float = .5*driven.mass*(driven_last.v.length_squared()-driven_first.v.length_squared())
 check(absf(translation_work-kinetic_gain) <= driven.force_value.length()*driven_last.v.length()*dt,"measured force work matches translational energy to fixed-step error")
 print("RIGID SAMPLES ",JSON.stringify({"dt":dt,"ballistic_dy":delta.y,"gravity_dvy":dv.y,"force_dvx":driven_dv.x,"heavy_dvx":heavy_dv.x,"torque_dwz":(driven_last.w-driven_first.w).z}))
 ballistic.queue_free()
 driven.queue_free()
 heavy.queue_free()
 await process_frame

func motor_fixture() -> Dictionary:
 return {"version":1,"name":"Energy fixture","paint":"ffffff","parts":[{"id":"c","kind":"cockpit","p":[0,0,0],"r":[0,0,0]},{"id":"b","kind":"battery","p":[0,0,.9],"r":[0,0,0]},{"id":"m","kind":"motor","p":[0,0,-1.05],"r":[0,0,0]}]}

func test_electrical_energy() -> void:
 var plane = InstrumentedAircraft.new()
 plane.limit = 121
 root.add_child(plane)
 plane.configure(motor_fixture(),0)
 plane.gravity_scale = 0
 plane.launch(Vector3(0,200,0))
 plane.throttle = .6
 await wait_aircraft(plane)
 var first: Dictionary = plane.samples[0]
 var last: Dictionary = plane.samples[-1]
 var duration: float = last.elapsed-first.elapsed
 # At <=6m/s the specified 39N drive has a 6m/s propulsive power floor,
 # 72% efficiency, and 20W*throttle overhead: exactly 337W.
 check(last.v.length() < 6,"energy fixture stays within known constant-power-floor regime")
 near(first.energy-last.energy,337.0*duration,.02,"actual aircraft energy integrates specified electrical power at physics dt")
 var gained: float = .5*plane.mass*(last.v.length_squared()-first.v.length_squared())
 var electrical: float = first.energy-last.energy
 check(gained > 1 and gained <= .72*electrical+.05,"actual Jolt kinetic gain is positive and bounded by consumed electrical energy")
 check(last.v.z < first.v.z and absf(last.v.x)<.001 and absf(last.v.y)<.001,"aligned real propulsion accelerates along aircraft forward axis")
 plane.queue_free()
 await process_frame
 var tiny = InstrumentedAircraft.new()
 tiny.limit = 31
 root.add_child(tiny)
 tiny.configure(motor_fixture(),0)
 tiny.gravity_scale = 0
 tiny.launch(Vector3(0,200,0))
 tiny.throttle = 1
 tiny.energy = 1
 await wait_aircraft(tiny)
 var tiny_last: Dictionary = tiny.samples[-1]
 near(tiny.energy,0,.000001,"a real partly funded physics step exhausts its one joule without going negative")
 var tiny_kinetic: float = .5*tiny.mass*tiny_last.v.length_squared()
 check(tiny_last.v.z < 0 and tiny_kinetic <= .72+.001,"partly funded propulsion yields bounded real motion, not free thrust")
 var middle: Dictionary = tiny.samples[10]
 check(tiny_last.v.length() <= middle.v.length()+.00001,"exhausted real propulsion cannot keep accelerating the body")
 tiny.queue_free()
 await process_frame

func test_render_rates() -> void:
 var baseline: Array[Dictionary] = []
 var frame_counts: Array[int] = []
 for rate in RATES:
  Engine.max_fps = rate
  var plane = InstrumentedAircraft.new()
  plane.limit = TRAJECTORY_STEPS+1
  root.add_child(plane)
  plane.configure(BP.starter(),2)
  plane.launch(Vector3(0,180,0))
  plane.throttle = .82
  plane.controls = Vector3(.05,.3,-.15)
  plane.wind = Vector3(1,0,-.4)
  await wait_aircraft(plane)
  check(not plane.crashed,"render-rate fixture remains a real airborne aircraft at %d fps" % rate)
  frame_counts.append(plane.render_samples.size())
  if baseline.is_empty():
   baseline = plane.samples.duplicate(true)
  else:
   for index in [30,60,90,120,150]:
    var reference: Dictionary = baseline[index]
    var current: Dictionary = plane.samples[index]
    check(current.p.distance_to(reference.p) < .002,"same physics-step aircraft position at %d fps, tick %d" % [rate,index])
    check(current.v.distance_to(reference.v) < .002,"same physics-step aircraft velocity at %d fps, tick %d" % [rate,index])
    check(current.w.distance_to(reference.w) < .002,"same physics-step aircraft angular velocity at %d fps, tick %d" % [rate,index])
    check(current.basis.is_equal_approx(reference.basis),"same physics-step aircraft attitude at %d fps, tick %d" % [rate,index])
    near(current.energy,reference.energy,.02,"same physics-step energy at %d fps, tick %d" % [rate,index])
    near(current.elapsed,reference.elapsed,.000001,"same physics-step elapsed time at %d fps, tick %d" % [rate,index])
  var final: Dictionary = plane.samples[-1]
  print("RATE SAMPLE ",JSON.stringify({"process_cap":rate,"actual_process_samples":plane.render_samples.size(),"physics_samples":plane.samples.size(),"elapsed":final.elapsed,"position":[final.p.x,final.p.y,final.p.z],"velocity":[final.v.x,final.v.y,final.v.z],"energy":final.energy}))
  plane.queue_free()
  await process_frame
 check(frame_counts[-1] > frame_counts[0]*3,"different caps actually produced substantially different process sampling frequencies")
 # A maximum FPS is a cap, not a promise from a virtual/shared machine.
 # Require real samples and the >3x observed ratio above, not an absolute144Hz yield.
 check(frame_counts[0] >= 10 and frame_counts[-1] >= frame_counts[0]*3,"low and high process loops both sampled the real flight")
