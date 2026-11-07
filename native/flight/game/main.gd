extends Node3D
const AircraftType=preload("res://game/aircraft.gd")
const WorldType=preload("res://game/world.gd")
const Parts=preload("res://core/parts.gd")
const BP=preload("res://core/blueprint.gd")
const Mass=preload("res://core/mass_properties.gd")
const History=preload("res://core/history.gd")
const Profile=preload("res://core/profile.gd")
const Contracts=preload("res://core/contracts.gd")
const Bindings=preload("res://core/input_bindings.gd")
var world
var aircraft
var camera:Camera3D
var ui:Control
var profile:Dictionary
var history
var contract:Dictionary={}
var mode="build"
var last_mode="build"
var folder=""
var objective_panel:PanelContainer
var instrument_panel:PanelContainer
var actions_bar:HBoxContainer
var build_scroll:ScrollContainer
var build_panel:PanelContainer
var pause_panel:PanelContainer
var crash_panel:PanelContainer
var inspector:PanelContainer
var message_label:Label
var objective:Label
var instruments:Label
var energy_bar:ProgressBar
var selected_label:Label
var part_buttons:Dictionary={}
var undo_button:Button
var redo_button:Button
var load_button:Button
var launch_button:Button
var launch_payload=true
var mirror=true
var kind="wing"
var rotation_quarters=Vector3.ZERO
var orbit_yaw=-.90
var orbit_pitch=.30
var orbit_distance=9.0
var chase_distance=12.0
var chase_heading=Vector3.FORWARD
var look_yaw=0.0
var selected_id=""
var active_socket=-1
var candidate:Dictionary={}
var ghost:MeshInstance3D
var selection_box:MeshInstance3D
var sockets: Array[MeshInstance3D]=[]
var socket_positions:Array[Vector3]=[]
var _dragging=false
var _drag_distance=0.0
var _mouse_down=Vector2.ZERO
var _message_time=0.0
var _toast=""
var _bind_action=""
var _binding_buttons:Dictionary={}
var _ui_timer=0.0
var _last_physics:Dictionary={}
var flight_trace:Array=[]
var last_trace:Array=[]
var last_attempt:Dictionary={}
var discovered_message=""
var assist_hint:Label
var _last_heading=0.0
var _elapsed_world=0.0
var completed_this_run=false
var sound_engine:AudioStreamPlayer
var sound_wind:AudioStreamPlayer
var sound_contact:AudioStreamPlayer
var audio_events=0
var navigation:Control
var hud_graph:Control
var reticle:Control
var engineering
var unload_button:Button

func _ready():
	TranslationServer.set_locale("en")
	var boot=get_node("/root/Boot")
	folder=boot.profile_dir
	var loaded=Profile.load_profile(folder)
	profile=loaded.profile
	Bindings.install(profile.settings.get("bindings",{}))
	if not boot.test_mode:
		AudioServer.set_bus_volume_db(0,linear_to_db(maxf(.0001,profile.settings.master_volume)))
	contract=Contracts.next_contract(profile.completed)
	history=History.new(profile.current,profile.current.parts[0].id)
	selected_id=history.selected
	world=WorldType.new()
	world.name="IslandRegion"
	add_child(world)
	aircraft=AircraftType.new()
	aircraft.name="PlayerAircraft"
	add_child(aircraft)
	aircraft.impact.connect(func(text):call_deferred("_on_crash",text))
	camera=Camera3D.new()
	camera.name="PlayerCamera"
	camera.fov=56
	camera.near=.12
	camera.far=4000
	add_child(camera)
	camera.current=true
	_construct_ui()
	_build_tools()
	_create_audio()
	engineering=preload("res://game/engineering_overlay.gd").new()
	engineering.aircraft=aircraft
	add_child(engineering)
	_rebuild()
	camera.global_position=aircraft.craft_origin()+Vector3(-10,6,10)
	_notice("Welcome to the islands. Your first parcel is ready at the harbour desk.",8)
	if loaded.error!="":_notice(loaded.error,10)
	get_window().title="Flight Islands — Native Alpha"
	if boot.test_mode and ("--quality-flow" in OS.get_cmdline_user_args() or "--quality-restore" in OS.get_cmdline_user_args() or "--quality-clip" in OS.get_cmdline_user_args()):
		var runner=preload("res://qa/gameplay.gd").new()
		runner.app=self
		add_child(runner)
	if boot.test_mode and "--quality-benchmark" in OS.get_cmdline_user_args():
		var runner=load("res://qa/performance.gd").new()
		runner.app=self
		add_child(runner)

func _style(bg:Color,border=Color(0,0,0,0),radius=8)->StyleBoxFlat:
	var style=StyleBoxFlat.new()
	style.bg_color=bg
	style.border_color=border
	style.set_border_width_all(1 if border.a>0 else 0)
	style.set_corner_radius_all(radius)
	style.content_margin_left=18
	style.content_margin_right=18
	style.content_margin_top=14
	style.content_margin_bottom=14
	return style

func _label(text:String,size=18,color=Color("f3efe2"))->Label:
	var l=Label.new()
	l.text=text
	l.add_theme_font_size_override("font_size",size)
	l.add_theme_color_override("font_shadow_color",Color(0,0,0,.25))
	l.add_theme_constant_override("shadow_offset_x",1)
	l.add_theme_constant_override("shadow_offset_y",1)
	l.add_theme_color_override("font_color",color)
	l.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART
	return l

func _button(text:String,callback:Callable,name_value="")->Button:
	var button=Button.new()
	button.text=text
	button.custom_minimum_size.y=39
	button.add_theme_font_size_override("font_size",15)
	if name_value!="":button.name=name_value
	button.pressed.connect(callback)
	return button

