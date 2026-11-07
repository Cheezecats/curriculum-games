"""Original code-native Flight Islands identity. Code: MIT; generated art: CC BY 4.0.

No external images, fonts or downloaded assets. Pillow only rasterizes the same
authored geometry for app packaging/inspection; SVG is the editable source.
"""
from pathlib import Path
from math import cos, sin, radians
import re, json, hashlib
from PIL import Image, ImageDraw

BASE = Path(__file__).resolve().parent
PREVIEWS=BASE/'previews';PREVIEWS.mkdir(exist_ok=True)
(PREVIEWS/'.gdignore').write_text('')
NAVY = '#153440'
CORAL = '#DF6750'
IVORY = '#F4E9CD'
SEA = '#375B65'
SHORE = '#EAA774'

# A rounded, cambered monoplane silhouette; y decreases toward its nose.
PLANE = [
 ('M',512,215),('C',537,215,544,251,544,283),('L',544,368),
 ('L',756,469),('Q',776,478,776,492),('L',776,518),
 ('Q',776,531,763,527),('L',541,470),('L',534,627),
 ('L',623,681),('L',623,712),('L',529,689),
 ('L',523,728),('L',501,728),('L',495,689),
 ('L',401,712),('L',401,681),('L',490,627),
 ('L',483,470),('L',261,527),('Q',248,531,248,518),
 ('L',248,492),('Q',248,478,268,469),('L',480,368),
 ('L',480,283),('C',480,251,487,215,512,215),('Z',),
]
ISLAND = [
 ('M',231,797),('C',293,761,334,768,373,744),
 ('C',431,707,476,758,531,758),('C',594,760,617,727,663,751),
 ('C',711,776,750,762,797,797),('C',737,823,672,828,611,820),
 ('C',550,812,504,843,447,831),('C',367,815,311,838,231,797),('Z',),
]
COVE = [('M',345,791),('C',414,774,424,792,467,793),('C',523,793,556,781,599,790)]
WAKE = [('M',330,860),('C',407,880,457,854,510,864),('C',568,876,620,865,670,860)]
CANOPY = [('M',512,289),('C',528,292,531,320,528,350),('Q',512,358,496,350),('C',493,320,496,292,512,289),('Z',)]

def path_data(commands):
    return ' '.join(c[0]+' '+ ' '.join(str(v) for v in c[1:]) for c in commands)

def sample(commands):
    pts=[]; current=(0,0); start=None
    for c in commands:
        op=c[0]
        if op in ['M','L']:
            current=(c[1],c[2]);pts.append(current)
            if op=='M': start=current
        elif op in ['C','Q']:
            initial=current
            for j in range(1,49):
                t=j/48;u=1-t
                if op=='C':
                    current=(u**3*initial[0]+3*u*u*t*c[1]+3*u*t*t*c[3]+t**3*c[5],u**3*initial[1]+3*u*u*t*c[2]+3*u*t*t*c[4]+t**3*c[6])
                else:
                    current=(u*u*initial[0]+2*u*t*c[1]+t*t*c[3],u*u*initial[1]+2*u*t*c[2]+t*t*c[4])
                pts.append(current)
        elif op=='Z': pts.append(start);current=start
    return pts

def rotated(points,angle=27):
    a=radians(angle);ca=cos(a);sa=sin(a)
    return [(512+(x-512)*ca-(y-465)*sa,465+(x-512)*sa+(y-465)*ca) for x,y in points]

def icon_inner():
    return f'''<rect x="72" y="72" width="880" height="880" rx="202" fill="{NAVY}"/>
<rect x="92" y="92" width="840" height="840" rx="184" fill="none" stroke="{SEA}" stroke-width="3"/>
<circle cx="700" cy="314" r="104" fill="{CORAL}"/>
<path d="{path_data(ISLAND)}" fill="{CORAL}"/>
<path d="{path_data(COVE)}" fill="none" stroke="{SHORE}" stroke-width="15" stroke-linecap="round"/>
<path d="{path_data(WAKE)}" fill="none" stroke="{SEA}" stroke-width="12" stroke-linecap="round"/>
<g transform="rotate(27 512 465)">
<path d="{path_data(PLANE)}" fill="{IVORY}" stroke="{NAVY}" stroke-width="15" stroke-linejoin="round"/>
<path d="{path_data(CANOPY)}" fill="{NAVY}"/>
<path d="M 496 574 L 528 574" stroke="{CORAL}" stroke-width="14"/>
</g>'''

