extends Node3D
var aircraft
var enabled=false
var lines=ImmediateMesh.new()
var marker:MeshInstance3D
func _ready():
 var mesh=MeshInstance3D.new();mesh.mesh=lines
 var material=StandardMaterial3D.new()
 material.shading_mode=BaseMaterial3D.SHADING_MODE_UNSHADED
 material.vertex_color_use_as_albedo=true
 material.no_depth_test=true
 mesh.material_override=material;add_child(mesh)
 marker=MeshInstance3D.new()
 var sphere=SphereMesh.new();sphere.radius=.10;sphere.height=.2
 marker.mesh=sphere
 var gold=StandardMaterial3D.new();gold.albedo_color=Color("f4c776");gold.shading_mode=BaseMaterial3D.SHADING_MODE_UNSHADED;gold.no_depth_test=true
 marker.material_override=gold;add_child(marker)
func _process(_dt):
 visible=enabled
 if not enabled or not is_instance_valid(aircraft):return
 marker.global_position=aircraft.global_position
 lines.clear_surfaces()
 lines.surface_begin(Mesh.PRIMITIVE_LINES)
 if aircraft.flying:
  for sample in aircraft.force_samples:
   _arrow(sample.p,sample.f*.018,Color("79dce0") if sample.get("kind","")=="aero" else Color("eda667"))
  _arrow(aircraft.global_position,Vector3.DOWN*aircraft.mass*9.81*.018,Color("f4c776"))
 else:
  var p=aircraft.global_position
  _arrow(p-Vector3(.4,0,0),Vector3(.8,0,0),Color("f4c776"))
  _arrow(p-Vector3(0,.4,0),Vector3(0,.8,0),Color("f4c776"))
 lines.surface_end()
func _arrow(start:Vector3,delta:Vector3,color:Color):
 if delta.length()<.02:return
 if delta.length()>6:delta=delta.normalized()*6
 var end=start+delta
 var side=delta.normalized().cross(Vector3.FORWARD)
 if side.length()<.1:side=Vector3.RIGHT
 side=side.normalized()*.12
 var back=end-delta.normalized()*.25
 for v in [start,end,end,back+side,end,back-side]:
  lines.surface_set_color(color);lines.surface_add_vertex(v)
