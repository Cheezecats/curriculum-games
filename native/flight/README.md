# Flight Islands — native alpha

Build an improbable aircraft, lift off from a coastal airfield, carry a real load, and bring it home safely. This is a native Godot game; the browser prototypes elsewhere in this repository remain separate references.

## Play

The Mac alpha contains an offline, single-player 3D workshop, twelve component families, a fixed coastal region, three delivery contracts, two discoveries and free flight. Repairs cost nothing. A crash preserves your design; retry restores your launch cargo and battery.

[Download the Mac alpha and editable source](https://github.com/Cheezecats/curriculum-games/releases/tag/flight-islands-v0.1.0-alpha.1). Extract the macOS archive and open **Flight Islands.app**. This alpha always runs silently. The archive includes controls, verification evidence and an audio-free gameplay recording.

Use Godot **4.7.2** to open `project.godot`, or use the packaged Mac application. The alpha is ad hoc signed, **not notarized**. It is an early playable build, with the remaining acceptance limits recorded in [verification.md](verification.md).

For a silent source run, set `GODOT_BIN` to the Godot executable and run:

```sh
./tools/run-silent.sh
```

The Mac application has a native launcher that also forces Dummy output and master mute, including automatic relaunches. It preserves local designs in the normal game profile. This source launcher chooses the Dummy audio output before startup and enforces master mute. Its default save folder is a temporary test profile. It does not change macOS volume or the player's saved volume setting. All automated editor, game, export and recording sessions use these two audio safeguards. Audible sound quality has not been assessed.

## First flight

1. The Island trainer is ready with the first parcel. Select **Roll out to runway**.
2. Hold **Up** or **Shift** to reach full power. At about 11 m/s, gently hold **S** to rotate, then release it to settle into the climb. The assistance moves the control surfaces; it still needs airspeed.
3. Bank with **A/D** and steer on the ground with **Q/E**. The chart and gold diamond locate your destination.
4. Reduce power with **Down** or **Ctrl**. Line up with the runway early. Descend gently at approximately 11–13 m/s, level the wings, then use **Space** to brake after touchdown.
5. Taxi into the gold pad and stop below **2 m/s**. Press **F** to unload. Cargo must physically be inside the pad and grounded. Returning to the workshop selects the next contract.

| Action                    | Keyboard / mouse                              | Gamepad default        |
| ------------------------- | --------------------------------------------- | ---------------------- |
| Pitch / bank              | W/S · A/D                                     | Left stick             |
| Ground steering / yaw     | Q/E                                           | Shoulder buttons       |
| Increase / reduce power   | Up or Shift / Down or Ctrl                    | Right / left trigger   |
| Brake                     | Space                                         | A / south              |
| Unload                    | F                                             | B / east               |
| Workshop / retry          | Tab / R                                       | X / west · Y / north   |
| Pause / notebook          | Esc / I                                       | Start for pause        |
| Engineering overlay       | G                                             | Remappable             |
| Orbit / zoom              | Right drag in workshop / wheel in either mode | Mouse for construction |
| Undo / redo               | Z / Y                                         | Remappable             |
| Rotate placement          | C pitch · X yaw · V roll                      | Remappable             |
| Remove selected component | Delete / Backspace                            | Workshop button        |

Controls can be rebound to keys, mouse buttons or gamepad inputs in **Controls & settings**. The alpha's construction view uses a mouse. Real gamepad hardware acceptance remains open; engine-level event routing is checked automatically.

## Workshop

Click a component to select it. Its six attachment points appear in gold. Choose a component family, hover a socket to preview placement, then click. A green preview is valid; red explains a rejected attachment. Mirror mode adds the opposite component. **Replace selected** can upgrade a symmetrical wing pair directly. Rotation is in quarter turns. Disconnected edits are rejected atomically. The limit is 128 connected components and exactly one cockpit.

Paint, undo/redo and saved blueprints work on the same assembly that flies. The local profile and its backup store designs, completed jobs, discoveries and settings. On a malformed current save, the last valid backup is recovered. Flight position is not saved; relaunch begins in the workshop.

The heavy contract needs more than the stock trainer. One tested solution uses larger wings, replaces the nose motor with a strut, adds two wing motors and two battery packs. Those changes add lift, power, mass and stored energy. Other connected designs are unrestricted. The ridge can be approached directly or via the lower western valley; climb, range and landing position trade against each other.

## Physics and architecture

- SI units, +Y up, -Z forward. Jolt rigid-body integration at **120 Hz**, independent of rendering.
- `core/parts.gd` defines dimensions, mass, lifting area, engine force and battery energy. Twelve original component GLBs correspond to those dimensions.
- `core/mass_properties.gd` sums rotated cuboid inertias plus parallel-axis terms, then resolves principal axes. The rigid body is located at the combined centre of mass; model and collision transforms preserve the blueprint frame.
- Each surface uses its own local air velocity, including angular velocity. Aerodynamic, engine, cargo-drag and gear forces act at their actual component locations, producing torque.
- Simplified air density is 1.225 kg/m³. Lift slope is 5/radian, wing incidence 0.07 rad and peak lift coefficient 1.45. Stall begins above 0.30 rad and blends smoothly toward a post-stall curve by 0.65 rad. Induced and cross-flow drag dissipate energy.
- The 65 N motor consumes electrical energy at 72% efficiency, with a minimum 6 m/s load and 20 W overhead. A battery stores 120 kJ and weighs 2 kg. These are gameplay parameters, not a hardware specification. Partial final battery steps scale thrust; empty packs cannot produce thrust.
- Pitch, bank and coordinated yaw assistance only requests bounded elevator, aileron and rudder deflections. It cannot set velocity, add free lift or refill energy. Gear uses spring/damper contacts, lateral tyre friction and rolling/braking resistance.
- Cargo is a visible, collidable cuboid scaled with mass at constant density. It contributes to the full inertia tensor. Unloading preserves position, energy and elapsed-flight evidence.
- Wind, weather, propwash, detailed airfoil tables, structural flex and damage are not simulated. The fixed authored region uses a deterministic heightfield and placement seed; there is no infinite world generator.

`game/aircraft.gd` owns physical flight; `game/world.gd` owns the region; `core/contracts.gd` owns delivery rules; `core/history.gd` and `core/profile.gd` own editing and persistence. `game/main.gd` connects the native game and HUD. `qa/` contains explicitly requested, muted development workloads; normal play never activates them.

## Build and verify

Install official Godot4.7.2, its matching macOS export templates and Apple Command Line Tools for the native silent launcher. With `GODOT_BIN` configured:

```sh
./tools/run-silent.sh --headless --editor --import
python3 tools/test.py
python3 tests/launcher_test.py
python3 tools/build_mac.py
python3 tools/gameplay.py --app 'build/Flight Islands.app'
python3 tools/benchmark.py --app 'build/Flight Islands.app' --duration 600
```

The strict runners reject script errors even when Godot exits with status0. The gameplay controller uses the game's actual Input actions after a normal ground launch; it does not teleport or set body velocities. It tests a real crash, retry, two aircraft designs, physical deliveries and a separate-process restore. The performance runner checks the actual rendered image size before measuring ten minutes of a 128-part aircraft. Recording workloads are excluded from performance qualification.

The original Blender master and GLB generation code are retained in `assets/source/` and `tools/generate_art.py`. Branding is editable SVG with a reproducible generator. [Asset provenance](assets/README.md), [original art licence](assets/LICENSE-ART.md), [third-party notices](THIRD_PARTY_NOTICES.txt), and the root MIT/CC BY4.0 licences cover redistribution.

This alpha teaches through engineering choices. It does not claim validated learning gains, complete curriculum coverage or published SL/HL mappings.

## Technical references

The underlying force structure follows the [NASA lift equation](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/lift-equation/). Native force and body-frame APIs are documented in Godot's [RigidBody3D](https://docs.godotengine.org/en/stable/classes/class_rigidbody3d.html) and [PhysicsDirectBodyState3D](https://docs.godotengine.org/en/stable/classes/class_physicsdirectbodystate3d.html) references. The chosen coefficients, assistance, stall blend and battery parameters are this game's simplified calibration; those sources do not validate its handling or learning effects.