def raster_icon():
    scale=3
    im=Image.new('RGBA',(1024*scale,1024*scale),(0,0,0,0));d=ImageDraw.Draw(im)
    def pts(vs):return [(round(x*scale),round(y*scale)) for x,y in vs]
    def line(vs,color,width):
        p=pts(vs);d.line(p,fill=color,width=round(width*scale),joint='curve')
        r=width*scale/2
        for x,y in [p[0],p[-1]]:d.ellipse((x-r,y-r,x+r,y+r),fill=color)
    d.rounded_rectangle((72*scale,72*scale,952*scale,952*scale),radius=202*scale,fill=NAVY)
    d.rounded_rectangle((92*scale,92*scale,932*scale,932*scale),radius=184*scale,outline=SEA,width=3*scale)
    d.ellipse((596*scale,210*scale,804*scale,418*scale),fill=CORAL)
    d.polygon(pts(sample(ISLAND)),fill=CORAL)
    line(sample(COVE),SHORE,15);line(sample(WAKE),SEA,12)
    plane=rotated(sample(PLANE));d.polygon(pts(plane),fill=IVORY);line(plane,NAVY,15)
    d.polygon(pts(rotated(sample(CANOPY))),fill=NAVY)
    line(rotated([(496,574),(528,574)]),CORAL,14)
    return im.resize((1024,1024),Image.Resampling.LANCZOS)

# Original geometric lettering drawn as paths, not an installed font.
GLYPHS={
 'F':'M0 7V0H5M0 3.3H4', 'L':'M0 0V7H5', 'I':'M0 0H4M2 0V7M0 7H4',
 'G':'M5 .9C4.5 .2 3.9 0 2.5 0C.7 0 0 .9 0 2V5C0 6.3 .8 7 2.5 7C4.2 7 5 6.3 5 5V3.6H3',
 'H':'M0 0V7M5 0V7M0 3.5H5', 'T':'M0 0H5M2.5 0V7',
 'S':'M5 .7C4.3 .2 3.5 0 2.5 0C.8 0 0 .8 0 1.9C0 3 1 3.5 2.5 3.5C4 3.5 5 4.1 5 5.2C5 6.3 4.2 7 2.5 7C1.5 7 .7 6.8 0 6.3',
 'A':'M0 7L2.5 0L5 7M.9 4.6H4.1',
 'N':'M0 7V0L5 7V0',
 'D':'M0 0V7H2.3C4.1 7 5 6 5 4.7V2.3C5 1 4.1 0 2.3 0Z',
}

def wordmark(color):
    paths=[];x=0
    for letter in 'FLIGHT ISLANDS':
        if letter==' ': x+=3.2;continue
        paths.append(f'<path d="{GLYPHS[letter]}" transform="translate({x:.1f} 0)"/>')
        x+=7.4 if letter!='I' else 6.4
    return f'<g transform="translate(192 58) scale(8.6)" fill="none" stroke="{color}" stroke-width=".72" stroke-linejoin="round" stroke-linecap="square">'+''.join(paths)+'</g>'

def glyph_paths(data):
    tokens=re.findall(r'[A-Z]|[-+]?(?:\d*\.\d+|\d+)',data);i=0;current=(0,0);paths=[];commands=[]
    sizes={'M':2,'L':2,'C':6,'V':1,'H':1,'Z':0}
    while i<len(tokens):
        op=tokens[i];i+=1;count=sizes[op];v=[float(n) for n in tokens[i:i+count]];i+=count
        if op=='M' and commands: paths.append(sample(commands));commands=[]
        if op=='V':op='L';v=[current[0],v[0]]
        elif op=='H':op='L';v=[v[0],current[1]]
        commands.append(tuple([op]+v))
        if len(v)>=2:current=(v[-2],v[-1])
    if commands:paths.append(sample(commands))
    return paths

