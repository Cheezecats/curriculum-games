# Native subsystem contracts

Godot4.7.2, GDScript and Jolt. SI units; +Y up, -Z forward, +X right. Physics120Hz. Original browser prototypes remain separate.

## Components and artwork

`core/parts.gd` exposes `kinds()` and `definition(kind)`. A definition contains `label`, `mass`, full cuboid `size`, lifting `area`, stored `energy`, maximum `thrust`, parasitic `drag` coefficient and GLB `model` path. Unknown kinds return an empty dictionary.

| Family      | Mass kg | Full size m     |
| ----------- | ------: | --------------- |
| cockpit     |       4 | .85 × .8 × 1.5  |
| fuselage    |     1.5 | .7 × .55 × 1.2  |
| strut       |     .35 | .18 × .18 × 1   |
| wing        |     1.1 | 2.2 × .14 × .7  |
| large_wing  |    1.65 | 3.2 × .16 × .85 |
| aileron     |     .25 | 1.2 × .1 × .3   |
| elevator    |     .35 | 1.5 × .12 × .4  |
| rudder      |      .3 | .12 × .8 × .65  |
| motor       |     1.8 | .55 × .55 × .7  |
| battery     |       2 | .5 × .35 × .7   |
| gear        |      .9 | .3 × .65 × .45  |
| cargo_mount |     .45 | .7 × .15 × .8   |

Wing areas are1.5/2.5m²; aileron/elevator/rudder areas .32/.5/.4m². Each motor has65N maximum thrust and each battery120kJ capacity. See the native README for aerodynamic and electrical assumptions.

Aircraft GLBs live under `assets/models/`, centred on their physical component frame. Environment models under `assets/environment/` have ground-centred origins. Moving child names are `Propeller` (localZ), `Flap` (localX for aileron/elevator, Y for rudder) and `Wheel` (localX). Paintable materials are named `Paint`. Preserve these pivots, model bounds and original editable sources when changing art.

## Blueprints and editing

A blueprint is JSON-compatible:

```text
{version:1, name:String, paint:"rrggbb", parts:[
  {id:String, kind:String, p:[x,y,z], r:[degrees_x,degrees_y,degrees_z]}
]}
```

`core/blueprint.gd` provides `starter()`, `position(part)`, `basis(part)` and `validate(blueprint) -> {ok,error}`. A build has1–128 parts, one cockpit, unique nonempty IDs and centres, finite positions within32m, quarter-turn rotations and a connected rotated-AABB graph with maximum .08m separation. Overlap at connections is permitted. Invalid edits must leave live state intact.

`core/history.gd` exposes a deep-copy `current`, selected ID, validated `apply`, `undo` and `redo`; history is bounded to40 edits. Mirror placement reflects position and yaw/roll. Static visual instancing must preserve component transforms, authored geometry and all individual collision shapes.

## Mass and physical frame

`Mass.compute(blueprint,cargo_mass=0)` returns `mass`, `com`, full `tensor`, positive principal moments `principal`, right-handed principal `axes`, `cargo_position`, `cargo_size` and `cargo_basis`. Invalid data returns an empty dictionary. The tensor includes rotated cuboid centroid inertia and parallel-axis terms.

The rigid body's origin is the total centre of mass. Its axes are the principal axes; model and collision transforms counter-rotate into that frame. `tensor = axes × diag(principal) × axes.transposed()`.

The18kg cargo box measures .8 × .65 × .85m. Dimensions scale by `(mass/18)^(1/3)`. Its centre is the first mount's position plus its rotated local-UP direction times `.095 + cargo_height/2`. The mount basis rotates cargo geometry, inertia and its attachment offset together. Cargo drag uses projected area. Unloading preserves world position, battery energy and elapsed-flight evidence.

`game/aircraft.gd` owns force integration, landing gear, animation and crashes. It provides `configure`, `place`, `launch`, `set_paused`, `unload_cargo`, `craft_basis`, `craft_origin` and actual `telemetry`. Guidance may set normal controls/throttle/brake. It must not manufacture lift or energy or override flight velocity.

## Contracts and persistence

`core/contracts.gd` provides `all()`, `can_deliver(contract,telemetry)` and `next_contract(completed)`. Cargo masses are2/18/10kg. Harbour pad centre is(-402,9,-250); ridge pad centre(448,118,-350). Both painted pads have8m radius. Delivery uses the actual cargo centre, horizontal radius, height difference below3m, grounded state, speed below2m/s, present cargo and no crash. Missing or nonfinite evidence fails. Completion unlocks the next job; after all three, repeat contracts and free flight remain available.

`core/profile.gd` stores version1 designs, progress and settings, with atomic replacement and a validated previous backup. The current aircraft and every saved blueprint are validated. Corrupt current data may recover from the backup. Save failure preserves the live session, remains visible and prevents implicit quit; discarding changes requires the player's explicit choice.

## Silent verification

Every agent-run editor/game/export starts with `--audio-driver Dummy` and user argument `--test-muted`. Boot enforces master mute before audio nodes start and refuses a testing session using another output driver. Never change system volume or save the testing override as the player's preference. Test profiles are isolated in temporary folders.

QA controllers operate through actual Input actions after normal ground launch. Render batching may reduce draw overhead without deleting physical parts. Headless smoke tests do not qualify GPU performance. The benchmark verifies an actual1920×1080 image and records ten minutes, slow-frame percentiles and hardware; open gates must remain explicit.
