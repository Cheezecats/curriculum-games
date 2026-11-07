extends Control
var aircraft
var destination=Vector3.ZERO
var has_target=false
var pads:Dictionary={}
func _ready():
	mouse_filter=Control.MOUSE_FILTER_IGNORE
func _process(_dt):queue_redraw()
func _map(p:Vector3)->Vector2:
	return Vector2(size.x*.5,size.y*.5)+Vector2(p.x,p.z)*(.43*size.x/800)
func _draw():
	var center=size*.5
	draw_style_box(_background(),Rect2(Vector2.ZERO,size))
	var outline=PackedVector2Array()
	for i in range(64):
		var angle=float(i)/64*TAU
		outline.append(_map(Vector3(cos(angle)*680,0,sin(angle)*650+30)))
	draw_colored_polygon(outline,Color("6a8267"))
	for key in pads:
		var p=_map(pads[key])
		draw_rect(Rect2(p-Vector2(2,5),Vector2(4,10)),Color("d9d5ba"))
	if has_target:
		var target=_map(destination)
		draw_arc(target,6,0,TAU,32,Color("e7bd78"),1.5,true)
	if aircraft and is_instance_valid(aircraft):
		var p=_map(aircraft.craft_origin())
		var f=-aircraft.craft_basis().z
		var forward=Vector2(f.x,f.z).normalized()
		var right=Vector2(-forward.y,forward.x)
		draw_colored_polygon(PackedVector2Array([p+forward*7,p-forward*4+right*4,p-forward*2,p-forward*4-right*4]),Color("fff1cc"))
	draw_string(ThemeDB.fallback_font,Vector2(12,18),"N  ↑    ISLAND CHART",HORIZONTAL_ALIGNMENT_LEFT,-1,10,Color("d9e3df"))
func _background()->StyleBoxFlat:
	var style=StyleBoxFlat.new()
	style.bg_color=Color(.045,.09,.12,.88)
	style.set_corner_radius_all(7)
	return style
