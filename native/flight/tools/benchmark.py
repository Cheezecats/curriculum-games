#!/usr/bin/env python3
"""Run the explicit silent 1080p GPU benchmark, or a short headless harness smoke.

No fixed-fps/time-scale shortcuts. Hardware and strict engine diagnostics are
recorded beside the runner's JSON. GPU runs require an explicit invocation;
--headless-smoke never claims or exercises the GPU gate.
"""
from __future__ import annotations
import argparse
import json
import os
from pathlib import Path
import platform
import plistlib
import re
import subprocess
import sys
import tempfile
import threading
import time

PROJECT = Path(__file__).resolve().parents[1]
DEFAULT_ENGINE = '/private/tmp/flight-islands-tools/Godot.app/Contents/MacOS/Godot'


def capture(command: list[str]) -> dict:
    try:
        result = subprocess.run(command, capture_output=True, text=True, timeout=10)
        return {'command': command, 'exit': result.returncode,
                'value': result.stdout.strip(), 'error': result.stderr.strip()}
    except (OSError, subprocess.TimeoutExpired) as exc:
        return {'command': command, 'error': str(exc)}


def hardware_snapshot() -> dict:
    result = {'platform': platform.platform(), 'machine': platform.machine(),
              'captured_unix_seconds': time.time()}
    if platform.system() == 'Darwin':
        result['sysctl'] = {key: capture(['/usr/sbin/sysctl', '-n', key]) for key in (
            'hw.model', 'hw.memsize', 'hw.physicalcpu', 'hw.logicalcpu',
            'machdep.cpu.brand_string', 'hw.optional.arm64')}
        result['macos_version'] = capture(['/usr/bin/sw_vers', '-productVersion'])
    else:
        result['sysctl'] = {'unavailable': 'Mac hardware sysctl is only captured on macOS'}
    result['source_revision'] = capture(['git', '-C', str(PROJECT), 'rev-parse', 'HEAD'])
    return result


