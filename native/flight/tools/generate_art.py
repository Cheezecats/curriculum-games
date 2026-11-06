"""Flight Islands original art. Blender 4.5+ background, no external inputs.

Run: Blender --background --factory-startup --python native/flight/tools/generate_art.py
Source geometry helpers use game metres (+Y up / -Z forward). Export is glTF Y-up.
Every exported animated pivot is a glTF identity rotation with the contracted local axes.
"""
import bpy, math, random, json, struct, os, sys
from pathlib import Path
from mathutils import Vector, Matrix

BASE = Path(__file__).resolve().parents[1] / 'assets'
for p in ['models', 'environment', 'source', 'previews']:
    (BASE/p).mkdir(parents=True, exist_ok=True)
random.seed(29)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
for c in list(bpy.data.collections):
    if c.name != 'Collection': bpy.data.collections.remove(c)
source_scene = bpy.context.scene
source_scene.name = 'Editable asset library'
COL = None
ROOT = None
ASSETS = {}
GROUPS = {}

def cv(v): return Vector((v[0], -v[2], v[1]))
def mat(name, rgb, rough=.55, metal=0):
    m=bpy.data.materials.new(name); m.diffuse_color=(*rgb,1); m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF'); bs.inputs['Base Color'].default_value=(*rgb,1)
    bs.inputs['Roughness'].default_value=rough; bs.inputs['Metallic'].default_value=metal
    return m
M = {
 'Paint':mat('Paint',(.69,.105,.07),.32,.14),
 'Ivory':mat('Ivory',(.87,.805,.63),.45),
 'Navy':mat('Navy',(.028,.075,.115),.42,.12),
 'Aluminium':mat('Aluminium',(.43,.53,.56),.3,.75),
 'Rubber':mat('Rubber',(.018,.026,.03),.82),
 'Glass':mat('Glass',(.065,.24,.31),.15,.38),
 'Wood':mat('Wood',(.39,.205,.085),.75),
 'WoodLight':mat('WoodLight',(.64,.40,.17),.68),
 'Brass':mat('Brass',(.65,.43,.14),.34,.68),
 'Pine':mat('Pine',(.07,.23,.16),.95),
 'Leaf':mat('Leaf',(.19,.35,.17),.95),
 'LeafLight':mat('LeafLight',(.32,.43,.19),.95),
 'Stone':mat('Stone',(.38,.43,.43),.96),
 'Concrete':mat('Concrete',(.56,.57,.49),.95),
 'Glow':mat('Glow',(.99,.62,.19),.28),
}
glow=M['Glow'].node_tree.nodes.get('Principled BSDF')
glow.inputs['Emission Color'].default_value=(1,.34,.07,1)
glow.inputs['Emission Strength'].default_value=.8

def asset(name, family):
    global COL, ROOT, GROUPS
    COL=bpy.data.collections.new(name); source_scene.collection.children.link(COL)
    ROOT=bpy.data.objects.new(name,None); COL.objects.link(ROOT)
    ROOT['game_forward']='-Z'; ROOT['game_up']='+Y'; ROOT['units']='metres'
    GROUPS={}
    ASSETS[name]={'collection':COL,'root':ROOT,'family':family}
    return ROOT

def link(obj, name, material, parent=None):
    for c in list(obj.users_collection): c.objects.unlink(obj)
    COL.objects.link(obj); obj.name=name
    if obj.type=='MESH':
        bpy.context.view_layer.update()
        # Bake all modelling transforms, then use identity local nodes in exported hierarchy.
        obj.data.transform(obj.matrix_world); obj.matrix_world=Matrix.Identity(4)
        obj.data.materials.clear(); obj.data.materials.append(M[material])
        for p in obj.data.polygons: p.use_smooth=True
    parent=parent or ROOT
    if obj.type=='MESH' and parent != ROOT:
        obj.data.transform(Matrix.Translation(-parent.location))
    obj.parent=parent
    GROUPS.setdefault((parent.name,material),[]).append(obj)
    return obj

def mesh(name, vs, fs, material, parent=None, smooth=True):
    me=bpy.data.meshes.new(name); me.from_pydata([cv(v) for v in vs],[],fs); me.update()
    ob=bpy.data.objects.new(name,me); COL.objects.link(ob)
    return link(ob,name,material,parent)

def box(name,pos,size,material,bevel=.02,parent=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=cv(pos))
    ob=bpy.context.object; ob.dimensions=(size[0],size[2],size[1]); bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        mod=ob.modifiers.new('Soft manufactured edges','BEVEL'); mod.width=bevel; mod.segments=2
        bpy.context.view_layer.objects.active=ob; bpy.ops.object.modifier_apply(modifier=mod.name)
    return link(ob,name,material,parent)

def sphere(name,pos,size,material,segments=20,rings=10,parent=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,radius=1,location=cv(pos))
    ob=bpy.context.object; ob.scale=(size[0]/2,size[2]/2,size[1]/2)
    return link(ob,name,material,parent)

def cylinder(name,a,b,r,material,vertices=16,r2=None,parent=None):
    d=cv(b)-cv(a); mid=(cv(a)+cv(b))/2
    bpy.ops.mesh.primitive_cone_add(vertices=vertices,radius1=r,radius2=r if r2 is None else r2,depth=d.length,location=mid)
    ob=bpy.context.object; ob.rotation_euler=d.to_track_quat('Z','Y').to_euler()
    return link(ob,name,material,parent)

def torus(name,pos,major,minor,material,axis='Z',parent=None):
    bpy.ops.mesh.primitive_torus_add(major_radius=major,minor_radius=minor,major_segments=24,minor_segments=8,location=cv(pos))
    ob=bpy.context.object
    direction={'X':Vector((1,0,0)),'Y':Vector((0,0,1)),'Z':Vector((0,-1,0))}[axis]
    ob.rotation_euler=direction.to_track_quat('Z','Y').to_euler()
    return link(ob,name,material,parent)

def pivot(name,pos):
    ob=bpy.data.objects.new(name,None); COL.objects.link(ob); ob.location=cv(pos); ob.parent=ROOT
    ob['animation_pivot']=name
    return ob

def curve(name,points,r,material,parent=None):
    for i in range(len(points)-1): cylinder(name,points[i],points[i+1],r,material,8,parent=parent)

def loft(name,sections,material,n=20):
    # Each section: z, half-width, half-height, vertical centre.
    vs=[]
    for z,w,h,y in sections:
        vs += [(w*math.cos(2*math.pi*i/n),y+h*math.sin(2*math.pi*i/n),z) for i in range(n)]
    fs=[]
    for j in range(len(sections)-1):
        for i in range(n): fs.append((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i))
    fs += [tuple(reversed(range(n))),tuple((len(sections)-1)*n+i for i in range(n))]
    return mesh(name,vs,fs,material)

