extends RigidBody3D
const Parts = preload("res://core/parts.gd")
const BP = preload("res://core/blueprint.gd")
const Mass = preload("res://core/mass_properties.gd")
const Aero = preload("res://core/aerodynamics.gd")
var blueprint: Dictionary = {}
var properties: Dictionary = {}
var cargo_mass = 0.0
var energy = 0.0
var capacity = 0.0
var throttle = 0.0
var controls = Vector3.ZERO
var brake = false
var flying = false
var crashed = false
var grounded = false
var stalled = false
var elapsed = 0.0
var peak_height = 0.0
var wind = Vector3.ZERO
var force_samples: Array = []
var crash_message = ""
var launch_origin = Vector3.ZERO
var previous_velocity = Vector3.ZERO
var pitch_command = 0.0
var roll_command = 0.0
var yaw_command = 0.0
var _part_nodes: Dictionary = {}
var _pause_velocity = Vector3.ZERO
var _pause_angular = Vector3.ZERO
var _selected = ""
signal impact(message)

func _ready():
	freeze = true
	continuous_cd = true
	can_sleep = false
	contact_monitor = true
	max_contacts_reported = 12
	collision_layer = 2
	collision_mask = 1
	linear_damp_mode = RigidBody3D.DAMP_MODE_REPLACE
	angular_damp_mode = RigidBody3D.DAMP_MODE_REPLACE
	linear_damp = 0.0
	angular_damp = 0.0
	var material = PhysicsMaterial.new()
	material.friction = .35
	material.bounce = .08
	physics_material_override = material

func configure(bp: Dictionary, payload = 0.0):
	flying = false
	freeze = true
	blueprint = bp.duplicate(true)
	cargo_mass = payload
	properties = Mass.compute(bp, cargo_mass)
	if properties.is_empty():
		push_error("Invalid aircraft assembly")
		return
	for child in get_children():
		child.free()
	_part_nodes.clear()
	mass = properties.mass
	center_of_mass_mode = RigidBody3D.CENTER_OF_MASS_MODE_CUSTOM
	center_of_mass = Vector3.ZERO
	inertia = properties.principal
	capacity = 0.0
	var inverse: Basis = properties.axes.transposed()
	for part in blueprint.parts:
		var def = Parts.definition(part.kind)
		capacity += def.energy
		var transform_part = Transform3D(inverse * BP.basis(part), inverse * (BP.position(part) - properties.com))
		var shape = BoxShape3D.new()
		shape.size = def.size if part.kind != "gear" else Vector3(.2,.15,.3)
		var collision = CollisionShape3D.new()
		collision.shape = shape
		collision.transform = transform_part
		add_child(collision)
		var visual = _model(part.kind, def.size)
		visual.name = part.id
		visual.transform = transform_part
		visual.set_meta("part_id", part.id)
		add_child(visual)
		_part_nodes[part.id] = visual
	if cargo_mass > 0:
		var cargo = Node3D.new()
		cargo.name = "Payload"
		cargo.position = inverse * (properties.cargo_position - properties.com)
		cargo.basis = inverse
		add_child(cargo)
		var model = _model("crate",Vector3(.8,.65,.85))
		var bounds = _model_bounds(model)
		var cargo_size:Vector3 = properties.cargo_size
		var scale_value = cargo_size / bounds.size
		model.scale = scale_value
		model.position = -(bounds.position+bounds.size*.5)*scale_value
		cargo.add_child(model)
		var box = CollisionShape3D.new()
		var shape = BoxShape3D.new()
		shape.size = properties.cargo_size
		box.shape = shape
		box.position = inverse * (properties.cargo_position-properties.com)
		box.basis = inverse
		add_child(box)
	energy = capacity
	throttle = 0.0
	crashed = false
	crash_message = ""
	elapsed = 0.0
	grounded = false
	previous_velocity = Vector3.ZERO
	paint(Color("#"+blueprint.paint))

func _model(kind: String, size: Vector3) -> Node3D:
	var path = "res://assets/models/%s.glb" % kind
	if not ResourceLoader.exists(path):
		path = "res://assets/environment/%s.glb" % kind
	if ResourceLoader.exists(path):
		var packed = load(path)
		if packed is PackedScene:
			return packed.instantiate()
	var holder = Node3D.new()
	var mesh = MeshInstance3D.new()
	var box = BoxMesh.new()
	box.size = size
	mesh.mesh = box
	var mat = StandardMaterial3D.new()
	mat.albedo_color = Color("d6d6ca")
	mesh.material_override = mat
	holder.add_child(mesh)
	return holder

func _model_bounds(node: Node3D) -> AABB:
	var result = {"bounds":AABB(),"first":true}
	_collect_bounds(node,Transform3D.IDENTITY,result)
	return result.bounds