def app_executable(path: Path) -> Path:
    if path.suffix != '.app':
        return path
    plist = path / 'Contents' / 'Info.plist'
    with plist.open('rb') as handle:
        name = plistlib.load(handle)['CFBundleExecutable']
    return path / 'Contents' / 'MacOS' / name


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--godot', default=os.environ.get('GODOT_BIN', DEFAULT_ENGINE))
    parser.add_argument('--app', type=Path, help='Benchmark an already exported native app/executable')
    parser.add_argument('--headless-smoke', action='store_true', help='Short validation only; cannot qualify GPU performance')
    parser.add_argument('--duration', type=float, help='Measured wall seconds; default600 GPU /6 smoke')
    parser.add_argument('--warmup', type=float, help='Excluded prelaunch warmup seconds; default3 GPU /.2 smoke')
    parser.add_argument('--output', type=Path)
    parser.add_argument('--hardware-json', type=Path, help='Use a separately captured host hardware snapshot instead of querying this process')
    parser.add_argument('--dry-run', action='store_true', help='Print exact launch without starting Godot')
    args = parser.parse_args()
    duration = args.duration if args.duration is not None else (6.0 if args.headless_smoke else 600.0)
    warmup = args.warmup if args.warmup is not None else (.2 if args.headless_smoke else 3.0)
    if not 0 < duration <= 3600 or not 0 <= warmup <= 60:
        parser.error('duration must be0–3600 and warmup0–60 seconds')
    if args.headless_smoke and duration > 60:
        parser.error('headless smoke is limited to60 seconds; it is never the GPU endurance gate')
    output = (args.output or PROJECT / 'output' / 'benchmarks' /
              time.strftime('quality-%Y%m%d-%H%M%S.json')).expanduser().resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    hardware_path = output.with_suffix('.hardware.json')
    console_path = output.with_suffix('.console.log')
    engine_log = output.with_suffix('.engine.log')
    wrapper_path = output.with_suffix('.launcher.json')
    executable = app_executable(args.app.resolve()) if args.app else Path(args.godot).expanduser()
    if not executable.is_file() or not os.access(executable, os.X_OK):
        parser.error(f'Executable not found: {executable}')
    with tempfile.TemporaryDirectory(prefix='flight-islands-quality-', dir='/private/tmp') as temporary:
        profile = Path(temporary) / 'profile'
        command = [str(executable), '--audio-driver', 'Dummy', '--log-file', str(engine_log)]
        if args.headless_smoke:
            command += ['--headless']
        else:
            command += ['--windowed', '--resolution', '1920x1080']
        if not args.app:
            command += ['--path', str(PROJECT)]
            if args.headless_smoke:
                # This external temporary SceneTree also works before Main's QA
                # hook is integrated; no extra repository-owned bootstrap file.
                bootstrap = Path(temporary) / 'quality_bootstrap.gd'
                bootstrap.write_text('''extends SceneTree
func _initialize():
 call_deferred("begin")
func begin():
 var app=load("res://game/main.tscn").instantiate()
 root.add_child(app)
 await process_frame
 if not app.has_meta("quality_benchmark_active"):
  var runner=load("res://qa/performance.gd").new()
  runner.name="QualityBenchmark"
  runner.app=app
  app.add_child(runner)
''')
                command += ['--script', str(bootstrap)]
        command += ['--', '--test-muted', '--quality-benchmark',
                    f'--quality-output={output}', f'--quality-duration={duration}',
                    f'--quality-warmup={warmup}', f'--quality-hardware={hardware_path}',
                    f'--profile-dir={profile}']
        if args.headless_smoke:
            command += ['--quality-smoke']
        if args.dry_run:
            print(json.dumps({'command': command, 'output': str(output),
                              'smoke_only': args.headless_smoke}, indent=2))
            return 0
        try:
            hardware = json.loads(args.hardware_json.read_text()) if args.hardware_json else hardware_snapshot()
        except (OSError, ValueError) as exc:
            parser.error('Cannot read host hardware snapshot: '+str(exc))
        if not isinstance(hardware,dict):
            parser.error('Host hardware snapshot must be a JSON object')
        hardware_path.write_text(json.dumps(hardware, indent=2))
        required_hardware = ('hw.model','hw.memsize','hw.physicalcpu','hw.logicalcpu','machdep.cpu.brand_string')
        hardware_complete = platform.system() != 'Darwin' or all(
            hardware.get('sysctl', {}).get(key, {}).get('exit') == 0 and
            hardware.get('sysctl', {}).get(key, {}).get('value')
            for key in required_hardware)
        if not args.headless_smoke and not hardware_complete:
            print('GPU benchmark was not started: required host sysctl hardware capture is unavailable in this process. Run the launcher in the authorized host context or pass --hardware-json with a host-captured snapshot.',file=sys.stderr)
            return 1
        for stale in (output, engine_log, console_path, output.with_suffix(output.suffix+'.progress.json')):
            stale.unlink(missing_ok=True)
        start = time.monotonic()
        timed_out = False
        with console_path.open('w') as console:
            process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1)
            def drain_output():
                assert process.stdout is not None
                for line in process.stdout:
                    console.write(line)
                    console.flush()
                    print(line,end='',flush=True)
            reader=threading.Thread(target=drain_output,daemon=True)
            reader.start()
            print('Started silent ' + ('headless smoke' if args.headless_smoke else 'GPU1080p benchmark') +
                  f'; process={process.pid}; output={output}', flush=True)
            try:
                code = process.wait(timeout=duration+warmup+150)
            except KeyboardInterrupt:
                process.terminate()
                try:
                    code = process.wait(timeout=8)
                except subprocess.TimeoutExpired:
                    process.kill()
                    code = process.wait(timeout=8)
            except subprocess.TimeoutExpired:
                timed_out = True
                process.terminate()
                try:
                    code = process.wait(timeout=8)
                except subprocess.TimeoutExpired:
                    process.kill()
                    code = process.wait(timeout=8)
            reader.join(timeout=5)
        text = console_path.read_text(errors='replace')
        logged = engine_log.read_text(errors='replace') if engine_log.exists() else ''
        diagnostics = re.findall(r'(?im)^.*(?:SCRIPT ERROR:|ERROR:|WARNING:|FAIL(?:\s|:)).*$', text+'\n'+logged)
        # Repeated console/engine entries are one diagnostic, never silently hidden.
        diagnostics = list(dict.fromkeys(diagnostics))
        try:
            report = json.loads(output.read_text())
        except (OSError, ValueError) as exc:
            report = {}
            diagnostics.append('Missing or invalid runner report: '+str(exc))
        complete = report.get('status') in ('completed', 'headless_smoke_complete')
        if not engine_log.exists():
            diagnostics.append('Fresh engine log was not created')
        if not args.headless_smoke and not report.get('viewport_proof', {}).get('verified'):
            diagnostics.append('Actual GPU1920x1080 viewport proof missing')
        # A full requested qualification run fails the launcher gate if the real
        # flight/duration/frame pacing target was not met, even with engine exit0.
        qualified = report.get('gpu_1080p_10min_128part_60fps_qualified', False)
        gate_ok = bool(qualified) if not args.headless_smoke and duration >= 600 else complete
        passed = code == 0 and not timed_out and not diagnostics and complete and gate_ok
        wrapper = {'command': command, 'engine_exit': code, 'timed_out': timed_out,
                   'wall_seconds_including_startup': time.monotonic()-start,
                   'strict_diagnostic_count': len(diagnostics), 'diagnostics': diagnostics,
                   'runner_status': report.get('status'), 'smoke_only': args.headless_smoke,
                   'gpu_qualified': bool(qualified), 'hardware_capture_complete': bool(hardware_complete), 'passed_requested_run': passed,
                   'output': str(output), 'engine_log': str(engine_log),
                   'console_log': str(console_path), 'hardware': str(hardware_path)}
        wrapper_path.write_text(json.dumps(wrapper, indent=2))
        print('STRICT BENCHMARK RESULT '+json.dumps(wrapper, sort_keys=True), flush=True)
        return 0 if passed else 1


if __name__ == '__main__':
    raise SystemExit(main())
