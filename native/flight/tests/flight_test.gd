extends SceneTree
const AircraftType = preload("res://game/aircraft.gd")
const BP = preload("res://core/blueprint.gd")
var failures = 0
func visual_bounds(node:Node)->AABB:
	var result=AABB()
	var first=true
	for child in node.find_children("*","MeshInstance3D",true,false):
		if child.mesh:
			var bounds=child.global_transform*child.mesh.get_aabb()
			if first:result=bounds;first=false
			else:result=result.merge(bounds)
	return result
func check(ok,label):
	if not ok:
		failures+=1
		printerr("FAIL ",label)
func _initialize():
	call_deferred("run")
func run():
	var plane = AircraftType.new()
	root.add_child(plane)
	plane.configure(BP.starter(),18)
	plane.place(Vector3(0,80,0))
	var t = plane.telemetry()
	check(abs(t.mass-35.3)<.001,"payload contributes real body mass")
	check(t.has_cargo,"loaded payload is present")
	var cargo_bounds=visual_bounds(plane.get_node("Payload"))
	check(cargo_bounds.get_center().distance_to(t.cargo_world_position)<.002,"visible cargo centre matches its physical centre")
	check(cargo_bounds.size.distance_to(Vector3(.8,.65,.85))<.002,"visible cargo matches its collision dimensions")
	check(plane.inertia.x>0 and plane.inertia.y>0 and plane.inertia.z>0,"native rigid body has nonzero principal inertias")
	check(t.cargo_world_position.distance_to(Vector3(0,79.70,.45))<.001,"principal frame preserves actual cargo world position")
	plane.launch(Vector3(0,80,0))
	plane.throttle=1
	for i in range(120): await physics_frame
	check(plane.energy<120000 and plane.energy>0,"active propulsion consumes real battery")
	check(plane.linear_velocity.z<-.1,"motor accelerates the real rigid body forward")
	var before=plane.energy
	plane.energy=0
	for i in range(12): await physics_frame
	check(plane.energy==0,"empty battery cannot become negative")
	plane.set_paused(true)
	var paused=plane.global_transform
	for i in range(12): await physics_frame
	check(plane.global_position.distance_to(paused.origin)<.001,"pause preserves rigid-body position")
	check(AudioServer.get_driver_name()=="Dummy" and AudioServer.is_bus_mute(0),"native runtime remains silent")
	print("Flight assertions: ",11-failures,"/11")
	plane.queue_free()
	await process_frame
	quit(1 if failures else 0)
