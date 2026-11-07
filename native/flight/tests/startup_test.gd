extends SceneTree
var failures=0
func _initialize():call_deferred("run")
func check(value,label):
	if not value:failures+=1;printerr("FAIL ",label)
func run():
	var app=load("res://game/main.tscn").instantiate()
	root.add_child(app)
	for i in range(6):await process_frame
	var viewport=Rect2(Vector2.ZERO,app.ui.size)
	var names=["LaunchButton","Objective","FlightInstruments","HangarButton"]
	var bounds={}
	for name_value in names:
		var item=app.find_child(name_value,true,false)
		var rect=item.get_global_rect()
		bounds[name_value]={"x":rect.position.x,"y":rect.position.y,"w":rect.size.x,"h":rect.size.y}
		check(viewport.encloses(rect),name_value+" stays inside the native viewport")
	check(AudioServer.get_driver_name()=="Dummy" and AudioServer.is_bus_mute(0),"silent output before audio playback")
	check(app.aircraft.get_node("part_00").get_child_count()>0,"actual aircraft art instantiated")
	print(JSON.stringify({"bounds":bounds,"viewport":[app.ui.size.x,app.ui.size.y],"audio_driver":AudioServer.get_driver_name(),"muted":AudioServer.is_bus_mute(0),"audio_events":app.audio_events}))
	print("Startup checks: ",6-failures,"/6")
	app.queue_free()
	for i in range(3):await process_frame
	OS.delay_msec(250)
	await process_frame
	quit(1 if failures else 0)
