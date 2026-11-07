# Native alpha verification

This records observed behavior and remaining acceptance limits for Flight Islands 0.1.0-alpha.1. Automated completion is not evidence of enjoyment or improved learning.

## Tested application

- Official Godot **4.7.2**, matching export templates, Jolt, 120 Hz physics. Official downloads were SHA-256 checked before use.
- Native universal macOS app, Mobile/Metal rendering, original Blender artwork and animated propellers, surfaces and wheels. Browser prototypes remain separate and unchanged.
- The gameplay implementation is revision `d321d83`. Subsequent release-document changes do not change its packed game. The release manifest records the complete source revision, engine, launcher and packed-game hashes.
- The supplied app is ad hoc signed and **not notarized**. Archive extraction, signature verification and an extracted-app gameplay/restore check are required before publication.

## Correctness and complete gameplay

The final local run passed **13/13 Godot suites, 679 assertions**, plus **8/8 native-launcher checks**. Strict runners reject engine errors and warnings even when the engine exits with status zero.

| Area                   | Evidence                                                                                                                                                                                        |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Construction           | Connectivity, 128-part limit, one cockpit, attachment bounds, mirrored changes, rotation, history, remapped mouse/gamepad actions and conflict rejection.                                       |
| Physical aircraft      | Ballistic motion, force/mass and torque/inertia, full rotated inertia tensor, component-position forces, real ground contact and takeoff.                                                       |
| Handling               | Control-driven takeoff and landing; an airborne stall followed by nose-down, powered recovery with energy consumption. No body-state overrides after test initialization.                       |
| Energy                 | Drag dissipation, motor consumption, exhausted-pack behavior and partial-step power limits. Cargo unloading cannot refill the battery.                                                          |
| Cargo                  | Visible geometry, collider, position, balance and inertia all rotate with its mount. Delivery requires actual grounded cargo inside the destination pad below 2 m/s.                            |
| Persistence            | Atomic saves, versioned validation, backup recovery, visible write errors, blocked quit on failed save and separate-process restore.                                                            |
| Lifecycle              | Crash/retry race protection, a fresh physical body on return to the workshop, window-close save gate and audio/resource cleanup.                                                                |
| Rendering independence | Matched 120 Hz physical samples at render caps 15/30/60/144 agree in position, velocity, attitude and energy. Actual callback counts are observed; a cap is not assumed to be an achieved rate. |
| Rendering structure    | Static repeated aircraft visuals are instanced; all physical colliders remain. Bounds are checked in the body frame. Regional vegetation preserves all material meshes and trunk colliders.     |

The packaged app completed a control-driven crash, retry, first trainer delivery, failed stock heavy-cargo attempt, larger-wing twin-motor modification, successful heavy delivery and ridge delivery. A second app process restored the hauler and all three completed contracts. The latest headless run took **12.46 seconds**, with **1.37 seconds** for restore; those accelerated checks are not real-time performance measurements. A prior real GPU play flow completed in **415.20 wall seconds**, plus **2.70 seconds** for restore.

The two successful aircraft are materially different: a 15-part trainer carrying 2 kg and a larger-wing, twin-motor, three-battery hauler carrying 18 kg. The stock trainer fails the heavy-lift check. The hauler subsequently delivers 10 kg to the ridge via the lower western route.

The retry test checks return to flight within five seconds while preserving the design and restoring launch cargo and battery. Automated takeoff occurs around eight to nine seconds after rollout. Neither measurement establishes a first-time human player's speed.

A final rendered native reset probe flew for 20 simulated seconds, returned to the workshop, waited through physics/render synchronization, then captured the aircraft at the home apron `(110, 15.5, 440)`. This checks the visible stale-position bug that a headless run alone had missed.

## Measured Mac performance

The final guarded app completed **600.005 wall seconds** at a verified **1920 × 1080** rendering resolution on an **Apple M2, 16 GB, Mac14,7, macOS 26.5.2**. The 128-part aircraft took off in **8.62 seconds**, remained airborne for **588.72 simulated seconds**, and finished without a crash, energy exhaustion or engine diagnostic.

