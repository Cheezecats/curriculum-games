extends SceneTree
const Aero = preload("res://core/aerodynamics.gd")
var failures = 0
func check(ok, label):
	if not ok:
		failures += 1
		printerr("FAIL ", label)
func _initialize():
	var drag = Aero.surface_force(Vector3(0,0,-20), Basis.IDENTITY, 2.0, 0.0, false)
	check(drag.force.dot(Vector3(0,0,-20)) < -1.0, "drag must dissipate air-relative energy")
	check(drag.force.y > 1.0, "positive wing incidence creates lift")
	var reverse = Aero.surface_force(Vector3(0,0,20), Basis.IDENTITY, 2.0, 0.0, false)
	check(reverse.force.dot(Vector3(0,0,20)) <= 0.0001, "reverse airflow cannot create energy")
	var still = Aero.surface_force(Vector3.ZERO, Basis.IDENTITY, 2.0, .3, false)
	check(still.force.length() < .00001, "stationary wings create no lift")
	var stall = Aero.surface_force(Vector3(0,-15,-10), Basis.IDENTITY, 2.0, 0.0, false)
	check(stall.stall, "high incidence reports the actual stall")
	var empty = Aero.engine_force(1.0, 65.0, 20.0, 0.0, 1.0/120)
	check(empty.thrust == 0 and empty.used == 0, "empty battery cuts thrust")
	var partial = Aero.engine_force(1.0,65.0,20.0,1.0,1.0)
	check(abs(partial.used-1.0)<.00001 and partial.thrust>0 and partial.thrust<65, "partial energy scales force instead of creating energy")
	var work = partial.thrust*20.0
	check(work <= partial.used*.72+.0001, "engine work cannot exceed electrical energy")
	var before_stall=Aero.surface_force(Vector3(0,-sin(.229)*20,-cos(.229)*20),Basis.IDENTITY,2.0,0.0,false)
	var after_stall=Aero.surface_force(Vector3(0,-sin(.231)*20,-cos(.231)*20),Basis.IDENTITY,2.0,0.0,false)
	check(before_stall.force.distance_to(after_stall.force)<before_stall.force.length()*.10,"stall transition remains continuous and controllable")
	print("Aero assertions: ", 9-failures, "/9")
	quit(1 if failures else 0)