func _panel(parent:Node,width:float)->PanelContainer:
	var p=PanelContainer.new()
	p.custom_minimum_size.x=width
	p.add_theme_stylebox_override("panel",_style(Color(.06,.11,.14,.93),Color(.65,.74,.73,.25)))
	parent.add_child(p)
	return p

func _vbox(parent:Node)->VBoxContainer:
	var box=VBoxContainer.new()
	box.add_theme_constant_override("separation",10)
	parent.add_child(box)
	return box

func _construct_ui():
	var layer=CanvasLayer.new()
	add_child(layer)
	ui=Control.new()
	ui.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	ui.mouse_filter=Control.MOUSE_FILTER_IGNORE
	layer.add_child(ui)
	var theme=Theme.new()
	theme.default_font_size=16
	for state in ["normal","hover","pressed","focus","disabled"]:
		var color=Color("273e47")
		if state=="hover":color=Color("3b5960")
		if state=="pressed":color=Color("bf5d46")
		if state=="disabled":color=Color("1c2a30")
		theme.set_stylebox(state,"Button",_style(color,Color(.6,.7,.7,.15),5))
	ui.theme=theme
	var brand=TextureRect.new()
	brand.texture=preload("res://assets/branding/flight_islands_title_light.png")
	brand.expand_mode=TextureRect.EXPAND_IGNORE_SIZE
	brand.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	brand.position=Vector2(26,20)
	brand.size=Vector2(300,40)
	ui.add_child(brand)
	var tag=_label("ISLAND AIR SERVICE  /  NATIVE ALPHA",11,Color("b6c7c7"))
	tag.position=Vector2(28,57)
	tag.size=Vector2(320,20)
	ui.add_child(tag)
	objective_panel=_panel(ui,400)
	objective_panel.set_anchors_and_offsets_preset(Control.PRESET_TOP_RIGHT)
	objective_panel.position=Vector2(-426,20)
	var ov=_vbox(objective_panel)
	objective=_label("",18)
	objective.name="Objective"
	ov.add_child(objective)
	energy_bar=ProgressBar.new()
	energy_bar.custom_minimum_size.y=5
	energy_bar.show_percentage=false
	energy_bar.add_theme_stylebox_override("background",_style(Color("263c44"),Color.TRANSPARENT,2))
	energy_bar.add_theme_stylebox_override("fill",_style(Color("e4c88b"),Color.TRANSPARENT,2))
	ov.add_child(energy_bar)
	message_label=_label("",17,Color("f4e3b6"))
	message_label.set_anchors_and_offsets_preset(Control.PRESET_CENTER_TOP)
	message_label.position=Vector2(-280,112)
	message_label.size=Vector2(560,70)
	message_label.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER
	ui.add_child(message_label)
	build_panel=_panel(ui,294)
	build_panel.name="WorkshopPanel"
	build_panel.position=Vector2(26,96)
	var scroll=ScrollContainer.new()
	build_scroll=scroll
	scroll.custom_minimum_size=Vector2(258,500)
	scroll.horizontal_scroll_mode=ScrollContainer.SCROLL_MODE_DISABLED
	build_panel.add_child(scroll)
	var box=_vbox(scroll)
	box.size_flags_horizontal=Control.SIZE_EXPAND_FILL
	box.add_child(_label("THE WORKSHOP",13,Color("dfb883")))
	selected_label=_label("",15)
	box.add_child(selected_label)
	var grid=GridContainer.new()
	grid.columns=2
	grid.add_theme_constant_override("h_separation",6)
	grid.add_theme_constant_override("v_separation",5)
	box.add_child(grid)
	for k in Parts.kinds():
		var d=Parts.definition(k)
		var button=_button(d.label,func():kind=k;rotation_quarters=Vector3.ZERO;_update_build_ui())
		button.custom_minimum_size=Vector2(119,34)
		button.add_theme_font_size_override("font_size",13)
		grid.add_child(button)
		part_buttons[k]=button
	var symmetry=CheckButton.new()
	symmetry.text="Mirror wings & parts"
	symmetry.button_pressed=true
	symmetry.toggled.connect(func(v):mirror=v)
	box.add_child(symmetry)
	box.add_child(_button("Balance & forces  [G]",_toggle_engineering))
	var row=HBoxContainer.new()
	box.add_child(row)
	undo_button=_button("Undo",func():history.undo();_after_edit(),"UndoButton")
	redo_button=_button("Redo",func():history.redo();_after_edit(),"RedoButton")
	row.add_child(undo_button)
	row.add_child(redo_button)
	box.add_child(_button("Replace selected with chosen part",_replace_selected,"ReplaceButton"))
	var rotation_row=HBoxContainer.new()
	box.add_child(rotation_row)
	for axis in range(3):
		rotation_row.add_child(_button(["Pitch ↻","Yaw ↻","Roll ↻"][axis],func():rotation_quarters[axis]=fmod(rotation_quarters[axis]+90,360)))
	box.add_child(_button("Remove selected  [Delete]",_remove_selected,"RemoveButton"))
	var paints=HBoxContainer.new()
	box.add_child(paints)
	for color in ["c94638","315b70","d6ae57","738875","e0d8bd"]:
		var button=_button("●",func():_paint(color))
		button.add_theme_color_override("font_color",Color("#"+color))
		button.custom_minimum_size.x=41
		paints.add_child(button)
	var save_row=HBoxContainer.new()
	box.add_child(save_row)
	save_row.add_child(_button("Save design",_save_design,"SaveDesignButton"))
	save_row.add_child(_button("Load saved",_show_blueprints,"LoadDesignButton"))
	box.add_child(_label("Select a component, then click an attachment point. Right-drag to orbit · scroll to zoom.",12,Color("b4c3c5")))
	launch_button=_button("Roll out to runway  →",start_flight,"LaunchButton")
	launch_button.custom_minimum_size.y=48
	ui.add_child(launch_button)
	box.add_child(_button("Choose delivery / free flight",_choose_contract,"ContractsButton"))
	box.add_child(_button("Controls & settings",_show_settings,"SettingsButton"))
	var bottom=_panel(ui,540)
	instrument_panel=bottom
	bottom.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_LEFT)
	bottom.position=Vector2(26,-91)
	var bv=_vbox(bottom)
	instruments=_label("",19)
	instruments.name="FlightInstruments"
	bv.add_child(instruments)
	assist_hint=_label("",11,Color("b9c8ca"))
	bv.add_child(assist_hint)
	var actions=HBoxContainer.new()
	actions_bar=actions
	actions.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_RIGHT)
	actions.position=Vector2(-435,-73)
	ui.add_child(actions)
	actions.add_child(_button("Hangar  [Tab]",return_to_hangar,"HangarButton"))
	actions.add_child(_button("Retry  [R]",retry,"RetryButton"))
	actions.add_child(_button("Pause",toggle_pause,"PauseButton"))
	unload_button=_button("Unload parcel  [F]",_deliver,"UnloadButton")
	ui.add_child(unload_button)
	unload_button.hide()
	navigation=preload("res://game/navigation.gd").new()
	navigation.name="IslandChart"
	navigation.aircraft=aircraft
	navigation.pads=world.pads
	navigation.size=Vector2(204,204)
	ui.add_child(navigation)
	reticle=Control.new()
	reticle.mouse_filter=Control.MOUSE_FILTER_IGNORE
	reticle.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	reticle.draw.connect(_draw_reticle)
	ui.add_child(reticle)
	ui.move_child(reticle,0)
	pause_panel=_center_panel("PausePanel",430)
	crash_panel=_center_panel("CrashPanel",470)
	inspector=_center_panel("InspectorPanel",570)

