#!/usr/bin/env python3
"""Run the real Godot boundary tests silently; reject script errors even on exit0."""
import argparse,os,pathlib,re,subprocess,sys,time
root=pathlib.Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser()
p.add_argument('tests',nargs='*')
a=p.parse_args()
engine=os.environ.get('GODOT_BIN','/private/tmp/flight-islands-tools/Godot.app/Contents/MacOS/Godot')
out=root/'output'/'tests';out.mkdir(parents=True,exist_ok=True)
scripts=[root/'tests'/s for s in a.tests] if a.tests else sorted((root/'tests').glob('*_test.gd'))
failed=[]
for script in scripts:
 start=time.monotonic()
 cmd=[engine,'--headless','--audio-driver','Dummy','--fixed-fps','120','--log-file',str(out/(script.stem+'-engine.log')),'--path',str(root),'--script','res://tests/'+script.name,'--','--test-muted','--profile-dir=/private/tmp/flight-islands-check-'+str(os.getpid())+'-'+script.stem]
 try:
  r=subprocess.run(cmd,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,timeout=120)
  log=r.stdout
  bad=r.returncode!=0 or re.search(r'SCRIPT ERROR|ERROR:|FAIL ',log) is not None
 except subprocess.TimeoutExpired as e:
  log=(e.stdout or b'').decode(errors='replace') if isinstance(e.stdout,bytes) else (e.stdout or '')
  log+='\nFAIL timed out after120seconds\n';bad=True
 (out/(script.stem+'.log')).write_text(log)
 summaries=[line for line in log.splitlines() if any(x in line for x in ['checks:','assertions:','FAIL ','ERROR:'])]
 print(('FAIL' if bad else 'PASS'),script.name,'%.2fs'%(time.monotonic()-start),' | '.join(summaries[-4:]),flush=True)
 if bad:failed.append(script.name)
print('Godot suites:',len(scripts)-len(failed),'/',len(scripts),'passed')
sys.exit(1 if failed else 0)