def airfoil(name,span,thick,chord,material='Ivory',parent=None,center=(0,0,0),tip=.88):
    # Closed cambered NACA-like sectional wing, with swept rounded tips.
    count=16; xs=[-span/2,-span*.47,-span*.37,0,span*.37,span*.47,span/2]
    vs=[]
    outline=[(i/count,1) for i in range(count+1)]+[(i/count,-1) for i in range(count-1,0,-1)]
    for k,x in enumerate(xs):
        taper=tip if k in [0,len(xs)-1] else (.98 if k in [1,len(xs)-2] else 1)
        for t,side in outline:
            half=5*.12*(.2969*math.sqrt(t)-.126*t-.3516*t*t+.2843*t**3-.1036*t**4)*chord
            half*=thick/(.12*chord)
            camber=.012*chord*math.sin(t*math.pi)
            vs.append((x+center[0],center[1]+(half*side+camber)*taper,center[2]+(t-.5)*chord*taper+.035*chord*(abs(x)/(span/2))**3))
    n=len(outline); fs=[]
    for k in range(len(xs)-1):
        for j in range(n): fs.append((k*n+j,k*n+(j+1)%n,(k+1)*n+(j+1)%n,(k+1)*n+j))
    fs.extend([tuple(reversed(range(n))),tuple((len(xs)-1)*n+j for j in range(n))])
    return mesh(name,vs,fs,material,parent)

def rivet(pos,axis='Y',parent=None):
    d={'X':(.004,0,0),'Y':(0,.004,0),'Z':(0,0,.004)}[axis]
    cylinder('Flush rivet',tuple(pos[i]-d[i] for i in range(3)),tuple(pos[i]+d[i] for i in range(3)),.009,'Aluminium',8,parent=parent)

def finish(name):
    # Batch by material and animation parent, preserving just the documented pivots.
    for (parent_name, material), objects in GROUPS.items():
        meshes=[o for o in objects if o.type=='MESH']
        if not meshes: continue
        bpy.ops.object.select_all(action='DESELECT')
        for ob in meshes: ob.select_set(True)
        bpy.context.view_layer.objects.active=meshes[0]
        if len(meshes)>1: bpy.ops.object.join()
        ob=bpy.context.object; ob.name=f'{parent_name}_{material}'
    entry=ASSETS[name]; allobs=list(entry['collection'].objects)
    bpy.ops.object.select_all(action='DESELECT')
    for ob in allobs: ob.select_set(True)
    dest=BASE/entry['family']/(name+'.glb')
    bpy.ops.export_scene.gltf(filepath=str(dest),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_animations=False,export_cameras=False,export_lights=False)
    # Blender requires globally unique datablock names; the independent GLBs do not.
    # Restore exact contracted pivot names in their respective exported hierarchies.
    payload=dest.read_bytes(); json_length=struct.unpack_from('<I',payload,12)[0]
    gltf=json.loads(payload[20:20+json_length])
    for node in gltf.get('nodes',[]):
        for canonical in ['Flap','Wheel','Propeller']:
            node_name=node.get('name','')
            if node_name==canonical or (node_name.startswith(canonical+'.') and node_name[len(canonical)+1:].isdigit()):
                node['name']=canonical
    encoded=json.dumps(gltf,separators=(',',':')).encode('utf8')
    encoded += b' '*((-len(encoded))%4)
    remainder=payload[20+json_length:]
    dest.write_bytes(struct.pack('<4sII',b'glTF',2,20+len(encoded)+len(remainder))+struct.pack('<I4s',len(encoded),b'JSON')+encoded+remainder)
    verts=sum(len(o.data.vertices) for o in allobs if o.type=='MESH')
    tris=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in allobs if o.type=='MESH')
    entry['vertices']=verts;entry['triangles']=tris;entry['mesh_nodes']=sum(o.type=='MESH' for o in allobs)
    print('ART_ASSET',name,verts,tris,entry['mesh_nodes'],flush=True)

# --- Aircraft kit ----------------------------------------------------------
asset('cockpit','models')
loft('Riveted lower boat',[(-.75,.20,.19,-.12),(-.63,.36,.25,-.13),(-.35,.425,.25,-.13),(.24,.40,.23,-.15),(.62,.27,.18,-.16),(.75,.18,.13,-.17)],'Ivory')
loft('Red nose wrap',[(-.752,.202,.192,-.12),(-.67,.34,.24,-.13),(-.59,.373,.254,-.13)],'Paint')
# Ellipsoidal bubble canopy cut at its equator; carefully framed with navy arcs.
vs=[]; fs=[]; steps=16; rings=8
for j in range(rings+1):
    a=j/rings*math.pi/2
    for i in range(steps+1):
        t=i/steps*math.pi*2
        vs.append((.34*math.cos(t)*math.cos(a),.02+.4*math.sin(a),-.015+.54*math.sin(t)*math.cos(a)))
for j in range(rings):
    for i in range(steps): fs.append((j*(steps+1)+i,j*(steps+1)+i+1,(j+1)*(steps+1)+i+1,(j+1)*(steps+1)+i))
mesh('Blue bubble canopy',vs,fs,'Glass')
curve('Canopy sill',[(.343*math.cos(i*math.pi/12),.025,-.015+.545*math.sin(i*math.pi/12)) for i in range(25)],.012,'Navy')
for z in [-.23,.26]:
    factor=math.sqrt(1-((z+.015)/.54)**2)
    curve('Canopy arch',[(.34*factor*math.cos(t*math.pi/12),.02+.4*factor*math.sin(t*math.pi/12),z) for t in range(13)],.013,'Navy')
for side in [-1,1]:
    curve('Beltline trim',[(side*.36,-.01,-.58),(side*.424,-.02,-.3),(side*.402,-.04,.22),(side*.265,-.05,.62)],.012,'Navy')
    for z in [-.45,-.22,0,.22,.44]: rivet((side*.39,-.10,z),'X')
box('Nose instrument housing',(0,.02,-.57),(.42,.12,.17),'Navy',.03)
finish('cockpit')

asset('fuselage','models')
loft('Streamlined rear shell',[(-.6,.35,.265,0),(-.49,.35,.275,0),(-.12,.32,.25,0),(.3,.245,.20,.015),(.6,.17,.14,.015)],'Ivory')
loft('Reinforced front collar',[(-.603,.352,.267,0),(-.55,.354,.278,0),(-.50,.351,.276,0)],'Navy')
loft('Tail band',[(.4,.22,.18,.015),(.49,.197,.163,.015)],'Paint')
for side in [-1,1]:
    curve('Longitudinal trim',[(side*.35,0,-.5),(side*.32,0,-.1),(side*.24,.015,.3),(side*.17,.015,.6)],.009,'Paint')
    for z,w in [(-.5,.35),(-.15,.325),(.2,.265),(.5,.197)]: rivet((side*w,0,z),'X')
box('Service hatch',(0,.25,-.24),(.22,.026,.32),'Aluminium',.015)
finish('fuselage')

