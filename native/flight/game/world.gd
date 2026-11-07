extends Node3D
const HOME = Vector3(80,14,430)
const HARBOUR = Vector3(-430,9,-260)
const RIDGE = Vector3(420,118,-360)
var pads: Dictionary = {"home":HOME,"harbour":HARBOUR,"ridge":RIDGE}
var discoveries: Array = [{"id":"sea_arch","name":"The sea arch","p":Vector3(-580,22,210)},{"id":"old_beacon","name":"The old beacon","p":Vector3(560,60,80)}]
var _materials: Dictionary = {}
var _rng = RandomNumberGenerator.new()
var _batches: Dictionary = {}
var _props_body: StaticBody3D

static func terrain_height(x:float,z:float)->float:
	var d = Vector2(x/690.0,(z-30.0)/660.0).length()
	var base = 18.0+sin(x*.012)*cos(z*.013)*6.0+sin(x*.032+z*.024)*2.2
	base += 112.0*exp(-pow((x-420.0)/215.0,2)-pow((z+350.0)/230.0,2))
	base += 30.0*exp(-pow((x+50.0)/250.0,2)-pow((z+50.0)/240.0,2))
	base = lerpf(base,-18.0,smoothstep(.80,1.08,d))
	for entry in [[HOME,Vector2(65,155)],[HARBOUR,Vector2(60,105)],[RIDGE,Vector2(60,90)]]:
		var p:Vector3=entry[0]
		var radii:Vector2=entry[1]
		var length=Vector2((x-p.x)/radii.x,(z-p.z)/radii.y).length()
		base=lerpf(p.y,base,smoothstep(.78,1.30,length))
	return base

func _ready():
	_rng.seed=89123
	_environment()
	_terrain()
	_water()
	_props_body=StaticBody3D.new()
	add_child(_props_body)
	_airfield(HOME,"ISLAND AIR SERVICE",true)
	_airfield(HARBOUR,"HARBOUR POST",false)
	_airfield(RIDGE,"RIDGE OBSERVATORY",false)
	_forest()
	_settlements()
	_discovery_art()

func _mat(name:String,color:Color,roughness=.8)->StandardMaterial3D:
	if _materials.has(name):return _materials[name]
	var m=StandardMaterial3D.new()
	m.albedo_color=color
	m.roughness=roughness
	_materials[name]=m
	return m

func _environment():
	var environment=WorldEnvironment.new()
	var e=Environment.new()
	e.background_mode=Environment.BG_SKY
	var sky=Sky.new()
	var material=ProceduralSkyMaterial.new()
	material.sky_top_color=Color("5985ac")
	material.sky_horizon_color=Color("c1d9df")
	material.ground_bottom_color=Color("607982")
	material.ground_horizon_color=Color("b6cdd4")
	material.sun_angle_max=12
	material.sky_curve=.18
	sky.sky_material=material
	e.sky=sky
	e.ambient_light_source=Environment.AMBIENT_SOURCE_COLOR
	e.ambient_light_color=Color("b6cedc")
	e.ambient_light_energy=.62
	e.reflected_light_source=Environment.REFLECTION_SOURCE_SKY
	e.tonemap_mode=Environment.TONE_MAPPER_ACES
	e.fog_enabled=true
	e.fog_light_color=Color("c3dce0")
	e.fog_density=.0003
	e.fog_sky_affect=.28
	environment.environment=e
	add_child(environment)
	var sun=DirectionalLight3D.new()
	sun.rotation_degrees=Vector3(-38,-42,0)
	sun.light_color=Color("fff1d8")
	sun.light_energy=1.1
	sun.shadow_enabled=true
	sun.directional_shadow_max_distance=230
	sun.directional_shadow_mode=DirectionalLight3D.SHADOW_PARALLEL_4_SPLITS
	sun.shadow_bias=.04
	add_child(sun)

