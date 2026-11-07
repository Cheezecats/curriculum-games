# Flight Islands implementation

Spec: docs/superpowers/specs/2026-11-06-flight-islands-design.md

## Global constraints

NativeMac3D,Godot4.7.2/GDScript/Jolt,120Hz SI,+Yup/-Zforward/+Xright,128connectedparts, actualforces/mass/COM/inertia/cargo, no fake telemetry, all agent-run sessions MUST use Dummy output and test-muted master bus before sound can start. No systemvolume/preference mutation. Preservebrowserbeta. Qualitygates overcontentbreadth.

## Task1 — native foundation and mathematical core

Root config/silentlauncher/tests and core scripts. Establish behavioralRED/GREEN for validatedblueprints, mass/COM/fulltensor+principalaxes, cargo load/unload, bounded history, atomicprofiles/backups, actualdeliverycondition. Native scene muststartsilently withGodot4.7.2. Existingbrowser129tests baselinepass.

## Task2 — native flight and building loop

One real Rigidbody aircraft with measured componentforces, energybudget, surface-driven stabilization, spring/damper/friction gear, groundtakeoff, stalls/recovery, impact/crash/reset. Buildsocketghost/mirror/rotation/history/paint/save. Actual cargo delivery. Test andplaytest fullcycle before expandingcontracts.

## Task3 — aircraft/world artwork and complete opening

Independent artpack generation inBlender withGLB andblendmaster, cohesivecoastalworldassets/3destinations/2discoveries; animatedparts, wind/engine/contact audio tested silently; fullnativeHUD andremappablecontrols. Threegameplaycontracts and progression usingactualphysics.

## Task4 — release and observed quality

Native unit/integration tests, two successfuldifferentdesigns and failedstarterheavyattempt, actualkeyboard/gamepad lifecycle, build→takeoff→crash→rebuild→land→delivery→save/relaunch. Silentnativepackagedappscreenshots/recording. 10min128part1080p benchmark withframetimes/hardware. Independentwholebranchreview; fiximportantfindings. Mac.app/alphaarchive,source,notices,setup/controls/modelnotes. Do notlabelincompletegatescomplete. No audioaudition.

## Review focus

Cargo actualworldposition/contacts, blueprint mutation atomicity, inertiaframe transforms, forceapplicationpoints, dissipativeaerodynamics/batterypartialsteps, UIstate/lifecycle/autosaves, testmutebeforeoutput, rendered nativegame actuallyplayed, fullviewport benchmark nottinysubcanvas.