asset('strut','models')
loft('Aerodynamic strut',[(-.5,.06,.058,0),(-.43,.074,.066,0),(.43,.074,.066,0),(.5,.06,.058,0)],'Ivory',12)
for z in [-.43,.43]:
    box('Clamp',(0,0,z),(.18,.18,.09),'Navy',.015)
    for x in [-.065,.065]: rivet((x,.091,z),'Y')
finish('strut')

for name,span,thick,chord in [('wing',2.2,.14,.7),('large_wing',3.2,.16,.85)]:
    asset(name,'models'); airfoil('Stitched cambered airfoil',span,thick*.87,chord)
    # Thin curved tips share sectional construction instead of thick box caps.
    for s in [-1,1]:
        airfoil('Painted tip',span*.105,thick*.82,chord*.91,'Paint',center=(s*span*.446,.001,.008))
    for x in [-span*.32,-span*.17,0,span*.17,span*.32]:
        curve('Fabric rib seam',[(x,thick*.32,-chord*.33),(x,thick*.48,-chord*.19),(x,thick*.46,0),(x,thick*.26,chord*.25),(x,.012,chord*.45)],.003,'WoodLight')
    for x in [-span*.17,span*.17]: box('Root reinforcement',(x,-thick*.35,-.035),(.075,.045,chord*.55),'Navy',.01)
    finish(name)

for name,span,thick,chord in [('aileron',1.2,.1,.3),('elevator',1.5,.12,.4)]:
    asset(name,'models'); flap=pivot('Flap',(0,0,-chord*.38))
    airfoil('Moving fabric surface',span,thick*.8,chord,'Ivory',parent=flap)
    for s in [-1,1]: airfoil('Red tip',span*.1,thick*.78,chord*.9,'Paint',parent=flap,center=(s*span*.448,0,.005))
    for x in [-span*.34,0,span*.34]:
        cylinder('Hinge pin',(x-.036,0,-chord*.405),(x+.036,0,-chord*.405),.022,'Aluminium',12)
        box('Hinge leaf',(x,-.023,-chord*.35),(.06,.028,.07),'Navy',.006)
    finish(name)

asset('rudder','models'); flap=pivot('Flap',(0,-.30,-.23))
# Rounded vertical airfoil with a swept top and distinct leading spar.
vs=[];fs=[];n=20
for y,chord,zc,w in [(-.4,.59,.0,.042),(-.32,.65,0,.06),(.1,.59,.035,.056),(.33,.43,.075,.04),(.4,.23,.10,.015)]:
    for i in range(n):
        a=2*math.pi*i/n
        vs.append((w*math.sin(a),y,zc+chord*.5*math.cos(a)))
for j in range(4):
    for i in range(n): fs.append((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i))
fs += [tuple(reversed(range(n))),tuple(4*n+i for i in range(n))]
mesh('Swept fabric fin',vs,fs,'Paint',flap)
for s in [-1,1]:
    box('Ivory tail marking',(s*.057,-.02,.05),(.004,.095,.28),'Ivory',.002,flap)
for y in [-.28,.03]: cylinder('Rudder hinge',(0,y-.038,-.24),(0,y+.038,-.24),.026,'Aluminium',12)
finish('rudder')

asset('motor','models')
loft('Engine cowling',[(-.25,.19,.19,0),(-.19,.265,.265,0),(.12,.275,.275,0),(.28,.235,.235,0),(.35,.19,.19,0)],'Paint',24)
for z in [-.18,.26]: torus('Cowling rolled lip',(0,0,z),.245,.014,'Aluminium')
for i in range(10):
    a=2*math.pi*i/10
    cylinder('Cooling slot rim',(.25*math.cos(a),.25*math.sin(a),.03),(.25*math.cos(a),.25*math.sin(a),.19),.012,'Navy',8)
for x in [-.13,.13]:
    cylinder('Rear engine mount',(x,-.16,.27),(x,-.16,.34),.032,'Aluminium',12)
prop=pivot('Propeller',(0,0,-.295))
for i in range(3):
    a=i*math.pi*2/3
    def bp(r,w,z): return (r*math.sin(a)+w*math.cos(a),r*math.cos(a)-w*math.sin(a),z)
    # Tapered, twisted, convex wooden blades.
    vs=[]
    for r,w,z in [(.045,.025,-.298),(.13,.045,-.31),(.238,.032,-.32),(.268,.008,-.315)]:
        vs += [bp(r,-w,z-.01),bp(r,w,z+.006),bp(r,w,z+.02),bp(r,-w,z+.01)]
    fs=[]
    for j in range(3):
        for k in range(4): fs.append((j*4+k,j*4+(k+1)%4,(j+1)*4+(k+1)%4,(j+1)*4+k))
    fs += [(3,2,1,0),(12,13,14,15)]
    mesh('Laminated wood prop blade',vs,fs,'WoodLight',prop)
    sphere('Ivory propeller tip',bp(.245,0,-.31),(.035,.045,.025),'Ivory',12,6,prop)
cylinder('Spinner',(0,0,-.35),(0,0,-.27),.069,'Aluminium',24,r2=.025,parent=prop)
finish('motor')

asset('battery','models')
box('Battery case',(0,-.012,0),(.48,.31,.68),'Navy',.045)
box('Rounded red lid',(0,.135,0),(.50,.055,.70),'Paint',.022)
for x in [-.18,.18]:
    box('Retaining band',(x,-.007,0),(.028,.325,.69),'Aluminium',.011)
    cylinder('Brass terminal',(x,.165,-.22),(x,.175,-.22),.035,'Brass',12)
for x in [-.10,-.05,0,.05,.10]: box('Vent',(x,.166,.22),(.018,.008,.12),'Navy',.004)
box('Ivory rating label',(0,.033,-.344),(.20,.13,.008),'Ivory',.006)
box('Red charge stripe',(0,.034,-.35),(.13,.018,.006),'Paint',.002)
finish('battery')

asset('gear','models')
wheel=pivot('Wheel',(0,-.10,0))
torus('Rubber tyre',(0,-.10,0),.166,.059,'Rubber','X',wheel)
cylinder('Wheel rim',(-.065,-.10,0),(.065,-.10,0),.116,'Aluminium',24,parent=wheel)
for s in [-1,1]:
    cylinder('Wheel hub',(s*.066,-.10,0),(s*.079,-.10,0),.042,'Navy',16,parent=wheel)
    for i in range(6):
        a=i*math.pi/3
        cylinder('Rim holes',(s*.066,-.10+.077*math.cos(a),.077*math.sin(a)),(s*.069,-.10+.077*math.cos(a),.077*math.sin(a)),.013,'Navy',8,parent=wheel)
    cylinder('Landing fork',(s*.12,-.10,0),(s*.105,.18,.025),.023,'Aluminium',12)
cylinder('Main oleo',(0,.12,.025),(0,.31,.025),.044,'Navy',16)
cylinder('Oleo piston',(0,.03,.025),(0,.20,.025),.026,'Aluminium',16)
box('Mounting shoe',(0,.302,.025),(.24,.046,.18),'Paint',.012)
finish('gear')