| Frame pacing                   | Final result |
| ------------------------------ | ------------ |
| Measured frame intervals       | 82,139       |
| Average frame rate             | 136.90 FPS   |
| Median frame interval          | 6.865 ms     |
| 95th-percentile frame interval | 10.300 ms    |
| 99th-percentile frame interval | 17.924 ms    |
| Longest frame interval         | 1108.025 ms  |

The mean and 95th-percentile pacing both pass the declared 60 FPS gate (16.67 ms). **This is not a hitch-free result:** a roughly 1.11-second frame interval was recorded and remains a limitation of this alpha. Tests used the Mobile/Metal renderer, 2× MSAA, four shadow cascades, uncapped rendering and 120 Hz physical simulation. V-sync was disabled for measurement; time scale remained 1.0.

The renderer's GPU-timestamp counter was unavailable. No zero-GPU-time claim is made. The measurement uses frame intervals, actual full-resolution image proof and recorded host hardware. Recording/encoding was excluded from this workload.

The first ten-minute baseline failed the same pacing gate (114.64 FPS mean, 19.25 ms p95). Component-data caching, shared paint materials and static visual instancing improved the measured result without removing physical colliders or lowering resolution. Experiments with smaller foliage chunks and reduced shadow settings were slower and were reverted. Final lighting retains four shadow cascades and the detailed foliage.

## Actual presentation and controls

Native framebuffer captures were inspected for aircraft construction, takeoff, banking, coastal flight, approaches, delivery and the return to the home apron. Basic keyboard throttle, pitch and bank, mouse rollout and pause/resume were observed through desktop input. The level-horizon chase camera, terrain obstruction, model articulation and consistent original materials were inspected during native play.

`flight-islands-gameplay-silent.mp4` contains approximately 90 seconds of actual control-driven first-delivery gameplay: 1280 × 720, 30 FPS, encoded from a 1600 × 900 native recording. Its media metadata confirms **no audio stream**. It is not a 1080p benchmark or a human play-test.

## Mandatory silence

The app's native launch boundary selects **Dummy** audio output before starting Godot and supplies the master-mute flag. Caller-supplied audio-driver choices are removed. The same boundary runs on ordinary double-clicks and automatic relaunches. A no-argument launch was checked at runtime: `driver=Dummy`, `master_muted=true`.

Source editor/game/export/test tools use the silent wrapper; editor child-game arguments also request Dummy output and master mute. Test profiles are isolated. No macOS volume or player volume preference is changed. Audio event triggering, looping, pitch/volume updates and disposal are checked silently. **Audible sound quality remains unverified.**

During desktop automation, an early managed process was observed without the requested command-line arguments and stopped. That observation led to the native launcher safeguard; it is not evidence that audible output was heard. Desktop capture automation also stalled, so final checks use native framebuffer captures and engine input rather than relying on that tool.

## Review decisions and remaining limits

- All six final-review findings were fixed: event-independent workshop actions, pre-GUI rebind capture/cancellation, binding conflict rejection, save-error/quit behavior, live control labels and rotated cargo geometry/inertia. The cargo finding was raised from minor to important because physical attachments must remain consistent. No review minor was deferred.
- Battery capacity is a documented gameplay calibration: 120 kJ per 2 kg pack. It keeps the introductory route attainable; human testing may still require balance changes.
- A broad manual acceptance pass, real gamepad hardware and accessibility usability remain open. Engine input-event coverage does not replace those checks.
- The 20–30-minute opening-experience target, first-time three-minute takeoff, enjoyment and comparative learning outcomes require human play-testing. Automated completion does not establish them.
- The simplified aerodynamics omit weather, propwash, detailed airfoil tables, structural flex and damage. They are not certified engineering analysis. No measured learning gain or complete curriculum coverage is claimed.
- Apple Developer signing/notarization and Windows remain outside this alpha. Internet-downloaded copies may encounter macOS security restrictions. Robot Vision, multiplayer and additional expansion content are deferred.

Selected raw gameplay, hardware, benchmark and launcher reports accompany the alpha under `Evidence/`. The release manifest and SHA-256 list identify the exact downloadable artifacts.
