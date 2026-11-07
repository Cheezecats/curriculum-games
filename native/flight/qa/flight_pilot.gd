extends RefCounted
signal progress(phase,telemetry)
const Jobs=preload("res://core/contracts.gd")
var app
func _init(game):app=game
func axis(negative,positive,value):
 Input.action_release(negative);Input.action_release(positive)
 if value<-.01:Input.action_press(negative,-value)
 elif value>.01:Input.action_press(positive,value)
func release():
 for action in ["pitch_up","pitch_down","roll_left","roll_right","yaw_left","yaw_right","throttle_up","throttle_down","brake"]:Input.action_release(action)
func fly(destination:Vector3,timeout=260.0)->Dictionary:
 var phase="takeoff"
 var base=destination-Vector3(28,0,10)
 var target=Vector3(-180,base.y,250) if base.y>60 else base+Vector3(0,0,290)
 var landed=false
 var reached=false
 var trace=[]
 for i in range(int(timeout*120)):
  await app.get_tree().physics_frame
  var t=app.aircraft.telemetry()
  var p:Vector3=t.position
  var delta:Vector3=target-p
  var distance=Vector2(delta.x,delta.z).length()
  var heading=atan2(-app.aircraft.craft_basis().z.x,-app.aircraft.craft_basis().z.z)
  var wanted_heading=atan2(delta.x,delta.z)
  var error=wrapf(wanted_heading-heading,-PI,PI)
  var power=1.0
  var pitch=.15 if app.aircraft.mass>30 else .6
  var roll=0.0
  var yaw=0.0
  if phase=="takeoff" and t.elapsed>12 and not t.grounded:phase="valley" if base.y>60 else "cruise"
  if phase=="valley" and distance<65:
   phase="cruise";target=base+Vector3(0,0,290)
  if phase=="cruise" and distance<60:phase="approach"
  if phase=="approach":
   target=Vector3(base.x,base.y,minf(p.z-100,base.z+45))
   delta=target-p
   wanted_heading=atan2(delta.x,delta.z)
   error=wrapf(wanted_heading-heading,-PI,PI)
  if phase!="takeoff":
   roll=clampf(-error*1.8,-.35,.35)
   var desired_alt=maxf(55,base.y+45) if phase in ["cruise","valley"] else base.y+1.5+maxf(0,p.z-(base.z+45))*.13
   var wanted_pitch=clampf((desired_alt-p.y)*.045,-.13,.14)
   pitch=clampf((wanted_pitch-.11)/.24,-1,1)
   if phase=="approach":power=.28 if t.speed>11 else .5
  if t.grounded and phase=="approach":
   phase="taxi";landed=true;target=destination
  if phase=="taxi":
   pitch=0;roll=0;yaw=clampf(-error*2,-1,1)
   power=.18 if distance>6 else 0.0
  axis("pitch_down","pitch_up",pitch)
  axis("roll_left","roll_right",roll)
  axis("yaw_left","yaw_right",yaw)
  axis("throttle_down","throttle_up",clampf((power-t.throttle)*10,-1,1))
  if phase=="taxi" and (distance<7 or t.speed>3):Input.action_press("brake")
  else:Input.action_release("brake")
  if i%240==0:
   trace.append({"t":snappedf(t.elapsed,.1),"phase":phase,"p":[snappedf(p.x,.1),snappedf(p.y,.1),snappedf(p.z,.1)],"v":snappedf(t.speed,.1),"d":snappedf(distance,.1),"pitch":snappedf(rad_to_deg(t.pitch),.1),"bank":snappedf(rad_to_deg(t.bank),.1),"e":snappedf(t.energy,.1),"heading_error":snappedf(error,.01)})
   progress.emit(phase,t)
  if Jobs.can_deliver(app.contract,t):
   app._deliver();reached=app.completed_this_run;break
  if t.crashed:break
 release()
 return {"landed":landed,"delivered":reached,"trace":trace,"final":app.aircraft.telemetry()}