func _layout_ui():
	var viewport=get_viewport().get_visible_rect().size
	ui.size=viewport
	objective_panel.position=Vector2(viewport.x-426,20)
	instrument_panel.position=Vector2(26,viewport.y-91)
	actions_bar.position=Vector2(viewport.x-435,viewport.y-73)
	launch_button.position=Vector2(26,viewport.y-160)
	launch_button.size=Vector2(294,50)
	launch_button.visible=mode=="build"
	navigation.position=Vector2(viewport.x-230,viewport.y-310)
	navigation.visible=mode!="build"
	navigation.has_target=not contract.is_empty() and not completed_this_run
	navigation.destination=contract.get("destination",Vector3.ZERO)
	build_scroll.custom_minimum_size.y=maxf(260,viewport.y-365)
	for panel in [pause_panel,crash_panel,inspector]:
		panel.position=viewport*.5-Vector2(panel.size.x*.5,minf(250,panel.size.y*.5))

func _center_panel(node_name:String,width:float)->PanelContainer:
	var p=_panel(ui,width)
	p.name=node_name
	p.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	p.position=Vector2(-width/2,-190)
	p.visible=false
	return p

func _clear(panel:PanelContainer)->VBoxContainer:
	for child in panel.get_children():child.free()
	return _vbox(panel)

func _draw_reticle():
	if mode!="flight":return
	var centre=ui.size*.5
	var color=Color(.95,.95,.84,.70)
	reticle.draw_line(centre+Vector2(-24,0),centre+Vector2(-7,0),color,1.6,true)
	reticle.draw_line(centre+Vector2(7,0),centre+Vector2(24,0),color,1.6,true)
	reticle.draw_circle(centre,2,color)
	if contract.is_empty() or completed_this_run:return
	var target:Vector3=contract.destination+Vector3.UP*7
	var point:Vector2
	if camera.is_position_behind(target):
		var local=camera.global_basis.transposed()*(target-camera.global_position)
		point=Vector2(70 if local.x<0 else ui.size.x-270,ui.size.y*.4)
	else:
		point=camera.unproject_position(target)
		point=point.clamp(Vector2(80,180),ui.size-Vector2(270,150))
	var gold=Color("eecb7d")
	reticle.draw_polyline(PackedVector2Array([point+Vector2(-8,0),point+Vector2(0,8),point+Vector2(8,0),point+Vector2(0,-8),point+Vector2(-8,0)]),gold,2,true)
	reticle.draw_string(ThemeDB.fallback_font,point+Vector2(14,5),"%.0f m · delivery pad"%aircraft.craft_origin().distance_to(contract.destination),HORIZONTAL_ALIGNMENT_LEFT,-1,14,gold)

func _build_tools():
	ghost=MeshInstance3D.new()
	var mesh=BoxMesh.new()
	mesh.size=Vector3.ONE
	ghost.mesh=mesh
	var material=StandardMaterial3D.new()
	material.albedo_color=Color(.7,.88,.85,.35)
	material.transparency=BaseMaterial3D.TRANSPARENCY_ALPHA
	material.shading_mode=BaseMaterial3D.SHADING_MODE_UNSHADED
	ghost.material_override=material
	ghost.cast_shadow=GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(ghost)
	selection_box=MeshInstance3D.new()
	selection_box.mesh=BoxMesh.new()
	var highlight=material.duplicate()
	highlight.albedo_color=Color(.96,.68,.31,.14)
	selection_box.material_override=highlight
	selection_box.cast_shadow=GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(selection_box)
	for i in range(6):
		var node=MeshInstance3D.new()
		var sphere=SphereMesh.new()
		sphere.radius=.065
		sphere.height=.13
		node.mesh=sphere
		var m=StandardMaterial3D.new()
		m.albedo_color=Color("edbf77")
		m.shading_mode=BaseMaterial3D.SHADING_MODE_UNSHADED
		node.material_override=m
		node.cast_shadow=GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		add_child(node)
		sockets.append(node)

