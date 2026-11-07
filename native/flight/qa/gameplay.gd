extends Node
const BP=preload("res://core/blueprint.gd")
const Jobs=preload("res://core/contracts.gd")
const Profile=preload("res://core/profile.gd")
const Pilot=preload("res://qa/flight_pilot.gd")
var app
var failures:Array=[]
var results:Dictionary={}
var output="res://output/gameplay.json"
var capture_dir="res://output/gameplay"
var _shots:Dictionary={}
var _capturing=false
func _ready():call_deferred("run")
func check(ok:bool,label:String):
 print("FLOW ","PASS " if ok else "FAIL ",label)
 if not ok:failures.append(label)
func shot(label:String):
 if DisplayServer.get_name()=="headless" or _capturing:return
 _capturing=true
 await RenderingServer.frame_post_draw
 get_viewport().get_texture().get_image().save_png(capture_dir+"/"+label+".png")
 _capturing=false
func sample(phase:String,t:Dictionary):
 var key=app.contract.id+"_"+phase
 if phase=="cruise" and t.elapsed<28:return
 if phase=="approach" and t.altitude>app.contract.destination.y+20:return
 if not _shots.has(key):_shots[key]=true;shot(key)
func hauler()->Dictionary:
 var bp=BP.starter();bp.name="Harbour hauler";bp.paint="315b70"
 for part in bp.parts:
  if part.kind=="wing":part.kind="large_wing"
  if part.kind=="motor":part.kind="strut"
 for extra in [["reserve","battery",[0,-.45,1.0]],["reserve2","battery",[0,-.45,1.7]],["motor_l","motor",[-1.35,-.2,-.65]],["motor_r","motor",[1.35,-.2,-.65]]]:
  bp.parts.append({"id":extra[0],"kind":extra[1],"p":extra[2],"r":[0,0,0]})
 return bp
func same_design(a:Dictionary,b:Dictionary)->bool:
 if a.name!=b.name or a.paint!=b.paint or a.parts.size()!=b.parts.size():return false
 for i in range(a.parts.size()):
  var left=a.parts[i];var right=b.parts[i]
  if left.id!=right.id or left.kind!=right.kind or BP.position(left).distance_to(BP.position(right))>.00001 or not BP.basis(left).is_equal_approx(BP.basis(right)):return false
 return true
func finish():
 var tree=get_tree()
 reparent(tree.root)
 app.queue_free()
 for i in range(3):await tree.process_frame
 # Dummy's real-time mixer owns playback briefly after the scene stops.
 OS.delay_msec(250)
 for i in range(2):await tree.process_frame
 tree.quit(0 if failures.is_empty() else 1)