def raster_title(color):
    factor=3;im=Image.new('RGBA',(1090*factor,176*factor),(0,0,0,0))
    emblem=raster_icon().resize((160*factor,160*factor),Image.Resampling.LANCZOS);im.alpha_composite(emblem,(8*factor,8*factor))
    d=ImageDraw.Draw(im);x=0
    for ch in 'FLIGHT ISLANDS':
        if ch==' ':x+=3.2;continue
        for path in glyph_paths(GLYPHS[ch]):
            points=[(round((192+(a+x)*8.6)*factor),round((58+b*8.6)*factor)) for a,b in path]
            d.line(points,fill=color,width=round(.72*8.6*factor),joint='curve')
        x+=7.4 if ch!='I' else 6.4
    return im.resize((1090,176),Image.Resampling.LANCZOS)

SVG_HEAD='<svg xmlns="http://www.w3.org/2000/svg" '
metadata='''<metadata>Original Flight Islands identity, Copyright 2026 Curriculum Games contributors.
Artwork licensed CC BY 4.0; generator code MIT. No external images or fonts.</metadata>'''
icon_svg=SVG_HEAD+'width="1024" height="1024" viewBox="0 0 1024 1024" role="img" aria-labelledby="title desc">\n<title id="title">Flight Islands</title><desc id="desc">Ivory aircraft flying over a coral island and sun on a navy aviation badge.</desc>\n'+metadata+icon_inner()+'\n</svg>\n'
(BASE/'flight_islands_icon.svg').write_text(icon_svg)
for suffix,color in [('',NAVY),('_light',IVORY)]:
    text=SVG_HEAD+'width="1090" height="176" viewBox="0 0 1090 176" role="img" aria-labelledby="title">\n<title id="title">Flight Islands</title>\n'+metadata+'<g transform="translate(8 8) scale(.15625)">'+icon_inner()+'</g>'+wordmark(color)+'\n</svg>\n'
    (BASE/f'flight_islands_title{suffix}.svg').write_text(text)
icon=raster_icon();icon.save(BASE/'flight_islands_icon_1024.png')
for size in [512,256,128,64,32,16]: icon.resize((size,size),Image.Resampling.LANCZOS).save(BASE/f'flight_islands_icon_{size}.png')
for suffix,color in [('',NAVY),('_light',IVORY)]: raster_title(color).save(BASE/f'flight_islands_title{suffix}.png')
icon.save(BASE/'flight_islands.icns',format='ICNS')
# A neutral proof sheet makes edge quality, padding and small-size recognition inspectable.
proof=Image.new('RGB',(1450,1100),'#ECE8DD')
proof.paste(icon,(32,18),icon)
for size,y in [(256,50),(128,360),(64,560),(32,710)]:
    reduced=icon.resize((size,size),Image.Resampling.LANCZOS);proof.paste(reduced,(1110,y),reduced)
proof.save(PREVIEWS/'branding_proof.png')
proof=Image.new('RGB',(1160,420),IVORY)
proof.paste(raster_title(NAVY),(35,14),raster_title(NAVY))
ImageDraw.Draw(proof).rectangle((0,210,1160,420),fill=NAVY)
proof.paste(raster_title(IVORY),(35,225),raster_title(IVORY))
proof.save(PREVIEWS/'title_marks_proof.png')
files={}
for path in sorted(BASE.rglob('*')):
    if path.suffix.lower() not in ['.svg','.png','.icns']:continue
    entry={'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'license':'CC-BY-4.0'}
    if path.suffix.lower() in ['.png','.icns']:
        with Image.open(path) as im:entry['size']=list(im.size)
    files[str(path.relative_to(BASE))]=entry
(BASE/'manifest.json').write_text(json.dumps({
    'name':'Flight Islands original identity','code_license':'MIT','art_license':'CC-BY-4.0',
    'copyright':'2026 Curriculum Games contributors','attribution':'Flight Islands / Curriculum Games contributors',
    'source':'https://github.com/Cheezecats/curriculum-games',
    'external_images':False,'font_dependencies':False,
    'palette':{'navy':NAVY,'coral':CORAL,'ivory':IVORY,'sea':SEA,'shore':SHORE},'files':files,
},indent=2)+'\n')
print('BRANDING_GENERATED: 3 SVG sources; 7 PNG icon sizes; 2 PNG marks; macOS ICNS; original path lettering')