func _rebuild():
	completed_this_run=false
	selected_id=history.selected
	var payload=contract.get("cargo_mass",0.0) if launch_payload else 0.0
	var has_mount=false
	for part in history.current.parts:
		if part.kind=="cargo_mount":has_mount=true
	if not has_mount:payload=0.0
	aircraft.configure(history.current,payload)
	aircraft.place(WorldType.HOME+Vector3(30,1.5,10))
	mode="build"
	build_panel.show()
	crash_panel.hide()
	pause_panel.hide()
	inspector.hide()
	_update_build_ui()
	_update_sockets()
	profile.current=history.current
	_save_profile()

func _after_edit():
	_rebuild()
	_notice("Design updated. Changes affect mass, balance and handling.",3)

func _selected_part()->Dictionary:
	for part in history.current.parts:
		if part.id==selected_id:return part
	return history.current.parts[0]

func _update_build_ui():
	var bp=history.current
	var part=_selected_part()
	var d=Parts.definition(part.kind)
	selected_label.text="%s  ·  %d/128 parts\n%.1f kg loaded  ·  %.0f kJ battery"%[d.label,bp.parts.size(),aircraft.mass,aircraft.capacity/1000]
	for k in part_buttons:part_buttons[k].modulate=Color("f3c982") if k==kind else Color.WHITE
	undo_button.disabled=not history.can_undo()
	redo_button.disabled=not history.can_redo()
	var has_motor=false
	var has_wing=false
	for p in bp.parts:
		has_motor=has_motor or p.kind=="motor"
		has_wing=has_wing or p.kind in ["wing","large_wing"]
	launch_button.disabled=not has_motor or not has_wing

func _extent(part:Dictionary)->Vector3:
	var b=BP.basis(part)
	var half:Vector3=Parts.definition(part.kind).size*.5
	return b.x.abs()*half.x+b.y.abs()*half.y+b.z.abs()*half.z

func _update_sockets():
	var part=_selected_part()
	var half=_extent(part)
	var rotation=Basis.from_euler(rotation_quarters*PI/180)
	var size:Vector3=Parts.definition(kind).size*.5
	var other=rotation.x.abs()*size.x+rotation.y.abs()*size.y+rotation.z.abs()*size.z
	var axes=[Vector3.RIGHT,Vector3.LEFT,Vector3.UP,Vector3.DOWN,Vector3.FORWARD,Vector3.BACK]
	socket_positions.clear()
	for i in range(6):
		var local=BP.position(part)+axes[i]*(half+other)*.99
		socket_positions.append(local)
		sockets[i].global_position=aircraft.craft_origin()+aircraft.craft_basis()*local
		sockets[i].visible=mode=="build"
	selection_box.visible=mode=="build"
	selection_box.global_transform=Transform3D(aircraft.craft_basis()*BP.basis(part),aircraft.craft_origin()+aircraft.craft_basis()*BP.position(part))
	selection_box.scale=Parts.definition(part.kind).size*1.06

func _update_ghost():
	ghost.visible=false
	candidate={}
	active_socket=-1
	if mode!="build" or pause_panel.visible or inspector.visible:return
	if get_viewport().gui_get_hovered_control()!=null:return
	var mouse=get_viewport().get_mouse_position()
	var best=30.0
	for i in range(socket_positions.size()):
		var pos=sockets[i].global_position
		if camera.is_position_behind(pos):continue
		var distance=camera.unproject_position(pos).distance_to(mouse)
		if distance<best:best=distance;active_socket=i
	if active_socket<0:return
	var bp=history.current
	var p=socket_positions[active_socket]
	var next={"id":"part_%d"%Time.get_ticks_usec(),"kind":kind,"p":[p.x,p.y,p.z],"r":[rotation_quarters.x,rotation_quarters.y,rotation_quarters.z]}
	bp.parts.append(next)
	if mirror and absf(p.x)>.3:
		var mirrored=next.duplicate(true)
		mirrored.id+="_mirror"
		mirrored.p[0]=-p.x
		mirrored.r[1]=-mirrored.r[1]
		mirrored.r[2]=-mirrored.r[2]
		if not _position_used(bp,Vector3(mirrored.p[0],mirrored.p[1],mirrored.p[2])):bp.parts.append(mirrored)
	var validation=BP.validate(bp)
	candidate={"bp":bp,"selected":next.id,"ok":validation.ok,"error":validation.error}
	ghost.visible=true
	ghost.global_transform=Transform3D(aircraft.craft_basis()*Basis.from_euler(rotation_quarters*PI/180),aircraft.craft_origin()+aircraft.craft_basis()*p)
	ghost.scale=Parts.definition(kind).size
	ghost.material_override.albedo_color=Color(.50,.90,.73,.35) if validation.ok else Color(1,.3,.22,.35)

func _position_used(bp:Dictionary,p:Vector3)->bool:
	for part in bp.parts:
		if BP.position(part).distance_to(p)<.02:return true
	return false