func run():
 set_meta("quality_flow",true)
 app.set_meta("quality_flow_active",true)
 for arg in OS.get_cmdline_user_args():
  if arg.begins_with("--quality-output="):output=arg.trim_prefix("--quality-output=");capture_dir=output.get_base_dir()+"/gameplay"
 DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(capture_dir))
 for i in range(8):await get_tree().physics_frame
 if "--quality-restore" in OS.get_cmdline_user_args():
  check(same_design(app.history.current,hauler()) and app.profile.completed.has("first_delivery") and app.profile.completed.has("heavy_cargo") and app.profile.completed.has("ridge_run"),"separate process relaunch restores aircraft and all three contracts")
  print("RESTORE_RESULT ",JSON.stringify({"failures":failures,"driver":AudioServer.get_driver_name(),"muted":AudioServer.is_bus_mute(0)}))
  await shot("restored_hauler")
  await finish();return
 check(AudioServer.get_driver_name()=="Dummy" and AudioServer.is_bus_mute(0),"silent output and master mute")
 if "--quality-clip" in OS.get_cmdline_user_args():
  await shot("workshop")
  app.start_flight()
  var flight=Pilot.new(app)
  flight.progress.connect(sample)
  var result=await flight.fly(app.contract.destination)
  check(result.delivered,"recorded real-control first delivery")
  await shot("first_delivery_complete")
  flight.progress.disconnect(sample)
  flight.release()
  await finish();return
 var original=app.history.current
 app._paint("738875");check(app.history.current.paint=="738875","paint changes actual aircraft")
 app.history.undo();app._after_edit();check(app.history.current==original,"undo restores the design")
 app.history.redo();app._after_edit();check(app.history.current.paint=="738875","redo reapplies the design")
 app._save_design()
 check(Profile.load_profile(app.folder).profile.blueprints.size()>0,"saved blueprint reads back")
 await shot("workshop")
 # Deliberate piloting error: dive into the ground after a normal takeoff.
 app.start_flight()
 Input.action_press("throttle_up");Input.action_press("pitch_up",.6)
 for i in range(1320):await get_tree().physics_frame
 Input.action_release("throttle_up");Input.action_release("pitch_up");Input.action_press("pitch_down")
 for i in range(3600):
  await get_tree().physics_frame
  if app.aircraft.crashed:break
 Input.action_release("pitch_down")
 check(app.aircraft.crashed,"real flight failure reaches the crash screen")
 await shot("crash")
 var design_before=app.history.current
 var retry_start=Time.get_ticks_msec()
 app.retry()
 for i in range(2):await get_tree().physics_frame
 check(Time.get_ticks_msec()-retry_start<5000 and app.mode=="flight","retry returns to the runway in under five seconds")
 check(app.history.current==design_before and app.aircraft.cargo_mass==2 and app.aircraft.energy==app.aircraft.capacity,"retry preserves design and restores launch cargo and battery")
 results.record_started=true
 var pilot=Pilot.new(app);pilot.progress.connect(sample)
 var first=await pilot.fly(app.contract.destination)
 results.first_delivery=first
 check(first.delivered,"trainer takes off, lands, taxis and unloads the first parcel")
 check(app.aircraft.energy<app.aircraft.capacity and app.aircraft.cargo_mass==0,"unload removes payload without refilling the battery")
 await shot("first_delivery_complete")
 app.return_to_hangar()
 app.contract=Jobs.all()[1];app.launch_payload=true;app._rebuild();app.start_flight()
 Input.action_press("throttle_up");Input.action_press("pitch_up",.15)
 var heavy_lift=false
 for i in range(5400):
  await get_tree().physics_frame
  if not app.aircraft.grounded and app.aircraft.craft_origin().y>app.world.terrain_height(app.aircraft.craft_origin().x,app.aircraft.craft_origin().z)+4:heavy_lift=true
 Input.action_release("throttle_up");Input.action_release("pitch_up")
 results.stock_heavy={"clearance_reached":heavy_lift,"telemetry":app.aircraft.telemetry()}
 check(not heavy_lift,"stock trainer needs modification for the heavy contract")
 app.return_to_hangar()
 var upgraded=hauler()
 check(BP.validate(upgraded).ok,"second materially different design is connected and valid")
 check(app.history.apply(upgraded,upgraded.parts[0].id).ok,"builder accepts the larger-wing twin-motor design")
 app._after_edit();app._save_design();await shot("hauler_workshop")
 app.start_flight()
 var heavy=await pilot.fly(app.contract.destination)
 results.heavy_delivery=heavy
 check(heavy.delivered,"modified hauler lands and delivers the heavy parcel")
 await shot("heavy_delivery_complete")
 app.return_to_hangar();app.contract=Jobs.all()[2];app._rebuild();app.start_flight()
 var ridge=await pilot.fly(app.contract.destination,330)
 results.ridge_delivery=ridge
 check(ridge.delivered,"hauler reaches the ridge, lands and unloads")
 await shot("ridge_delivery_complete")
 app.return_to_hangar();app._save_profile()
 var expected=app.history.current
 var loaded=Profile.load_profile(app.folder)
 check(same_design(loaded.profile.current,expected) and loaded.profile.completed.has("first_delivery") and loaded.profile.completed.has("heavy_cargo") and loaded.profile.completed.has("ridge_run"),"design and three completions survive save/readback")
 results.failures=failures
 results.audio={"driver":AudioServer.get_driver_name(),"master_muted":AudioServer.is_bus_mute(0),"audible_assessment":"unverified"}
 results.audio_events=app.audio_events
 var file=FileAccess.open(output,FileAccess.WRITE)
 if file:file.store_string(JSON.stringify(results,"  "));file.close()
 print("GAMEPLAY_RESULT ",JSON.stringify({"failures":failures,"output":output}))
 pilot.release();pilot.progress.disconnect(sample)
 await finish()
