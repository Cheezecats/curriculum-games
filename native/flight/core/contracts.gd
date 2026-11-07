extends RefCounted

static func all() -> Array[Dictionary]:
 return [
 {"id":"first_delivery","title":"The harbour run","description":"Carry a small parcel down to the harbour landing pad.","cargo_mass":2.0,"destination":Vector3(-402,9,-250),"pad_radius":8.0,"reward":"Heavy cargo contract"},
 {"id":"heavy_cargo","title":"Working weight","description":"Deliver eighteen kilograms to the harbour. Add lift or reduce airframe weight.","cargo_mass":18.0,"destination":Vector3(-402,9,-250),"pad_radius":8.0,"reward":"Ridge contract"},
 {"id":"ridge_run","title":"Above the ridge","description":"Deliver ten kilograms to the high ridge pad.","cargo_mass":10.0,"destination":Vector3(448,118,-350),"pad_radius":8.0,"reward":"Free flight and repeat contracts"}]

static func can_deliver(contract: Dictionary, telemetry: Dictionary) -> bool:
 var destination = contract.get("destination")
 var cargo = telemetry.get("cargo_world_position")
 var radius = contract.get("pad_radius")
 var speed = telemetry.get("speed")
 if not destination is Vector3 or not cargo is Vector3 or not destination.is_finite() or not cargo.is_finite():
  return false
 if not _number(radius) or float(radius) <= 0 or not _number(speed) or float(speed) < 0 or float(speed) >= 2:
  return false
 var grounded = telemetry.get("grounded")
 var crashed = telemetry.get("crashed")
 var has_cargo = telemetry.get("has_cargo")
 if not grounded is bool or not crashed is bool or not has_cargo is bool:
  return false
 if not grounded or crashed or not has_cargo:
  return false
 var delta: Vector3 = cargo - destination
 return Vector2(delta.x,delta.z).length() <= float(radius) and absf(delta.y) < 3.0

static func next_contract(completed: Array) -> Dictionary:
 var entries: Array[Dictionary] = all()
 for entry in entries:
  if not completed.has(entry.id):
   return entry
 return entries[0]

static func _number(value: Variant) -> bool:
 return (value is float or value is int) and is_finite(float(value))