asset('cargo_mount','models')
for x in [-.30,.30]:
    box('Cradle rail',(x,-.025,0),(.10,.10,.80),'Navy',.018)
    for z in [-.32,.32]:
        box('Raised retaining lug',(x,.028,z),(.10,.09,.09),'Aluminium',.012)
        rivet((x,.077,z),'Y')
for z in [-.28,0,.28]: box('Wooden cross bearer',(0,-.02,z),(.68,.09,.085),'WoodLight',.012)
for x in [-.24,.24]: box('Tie down grip',(x,.055,0),(.055,.035,.22),'Brass',.012)
finish('cargo_mount')

# --- Island airfield / landscape -----------------------------------------
asset('tree_pine','environment')
cylinder('Pine trunk',(0,0,0),(0,5.7,0),.23,'Wood',12,r2=.095)
for j,(y,r,h) in enumerate([(1.1,1.65,2.7),(2.3,1.4,2.5),(3.5,1.05,2.2),(4.6,.72,1.9)]):
    # Ring variation gives sculpted scalloped boughs instead of perfect cones.
    vs=[];fs=[];n=11
    for ring,(dy,scale) in enumerate([(0,.85),(.35,1),(h,.04)]):
        for i in range(n):
            a=2*math.pi*i/n; rr=r*scale*(1+random.uniform(-.1,.1))
            vs.append((rr*math.cos(a),y+dy+random.uniform(-.08,.08),rr*math.sin(a)))
    for k in range(2):
        for i in range(n): fs.append((k*n+i,k*n+(i+1)%n,(k+1)*n+(i+1)%n,(k+1)*n+i))
    fs.append(tuple(reversed(range(n)))); mesh('Layered pine boughs',vs,[tuple(reversed(f)) for f in fs],'Pine' if j%2 else 'Leaf')
finish('tree_pine')

asset('tree_broad','environment')
cylinder('Broadleaf trunk',(0,0,0),(0,3.7,0),.31,'Wood',12,r2=.16)
for i in range(6):
    a=i*math.pi/3; end=(1.25*math.cos(a),3.8+random.random()*.8,1.25*math.sin(a))
    cylinder('Forking branches',(0,2.1,0),end,.14,'Wood',10,r2=.055)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=1,location=cv((end[0],end[1]+.6,end[2])))
    ob=bpy.context.object; ob.scale=(1.45,1.35,1.4)
    for v in ob.data.vertices: v.co*=random.uniform(.89,1.1)
    link(ob,'Sculpted leaf crown','Leaf' if i%2 else 'LeafLight')
sphere('Central leaf crown',(0,5.0,0),(3.1,2.5,3.0),'Leaf',12,6)
finish('tree_broad')

asset('rock','environment')
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=1,location=(0,0,0))
ob=bpy.context.object
for v in ob.data.vertices:
    v.co.x*=1.5*random.uniform(.85,1.15); v.co.y*=1.05*random.uniform(.85,1.15)
    v.co.z=max(.025,(v.co.z+1)*.75*random.uniform(.88,1.12))
link(ob,'Weathered faceted boulder','Stone')
finish('rock')

asset('crate','environment')
box('Dark interior',(0,.65,0),(1.21,1.23,1.21),'Wood',.025)
for j in range(5):
    p=-.48+j*.24
    for s in [-1,1]:
        box('Face plank',(p,.66,s*.624),(.225,1.20,.04),'WoodLight',.008)
        box('Side plank',(s*.624,.66,p),(.04,1.20,.225),'WoodLight',.008)
    box('Lid plank',(p,1.285,0),(.225,.045,1.20),'WoodLight',.008)
for s in [-1,1]:
    for y in [.12,1.18]:
        box('Face batten',(0,y,s*.66),(1.4,.14,.065),'Wood',.012)
        box('Side batten',(s*.66,y,0),(.065,.14,1.4),'Wood',.012)
    curve('Diagonal brace',[(-.55,.22,s*.70),(.55,1.08,s*.70)],.055,'Wood')
    for x in [-.54,.54]:
        for y in [.12,1.18]: cylinder('Crate nail',(x,y,s*.70),(x,y,s*.711),.015,'Aluminium',8)
finish('crate')

asset('hangar','environment')
# 18 m wide x 14 deep, 8 m high. Completely open positive-Z aircraft entrance.
for x in [-8.8,8.8]:
    box('Concrete footing',(x,.16,0),(.44,.32,14),'Concrete',.04)
    box('Side wall',(x,2.7,0),(.20,5.15,14),'Ivory',.035)
    for z in [-6.7,-3.3,0,3.3,6.7]:
        cylinder('Steel wall column',(x,.3,z),(x,5.5,z),.12,'Navy',8)
    for z in [i*.37-6.85 for i in range(38)]:
        box('Corrugated side rib',(x,2.9,z),(.27,4.9,.045),'Aluminium',.012)
box('Rear wall',(0,2.8,-6.9),(17.7,5.5,.18),'Ivory',.02)
for x in [-7,-3.5,0,3.5,7]:
    box('Rear window frame',(x,3.8,-6.78),(2.6,1.15,.10),'Navy',.025)
    box('Rear window',(x,3.8,-6.70),(2.39,.94,.025),'Glass',.01)
# Arch vault is curved in 16 segments; full height 8, door clear 17.4 x 5.2.
vs=[];fs=[];n=20
for z in [-7,7]:
    for j in range(n+1):
        a=math.pi*j/n
        vs.append((8.99*math.cos(a),5.1+2.9*math.sin(a),z))
for j in range(n): fs.append((j,j+1,n+2+j,n+1+j))
mesh('Barrel vaulted roof',vs,fs,'Navy')
for z in [-7,-5,-3,-1,1,3,5,7]:
    curve('Roof standing seam',[(9.0*math.cos(j*math.pi/n),5.105+2.9*math.sin(j*math.pi/n),z) for j in range(n+1)],.025,'Aluminium')
for z in [-6.94,6.94]:
    curve('Arch truss',[(8.8*math.cos(j*math.pi/n),5.1+2.82*math.sin(j*math.pi/n),z) for j in range(n+1)],.095,'Paint')
    cylinder('Truss cross beam',(-8.8,5.16,z),(8.8,5.16,z),.09,'Paint',8)
# Split doors are visibly parked against the side, leaving the whole portal open.
for s in [-1,1]:
    box('Parked sliding door',(s*8.3,2.55,7.12),(1.05,4.9,.12),'Paint',.025)
    for y in [.45,1.6,2.75,3.9,4.85]: box('Door brace',(s*8.3,y,7.21),(.95,.055,.06),'Navy',.01)
    cylinder('Entrance lamp bracket',(s*7.65,5.2,7.0),(s*7.65,5.2,7.38),.035,'Navy',8)
    sphere('Warm portal lamp',(s*7.65,5.15,7.38),(.25,.19,.15),'Glow',12,6)