func _pick_part(mouse:Vector2):
	var from=camera.project_ray_origin(mouse)
	var direction=camera.project_ray_normal(mouse)
	var inverse=aircraft.craft_basis().transposed()
	var origin=aircraft.craft_origin()
	var nearest=INF
	var chosen=""
	for part in history.current.parts:
		var transform=Transform3D(aircraft.craft_basis()*BP.basis(part),origin+aircraft.craft_basis()*BP.position(part))
		var local_from=transform.affine_inverse()*from
		var local_to=transform.affine_inverse()*(from+direction*2000)
		var size:Vector3=Parts.definition(part.kind).size
		var result=AABB(-size*.5,size).intersects_segment(local_from,local_to)
		if result!=null:
			var distance=from.distance_to(transform*result)
			if distance<nearest:nearest=distance;chosen=part.id
	if chosen!="":
		selected_id=chosen
		history.selected=chosen
		_update_build_ui()
		_update_sockets()

func _place_candidate():
	if candidate.is_empty():return
	if not candidate.ok:_notice(candidate.error,4);return
	var result=history.apply(candidate.bp,candidate.selected)
	if result.ok:_after_edit()
	else:_notice(result.error,4)

func _replace_selected():
	var bp=history.current
	var selected=_selected_part()
	for part in bp.parts:
		var p=BP.position(part)
		var original=BP.position(selected)
		if part.id==selected.id or (mirror and absf(original.x)>.3 and part.kind==selected.kind and p.distance_to(Vector3(-original.x,original.y,original.z))<.01):
			part.kind=kind
	var result=history.apply(bp,selected_id)
	if result.ok:_after_edit()
	else:_notice(result.error,4)

func _remove_selected():
	var bp=history.current
	var index=-1
	for i in range(bp.parts.size()):
		if bp.parts[i].id==selected_id:index=i
	if index<0:return
	if bp.parts[index].kind=="cockpit":_notice("The cockpit is the root of your aircraft.",4);return
	bp.parts.remove_at(index)
	var result=history.apply(bp,bp.parts[0].id)
	if result.ok:_after_edit()
	else:_notice(result.error,4)

func _paint(color:String):
	var bp=history.current
	bp.paint=color
	if history.apply(bp,selected_id).ok:_after_edit()

func _save_profile():
	var result=Profile.save(folder,profile)
	if not result.ok:_notice("Save failed. Your live aircraft is intact: "+result.error,8)

func _save_design():
	var bp=history.current
	bp.name="Custom aircraft %d"%(profile.blueprints.size()+1)
	if profile.blueprints.size()>=24:profile.blueprints.pop_front()
	profile.blueprints.append(bp)
	profile.current=history.current
	_save_profile()
	_notice("Blueprint saved locally. Your design survives a restart.",4)

func _show_blueprints():
	var box=_clear(pause_panel)
	box.add_child(_label("YOUR BLUEPRINTS",24))
	var scroll=ScrollContainer.new()
	scroll.custom_minimum_size=Vector2(385,330)
	box.add_child(scroll)
	var list=_vbox(scroll)
	list.size_flags_horizontal=Control.SIZE_EXPAND_FILL
	list.add_child(_button("Island trainer",func():_load_blueprint(BP.starter())))
	for bp in profile.blueprints:
		list.add_child(_button(bp.name+" · %d parts"%bp.parts.size(),func():_load_blueprint(bp)))
	box.add_child(_button("Back",func():pause_panel.hide()))
	pause_panel.show()

func _load_blueprint(bp:Dictionary):
	var valid=BP.validate(bp)
	if not valid.ok:_notice(valid.error);return
	history=History.new(bp,bp.parts[0].id)
	_rebuild()

func start_flight():
	if mode=="paused":return
	aircraft.launch(WorldType.HOME+Vector3(0,1.55,88))
	aircraft.throttle=.0
	mode="flight"
	completed_this_run=false
	flight_trace.clear()
	build_panel.hide()
	pause_panel.hide()
	crash_panel.hide()
	ghost.hide()
	selection_box.hide()
	for s in sockets:s.hide()
	_notice("Hold Shift or Up for power. S gently raises the nose; A/D bank. Space brakes.",8)
	_play_contact(.25)

func retry():
	if mode=="build":return
	_rebuild()
	start_flight()
	_notice("Same design. Fresh battery and cargo. Try one useful change.",4)

func return_to_hangar():
	if mode=="build":return
	_record_attempt()
	var finished_job=completed_this_run
	if finished_job:contract=Contracts.next_contract(profile.completed)
	_rebuild()
	_notice("Next job: "+contract.title+" · "+contract.description if finished_job else "Back at the hangar. Your design is preserved.",7)

func _record_attempt():
	if aircraft.elapsed<.1:return
	last_attempt=aircraft.telemetry().duplicate(true)
	last_trace=flight_trace.duplicate(true)

func _on_crash(text:String):
	if not aircraft.crashed:return
	mode="crashed"
	_record_attempt()
	var box=_clear(crash_panel)
	box.add_child(_label("A ROUGH ARRIVAL",25,Color("edbd8a")))
	box.add_child(_label(text,17))
	box.add_child(_label("Your aircraft design is safe. Rebuild or make another attempt.",14,Color("b6c9c9")))
	box.add_child(_button("Fly again  [R]",retry,"CrashRetryButton"))
	box.add_child(_button("Modify in hangar  [Tab]",return_to_hangar,"CrashBuildButton"))
	box.add_child(_button("Inspect actual flight  [I]",_show_inspector))
	crash_panel.show()
	_play_contact(.8)

func toggle_pause():
	if mode=="build":_show_settings();return
	if mode=="paused":_resume();return
	if mode!="flight":return
	last_mode=mode
	mode="paused"
	aircraft.set_paused(true)
	var box=_clear(pause_panel)
	box.add_child(_label("TAKE A BREATHER",25))
	box.add_child(_button("Resume flight",_resume,"ResumeButton"))
	box.add_child(_button("Inspect this flight",_show_inspector))
	box.add_child(_button("Controls & settings",_show_settings))
	box.add_child(_button("Return to hangar",return_to_hangar))
	box.add_child(_button("Credits & licences",_show_credits))
	box.add_child(_button("Save & quit",_quit))
	pause_panel.show()

