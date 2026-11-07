#!/usr/bin/env python3
"""Export then enforce the silent native boundary before the app can be tested."""
import pathlib,subprocess,sys
project=pathlib.Path(__file__).resolve().parents[1]
subprocess.run([str(project/'tools/run-silent.sh'),'--headless','--export-release','macOS'],check=True)
subprocess.run([sys.executable,str(project/'tools/prepare_app.py'),str(project/'build/Flight Islands.app')],check=True)