box('Portal number plaque',(0,6.17,7.035),(2.65,.70,.07),'Ivory',.04)
for x in [-.65,0,.65]: box('Hangar plaque bars',(x,6.17,7.08),(.15,.44,.025),'Paint',.006)
finish('hangar')

asset('tower','environment')
box('Tower concrete base',(0,.13,0),(3.7,.26,3.7),'Concrete',.08)
for x in [-1.3,1.3]:
    for z in [-1.3,1.3]:
        cylinder('Timber tower legs',(x,.2,z),(x,7.1,z),.15,'Wood',10,r2=.11)
for y in [1.3,3.0,4.7,6.3]:
    for s in [-1,1]:
        cylinder('Diagonal tower bracing',(-1.3,y-1.05,s*1.3),(1.3,y+.55,s*1.3),.064,'WoodLight',8)
        cylinder('Side tower bracing',(s*1.3,y-1.05,-1.3),(s*1.3,y+.55,1.3),.064,'WoodLight',8)
box('Observation deck',(0,6.7,0),(3.5,.20,3.5),'Navy',.04)
box('Cabin lower',(0,7.25,0),(3.0,.94,3.0),'Ivory',.04)
box('Wraparound blue glazing',(0,8.04,0),(2.95,.80,2.95),'Glass',.025)
for x in [-1.5,1.5]:
    for z in [-1.5,1.5]: box('Cabin corner mullion',(x,8.0,z),(.1,1.02,.1),'Paint',.01)
box('Cabin roof',(0,8.65,0),(3.5,.20,3.5),'Navy',.06)
for s in [-1,1]:
    for x in [-1.65,0,1.65]: cylinder('Safety rail post',(x,6.8,s*1.65),(x,7.45,s*1.65),.035,'Aluminium',8)
    cylinder('Safety rail',(-1.65,7.45,s*1.65),(1.65,7.45,s*1.65),.035,'Aluminium',8)
for y in [i*.32+.4 for i in range(20)]: cylinder('Ladder rung',(1.37,y,-.35),(1.37,y,.35),.025,'Aluminium',8)
cylinder('Radio antenna',(0,8.75,0),(0,10,0),.035,'Aluminium',8)
finish('tower')

asset('wind_sock','environment')
cylinder('Windsock footing',(0,0,0),(0,.17,0),.42,'Concrete',16)
cylinder('Windsock mast',(0,.17,0),(0,5.5,0),.06,'Aluminium',12,r2=.035)
cylinder('Pivot arm',(0,5.3,0),(.0,5.3,.42),.035,'Navy',12)
for j in range(6):
    z=.42+j*.31; radius=.35-j*.038
    cylinder('Striped fabric sock',(0,5.3-j*.055,z),(0,5.3-(j+1)*.055,z+.31),radius,'Paint' if j%2==0 else 'Ivory',16,r2=radius-.038)
torus('Sock inlet hoop',(0,5.3,.42),.35,.018,'Aluminium')
finish('wind_sock')

asset('lamp','environment')
cylinder('Lamp base',(0,0,0),(0,.17,0),.35,'Concrete',16)
cylinder('Lamp tapered post',(0,.17,0),(0,4.6,0),.075,'Navy',12,r2=.04)
curve('Gooseneck',[(0,4.45,0),(0,4.75,.12),(0,4.77,.50),(0,4.56,.69)],.045,'Navy')
cylinder('Enamel lamp shade',(0,4.42,.69),(0,4.62,.69),.28,'Paint',20,r2=.10)
sphere('Lamp bulb',(0,4.41,.69),(.23,.13,.23),'Glow',16,8)
finish('lamp')

asset('barrel','environment')
# Lathed steel drum with rolled hoops and a top bung.
loft_dummy=None
vs=[];fs=[];n=24
for y,r in [(0,.30),(.04,.34),(.16,.35),(.52,.36),(.9,.35),(1.0,.34),(1.04,.30)]:
    for j in range(n): vs.append((r*math.cos(j*2*math.pi/n),y,r*math.sin(j*2*math.pi/n)))
for k in range(6):
    for j in range(n): fs.append((k*n+j,k*n+(j+1)%n,(k+1)*n+(j+1)%n,(k+1)*n+j))
fs += [tuple(reversed(range(n))),tuple(6*n+j for j in range(n))]
mesh('Steel fuel drum',vs,[tuple(reversed(f)) for f in fs],'Paint')
for y in [.07,.29,.76,1.0]: torus('Rolled steel hoop',(0,y,0),.344,.018,'Aluminium','Y')
cylinder('Fuel bung',(.14,1.035,.05),(.14,1.06,.05),.044,'Brass',12)
box('Fuel drum label',(0,.54,.361),(.30,.24,.008),'Ivory',.012)
finish('barrel')

asset('beacon','environment')
cylinder('Beacon base',(0,0,0),(0,.14,0),.30,'Concrete',16)
cylinder('Beacon post',(0,.14,0),(0,1.30,0),.105,'Navy',16)
for y in [.44,.68,.92]: cylinder('Reflector band',(0,y,0),(0,y+.10,0),.111,'Ivory',16)
cylinder('Beacon hood',(0,1.27,0),(0,1.36,0),.24,'Paint',20)
cylinder('Amber lantern',(0,1.36,0),(0,1.68,0),.16,'Glow',20)
cylinder('Lantern cap',(0,1.67,0),(0,1.74,0),.22,'Navy',20,r2=.12)
for x,z in [(-.12,-.12),(-.12,.12),(.12,-.12),(.12,.12)]: cylinder('Lantern cage',(x,1.34,z),(x,1.68,z),.013,'Aluminium',8)
finish('beacon')

# --- Coastal settlement and discovery landmarks --------------------------
asset('cottage','environment')
box('Stone cottage foundation',(0,.22,0),(11.25,.44,9.10),'Stone',.10)
box('Ivory plaster walls',(0,2.55,0),(11.0,4.62,8.8),'Ivory',.06)
# Solid gables and closed pitched roof keep the silhouette convincing from above.
for z in [-4.4,4.4]:
    mesh('Plaster gable',[(-5.5,4.85,z),(5.5,4.85,z),(0,7.65,z)],[(0,1,2)],'Ivory')
vs=[(-6,4.78,-4.9),(0,7.80,-4.9),(6,4.78,-4.9),(-6,4.78,4.9),(0,7.80,4.9),(6,4.78,4.9),(-6,4.61,-4.9),(0,7.63,-4.9),(6,4.61,-4.9),(-6,4.61,4.9),(0,7.63,4.9),(6,4.61,4.9)]
mesh('Pitched standing seam roof',vs,[tuple(reversed(f)) for f in [(0,1,4,3),(1,2,5,4),(6,9,10,7),(7,10,11,8),(0,6,7,1),(1,7,8,2),(3,4,10,9),(4,5,11,10),(0,3,9,6),(2,8,11,5)]],'Navy')
for z in [i*.61-4.88 for i in range(17)]:
    curve('Roof seam',[(-6.01,4.80,z),(0,7.82,z),(6.01,4.80,z)],.025,'Aluminium')