func _terrain():
	var st=SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var faces=PackedVector3Array()
	var step=12.5
	for iz in range(128):
		for ix in range(128):
			var x=-800+ix*step
			var z=-800+iz*step
			var a=Vector3(x,terrain_height(x,z),z)
			var b=Vector3(x+step,terrain_height(x+step,z),z)
			var c=Vector3(x,terrain_height(x,z+step),z+step)
			var d=Vector3(x+step,terrain_height(x+step,z+step),z+step)
			for v in [a,b,c,b,d,c]:
				var normal=Vector3(terrain_height(v.x-1,v.z)-terrain_height(v.x+1,v.z),2,terrain_height(v.x,v.z-1)-terrain_height(v.x,v.z+1)).normalized()
				var color=Color("6d8b66")
				if v.y<7:color=Color("cfbb90")
				elif normal.y<.86:color=Color("8e9290").lerp(Color("b1afa1"),normal.y)
				elif v.y>95:color=Color("819575")
				var variation=.94+sin(v.x*.1+v.z*.07)*.045
				st.set_color(color*variation)
				st.set_normal(normal)
				st.set_uv(Vector2(v.x,v.z)*.03)
				st.add_vertex(v)
				faces.append(v)
	var node=MeshInstance3D.new()
	node.mesh=st.commit()
	var material=_mat("terrain",Color.WHITE)
	material.vertex_color_use_as_albedo=true
	material.vertex_color_is_srgb=true
	var grain=NoiseTexture2D.new()
	grain.width=256;grain.height=256
	grain.seamless=true
	var noise=FastNoiseLite.new()
	noise.seed=43217;noise.frequency=.07;noise.fractal_octaves=3
	grain.noise=noise
	var ramp=Gradient.new()
	ramp.set_color(0,Color(.73,.76,.70))
	ramp.set_color(1,Color(1,1,1))
	grain.color_ramp=ramp
	material.albedo_texture=grain
	material.uv1_scale=Vector3(3,3,1)
	node.material_override=material
	add_child(node)
	var body=StaticBody3D.new()
	var collision=CollisionShape3D.new()
	var shape=ConcavePolygonShape3D.new()
	shape.set_faces(faces)
	collision.shape=shape
	body.add_child(collision)
	add_child(body)

func _water():
	var mesh=MeshInstance3D.new()
	var plane=PlaneMesh.new()
	plane.size=Vector2(7000,7000)
	plane.subdivide_width=90
	plane.subdivide_depth=90
	mesh.mesh=plane
	mesh.position.y=-.18
	var material=ShaderMaterial.new()
	var shader=Shader.new()
	shader.code="""shader_type spatial;
render_mode cull_disabled;
varying vec3 world;
void vertex(){world=(MODEL_MATRIX*vec4(VERTEX,1.0)).xyz;VERTEX.y+=sin(world.x*.045+TIME*.8)*.15+cos(world.z*.036+TIME*.65)*.12;}
void fragment(){float ripples=sin(world.x*.16+TIME)*cos(world.z*.13+TIME*.7)*.025;float fresnel=pow(1.0-clamp(dot(NORMAL,VIEW),0.0,1.0),3.0);ALBEDO=mix(vec3(.08,.35,.46),vec3(.38,.64,.68),fresnel)+ripples;ROUGHNESS=.25;METALLIC=.25;}
"""
	material.shader=shader
	mesh.material_override=material
	add_child(mesh)

func _box(pos:Vector3,size:Vector3,material:Material,collision=false)->MeshInstance3D:
	var node=MeshInstance3D.new()
	var mesh=BoxMesh.new()
	mesh.size=size
	node.mesh=mesh
	node.position=pos
	node.material_override=material
	add_child(node)
	if collision:
		var body=StaticBody3D.new()
		var c=CollisionShape3D.new()
		var shape=BoxShape3D.new()
		shape.size=size
		c.shape=shape
		body.position=pos
		body.add_child(c)
		add_child(body)
	return node

