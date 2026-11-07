#!/usr/bin/env python3
"""Package an already tested Mac alpha. Does not run or unmute the game."""
import argparse,hashlib,json,pathlib,shutil,subprocess,plistlib,tempfile
project=pathlib.Path(__file__).resolve().parents[1]
repo=project.parents[1]
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--app',type=pathlib.Path,default=project/'build'/'Flight Islands.app')
p.add_argument('--destination',type=pathlib.Path,required=True)
p.add_argument('--version',default='0.1.0-alpha.1')
a=p.parse_args();destination=a.destination.resolve();destination.mkdir(parents=True,exist_ok=True)
# Signing must happen outside File Provider-backed folders: they recreate
# Finder metadata after it is removed. Only finished archives go to destination.
stage=pathlib.Path(tempfile.mkdtemp(prefix='flight-islands-package-',dir='/private/tmp'))/'Flight Islands Alpha'
stage.mkdir();app=stage/'Flight Islands.app'
shutil.copytree(a.app.resolve(),app,symlinks=True)
# File Provider-backed Desktop folders add FinderInfo during a copy. Only
# remove signing-incompatible metadata on this newly generated app copy.
for item in [app,*app.rglob('*')]:
 attributes=subprocess.check_output(['xattr',str(item)],text=True).splitlines()
 for attribute in ('com.apple.FinderInfo','com.apple.ResourceFork'):
  if attribute in attributes:subprocess.run(['xattr','-d',attribute,str(item)],check=True)
marker=app/'Contents/Resources/test-profile.txt'
if marker.exists():marker.unlink()
subprocess.run(['codesign','--force','--deep','--sign','-',str(app)],check=True)
subprocess.run(['codesign','--verify','--deep','--strict',str(app)],check=True)
launcher=stage/'Play Flight Islands — Silent.command'
launcher.write_text('''#!/bin/bash
set -euo pipefail
flight_bundle_dir="$(cd "$(dirname "$0")" && pwd)"
flight_player_profile="$HOME/Library/Application Support/Godot/app_userdata/Flight Islands/profile"
flight_silent_log="${TMPDIR:-/tmp}/flight-islands-silent.log"
exec "$flight_bundle_dir/Flight Islands.app/Contents/MacOS/Flight Islands Launcher" --audio-driver Dummy --log-file "$flight_silent_log" -- --test-muted "--profile-dir=$flight_player_profile"
''')
launcher.chmod(0o755)
(stage/'START HERE.txt').write_text('''FLIGHT ISLANDS — NATIVE MAC ALPHA

Open “Play Flight Islands — Silent.command” for silent play with persistent local designs and progress. It does not change macOS volume or your saved volume setting. The .app itself also enforces silence. Audible sound quality has not been assessed.

Roll out to runway. Hold Up for power; gently press S at11m/s to lift off, then release. A/D bank, Q/E ground steering, Down reduces power, Space brakes. Land on the harbour runway, taxi into the gold pad below2m/s, F unloads. Tab returns to the workshop; R retries with the design and launch payload preserved. Esc opens controls, remapping and settings. I opens actual flight evidence; G shows forces and balance. Right-drag orbits the builder; wheel zooms.

This is an ad hoc signed alpha, not notarized. macOS may restrict an internet-downloaded copy. Source and Godot setup instructions are supplied separately. Full manual control, real gamepad and first-time human usability acceptance remain open; see verification.md for measured limits.

Code MIT. Original art and educational prose CC BY4.0. Credits and engine notices are included and available in the game’s settings.
''')
for name in ['README.md','verification.md','THIRD_PARTY_NOTICES.txt']:
 shutil.copy2(project/name,stage/name)
shutil.copy2(repo/'LICENSE',stage/'LICENSE-CODE.txt')
shutil.copy2(repo/'LICENSE-CONTENT.md',stage/'LICENSE-CONTENT.md')
shutil.copy2(project/'assets'/'LICENSE-ART.md',stage/'LICENSE-ART.md')
evidence=stage/'Evidence';evidence.mkdir()
for name in ['final-packaged-gameplay.json','final-packaged-gameplay.flow.log','final-packaged-gameplay.restore.log','correctness.log','launcher-test.log','reset-native.log','video-metadata.json']:
 source=project/'output'/name
 if source.exists():shutil.copy2(source,evidence/name)
for name in ['mac-m2-1080p-128.json','mac-m2-1080p-128.hardware.json','mac-m2-1080p-128.launcher.json','mac-m2-1080p-128.console.log','mac-m2-1080p-128.engine.log','mac-m2-1080p-128-viewport.png']:
 source=project/'output'/'benchmarks'/name
 if source.exists():shutil.copy2(source,evidence/name)
video=project/'output'/'flight-islands-gameplay-silent.mp4'
if video.exists():shutil.copy2(video,stage/video.name)
preview=project/'output'/'capture'/'gameplay'/'first_delivery_cruise.png'
if preview.exists():shutil.copy2(preview,stage/'flight-islands-preview.png')
archive=destination/('Flight-Islands-'+a.version+'-macOS.zip')
subprocess.run(['ditto','-c','-k','--sequesterRsrc','--keepParent',str(stage),str(archive)],check=True)
source_archive=destination/('Flight-Islands-'+a.version+'-source.zip')
with source_archive.open('wb') as f:subprocess.run(['git','-C',str(repo),'archive','--format=zip','HEAD'],stdout=f,check=True)
def sha(path):
 h=hashlib.sha256()
 with path.open('rb') as f:
  for chunk in iter(lambda:f.read(1024*1024),b''):h.update(chunk)
 return h.hexdigest()
manifest={'version':a.version,'source_commit':subprocess.check_output(['git','-C',str(repo),'rev-parse','HEAD'],text=True).strip(),'archives':[{ 'name':v.name,'bytes':v.stat().st_size,'sha256':sha(v)} for v in [archive,source_archive]],'application':{'pck_sha256':sha(app/'Contents/Resources/Flight Islands.pck'),'engine_sha256':sha(app/'Contents/MacOS/Flight Islands'),'launcher_sha256':sha(app/'Contents/MacOS/Flight Islands Launcher'),'signing':'ad hoc; not notarized'}}
(destination/'release-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
(destination/'SHA256SUMS.txt').write_text(''.join(v['sha256']+'  '+v['name']+'\n' for v in manifest['archives']))
print(json.dumps(manifest,indent=2))
print('Verified unpacked release:',stage)
