extends SceneTree
# Controlled airborne initial condition; all subsequent motion comes from forces.
const Aircraft=preload("res://game/aircraft.gd")
const BP=preload("res://core/blueprint.gd")
var failures=0
func _initialize():call_deferred("run")
func check(ok,label):
 if not ok:failures+=1;printerr("FAIL ",label)
func run():
 var plane=Aircraft.new();root.add_child(plane);plane.configure(BP.starter(),2)
 var nose_up=Basis(Vector3.RIGHT,deg_to_rad(22))
 plane.global_transform=Transform3D(nose_up*plane.properties.axes,Vector3(0,220,0)+nose_up*plane.properties.com)
 plane.flying=true;plane.freeze=false;plane.throttle=1
 plane.linear_velocity=Vector3(0,0,-8)
 var entered_stall=false
 for i in range(30):
  await physics_frame
  entered_stall=entered_stall or plane.stalled
 check(entered_stall,"controlled low-speed high-angle condition actually stalls")
 plane.controls=Vector3(-1,0,0)
 var recovered=false
 var samples=[]
 for i in range(1440):
  await physics_frame
  if i==480:plane.controls=Vector3.ZERO
  if i%120==0:samples.append({"t":plane.elapsed,"speed":plane.linear_velocity.length(),"pitch":rad_to_deg(plane.telemetry().pitch),"stall":plane.stalled,"alt":plane.craft_origin().y})
  if i>120 and not plane.stalled and plane.linear_velocity.length()>11:recovered=true
 check(recovered and not plane.crashed,"lowering the nose with real control surfaces and power recovers the trainer")
 check(not plane.stalled and plane.craft_origin().y>100,"recovery returns to stable flight with altitude remaining")
 check(plane.energy<plane.capacity and plane.energy>0,"stall recovery consumes battery energy")
 print("STALL_RECOVERY ",JSON.stringify(samples))
 print("Stall recovery checks: ",4-failures,"/4")
 plane.queue_free();await process_frame;quit(1 if failures else 0)