func _prop(kind:String,pos:Vector3,scale_value=1.0,rotation_value=0.0)->Node3D:
	var path="res://assets/models/%s.glb"%kind
	if not ResourceLoader.exists(path): path="res://assets/environment/%s.glb"%kind
	if not ResourceLoader.exists(path):return null
	var packed=load(path)
	if not packed is PackedScene:return null
	var node=packed.instantiate()
	node.position=pos
	node.scale=Vector3.ONE*scale_value
	node.rotation.y=rotation_value
	add_child(node)
	if kind in ["hangar","tower","lighthouse","rock_arch","fishing_boat"]:
		for piece in node.find_children("*","MeshInstance3D",true,false):
			if piece.mesh:piece.create_trimesh_collision()
	return node

func _airfield(p:Vector3,title:String,home:bool):
	var runway_length=235.0 if home else 145.0
	_box(p+Vector3(0,.04,0),Vector3(20,.12,runway_length),_mat("runway",Color("4b5556")))
	_box(p+Vector3(0,.02,0),Vector3(26,.10,runway_length+8),_mat("runwayedge",Color("bdb6a1")))
	for i in range(int(runway_length/16)):
		_box(p+Vector3(0,.13,-runway_length/2+8+i*16),Vector3(.35,.025,7),_mat("paint",Color("eee9cf")))
	for end in [-1,1]:
		for x in [-7.8,-5.8,-3.8,3.8,5.8,7.8]:
			_box(p+Vector3(x,.14,end*(runway_length/2-12)),Vector3(1.0,.03,12),_materials.paint)
	for z in range(-int(runway_length/2),int(runway_length/2)+1,20):
		for x in [-11.2,11.2]:
			_prop("lamp",p+Vector3(x,0,z),.6)
	_box(p+Vector3(34,.03,26),Vector3(42,.10,50),_mat("apron",Color("8c9389")))
	_prop("hangar",p+Vector3(44,0,34),1.6 if home else 1.0,-PI/2)
	_prop("tower",p+Vector3(34,0,-22),1.1)
	_prop("wind_sock",p+Vector3(-19,0,runway_length/2-25),1.2)
	for i in range(5):
		_prop("crate",p+Vector3(27+i*1.1,0,48),.8)
		_prop("barrel",p+Vector3(30+i*.9,0,51),.9)
	var sign=Label3D.new()
	sign.text=title
	sign.font_size=48
	sign.pixel_size=.008
	sign.modulate=Color("f5edcf")
	sign.position=p+Vector3(36,5,-23)
	sign.billboard=BaseMaterial3D.BILLBOARD_ENABLED
	add_child(sign)
	var ring=MeshInstance3D.new()
	var torus=TorusMesh.new()
	torus.inner_radius=7.7
	torus.outer_radius=8.0
	torus.rings=48
	torus.ring_segments=8
	ring.mesh=torus
	ring.name="DeliveryPad_"+("home" if p==HOME else ("harbour" if p==HARBOUR else "ridge"))
	ring.set_meta("radius",8.0)
	ring.position=p+Vector3(28,.18,10)
	ring.material_override=_mat("delivery",Color("db9c48"))
	add_child(ring)
	# Delivery pad coincides with each contract's designated centre.
	_box(p+Vector3(0,.15,-45),Vector3(8,.03,.25),_materials.paint)

func _forest():
	var positions={"tree_pine":[],"tree_broad":[],"rock":[]}
	for i in range(1350):
		var x=_rng.randf_range(-730,730)
		var z=_rng.randf_range(-700,730)
		var y=terrain_height(x,z)
		if y<9:continue
		var clear=false
		for p in pads.values():
			if absf(x-p.x)<70 and absf(z-p.z)<165: clear=true
		if clear:continue
		var kind="rock" if i%9==0 else ("tree_broad" if y<30 and i%3==0 else "tree_pine")
		var scale_value=_rng.randf_range(.75,1.5)
		positions[kind].append(Transform3D(Basis(Vector3.UP,_rng.randf_range(0,TAU)).scaled(Vector3.ONE*scale_value),Vector3(x,y,z)))
	for kind in positions:
		_batch_props(kind,positions[kind])