func _collect_bounds(node: Node, transform_value:Transform3D,result:Dictionary):
	if node is Node3D:transform_value=transform_value*node.transform
	if node is MeshInstance3D and node.mesh:
		var bounds=transform_value*node.mesh.get_aabb()
		if result.first:result.bounds=bounds;result.first=false
		else:result.bounds=result.bounds.merge(bounds)
	for child in node.get_children():_collect_bounds(child,transform_value,result)

func craft_basis() -> Basis:
	return global_basis * properties.get("axes",Basis.IDENTITY).transposed()

func craft_origin() -> Vector3:
	return global_position - craft_basis() * properties.get("com",Vector3.ZERO)

func place(origin: Vector3, heading = 0.0):
	var b = Basis(Vector3.UP,heading)
	global_transform = Transform3D(b * properties.get("axes",Basis.IDENTITY),origin + b * properties.get("com",Vector3.ZERO))
	linear_velocity = Vector3.ZERO
	angular_velocity = Vector3.ZERO

func launch(origin: Vector3, heading = 0.0):
	place(origin,heading)
	launch_origin = origin
	crashed = false
	elapsed = 0.0
	energy = capacity
	flying = true
	freeze = false

func set_paused(value: bool):
	if value:
		_pause_velocity = linear_velocity
		_pause_angular = angular_velocity
		freeze = true
	elif flying and not crashed:
		freeze = false
		linear_velocity = _pause_velocity
		angular_velocity = _pause_angular

func paint(color: Color):
	for visual in _part_nodes.values():
		_paint_node(visual, color)

func _paint_node(node: Node, color: Color):
	if node is MeshInstance3D and node.mesh:
		for surface in range(node.mesh.get_surface_count()):
			var mat = node.get_active_material(surface)
			if mat is StandardMaterial3D and ("paint" in mat.resource_name.to_lower() or node.name.to_lower().contains("paint")):
				var copy = mat.duplicate()
				copy.albedo_color = color
				node.set_surface_override_material(surface,copy)
	for child in node.get_children():
		_paint_node(child,color)

