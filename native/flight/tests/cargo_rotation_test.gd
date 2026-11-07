extends SceneTree
const BP=preload("res://core/blueprint.gd")
const Mass=preload("res://core/mass_properties.gd")
const Craft=preload("res://game/aircraft.gd")
var failures=0
var count=0
func _initialize():call_deferred("run")
func check(ok,label):
 count+=1
 if not ok:failures+=1;printerr("FAIL ",label)
func run():
 var original=BP.starter()
 var expected=Mass.compute(original,18)
 var rotated=original.duplicate(true)
 var turn=Basis(Vector3.FORWARD,PI/2)
 for part in rotated.parts:
  var p=turn*BP.position(part);part.p=[p.x,p.y,p.z]
  part.r=[0,0,-90]
 var properties=Mass.compute(rotated,18)
 check(properties.com.distance_to(turn*expected.com)<.0001,"rotating aircraft and mount rotates loaded centre of mass")
 check(properties.tensor.is_equal_approx(turn*expected.tensor*turn.transposed()),"rotated payload contributes consistently rotated inertia")
 check(properties.cargo_position.distance_to(turn*expected.cargo_position)<.0001,"payload attachment offset follows mount rotation")
 var plane=Craft.new();root.add_child(plane);plane.configure(rotated,18);plane.place(Vector3(0,80,0))
 var payload=plane.get_node("Payload")
 check(payload.global_basis.is_equal_approx(turn),"visible payload rotates with its attachment")
 var collision
 for child in plane.get_children():
  if child is CollisionShape3D and child.shape is BoxShape3D and child.shape.size.is_equal_approx(Mass.CARGO_DIMENSIONS):collision=child
 check(collision!=null and collision.global_basis.is_equal_approx(turn),"payload collision rotates with visible crate")
 plane.queue_free();await process_frame
 print("Cargo rotation checks: ",count-failures,"/",count)
 quit(1 if failures else 0)
