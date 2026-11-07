extends SceneTree
const Aircraft=preload("res://game/aircraft.gd")
const Workload=preload("res://qa/performance.gd")
const World=preload("res://game/world.gd")
var failures=0
func _initialize():call_deferred("run")
func check(ok,label):
 if not ok:failures+=1;printerr("FAIL ",label)
func run():
 var plane=Aircraft.new();root.add_child(plane);plane.configure(Workload.benchmark_blueprint(),2);plane.place(Vector3(0,80,0))
 var source_bounds=AABB();var source_first=true
 var visible=0
 for part in plane.blueprint.parts:
  for mesh in plane.get_node(part.id).find_children("*","MeshInstance3D",true,false):
   if mesh.visible:visible+=1
   if part.kind in ["strut","battery"]:
    var bounds=(plane.global_transform.affine_inverse()*mesh.global_transform)*mesh.mesh.get_aabb()
    if source_first:source_bounds=bounds;source_first=false
    else:source_bounds=source_bounds.merge(bounds)
 var batch_bounds=AABB();var batch_first=true
 var batches=plane.find_children("*","MultiMeshInstance3D",true,false)
 for batch in batches:
  var bounds=batch.transform*batch.multimesh.custom_aabb
  if batch_first:batch_bounds=bounds;batch_first=false
  else:batch_bounds=batch_bounds.merge(bounds)
 check(not batches.is_empty(),"repeated static components use real instanced rendering")
 check(visible<250,"128-part aircraft reduces individual visible draw objects")
 print("BATCH_BOUNDS ",str(source_bounds)," / ",str(batch_bounds))
 check(not batch_first and batch_bounds.position.distance_to(source_bounds.position)<.005 and batch_bounds.size.distance_to(source_bounds.size)<.005,"batched geometry preserves authored component bounds and placement")
 check(plane.blueprint.parts.size()==128 and plane.get_children().filter(func(c):return c is CollisionShape3D).size()==129,"render batching preserves all physical part and cargo colliders")
 var world=World.new();root.add_child(world)
 var localized=true
 var forest_instances=0
 for batch in world.find_children("*","MultiMeshInstance3D",true,false):
  var bounds=batch.multimesh.custom_aabb
  localized=localized and bounds.size.x>0 and bounds.size.x<160 and bounds.size.z<160
  forest_instances+=batch.multimesh.instance_count
 var physical=0
 for shape in world._props_body.get_children():
  if shape is CollisionShape3D and shape.shape is CapsuleShape3D:physical+=1
 check(localized,"vegetation batches have spatially local culling bounds")
 check(forest_instances==physical*3,"spatial batching keeps all three meshes per physical vegetation instance")
 world.queue_free()
 print("Render batching checks: ",6-failures,"/6")
 plane.queue_free();await process_frame;quit(1 if failures else 0)