func _resume():
	pause_panel.hide()
	inspector.hide()
	if mode=="paused":mode="flight";aircraft.set_paused(false)

func _choose_contract():
	var box=_clear(pause_panel)
	box.add_child(_label("THE DISPATCH DESK",23))
	for item in Contracts.all():
		var available=item.id=="first_delivery" or (item.id=="heavy_cargo" and profile.completed.has("first_delivery")) or (item.id=="ridge_run" and profile.completed.has("heavy_cargo"))
		var button=_button(("✓ " if profile.completed.has(item.id) else "")+item.title+" · %.0f kg"%item.cargo_mass,func():contract=item;launch_payload=true;_rebuild();_notice(item.description,7))
		button.disabled=not available
		box.add_child(button)
	box.add_child(_button("Free flight · no cargo",func():launch_payload=false;contract={};_rebuild();_notice("Explore and build without a delivery target.",5),"FreeFlightButton"))
	box.add_child(_button("Back",func():pause_panel.hide()))
	pause_panel.show()

func _deliver():
	if not launch_payload or completed_this_run or contract.is_empty():return
	if not Contracts.can_deliver(contract,aircraft.telemetry()):
		_notice("Land inside the destination pad and slow below 2 m/s to unload.",4)
		return
	completed_this_run=true
	if not profile.completed.has(contract.id):profile.completed.append(contract.id)
	_save_profile()
	_record_attempt()
	aircraft.unload_cargo()
	_play_contact(.4)
	_notice("DELIVERED · "+contract.reward+" unlocked. Return to the hangar for your next job.",10)

func _show_settings():
	if mode=="flight":last_mode="flight";mode="paused";aircraft.set_paused(true)
	var box=_clear(pause_panel)
	box.add_child(_label("CONTROLS & COMFORT",23))
	var scroll=ScrollContainer.new()
	scroll.custom_minimum_size=Vector2(385,330)
	box.add_child(scroll)
	var list=_vbox(scroll)
	list.size_flags_horizontal=Control.SIZE_EXPAND_FILL
	_binding_buttons.clear()
	for action in ["pitch_up","pitch_down","roll_left","roll_right","yaw_left","yaw_right","throttle_up","throttle_down","brake","hangar","retry","interact","pause_game","inspect","overlay","orbit","undo_build","redo_build","rotate_pitch","rotate_yaw","rotate_roll"]:
		var b=_button(action.replace("_"," ").capitalize()+"   "+Bindings.label(action),func():_bind_action=action;_notice("Press a key, mouse button or gamepad control for "+action.replace("_"," "),20))
		list.add_child(b)
		_binding_buttons[action]=b
	var invert=CheckButton.new()
	invert.text="Invert pitch"
	invert.button_pressed=profile.settings.invert_pitch
	invert.toggled.connect(func(v):profile.settings.invert_pitch=v;_save_profile())
	list.add_child(invert)
	var reduced=CheckButton.new()
	reduced.text="Reduced camera motion"
	reduced.button_pressed=profile.settings.get("reduced_motion",false)
	reduced.toggled.connect(func(v):profile.settings.reduced_motion=v;_save_profile())
	list.add_child(reduced)
	var volume=HSlider.new()
	volume.min_value=0
	volume.max_value=1
	volume.step=.05
	volume.value=profile.settings.master_volume
	volume.custom_minimum_size=Vector2(270,26)
	volume.value_changed.connect(func(v):profile.settings.master_volume=v;if_not_testing_volume(v);_save_profile())
	list.add_child(_label("Game volume",13))
	list.add_child(volume)
	box.add_child(_button("Back to game",func():pause_panel.hide();_resume()))
	box.add_child(_button("Credits & licences",_show_credits))
	box.add_child(_button("Save & quit",_quit))
	pause_panel.show()

func _show_credits():
	var box=_clear(pause_panel)
	box.add_child(_label("FLIGHT ISLANDS · NATIVE ALPHA",22))
	var text=RichTextLabel.new()
	text.custom_minimum_size=Vector2(385,360)
	text.text=FileAccess.get_file_as_string("res://THIRD_PARTY_NOTICES.txt")
	text.add_theme_font_size_override("normal_font_size",13)
	box.add_child(text)
	box.add_child(_button("Back",_show_settings))
	pause_panel.show()

func if_not_testing_volume(value):
	if not get_node("/root/Boot").test_mode:AudioServer.set_bus_volume_db(0,linear_to_db(maxf(value,.0001)))

func _toggle_engineering():
	engineering.enabled=not engineering.enabled
	_notice("Gold: centre of mass / weight · cyan: wing forces · orange: engines. Arrows scale at 1.8 cm/N, capped at 6 m." if engineering.enabled else "Engineering overlay hidden.",7)

func _show_inspector():
	if mode=="flight":mode="paused";aircraft.set_paused(true)
	pause_panel.hide()
	var box=_clear(inspector)
	var t=aircraft.telemetry() if mode!="build" else last_attempt
	box.add_child(_label("THE FLIGHT NOTEBOOK",24))
	if t.is_empty():
		box.add_child(_label("Make a flight first. This notebook records your actual measurements.",16))
	else:
		box.add_child(_label("%.1f m/s airspeed · %.1f m altitude\n%.2f kg loaded mass · %.1f kJ remaining\n%.0f m travelled · %.1f s elapsed\nPitch %.1f° · bank %.1f°"%[t.airspeed,t.altitude,t.mass,t.energy/1000,t.distance,t.elapsed,rad_to_deg(t.pitch),rad_to_deg(t.bank)],16))
		box.add_child(_label("Centre of mass: %.2f, %.2f, %.2f m\nPrincipal inertia: %.2f, %.2f, %.2f kg·m²"%[t.com.x,t.com.y,t.com.z,t.principal.x,t.principal.y,t.principal.z],14,Color("b6c9c9")))
		var graph=preload("res://game/flight_graph.gd").new()
		graph.samples=flight_trace.duplicate(true) if mode!="build" else last_trace.duplicate(true)
		box.add_child(graph)
		box.add_child(_label("More wing area lowers the required airspeed but adds mass and drag. Cargo location changes the balance. Change one thing, then compare another flight.",15))
	box.add_child(_button("Back",func():inspector.hide();if mode=="paused":_resume()))
	inspector.show()