for z in [-4.92,4.92]:
    curve('Red gable fascia',[(-6.05,4.72,z),(0,7.78,z),(6.05,4.72,z)],.095,'Paint')
for x in [-5.56,5.56]:
    for z in [-4.38,4.38]: box('Corner timber',(x,2.65,z),(.14,4.60,.16),'Wood',.018)
    cylinder('Eaves gutter',(x,4.63,-4.85),(x,4.63,4.85),.085,'Aluminium',12)
    cylinder('Downpipe',(x,4.6,-4.2),(x,.45,-4.2),.065,'Aluminium',10)
def cottage_window(x,y,z,side=False):
    size=(.12,1.55,1.45) if side else (1.45,1.55,.12)
    glass=(.035,1.27,1.17) if side else (1.17,1.27,.035)
    box('Timber window surround',(x,y,z),size,'Wood',.035)
    s=1 if (x if side else z)>0 else -1
    p=(x+s*.075,y,z) if side else (x,y,z+s*.075)
    box('Blue cottage window',p,glass,'Glass',.01)
    if side:
        box('Window mullion',(p[0]+s*.025,y,z),(.045,1.32,.055),'Ivory',.005)
        box('Stone window sill',(x+s*.04,y-.86,z),(.32,.15,1.72),'Concrete',.025)
    else:
        box('Window mullion',(x,y,p[2]+s*.025),(.055,1.32,.045),'Ivory',.005)
        box('Stone window sill',(x,y-.86,z+s*.04),(1.72,.15,.32),'Concrete',.025)
for z in [-4.47,4.47]:
    for x in [-3.40,3.40]: cottage_window(x,2.88,z)
for x in [-5.56,5.56]:
    for z in [-2.35,2.35]: cottage_window(x,2.88,z,True)
box('Red front door',(0,1.84,4.47),(1.65,2.90,.14),'Paint',.035)
box('Door upper glazing',(0,2.40,4.55),(1.13,1.16,.035),'Glass',.015)
for x in [-.88,.88]: box('Door frame',(x,1.93,4.58),(.14,3.16,.18),'Wood',.02)
box('Door lintel',(0,3.48,4.58),(1.90,.18,.18),'Wood',.02)
sphere('Brass door handle',(.53,1.61,4.59),(.09,.09,.08),'Brass',12,6)
for y,z,w,d in [(.14,5.25,2.70,1.20),(.31,5.0,2.35,.84),(.48,4.8,2.05,.50)]:
    box('Stone doorstep',(0,y,z),(w,.27,d),'Stone',.04)
box('Porch shelter',(0,3.75,4.95),(2.65,.16,1.34),'Navy',.045)
for x in [-1.15,1.15]: cylinder('Porch bracket',(x,3.7,5.35),(x,3.12,4.56),.055,'Wood',10)
box('Brick chimney',(3.05,6.66,-2.45),(.95,3.10,1.05),'Paint',.045)
for y in [5.45,5.85,6.25,6.65,7.05,7.45,7.85]: box('Chimney mortar seam',(3.05,y,-2.45),(.977,.026,1.077),'Ivory',.006)
box('Chimney crown',(3.05,8.25,-2.45),(1.18,.20,1.28),'Stone',.035)
cylinder('Chimney pot',(3.05,8.31,-2.45),(3.05,8.66,-2.45),.23,'Paint',12)
finish('cottage')

asset('fishing_boat','environment')
sections=[(-4.0,.045,.18,1.28),(-3.55,.55,.55,.97),(-2.55,1.20,.73,.83),(-.8,1.43,.74,.82),(1.5,1.38,.67,.88),(3.4,1.12,.55,.98),(3.8,1.0,.43,1.10)]
loft('Rounded fishing hull',sections,'Ivory',20)
# Deep red anti-fouling keel follows the lower hull instead of a box underside.
vs=[];fs=[];n=11
for z,w,h,y in sections:
    for j in range(n):
        a=math.pi+math.pi*j/(n-1)
        vs.append((w*math.cos(a)*1.005,y+h*math.sin(a)-.008,z))
for k in range(len(sections)-1):
    for j in range(n-1): fs.append((k*n+j,k*n+j+1,(k+1)*n+j+1,(k+1)*n+j))
mesh('Red anti fouling lower hull',vs,fs,'Paint')
deck=[(-3.78,.12),(-3.3,.64),(-2.4,1.14),(-.8,1.30),(1.5,1.26),(3.55,.95)]
vs=[(s*w,1.52,z) for s in [-1,1] for z,w in deck]
mesh('Open working deck',vs,[tuple(range(len(deck)))+tuple(reversed(range(len(deck),2*len(deck))))],'WoodLight')
for s in [-1,1]:
    rail=[(s*w,1.56,z) for z,w in deck]
    curve('Painted gunwale',rail,.075,'Navy')
    curve('Deck handrail',[(x,y+.36,z) for x,y,z in rail[:-1]],.028,'Aluminium')
    for z,w in [(-2.4,1.14),(-.8,1.30),(1.5,1.26)]:
        cylinder('Handrail stanchion',(s*w,1.56,z),(s*w,1.92,z),.025,'Aluminium',8)
    for z in [0,1.6]: torus('Tyre fender',(s*1.42,1.23,z),.19,.065,'Rubber','X')
    cylinder('Mooring cleat',(s*.71,1.57,3.18),(s*.71,1.69,3.18),.055,'Aluminium',8)
    cylinder('Cleat crossbar',(s*.71-.12,1.68,3.18),(s*.71+.12,1.68,3.18),.035,'Aluminium',8)
box('Wheelhouse',(0,2.18,-.80),(1.82,1.32,2.05),'Ivory',.06)
box('Wheelhouse glazing',(0,2.62,-.80),(1.86,.63,2.09),'Glass',.035)
for x in [-.93,.93]:
    for z in [-1.85,.25]: box('Wheelhouse upright',(x,2.61,z),(.07,.72,.07),'Paint',.01)
box('Cabin roof',(0,3.03,-.80),(2.12,.16,2.34),'Navy',.045)
box('Wheelhouse door',(0,2.08,.25),(.77,1.10,.045),'Paint',.025)
box('Door window',(0,2.36,.28),(.54,.45,.025),'Glass',.015)
cylinder('Boat mast',(0,1.55,1.04),(0,4.4,1.04),.055,'Wood',12,r2=.025)
cylinder('Mast crossbar',(-.85,3.80,1.04),(.85,3.80,1.04),.035,'Aluminium',8)
for s in [-1,1]:
    curve('Mast rigging',[(s*1.2,1.56,2.3),(0,4.3,1.04),(s*.75,1.62,-2.6)],.012,'Navy')