func _batch_props(kind:String,transforms:Array):
	var path="res://assets/models/%s.glb"%kind
	if not ResourceLoader.exists(path):path="res://assets/environment/%s.glb"%kind
	if not ResourceLoader.exists(path):return
	var scene=load(path).instantiate()
	var meshes:Array=[]
	_collect_meshes(scene,Transform3D.IDENTITY,meshes)
	# Local batches let the renderer cull and choose LOD for distant groves,
	# rather than treating all vegetation as one island-sized object.
	var chunks:Dictionary={}
	for transform_value in transforms:
		var cell=Vector2i(floori(transform_value.origin.x/128),floori(transform_value.origin.z/128))
		if not chunks.has(cell):chunks[cell]=[]
		chunks[cell].append(transform_value)
	for cell in chunks:
		var chunk_origin=Vector3(cell.x*128,0,cell.y*128)
		var instances:Array=chunks[cell]
		for entry in meshes:
			var mm=MultiMesh.new()
			mm.transform_format=MultiMesh.TRANSFORM_3D
			mm.mesh=entry.mesh
			mm.instance_count=instances.size()
			var bounds:AABB
			for i in range(instances.size()):
				var local:Transform3D=instances[i]
				local.origin-=chunk_origin
				local=local*entry.transform
				mm.set_instance_transform(i,local)
				var item_bounds=local*entry.mesh.get_aabb()
				bounds=item_bounds if i==0 else bounds.merge(item_bounds)
			mm.custom_aabb=bounds
			var node=MultiMeshInstance3D.new()
			node.multimesh=mm
			node.position=chunk_origin
			add_child(node)
	scene.free()
	# Collider trunks/rocks correspond to visible instances, rather than a decorative forest.
	for t in transforms:
		var shape=CapsuleShape3D.new()
		shape.radius=.35 if kind!="rock" else 1.2
		shape.height=4.0 if kind!="rock" else 2.4
		var c=CollisionShape3D.new()
		c.shape=shape
		c.position=t.origin+Vector3.UP*(shape.height*.5)
		_props_body.add_child(c)

func _collect_meshes(node:Node,current:Transform3D,result:Array):
	if node is Node3D:current=current*node.transform
	if node is MeshInstance3D and node.mesh: result.append({"mesh":node.mesh,"transform":current})
	for child in node.get_children():_collect_meshes(child,current,result)

func _settlements():
	for i in range(18):
		var x=-490+(i%6)*19
		var z=-345-int(i/6)*22
		var y=terrain_height(x,z)
		if y<5:continue
		_prop("cottage",Vector3(x,y,z),.85,PI if i%2==0 else 0.0)
		var shape=BoxShape3D.new()
		shape.size=Vector3(10,6,8)
		var collision=CollisionShape3D.new()
		collision.shape=shape
		collision.position=Vector3(x,y+3,z)
		_props_body.add_child(collision)
	for x in range(-490,-330,15):
		_box(Vector3(x,2,-430),Vector3(10,.8,7),_mat("pier",Color("887b5c")),true)
		_box(Vector3(x,0,-430),Vector3(.5,5,.5),_materials.pier)
		if x%30==0:_prop("fishing_boat",Vector3(x,-.3,-443),1.0,PI/2)
	_prop("lighthouse",RIDGE+Vector3(29,0,32),1.0)

func _discovery_art():
	for i in range(2):
		var d=discoveries[i]
		var p:Vector3=d.p
		p.y=terrain_height(p.x,p.z)
		d.p=p+Vector3.UP*10
		if i==0:
			_prop("rock_arch",p,1.0)
			for dx in [-11,11]:
				var c=CollisionShape3D.new()
				var shape=BoxShape3D.new()
				shape.size=Vector3(6,14,8)
				c.shape=shape
				c.position=p+Vector3(dx,7,0)
				_props_body.add_child(c)
		else:
			_prop("lighthouse",p,.8)
			_prop("rock",p+Vector3(-5,0,1),2.2)
