extends RefCounted
const Parts = preload("res://core/parts.gd")
const Blueprint = preload("res://core/blueprint.gd")
const CARGO_DIMENSIONS = Vector3(.8,.65,.85)

static func cargo_size(cargo_mass: float) -> Vector3:
 # Root calibration: constant payload density preserves the full 18 kg crate,
 # while introductory parcels have matching smaller visual/collision/inertia boxes.
 if not is_finite(cargo_mass) or cargo_mass <= 0:
  return Vector3.ZERO
 var size: Vector3 = CARGO_DIMENSIONS * pow(cargo_mass / 18.0,1.0 / 3.0)
 return size if size.is_finite() else Vector3.ZERO

static func cargo_position(bp: Dictionary, cargo_mass: float = 18) -> Vector3:
 if not is_finite(cargo_mass) or cargo_mass < 0:
  return Vector3.ZERO
 var entries = bp.get("parts",[])
 if not entries is Array:
  return Vector3.ZERO
 for part in entries:
  if part is Dictionary and part.get("kind","") == "cargo_mount":
   return Blueprint.position(part) + Blueprint.basis(part) * Vector3.UP * (.095 + cargo_size(cargo_mass).y * .5)
 return Vector3.ZERO

static func cargo_basis(bp:Dictionary)->Basis:
 for part in bp.get("parts",[]):
  if part is Dictionary and part.get("kind","")=="cargo_mount":return Blueprint.basis(part)
 return Basis.IDENTITY

static func compute(bp: Dictionary, cargo_mass: float = 0) -> Dictionary:
 if not is_finite(cargo_mass) or cargo_mass < 0 or not Blueprint.validate(bp).ok:
  return {}
 var components: Array[Dictionary] = []
 var total: float = 0
 var weighted = Vector3.ZERO
 var mount_found: bool = false
 for part in bp.parts:
  var def: Dictionary = Parts.definition(part.kind)
  var p: Vector3 = Blueprint.position(part)
  var component_mass: float = def.mass
  components.append({"mass":component_mass,"p":p,"size":def.size,"basis":Blueprint.basis(part)})
  total += component_mass
  weighted += p * component_mass
  mount_found = mount_found or part.kind == "cargo_mount"
 if cargo_mass > 0:
  if not mount_found:
   return {}
  var cp: Vector3 = cargo_position(bp,cargo_mass)
  components.append({"mass":cargo_mass,"p":cp,"size":cargo_size(cargo_mass),"basis":cargo_basis(bp)})
  total += cargo_mass
  weighted += cp * cargo_mass
 if not is_finite(total) or total <= 0:
  return {}
 var com: Vector3 = weighted / total
 var matrix: Array = [[0.0,0.0,0.0],[0.0,0.0,0.0],[0.0,0.0,0.0]]
 for component in components:
  var mass: float = component.mass
  var size: Vector3 = component.size
  var rotation: Basis = component.basis
  var local_diagonal = Vector3(mass*(size.y*size.y+size.z*size.z)/12.0,mass*(size.x*size.x+size.z*size.z)/12.0,mass*(size.x*size.x+size.y*size.y)/12.0)
  var offset: Vector3 = component.p - com
  for row in range(3):
   for col in range(3):
    var centroid: float = 0
    for k in range(3):
     centroid += rotation[k][row] * local_diagonal[k] * rotation[k][col]
    # Parallel axis theorem: m (|d|² I - d dᵀ), including products of inertia.
    var shift: float = mass * ((offset.length_squared() if row == col else 0.0) - offset[row]*offset[col])
    matrix[row][col] += centroid + shift
 var eigen: Dictionary = _diagonalize(matrix)
 var principal: Vector3 = eigen.principal
 if not principal.is_finite() or minf(principal.x,minf(principal.y,principal.z)) <= 0:
  return {}
 return {"mass":total,"com":com,"tensor":_to_basis(matrix),"principal":principal,"axes":eigen.axes,"cargo_position":cargo_position(bp,cargo_mass),"cargo_size":cargo_size(cargo_mass),"cargo_basis":cargo_basis(bp)}

static func _to_basis(rows: Array) -> Basis:
 return Basis(Vector3(rows[0][0],rows[1][0],rows[2][0]),Vector3(rows[0][1],rows[1][1],rows[2][1]),Vector3(rows[0][2],rows[1][2],rows[2][2]))

static func _diagonalize(input: Array) -> Dictionary:
 # Jacobi rotations diagonalize a real symmetric tensor, keeping eigenvectors as columns.
 var a: Array = input.duplicate(true)
 var v: Array = [[1.0,0.0,0.0],[0.0,1.0,0.0],[0.0,0.0,1.0]]
 for _iteration in range(48):
  var p: int = 0
  var q: int = 1
  var largest: float = absf(a[0][1])
  for pair in [[0,2],[1,2]]:
   var candidate: float = absf(a[pair[0]][pair[1]])
   if candidate > largest:
    p = pair[0]
    q = pair[1]
    largest = candidate
  var scale: float = maxf(1.0,maxf(absf(a[0][0]),maxf(absf(a[1][1]),absf(a[2][2]))))
  if largest <= 1e-12 * scale:
   break
  var angle: float = .5 * atan2(2.0*a[p][q],a[q][q]-a[p][p])
  var c: float = cos(angle)
  var s: float = sin(angle)
  var app: float = a[p][p]
  var aqq: float = a[q][q]
  var apq: float = a[p][q]
  a[p][p] = c*c*app-2.0*s*c*apq+s*s*aqq
  a[q][q] = s*s*app+2.0*s*c*apq+c*c*aqq
  a[p][q] = 0.0
  a[q][p] = 0.0
  for k in range(3):
   if k != p and k != q:
    var akp: float = a[k][p]
    var akq: float = a[k][q]
    a[k][p] = c*akp-s*akq
    a[p][k] = a[k][p]
    a[k][q] = s*akp+c*akq
    a[q][k] = a[k][q]
   var vkp: float = v[k][p]
   var vkq: float = v[k][q]
   v[k][p] = c*vkp-s*vkq
   v[k][q] = s*vkp+c*vkq
 var order: Array[int] = [0,1,2]
 order.sort_custom(func(i: int,j: int) -> bool: return a[i][i] < a[j][j])
 var axes = Basis(Vector3(v[0][order[0]],v[1][order[0]],v[2][order[0]]),Vector3(v[0][order[1]],v[1][order[1]],v[2][order[1]]),Vector3(v[0][order[2]],v[1][order[2]],v[2][order[2]]))
 if axes.determinant() < 0:
  axes.z = -axes.z
 return {"principal":Vector3(a[order[0]][order[0]],a[order[1]][order[1]],a[order[2]][order[2]]),"axes":axes}
