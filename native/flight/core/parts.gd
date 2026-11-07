extends RefCounted
# Physical dimensions in metres and masses in kilograms; rendering never sets mass.
const DATA: Dictionary = {
 "cockpit": ["Cockpit",4.0,Vector3(.85,.8,1.5),0.0,0.0,0.0],
 "fuselage": ["Fuselage",1.5,Vector3(.7,.55,1.2),0.0,0.0,0.0],
 "strut": ["Strut",.35,Vector3(.18,.18,1),0.0,0.0,0.0],
 "wing": ["Wing",1.1,Vector3(2.2,.14,.7),1.5,0.0,0.0],
 "large_wing": ["Large wing",1.65,Vector3(3.2,.16,.85),2.5,0.0,0.0],
 "aileron": ["Aileron",.25,Vector3(1.2,.1,.3),.32,0.0,0.0],
 "elevator": ["Elevator",.35,Vector3(1.5,.12,.4),.5,0.0,0.0],
 "rudder": ["Rudder",.3,Vector3(.12,.8,.65),.4,0.0,0.0],
 "motor": ["Motor",1.8,Vector3(.55,.55,.7),0.0,0.0,65.0],
 "battery": ["Battery",2.0,Vector3(.5,.35,.7),0.0,120000.0,0.0],
 "gear": ["Landing gear",.9,Vector3(.3,.65,.45),0.0,0.0,0.0],
 "cargo_mount": ["Cargo mount",.45,Vector3(.7,.15,.8),0.0,0.0,0.0]
}

static func kinds() -> Array[String]:
 var result: Array[String] = []
 for key in DATA:
  result.append(key)
 return result

static func definition(kind: String) -> Dictionary:
 if not DATA.has(kind):
  return {}
 var d: Array = DATA[kind]
 var drag={"cockpit":.045,"fuselage":.045,"strut":.10,"motor":.12,"battery":.06,"gear":.18,"cargo_mount":.02}.get(kind,.14)
 return {"drag":drag,"label":d[0],"mass":d[1],"size":d[2],"area":d[3],"energy":d[4],"thrust":d[5],"model":"res://assets/models/%s.glb" % kind}