func _quit():
	profile.current=history.current
	_save_profile()
	get_tree().quit()

func _notice(text:String,duration=5.0):
	_toast=text
	_message_time=duration
	if message_label:message_label.text=text

func _physics_process(dt):
	if aircraft==null:return
	if mode=="flight" and not aircraft.crashed:
		var pitch=Input.get_axis("pitch_down","pitch_up")
		if profile.settings.invert_pitch:pitch=-pitch
		aircraft.controls=Vector3(pitch,Input.get_axis("yaw_left","yaw_right"),Input.get_axis("roll_left","roll_right"))
		aircraft.throttle=clampf(aircraft.throttle+Input.get_axis("throttle_down","throttle_up")*dt*.38,0,1)
		aircraft.brake=Input.is_action_pressed("brake")
		_last_physics=aircraft.telemetry()
		if Engine.get_physics_frames()%24==0:
			flight_trace.append({"t":_last_physics.elapsed,"speed":_last_physics.speed,"altitude":_last_physics.altitude,"energy":_last_physics.energy})
			if flight_trace.size()>600:flight_trace.pop_front()
		for discovery in world.discoveries:
			if not profile.discovered.has(discovery.id) and aircraft.craft_origin().distance_to(discovery.p)<70:
				profile.discovered.append(discovery.id)
				_save_profile()
				_notice("DISCOVERED · "+discovery.name,7)
	else:aircraft.controls=Vector3.ZERO

func _process(dt):
	if aircraft==null:return
	_elapsed_world+=dt
	_layout_ui()
	_message_time-=dt
	if _message_time<=0 and message_label:message_label.text=""
	_update_camera(dt)
	if mode=="build":_update_sockets();_update_ghost()
	else:ghost.hide()
	reticle.queue_redraw()
	_ui_timer+=dt
	if _ui_timer>.1:
		_ui_timer=0
		_update_hud()
	_update_audio()

func _update_hud():
	var t=aircraft.telemetry()
	unload_button.visible=mode=="flight" and not contract.is_empty() and not completed_this_run and aircraft.craft_origin().distance_to(contract.destination)<35
	unload_button.disabled=not Contracts.can_deliver(contract,t)
	unload_button.position=get_viewport().get_visible_rect().size*Vector2(.5,.78)-Vector2(100,0)
	var percent=t.energy/maxf(1,t.capacity)*100
	energy_bar.value=percent
	instruments.text="%02.0f m/s   |   %03.0f m   |   PWR %.0f%%   BAT %.0f%%"%[t.speed,t.altitude,t.throttle*100,percent]
	assist_hint.text="W/S pitch · A/D bank · Q/E yaw · Shift/Up power · Ctrl/Down reduce · Space brake" if mode=="flight" else "Right-drag orbit · scroll zoom · Tab hangar · R retry"
	if t.stall and mode=="flight":assist_hint.text="STALL · lower the nose and build airspeed";assist_hint.modulate=Color("efb06d")
	else:assist_hint.modulate=Color.WHITE
	if contract.is_empty():objective.text="FREE FLIGHT\nExplore the islands at your own pace."
	elif completed_this_run:objective.text="DELIVERY COMPLETE\nReturn to the hangar for another job."
	else:
		var distance=aircraft.craft_origin().distance_to(contract.destination)
		objective.text="%s   ·   %.0f kg\n%s   ·   %.0f m away"%[contract.title.to_upper(),contract.cargo_mass,"HARBOUR POST" if contract.id!="ridge_run" else "RIDGE OBSERVATORY",distance]
		if mode=="flight" and Contracts.can_deliver(contract,t):_notice("Delivery pad reached · press F / gamepad B to unload",.2)

func _update_camera(dt):
	var origin=aircraft.craft_origin()
	var target=origin+Vector3.UP*.3
	var desired:Vector3
	if mode=="build":
		var offset=Vector3(sin(orbit_yaw)*cos(orbit_pitch),sin(orbit_pitch),cos(orbit_yaw)*cos(orbit_pitch))*orbit_distance
		desired=target+offset
	else:
		var f=-aircraft.craft_basis().z
		f.y=0
		if f.length_squared()>.02:
			var angle=atan2(-f.x,-f.z)
			_last_heading=rotate_toward(_last_heading,angle,dt*1.8)
		chase_heading=Vector3(-sin(_last_heading),0,-cos(_last_heading))
		var side=chase_heading.cross(Vector3.UP)
		desired=origin-chase_heading*chase_distance+Vector3.UP*3.5+side*2.0
		target=origin+Vector3.UP*1+chase_heading*4
	desired.y=maxf(desired.y,world.terrain_height(desired.x,desired.z)+.8)
	var obstruction=get_world_3d().direct_space_state.intersect_ray(PhysicsRayQueryParameters3D.create(target,desired,1))
	if not obstruction.is_empty():desired=obstruction.position+obstruction.normal*.5
	var amount=1.0 if profile.settings.get("reduced_motion",false) else 1-exp(-dt*6)
	camera.global_position=camera.global_position.lerp(desired,amount)
	camera.look_at(target,Vector3.UP)

