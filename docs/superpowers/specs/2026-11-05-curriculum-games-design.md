# Curriculum Games — approved design

Approved by the user's explicit request to implement the plan on 2026-11-05.

## Intent

Original, enjoyable single-player desktop browser games whose mechanisms teach selected textbook concepts. A small collection balances fun, topic breadth, and polish. First complete release: Flight Workshop and Robot Vision Workshop, six missions each, with unrestricted free play. Initial curriculum packs are IB Physics (first assessment 2025) and IB Computer Science (first assessment 2027). Label syllabus version, topic, level, sources, and enrichment. These are partial packs.

The user chose original games after comparing commercial-game companions, source adaptation, and original development. They chose a 3D flight builder and delegate the balance between quality, fun, and breadth. Existing games are inspiration, not copied dependencies.

## Flight Workshop

Playful 3D island/valley, modular grid aircraft builder, cockpit/fuselage, structural blocks, wings, control surfaces, engines, batteries, cargo, and skids. Three working starter aircraft; 128-part limit. Rotate/move/delete connected parts, diagnose invalid assemblies. Elevated launch pads, landing zones, fast crashes/retries. Orbit build camera; configurable keyboard flight controls and chase camera.

Six missions: glider motion; thrust versus mass; stable payload delivery; energy-efficient flight; torque/balance; rotational inertia. Last two are HL. A repeatable test bench isolates forces and torque. Free play exposes all parts. Optional force arrows, COM, flight graphs, and energy inspectors use actual simulation state.

Use SI units and a fixed 120 Hz simulation independent of rendering. Rapier handles rigid-body motion/collisions; compute mass/COM/inertia from parts. Apply original per-part aerodynamic/engine forces at their actual locations. Lift depends on relative airflow/angle of attack and has a documented simple stall model. Controls change forces/torques through surfaces, not direct rotation. Document pedagogical aerodynamic and motor/battery assumptions. Aircraft remains a compound rigid body; crash debris may be cosmetic.

## Robot Vision Workshop

2D robot/conveyor sorting game: collect/select labeled data, configure a bounded model, train, deploy, inspect costly held-out mistakes, improve. Six missions: weights/bias; nonlinear MLP; data quality; CNN features; generalization; accuracy/computation cost. Begin with two sensor inputs and progress to small grayscale geometric-part images. Genuine TensorFlow.js training/inference runs in a Web Worker with progress/cancellation. Actual predictions, learned weights, feature maps, and curves are displayed. Keep train/validation/test families and their augmentations separate. Starter trained models enable accessible initial play; free experimentation remains available. Cryptography and attention/transformers are later expansions.

## Learning, persistence, and delivery

Experiment, play, inspect evidence, revise, retry. Gameplay achievements unlock missions. Optional short post-run questions use fresh situations; track completed, explored, demonstrated separately. Original explanations are tied to actual run/model measurements and are source-backed. Verify exact CS objective/SL/HL labels before publishing those labels; otherwise mark detailed scope review pending.

TypeScript/Vite/React, Three.js, Rapier, Canvas/DOM, TensorFlow.js workers. Shared mission/curriculum/attempt/check types; lifecycle mount/pause/resume/reset/dispose. Versioned IndexedDB progress/aircraft/settings/models, bounded histories, validated JSON aircraft/progress import/export. Dynamically load large game modules; dispose resources when exiting. One repo, static GitHub Pages build, procedural/original art, MIT code, CC BY 4.0 educational prose, third-party notices. English, desktop browsers, local saves. No accounts/backend/paid API/multiplayer in the first release.

## Acceptance and order

Flight vertical slice and play-test first, complete six physics missions, add six vision missions and shared progression, verify and publish source/docs/demo. Unit/integration checks: F/m, ballistic motion, COM/inertia/torque, energy accounting, render-rate invariance, actual model learning, held-out separation, inspector accuracy, save/import, cancellation/reset/disposal. Browser checks: build/fly/crash/rebuild/complete and train/deploy/fail/improve on Chromium/Firefox/WebKit. Targets: 60 FPS at 1080p with capped craft and default training under 30 seconds on development Mac; record actual hardware/results. Automated correctness and observed play-tests guide releases; no unsupported efficacy claims.

Sources: https://www.ibo.org/globalassets/new-structure/university-admission/pdfs/subject-guides/physics-guide.pdf ; https://ibo.org/university-admission/latest-curriculum-updates/computer-science-updates/ ; https://rapier.rs/docs/user_guides/javascript/rigid_bodies/ ; https://www.tensorflow.org/js/tutorials/training/web_worker
