# Contributing to Flight Islands

Use Godot4.7.2 and keep browser prototypes separate from the native project. Prefer small changes that improve a complete build–fly–land loop. Add content after handling and presentation are convincing.

Run `tools/run-silent.sh` for every automated editor/game session. It selects Dummy output before startup and master mute, without touching system volume or player audio preferences. Never audition audio during agent testing. Use temporary test profiles; preserve real saved designs.

For simulation, editing, progression, saving or input fixes, reproduce the behavior with a failing test, implement the fix and run `python3 tools/test.py`. Inspect engine logs as well as exit codes. Godot can exit0 after a script error. Test actual native gameplay and the packaged application before claiming a user-facing issue resolved.

Keep forces, mass properties and energy truthful. Do not replace simulation with scripted trajectories, invented telemetry or hidden lift. Development controllers may drive normal Input actions but must not teleport an aircraft or rewrite its velocity after launch. Record that captures were automated when applicable.

Retain editable Blender/SVG originals and author/model bounds. Record provenance and licences before incorporating external assets. Original code is MIT; original artwork and educational prose are CC BY4.0. Regenerate third-party engine notices with `tools/licenses.gd` when changing engine versions.

Performance reports must name the hardware, renderer, actual internal image size, workload, duration and slow-frame percentiles. A small viewport, a headless smoke run or a recording cannot qualify the1080p60FPS gate. Human controls, onboarding, enjoyment and learning effects remain separate acceptance questions.
