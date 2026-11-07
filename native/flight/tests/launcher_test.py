#!/usr/bin/env python3
"""Execute the native argument boundary against an inert engine sentinel."""
import json,pathlib,subprocess,tempfile
project=pathlib.Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory(prefix='flight-launcher-',dir='/private/tmp') as temporary:
 app=pathlib.Path(temporary)/'Fixture.app';mac=app/'Contents/MacOS';resources=app/'Contents/Resources'
 mac.mkdir(parents=True);resources.mkdir()
 engine=mac/'Flight Islands'
 engine.write_text('#!/usr/bin/python3\nimport json,sys\nprint(json.dumps(sys.argv[1:]))\n');engine.chmod(0o755)
 executable=mac/'Fixture'
 subprocess.run(['/usr/bin/clang','-O2',str(project/'tools/silent_launcher.c'),'-o',str(executable)],check=True)
 def run(args):return json.loads(subprocess.check_output([str(executable)]+args,text=True))
 first=run([]);separator=first.index('--')
 assert first[separator-2:separator]==['--audio-driver','Dummy']
 assert '--test-muted' in first[separator+1:]
 assert any(v.startswith('--profile-dir=') for v in first[separator+1:])
 second=run(['--headless','--audio-driver','CoreAudio','--','--quality-flow','--profile-dir=/private/tmp/test isolated','--quality-output=/private/tmp/clip spaces.json'])
 separator=second.index('--')
 assert 'CoreAudio' not in second and '--headless' in second[:separator]
 assert second[separator-2:separator]==['--audio-driver','Dummy']
 assert second.count('--profile-dir=/private/tmp/test isolated')==1
 assert '--quality-output=/private/tmp/clip spaces.json' in second[separator+1:]
 (resources/'test-profile.txt').write_text('/private/tmp/flight-launcher-test-profile\n')
 assert '--profile-dir=/private/tmp/flight-launcher-test-profile' in run([])
print('Native launcher checks: 8/8; no audio engine launched')
