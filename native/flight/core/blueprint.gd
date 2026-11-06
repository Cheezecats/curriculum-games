extends RefCounted
const Parts = preload("res://core/parts.gd")
const MAX_PARTS: int = 128
const CONNECTION_GAP: float = .08

static func starter() -> Dictionary:
 var result = {"version":1,"name":"Island trainer","paint":"c94638","parts":[]}
 var layout: Array = [
 ["cockpit",Vector3.ZERO], ["motor",Vector3(0,0,-1.05)],
 ["battery",Vector3(0,-.45,.3)], ["fuselage",Vector3(0,0,1.2)],
 ["fuselage",Vector3(0,0,2.3)], ["wing",Vector3(-1.35,-.2,.15)],
 ["wing",Vector3(1.35,-.2,.15)], ["aileron",Vector3(-1.5,-.2,.65)],
 ["aileron",Vector3(1.5,-.2,.65)], ["elevator",Vector3(0,0,2.8)],
 ["rudder",Vector3(0,.4,2.65)], ["gear",Vector3(-.38,-.8,-.35)],
 ["gear",Vector3(.38,-.8,-.35)], ["gear",Vector3(0,-.65,2.35)],
 ["cargo_mount",Vector3(0,-.72,.45)]]
 for i in range(layout.size()):
  var p: Vector3 = layout[i][1]
  result.parts.append({"id":"part_%02d" % i,"kind":layout[i][0],"p":[p.x,p.y,p.z],"r":[0.0,0.0,0.0]})
 return result

static func position(part: Dictionary) -> Vector3:
 var p = part.get("p",[0,0,0])
 if not _triple(p):
  return Vector3.ZERO
 return Vector3(float(p[0]),float(p[1]),float(p[2]))

static func basis(part: Dictionary) -> Basis:
 var r = part.get("r",[0,0,0])
 if not _triple(r):
  return Basis.IDENTITY
 return Basis.from_euler(Vector3(deg_to_rad(float(r[0])),deg_to_rad(float(r[1])),deg_to_rad(float(r[2]))))

static func validate(bp: Dictionary) -> Dictionary:
 if not _number(bp.get("version")) or bp.version != 1:
  return _bad("Unsupported blueprint version.")
 if not bp.get("name") is String or bp.name.strip_edges().is_empty() or bp.name.length() > 80:
  return _bad("Name must contain 1–80 characters.")
 if not bp.get("paint") is String or bp.paint.length() != 6 or not bp.paint.is_valid_hex_number(false):
  return _bad("Paint must be six hexadecimal digits.")
 if not bp.get("parts") is Array or bp.parts.is_empty() or bp.parts.size() > MAX_PARTS:
  return _bad("A blueprint needs 1–128 parts.")
 var ids: Dictionary = {}
 var centers: Array[Vector3] = []
 var extents: Array[Vector3] = []
 var cockpits: int = 0
 for raw in bp.parts:
  if not raw is Dictionary:
   return _bad("Malformed part.")
  var part: Dictionary = raw
  if not part.get("id") is String or part.id.is_empty() or part.id.length() > 80 or ids.has(part.id):
   return _bad("Part ids must be unique nonempty strings.")
  ids[part.id] = true
  if not part.get("kind") is String or Parts.definition(part.kind).is_empty():
   return _bad("Unknown part kind.")
  if not _triple(part.get("p")) or not _triple(part.get("r")):
   return _bad("Part transforms need three finite numbers.")
  for n in part.p:
   if absf(float(n)) > 32.0:
    return _bad("Parts must remain within 32 metres of the build origin.")
  for angle in part.r:
   if absf(float(angle)) > 36000.0 or absf(float(angle)/90.0 - roundf(float(angle)/90.0)) > .00001:
    return _bad("Part rotations must be quarter turns.")
  var p: Vector3 = position(part)
  for previous in centers:
   if p.distance_squared_to(previous) < .00000001:
    return _bad("Parts cannot share the same centre.")
  centers.append(p)
  var b: Basis = basis(part)
  var half: Vector3 = Parts.definition(part.kind).size * .5
  extents.append(b.x.abs()*half.x + b.y.abs()*half.y + b.z.abs()*half.z)
  if part.kind == "cockpit":
   cockpits += 1
 if cockpits != 1:
  return _bad("A build must have exactly one cockpit.")
 var reached: Dictionary = {0:true}
 var queue: Array[int] = [0]
 while not queue.is_empty():
  var index: int = queue.pop_back()
  for other in range(centers.size()):
   if reached.has(other):
    continue
   var separation: Vector3 = (centers[index]-centers[other]).abs()-extents[index]-extents[other]
   var gap = Vector3(maxf(0,separation.x),maxf(0,separation.y),maxf(0,separation.z))
   if gap.length() <= CONNECTION_GAP + .00001:
    reached[other] = true
    queue.append(other)
 if reached.size() != centers.size():
  return _bad("Every part must physically connect to the cockpit.")
 return {"ok":true,"error":""}

static func _number(value: Variant) -> bool:
 return (value is float or value is int) and is_finite(float(value))

static func _triple(value: Variant) -> bool:
 if not value is Array or value.size() != 3:
  return false
 for n in value:
  if not _number(n):
   return false
 return true

static func _bad(message: String) -> Dictionary:
 return {"ok":false,"error":message}
