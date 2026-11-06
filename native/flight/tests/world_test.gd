extends SceneTree
const WorldType=preload("res://game/world.gd")
const Contracts=preload("res://core/contracts.gd")
var failures=0
func _initialize():call_deferred("run")
func run():
	var world=WorldType.new()
	root.add_child(world)
	for i in range(3):await physics_frame
	for contract in Contracts.all():
		var key="harbour" if contract.id!="ridge_run" else "ridge"
		var pad=world.get_node_or_null("DeliveryPad_"+key)
		if pad==null:
			failures+=1;printerr("FAIL destination has a visible matching delivery pad: ",contract.id)
			continue
		if Vector2(pad.global_position.x-contract.destination.x,pad.global_position.z-contract.destination.z).length()>.01:
			failures+=1;printerr("FAIL visible pad and actual cargo destination disagree")
		if absf(pad.get_meta("radius")-contract.pad_radius)>.01:
			failures+=1;printerr("FAIL visible pad aperture and acceptance radius disagree")
	print("World delivery checks: ",3-failures,"/3")
	world.queue_free()
	await process_frame
	quit(1 if failures else 0)