func _integrate_forces(state: PhysicsDirectBodyState3D):
	if not flying or crashed or properties.is_empty(): return
	var dt = state.step
	elapsed += dt
	var cb: Basis = state.transform.basis * properties.axes.transposed()
	var origin: Vector3 = state.transform.origin - cb * properties.com
	var forward = -cb.z
	var speed = (state.linear_velocity-wind).length()
	var pitch = asin(clampf(forward.y,-1.0,1.0))
	var bank = atan2(cb.x.y,cb.y.y)
	var angular = cb.transposed() * state.angular_velocity
	var desired_pitch = .11 + controls.x * .24
	pitch_command = clampf((desired_pitch-pitch)*3.8-angular.x*1.0,-1,1)
	roll_command = clampf((-controls.z*.65-bank)*2.3-angular.z*.60,-1,1)
	var desired_yaw_rate = -controls.y*.45 + tan(clampf(bank,-.7,.7))*9.81/maxf(speed,12.0)
	yaw_command = clampf(-(desired_yaw_rate-angular.y)*1.1,-1,1)
	force_samples.clear()
	stalled = false
	var engine_requests: Array = []
	var total_energy = 0.0
	for part in blueprint.parts:
		var def = Parts.definition(part.kind)
		var pos: Vector3 = BP.position(part)
		var offset: Vector3 = cb * (pos-properties.com)
		var local_velocity: Vector3 = state.linear_velocity + state.angular_velocity.cross(offset) - wind
		var axes: Basis = cb * BP.basis(part)
		var deflection = 0.0
		if part.kind == "elevator": deflection = -pitch_command*.36
		if part.kind == "aileron": deflection = roll_command*signf(pos.x)*.30
		if part.kind == "rudder": deflection = yaw_command*.30
		if def.area > 0:
			var aero = Aero.surface_force(local_velocity,axes,def.area,deflection,part.kind=="rudder")
			state.apply_force(aero.force,offset)
			if part.kind in ["wing","large_wing"]:
				stalled = stalled or (aero.stall and speed>6)
				force_samples.append({"p":origin+cb*pos,"f":aero.force})
		else:
			var v = local_velocity.length()
			if v>0.01:
				var area = def.size.x*def.size.y
				var drag = -local_velocity * v * (.5*1.225*area*def.get("drag",.14))
				state.apply_force(drag,offset)
		if def.thrust > 0:
			var request = Aero.engine_force(throttle,def.thrust,local_velocity.dot(-axes.z),1e15,dt)
			engine_requests.append({"p":offset,"direction":-axes.z,"thrust":request.thrust})
			total_energy += request.used
	var fraction = minf(1.0,energy/total_energy) if total_energy>0 else 0.0
	energy = maxf(0.0,energy-total_energy*fraction)
	for request in engine_requests:
		state.apply_force(request.direction*request.thrust*fraction,request.p)
	if cargo_mass > 0:
		var offset: Vector3 = cb*(properties.cargo_position-properties.com)
		var v: Vector3 = state.linear_velocity+state.angular_velocity.cross(offset)-wind
		var cargo_size:Vector3=properties.cargo_size
		state.apply_force(-v*v.length()*(.5*1.225*cargo_size.x*cargo_size.y*.45),offset)
	grounded = false
	for part in blueprint.parts:
		if part.kind != "gear": continue
		var pos: Vector3 = BP.position(part)
		var offset: Vector3 = cb*(pos-properties.com)
		var from: Vector3 = state.transform.origin+offset+cb.y*.32
		var to: Vector3 = from-cb.y*1.03
		var query = PhysicsRayQueryParameters3D.create(from,to,1,[get_rid()])
		var hit = state.get_space_state().intersect_ray(query)
		if hit.is_empty(): continue
		var distance = from.distance_to(hit.position)
		var compression = .83-distance
		if compression <=0: continue
		grounded = true
		var n: Vector3 = hit.normal
		var velocity: Vector3 = state.linear_velocity+state.angular_velocity.cross(offset)
		var normal_force = clampf(compression*1800-velocity.dot(n)*180,0,mass*9.81*2)
		state.apply_force(n*normal_force,offset)
		var steer = clampf(controls.y+controls.z,-1,1)*-.45 if pos.z<0 else 0.0
		var fwd = forward.rotated(cb.y,steer).slide(n).normalized()
		var side = fwd.cross(n).normalized()
		var side_force = clampf(-velocity.dot(side)*mass/(3*dt),-normal_force*.85,normal_force*.85)
		var friction = .75 if brake else .018
		var rolling = clampf(-velocity.dot(fwd)*mass/(3*dt),-normal_force*friction,normal_force*friction)
		state.apply_force(side*side_force+fwd*rolling,offset)
		if -previous_velocity.dot(n)>8:
			_crash("Hard landing · %.1f m/s vertical impact" % -previous_velocity.dot(n))
	for i in range(state.get_contact_count()):
		var normal = state.get_contact_local_normal(i)
		if previous_velocity.length()>11 and absf(previous_velocity.dot(normal))>8.5:
			_crash("Impact · %.1f m/s" % previous_velocity.length())
	if origin.y < .1:
		_crash("Water landing · return to the airfield and try another approach")
	if abs(origin.x)>1100 or abs(origin.z)>1100:
		_crash("Beyond the island region · return to your last launch")
	peak_height = maxf(peak_height,origin.y)
	previous_velocity = state.linear_velocity

func _crash(message: String):
	if crashed: return
	crashed = true
	crash_message = message
	throttle = 0.0
	set_deferred("freeze",true)
	impact.emit(message)

func _process(dt):
	if properties.is_empty(): return
	for part in blueprint.get("parts",[]):
		var node: Node3D = _part_nodes.get(part.id)
		if node == null: continue
		var prop = node.find_child("Propeller",true,false)
		if prop:
			prop.rotate_z(dt*(18+throttle*125) if flying and energy>0 else 0)
		var flap = node.find_child("Flap",true,false)
		if flap:
			if part.kind=="rudder": flap.rotation.y = yaw_command*.30
			elif part.kind=="elevator": flap.rotation.x = -pitch_command*.36
			else: flap.rotation.x = roll_command*signf(BP.position(part).x)*.30
		var wheel = node.find_child("Wheel",true,false)
		if wheel and grounded: wheel.rotate_x(-linear_velocity.length()*dt/.20)

func telemetry() -> Dictionary:
	var basis_craft = craft_basis()
	var origin = craft_origin()
	var pos = origin+basis_craft*properties.get("cargo_position",Vector3.ZERO)
	return {"speed":linear_velocity.length(),"airspeed":(linear_velocity-wind).length(),"altitude":origin.y,"energy":energy,"capacity":capacity,"throttle":throttle,"grounded":grounded,"crashed":crashed,"has_cargo":cargo_mass>0,"cargo_world_position":pos,"mass":mass,"com":properties.get("com",Vector3.ZERO),"pitch":asin(clampf((-basis_craft.z).y,-1,1)),"bank":atan2(basis_craft.x.y,basis_craft.y.y),"stall":stalled,"elapsed":elapsed,"vertical_speed":linear_velocity.y,"position":origin,"distance":Vector2(origin.x-launch_origin.x,origin.z-launch_origin.z).length(),"climb":peak_height-launch_origin.y,"crash_message":crash_message}
