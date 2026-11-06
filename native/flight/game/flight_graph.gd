extends Control
var samples:Array=[]
func _ready():
	custom_minimum_size=Vector2(500,110)
	mouse_filter=Control.MOUSE_FILTER_IGNORE
func _draw():
	var area=Rect2(0,12,size.x,size.y-27)
	for i in range(4):draw_line(Vector2(0,area.position.y+i*area.size.y/3),Vector2(size.x,area.position.y+i*area.size.y/3),Color(.6,.7,.7,.2))
	if samples.size()<2:return
	var max_height=10.0
	var max_speed=10.0
	for sample in samples:
		max_height=maxf(max_height,sample.altitude)
		max_speed=maxf(max_speed,sample.speed)
	for key in ["speed","altitude"]:
		var points=PackedVector2Array()
		for i in range(samples.size()):
			var value=samples[i][key]/(max_speed if key=="speed" else max_height)
			points.append(Vector2(float(i)/(samples.size()-1)*size.x,area.end.y-value*area.size.y))
		draw_polyline(points,Color("e7be7d") if key=="speed" else Color("9bc6d7"),1.7,true)
	draw_string(ThemeDB.fallback_font,Vector2(0,size.y-1),"ACTUAL TRACE   ·   gold: speed %.0f m/s   blue: altitude %.0f m"%[max_speed,max_height],HORIZONTAL_ALIGNMENT_LEFT,-1,11,Color("bccbc9"))