cylinder('Cabin exhaust',(.66,3.0,-1.22),(.66,3.60,-1.22),.08,'Aluminium',12)
box('Red exhaust cap',(.66,3.64,-1.22),(.22,.09,.22),'Paint',.025)
for z in [1.8,2.15,2.5,2.85]: box('Aft deck planking',(0,1.53,z),(1.70,.018,.025),'Wood',.004)
box('Fish storage locker',(0,1.82,2.68),(.88,.58,.87),'Navy',.045)
box('Locker lid',(0,2.13,2.68),(.94,.08,.93),'Ivory',.025)
finish('fishing_boat')

asset('lighthouse','environment')
cylinder('Lighthouse footing',(0,0,0),(0,.30,0),2.65,'Stone',32)
cylinder('Lighthouse plinth',(0,.28,0),(0,.72,0),2.23,'Concrete',32)
for y0,y1,r0,r1,material in [(.7,4.2,1.91,1.66,'Ivory'),(4.2,5.25,1.66,1.58,'Paint'),(5.25,8.7,1.58,1.32,'Ivory'),(8.7,9.65,1.32,1.25,'Paint'),(9.65,12.55,1.25,1.05,'Ivory')]:
    cylinder('Tapered masonry shaft',(0,y0,0),(0,y1,0),r0,material,32,r2=r1)
for y,r in [(1.0,1.90),(4.19,1.68),(5.24,1.60),(8.69,1.34),(9.64,1.27),(12.40,1.12)]: torus('Masonry course',(0,y,0),r,.025,'Concrete','Y')
box('Lighthouse door surround',(0,1.98,1.85),(1.10,2.45,.18),'Stone',.10)
box('Lighthouse red door',(0,1.94,1.965),(.80,2.10,.06),'Paint',.045)
box('Door vent',(0,2.39,2.005),(.47,.40,.018),'Navy',.025)
sphere('Door latch',(.23,1.75,2.025),(.09,.09,.07),'Brass',12,6)
for y,r in [(4.0,1.70),(7.2,1.47),(10.65,1.21)]:
    box('Deep window reveal',(0,y,r),(.58,1.12,.10),'Navy',.10)
    box('Blue lighthouse window',(0,y,r+.058),(.36,.84,.025),'Glass',.065)
    box('Window sill',(0,y-.60,r+.04),(.74,.13,.30),'Stone',.025)
cylinder('Gallery corbel',(0,12.45,0),(0,12.75,0),1.55,'Stone',32,r2=2.18)
cylinder('Gallery deck',(0,12.72,0),(0,12.90,0),2.20,'Navy',32)
for i in range(24):
    a=i*math.pi/12;x=2.06*math.cos(a);z=2.06*math.sin(a)
    cylinder('Gallery baluster',(x,12.88,z),(x,13.80,z),.031,'Aluminium',8)
for y in [13.26,13.80]: torus('Gallery rail',(0,y,0),2.06,.035,'Aluminium','Y')
cylinder('Lantern base',(0,12.90,0),(0,13.20,0),1.30,'Paint',24)
cylinder('Lantern blue glazing',(0,13.18,0),(0,14.88,0),1.22,'Glass',12)
for i in range(12):
    a=i*math.pi/6;x=1.235*math.cos(a);z=1.235*math.sin(a)
    cylinder('Lantern mullion',(x,13.18,z),(x,14.94,z),.04,'Ivory',8)
    if i%3==0:
        sphere('Beacon amber lens',(x*1.025,14.13,z*1.025),(.36,.73,.36),'Glow',16,8)
cylinder('Lantern roof eave',(0,14.90,0),(0,15.06,0),1.58,'Navy',24)
cylinder('Conical lighthouse roof',(0,15.04,0),(0,16.03,0),1.55,'Paint',24,r2=.08)
cylinder('Roof finial',(0,15.98,0),(0,16.34,0),.065,'Brass',12,r2=.025)
finish('lighthouse')

asset('rock_arch','environment')
# Swept irregular rock tube with a genuinely open central tunnel.
vs=[];fs=[];steps=22;sides=12
for i in range(steps+1):
    a=math.pi*i/steps
    for j in range(sides):
        p=2*math.pi*j/sides
        wobble=1+random.uniform(-.10,.10)
        radial=(2.95+.28*math.sin(a*3))*math.cos(p)*wobble
        vs.append(((11.05+radial)*math.cos(a),3.0+(9.78+radial)*math.sin(a),3.7*math.sin(p)*wobble))
for i in range(steps):
    for j in range(sides): fs.append((i*sides+j,i*sides+(j+1)%sides,(i+1)*sides+(j+1)%sides,(i+1)*sides+j))
fs += [tuple(reversed(range(sides))),tuple(steps*sides+j for j in range(sides))]
mesh('Weathered open stone span',vs,[tuple(reversed(f)) for f in fs],'Stone')
for s in [-1,1]:
    for x,y,z,sx,sy,sz in [(s*11.0,3.12,0,6.1,5.8,7.9),(s*12.3,1.80,1.6,3.6,3.3,4.7),(s*10.2,1.30,-2.4,4.4,2.4,3.7)]:
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=1,location=cv((x,y,z)))
        ob=bpy.context.object;ob.scale=(sx/2,sz/2,sy/2)
        for v in ob.data.vertices: v.co*=random.uniform(.92,1.07)
        link(ob,'Eroded coastal footing','Stone')
for i in range(9):
    a=.23+math.pi*.84*i/8
    y=3+12.65*math.sin(a);x=13.95*math.cos(a)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=cv((x,y,random.uniform(-1.3,1.3))))
    ob=bpy.context.object;ob.scale=(1.3,.80,.22)
    link(ob,'Salt tolerant moss shelf','Leaf')
finish('rock_arch')

# Parse actual exports: local axes, node names, vertices, primitives, bounds.
stats={}
for name,entry in ASSETS.items():
    path=BASE/entry['family']/(name+'.glb'); data=path.read_bytes(); length,typ=struct.unpack_from('<II',data,12)
    doc=json.loads(data[20:20+length]); nodes=doc.get('nodes',[])
    accessors=doc.get('accessors',[])
    # glTF mesh coordinates have been axis-converted by exporter. Bounds are verified below in Blender world space too.
    bounds=[]
    for ob in entry['collection'].objects:
        if ob.type=='MESH':
            for v in ob.bound_box:
                b=ob.matrix_world@Vector(v); bounds.append((b.x,b.z,-b.y))
    mins=[min(v[i] for v in bounds) for i in range(3)]; maxs=[max(v[i] for v in bounds) for i in range(3)]
    stats[name]={k:entry[k] for k in ['vertices','triangles','mesh_nodes']}
    stats[name].update(file=str(path.relative_to(BASE)),bytes=len(data),bounds_min=mins,bounds_max=maxs,dimensions=[maxs[i]-mins[i] for i in range(3)],nodes=[n.get('name') for n in nodes],primitives=sum(len(m['primitives']) for m in doc.get('meshes',[])))
    stats[name]['exported_vertices']=sum(accessors[p['attributes']['POSITION']]['count'] for m in doc.get('meshes',[]) for p in m['primitives'])
    for canonical in ['Flap','Wheel','Propeller']:
        assert sum(n.get('name')==canonical for n in nodes)<=1, (name,canonical)
    for n in nodes:
        if n.get('name') in ['Flap','Wheel','Propeller']:
            stats[name]['animation_pivot']={k:v for k,v in n.items() if k not in ['children','mesh']}
    # A material primitive is approximately one base-pass draw per visible instance;
    # the game's 128-part cap is independent and is not a draw-call budget.
    assert len(data)>1000
