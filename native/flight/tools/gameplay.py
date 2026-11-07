#!/usr/bin/env python3
"""Silent end-to-end native gameplay plus a separate-process restore check."""
import argparse,json,os,pathlib,plistlib,re,subprocess,sys,tempfile,time
project=pathlib.Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--app',type=pathlib.Path)
p.add_argument('--headless',action='store_true')
p.add_argument('--output',type=pathlib.Path,default=project/'output'/'packaged-gameplay.json')
a=p.parse_args();out=a.output.resolve();out.parent.mkdir(parents=True,exist_ok=True)
engine=os.environ.get('GODOT_BIN','/private/tmp/flight-islands-tools/Godot.app/Contents/MacOS/Godot')
if a.app:
 app=a.app.resolve()
 with (app/'Contents/Info.plist').open('rb') as f:executable=app/'Contents/MacOS'/plistlib.load(f)['CFBundleExecutable']
else:executable=pathlib.Path(engine)
with tempfile.TemporaryDirectory(prefix='flight-islands-play-',dir='/private/tmp') as temporary:
 base=[str(executable),'--audio-driver','Dummy','--log-file',str(out.with_suffix('.engine.log'))]
 if not a.app:base+=['--path',str(project)]
 if a.headless:base+=['--headless','--fixed-fps','120']
 else:base+=['--windowed','--resolution','1920x1080']
 for mode in ['flow','restore']:
  cmd=base+['--','--test-muted','--quality-'+mode,'--profile-dir='+temporary+'/profile','--quality-output='+str(out)]
  log=out.with_suffix('.'+mode+'.log')
  print('Running silent native',mode,'check',flush=True)
  start=time.monotonic()
  try:
   with log.open('w') as f:r=subprocess.run(cmd,stdout=f,stderr=subprocess.STDOUT,timeout=180 if a.headless else 900)
  except subprocess.TimeoutExpired:
   print('FAIL timed out; see',log);sys.exit(1)
  text=log.read_text()
  if r.returncode or re.search(r'SCRIPT ERROR|ERROR:|WARNING:|FLOW FAIL|"failures":\[[^\]]',text):
   print('FAIL native',mode,'check',r.returncode,'see',log);sys.exit(1)
  print('PASS native',mode,'%.2fs'%(time.monotonic()-start),flush=True)
print('PASS native gameplay and save/relaunch; audible sound quality remains unverified')
