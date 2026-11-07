# Native alpha verification

This records observed behavior and open acceptance limits. Automated success is not evidence of enjoyment or improved learning.

## Evidence already collected

- Godot4.7.2 official Mac binary and export templates downloaded from the official release, SHA256 verified; Metal renderer reports Apple M2.
- Pure/native checks cover blueprint connectivity and bounds, centre of mass and complete inertia, editing history, atomic saves/backup recovery, delivery boundaries, aerodynamic dissipation, stall continuity, engine energy, ground contact and takeoff, physical cargo geometry, unloading, retry races and real input-event routing.
- Actual rigid-body fixtures cover ballistic trajectories, force/mass and torque/inertia. At process caps15/30/60/144, matched120Hz aircraft samples agree in position, velocity, attitude and battery energy. This is a short-window headless test, not a GPU performance claim.
- The packaged Mac app completed a real crash and retry, then a trainer delivery, an unsuccessful stock heavy-cargo attempt, a modified twin-motor hauler delivery, and a ridge landing/delivery. A separate application process restored the saved hauler and all three contract completions. The full run took415.20wall seconds; restore2.70seconds. Its controller uses normal Input actions and no post-launch body-state overrides. Direct1920×1080 captures were inspected.
- First successful automated takeoff is approximately8–9seconds after rollout. Retry returns below5seconds. These do not establish first-time human onboarding speed.
- All engine/editor/export/playback sessions use Dummy audio output selected at process startup and master mute. Audio events, looping, pitch/volume updates and cleanup are checked silently. Audible sound quality remains unverified.

## Final-build checks

The final test counts, performance numbers, source revision and downloadable archive hashes are filled after the final native build. Raw local logs and images live in ignored `output/`; selected release evidence is copied to the alpha bundle.

## Open acceptance limits

- Desktop capture automation lost its connection during packaged testing. The game was instead inspected using direct native framebuffer captures and engine input. Physical keyboard behavior after the event-normalization fix and real gamepad hardware still need a manual acceptance pass.
- The20–30minute opening-experience and first-time human three-minute takeoff targets require user play-testing. The automated three-contract route proves completion, not those usability targets.
- macOS notarization and Apple Developer signing are not included. This alpha is ad hoc signed. Windows support, multiplayer and Robot Vision remain outside this release.
- The aerodynamics are simplified and calibrated for play. They do not replace engineering analysis or certified flight models. No claim of measured learning improvement is made.