(BASE/'source'/'asset_manifest.json').write_text(json.dumps(stats,indent=2))
if '--exports-only' in sys.argv:
    print('ART_EXPORTS_COMPLETE',len(ASSETS),flush=True)
    raise SystemExit(0)

# Arrange the actual editable source library in two galleries before saving.
for index,(name,e) in enumerate(ASSETS.items()):
    if e['family']=='models':
        idx=list(n for n,a in ASSETS.items() if a['family']=='models').index(name)
        e['root'].location=cv(((idx%4)*4.0,1.0,-(idx//4)*3.0))
    else:
        idx=list(n for n,a in ASSETS.items() if a['family']=='environment').index(name)
        e['root'].location=cv(((idx%5)*20,0,20+(idx//5)*22))

def setup_world(scene):
    scene.render.engine='CYCLES'; scene.cycles.samples=32
    scene.render.resolution_percentage=100
    scene.world=bpy.data.worlds.new(scene.name+' soft sky');scene.world.use_nodes=True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.38,.50,.61,1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value=.65
    ld=bpy.data.lights.new('Large softbox','AREA');lo=bpy.data.objects.new('Large softbox',ld);scene.collection.objects.link(lo)
    lo.location=cv((4,14,5)); ld.energy=1900;ld.shape='DISK';ld.size=10
    lo.rotation_euler=(Vector((0,0,0))-lo.location).to_track_quat('-Z','Y').to_euler()
    ld=bpy.data.lights.new('Warm sun','SUN');lo=bpy.data.objects.new('Warm sun',ld);scene.collection.objects.link(lo)
    ld.energy=2.0;lo.rotation_euler=(.4,-.5,-.3);ld.angle=.15
    scene.view_settings.view_transform='AgX'

def camera(scene,eye,target,scale):
    cd=bpy.data.cameras.new('Asset inspection camera');co=bpy.data.objects.new('Asset inspection camera',cd);scene.collection.objects.link(co)
    co.location=cv(eye);co.rotation_euler=(cv(target)-co.location).to_track_quat('-Z','Y').to_euler();cd.type='ORTHO';cd.ortho_scale=scale;scene.camera=co

def instance(scene,name,pos=(0,0,0),scale=1):
    ob=bpy.data.objects.new(name+' display',None);ob.instance_type='COLLECTION';ob.instance_collection=ASSETS[name]['collection']
    # Source root has gallery translation; collection instance needs inverse compensation.
    scene.collection.objects.link(ob);ob.location=cv(pos)-ASSETS[name]['root'].location*scale;ob.scale=(scale,)*3
    return ob

def label(scene,text,pos,size=.18):
    cu=bpy.data.curves.new('Label','FONT');cu.body=text;cu.size=size;cu.extrude=0;cu.align_x='CENTER'
    ob=bpy.data.objects.new(text,cu);scene.collection.objects.link(ob);ob.location=cv(pos)
    ob.rotation_euler=(math.pi/2,0,0);cu.materials.append(M['Navy'])

# Inspection sheet with honest individual pieces, not concept art.
preview=bpy.data.scenes.new('Aircraft kit inspection');setup_world(preview)
names=[n for n,e in ASSETS.items() if e['family']=='models']
for i,name in enumerate(names):
    x=(i%4)*3.7; z=-(i//4)*3.0
    instance(preview,name,(x,.60,z))
    label(preview,name.replace('_',' ').upper(),(x,.015,z+1.10),.19)
camera(preview,(9,15,13),(5.3,0,-2.4),17.0)
preview.render.resolution_x=1800;preview.render.resolution_y=1250
preview.render.filepath=str(BASE/'previews'/'aircraft_kit.png')
bpy.context.window.scene=preview;bpy.ops.render.render(write_still=True)

environment=bpy.data.scenes.new('Airfield architecture inspection');setup_world(environment)
for name,pos in [('hangar',(0,0,0)),('tower',(15,0,-3)),('wind_sock',(-12,0,6)),('tree_pine',(-14,0,-6)),('tree_broad',(14,0,7)),('rock',(-10,0,12)),('crate',(9,0,10)),('lamp',(-8,0,10)),('barrel',(7,0,11)),('beacon',(-6,0,12))]: instance(environment,name,pos)
camera(environment,(28,23,35),(0,2,0),46)
environment.render.resolution_x=1800;environment.render.resolution_y=1200
environment.render.filepath=str(BASE/'previews'/'airfield_props.png')
bpy.context.window.scene=environment;bpy.ops.render.render(write_still=True)

hero=bpy.data.scenes.new('Assembled kit proportion check');setup_world(hero)
for name,pos in [('cockpit',(0,1.0,-.75)),('fuselage',(0,.95,.55)),('fuselage',(0,.95,1.66)),('motor',(0,.88,-1.64)),('wing',(-1.15,.9,-.30)),('wing',(1.15,.9,-.30)),('elevator',(0,1.02,2.20)),('rudder',(0,1.40,2.18)),('gear',(-.53,.35,-.65)),('gear',(.53,.35,-.65)),('cargo_mount',(0,.56,.33))]: instance(hero,name,pos)
camera(hero,(5,3.8,-6),(0,.9,.2),7.2)
hero.render.resolution_x=1600;hero.render.resolution_y=1100
hero.render.filepath=str(BASE/'previews'/'assembled_aircraft.png')
bpy.context.window.scene=hero;bpy.ops.render.render(write_still=True)

coastal=bpy.data.scenes.new('Coastal landmarks inspection');setup_world(coastal)
for name,pos in [('rock_arch',(0,0,-15)),('cottage',(-16,0,7)),('lighthouse',(18,0,-2)),('fishing_boat',(4,0,14))]: instance(coastal,name,pos)
camera(coastal,(44,32,49),(0,4,-3),64)
coastal.render.resolution_x=2100;coastal.render.resolution_y=1400
coastal.render.filepath=str(BASE/'previews'/'coastal_props.png')
bpy.context.window.scene=coastal;bpy.ops.render.render(write_still=True)

# Default editable master opens on composed aircraft, with separate source collections/scenes.
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(BASE/'source'/'flight_islands_master.blend'))
print('ART_COMPLETE',len(ASSETS),'models',sum(e['vertices'] for e in ASSETS.values()),'vertices',flush=True)
