extends SceneTree
var failures=0
func _initialize():call_deferred("run")
func check(value,label):
	if not value:failures+=1;printerr("FAIL ",label)
func run():
	var app=load("res://game/main.tscn").instantiate()
	root.add_child(app)
	for i in range(4):await physics_frame
	var from=Vector3(80,40,430)
	var hit=app.get_world_3d().direct_space_state.intersect_ray(PhysicsRayQueryParameters3D.create(from,Vector3(80,0,430),1))
	check(not hit.is_empty(),"runway ground is physically hittable from above")
	print("GROUND ",str(hit))
	app.start_flight()
	Input.action_press("throttle_up")
	var samples=[]
	var took_off=false
	var stable_gear=false
	for i in range(3600):
		await physics_frame
		if i==360:Input.action_release("throttle_up")
		if i==780:Input.action_press("pitch_up")
		if i==1200:Input.action_release("pitch_up")
		var t=app.aircraft.telemetry()
		if i>60 and t.grounded:stable_gear=true
		if i>120 and not t.grounded and t.position.y>18:took_off=true
		if i%120==0:samples.append({"t":t.elapsed,"p":[t.position.x,t.position.y,t.position.z],"v":t.speed,"pitch":rad_to_deg(t.pitch),"bank":rad_to_deg(t.bank),"ground":t.grounded,"energy":t.energy,"crashed":t.crashed})
	check(stable_gear,"landing gear supports a real ground start")
	check(took_off,"starter can take off from ground with real thrust")
	check(not app.aircraft.crashed,"starter survives a straight takeoff")
	check(not app.aircraft.grounded and app.aircraft.craft_origin().y>app.world.terrain_height(app.aircraft.craft_origin().x,app.aircraft.craft_origin().z)+5,"neutral flight assistance maintains usable ground clearance after takeoff")
	print(JSON.stringify({"samples":samples,"final":str(app.aircraft.telemetry())}))
	print("Handling checks: ",5-failures,"/5")
	app.queue_free()
	await process_frame
	OS.delay_msec(250)
	await process_frame
	quit(1 if failures else 0)
