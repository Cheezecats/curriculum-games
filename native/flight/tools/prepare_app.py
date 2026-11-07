#!/usr/bin/env python3
"""Install the mandatory native silent launcher after Godot's Mac export."""
import argparse,pathlib,plistlib,subprocess
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('app',type=pathlib.Path)
a=p.parse_args();app=a.app.resolve();directory=app/'Contents'/'MacOS'
plist=app/'Contents/Info.plist'
with plist.open('rb') as f:info=plistlib.load(f)
runtime=directory/'Flight Islands'
legacy=directory/'Flight Islands Engine'
if legacy.exists():
 if runtime.stat().st_size<1000000:legacy.replace(runtime)
 else:legacy.unlink()
if not runtime.exists() or runtime.stat().st_size<1000000:p.error('Godot export executable was not found.')
main=directory/'Flight Islands Launcher'
info['CFBundleExecutable']=main.name
plist.write_bytes(plistlib.dumps(info))
# Official release templates disallow --main-pack. Preserve the engine name
# and matching pack, with an identical pack alias for bundle-based lookup.
import shutil
shutil.copy2(app/'Contents/Resources/Flight Islands.pck',app/'Contents/Resources/Flight Islands Launcher.pck')
source=pathlib.Path(__file__).with_name('silent_launcher.c')
subprocess.run(['/usr/bin/clang','-arch','arm64','-arch','x86_64','-mmacosx-version-min=13.0','-O2',str(source),'-o',str(main)],check=True)
subprocess.run(['codesign','--force','--sign','-',str(runtime)],check=True)
subprocess.run(['codesign','--force','--deep','--sign','-',str(app)],check=True)
subprocess.run(['codesign','--verify','--deep','--strict',str(app)],check=True)
print('Prepared native silent app:',app)