func _unhandled_input(event):
	if _bind_action!="":
		var token=Bindings.token_for(event)
		if token!="":
			profile.settings.bindings[_bind_action]=[token]
			Bindings.install(profile.settings.bindings)
			_bind_action=""
			_save_profile()
			_show_settings()
			_notice("Control saved.",3)
			get_viewport().set_input_as_handled()
		return
	if event.is_action_pressed("pause_game"):toggle_pause();return
	if event.is_action_pressed("retry") and mode!="build":retry();return
	if event.is_action_pressed("hangar") and mode!="build":return_to_hangar();return
	if event.is_action_pressed("interact") and mode=="flight":_deliver()
	if event.is_action_pressed("overlay"):_toggle_engineering();return
	if event.is_action_pressed("inspect"):_show_inspector();return
	if mode=="flight" and event is InputEventMouseButton and event.pressed:
		if event.button_index==MOUSE_BUTTON_WHEEL_UP:chase_distance=maxf(8,chase_distance-1)
		if event.button_index==MOUSE_BUTTON_WHEEL_DOWN:chase_distance=minf(26,chase_distance+1)
	if mode!="build" or pause_panel.visible or inspector.visible:return
	if event is InputEventKey and event.pressed and not event.echo:
		if event.is_action_pressed("rotate_yaw"):rotation_quarters.y=fmod(rotation_quarters.y+90,360)
		if event.is_action_pressed("rotate_pitch"):rotation_quarters.x=fmod(rotation_quarters.x+90,360)
		if event.is_action_pressed("rotate_roll"):rotation_quarters.z=fmod(rotation_quarters.z+90,360)
		if event.physical_keycode in [KEY_DELETE,KEY_BACKSPACE]:_remove_selected()
		if event.is_action_pressed("undo_build"):history.undo();_after_edit()
		if event.is_action_pressed("redo_build"):history.redo();_after_edit()
	if event is InputEventMouseButton:
		if event.is_action("orbit"):
			_dragging=event.pressed
			_drag_distance=0
		if event.button_index==MOUSE_BUTTON_WHEEL_UP:orbit_distance=maxf(5,orbit_distance-1)
		if event.button_index==MOUSE_BUTTON_WHEEL_DOWN:orbit_distance=minf(40,orbit_distance+1)
		if event.button_index==MOUSE_BUTTON_LEFT:
			if event.pressed:_mouse_down=event.position;_drag_distance=0
			elif event.position.distance_to(_mouse_down)<5:
				if not candidate.is_empty():_place_candidate()
				else:_pick_part(event.position)
	if event is InputEventMouseMotion and _dragging:
		orbit_yaw-=event.relative.x*.007
		orbit_pitch=clampf(orbit_pitch+event.relative.y*.005,-.05,1.1)

func _notification(what):
	if what==NOTIFICATION_WM_WINDOW_FOCUS_OUT and mode=="flight" and not has_meta("quality_flow_active") and not has_meta("quality_benchmark_active"):toggle_pause()
	if what==NOTIFICATION_WM_CLOSE_REQUEST and is_inside_tree() and profile!=null and not profile.is_empty():_quit()

func _create_audio():
	sound_engine=AudioStreamPlayer.new()
	sound_wind=AudioStreamPlayer.new()
	sound_contact=AudioStreamPlayer.new()
	for player in [sound_engine,sound_wind,sound_contact]:add_child(player)
	sound_engine.stream=_tone(1.0,90,true)
	sound_wind.stream=_tone(2.0,0,true)
	sound_contact.stream=_tone(.18,160,false)
	sound_engine.volume_db=-80
	sound_wind.volume_db=-80
	sound_engine.play()
	sound_wind.play()
	audio_events+=2

func _tone(seconds:float,hz:float,looped:bool)->AudioStreamWAV:
	var audio=AudioStreamWAV.new()
	audio.format=AudioStreamWAV.FORMAT_16_BITS
	audio.mix_rate=22050
	var count=int(seconds*audio.mix_rate)
	var bytes=PackedByteArray()
	bytes.resize(count*2)
	var rng=RandomNumberGenerator.new()
	rng.seed=146
	var filtered=0.0
	for i in range(count):
		var t=float(i)/audio.mix_rate
		filtered=filtered*.97+rng.randf_range(-1,1)*.03
		var value=(sin(t*TAU*hz)*.4+sin(t*TAU*hz*2)*.12) if hz>0 else filtered*3
		if not looped:value*=exp(-t*25)
		bytes.encode_s16(i*2,int(clampf(value,-1,1)*24000))
	audio.data=bytes
	if looped:audio.loop_mode=AudioStreamWAV.LOOP_FORWARD;audio.loop_end=count
	return audio

func _update_audio():
	if sound_engine==null:return
	var active=mode=="flight" and not aircraft.crashed
	sound_engine.volume_db=lerpf(sound_engine.volume_db,-18+aircraft.throttle*8 if active and aircraft.energy>0 else -80,.15)
	sound_engine.pitch_scale=.6+aircraft.throttle*1.4
	sound_wind.volume_db=lerpf(sound_wind.volume_db,clampf(-65+aircraft.linear_velocity.length()*1.5,-80,-18) if active else -80,.1)

func _play_contact(strength:float):
	if sound_contact:
		sound_contact.volume_db=-20+strength*10
		sound_contact.play()
		audio_events+=1

func _exit_tree():
	for player in [sound_engine,sound_wind,sound_contact]:
		if is_instance_valid(player):
			player.stop()
			player.stream=null
