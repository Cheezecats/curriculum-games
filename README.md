# Fieldwork

**Native Flight Islands alpha:** [game, controls, build and verification](native/flight/README.md). The browser games below remain available as earlier prototypes.

[Play the browser beta](https://cheezecats.github.io/curriculum-games/) · [Source repository](https://github.com/Cheezecats/curriculum-games)

An original browser playground for physics and machine learning. Build an aircraft, train a robot, and use the results of your experiments to work out what to change next.

The first beta contains **Flight Workshop** and **Robot Vision**, with six guided missions each and unrestricted free play. It covers selected IB Physics and Computer Science concepts. It is an experimental learning project; improved exam performance and learning efficacy have not been established.

## Run locally

Requires Node.js 22.12 or newer; development and verification use Node 24.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. The application needs a desktop browser with WebGL 2 for Flight Workshop. Training, models, aircraft, and progress stay in the browser. Runtime data is stored in IndexedDB; no account, API key, paid service, or application backend is required.

```sh
npm run check       # TypeScript, ESLint, real physics/learning/persistence tests
npm run build       # Production static bundle in dist/
npm run preview     # Serve the production bundle
npx playwright install chromium firefox webkit
npm run test:e2e    # Browser workflows, including genuine training and flight
```

The first workshop load downloads its rendering/physics or learning dependencies. Subsequent game operations use local browser computation. Serve `dist/` over HTTP(S); opening `index.html` through `file://` does not support module workers correctly.

## Flight Workshop

Choose one of three flyable starter aircraft, select a part in the scene, and attach new parts to its faces. The editor supports movement, 90° aero-surface roll rotation, deletion, JSON import/export, and up to 128 connected parts. Undo/redo retains up to 40 valid edits and the selected part; an invalid edit leaves that history intact. Use **Aircraft files → Save locally** to save a design; **Restore save** loads it into the current hangar.

The elevated launch gives the aircraft an initial 18 m/s at 36 m altitude. The chase camera follows the aircraft heading with a level horizon and frames its centre of mass. Dragging to orbit does not change the selected part; **Reset view** recentres the camera. Compare the live objective measurements and finish an attempt when you have enough evidence. Crashes and safe landings end the attempt automatically. The controlled bench isolates force, mass, torque, and inertia from aerodynamic effects.

| Action                         | Default control               |
| ------------------------------ | ----------------------------- |
| Pitch up / down                | S / W                         |
| Roll left / right              | A / D                         |
| Yaw left / right               | Q / E                         |
| Increase / decrease throttle   | Left Shift / Left Control     |
| Orbit the builder camera       | Drag                          |
| Zoom the builder camera        | Scroll                        |
| Undo / redo a build edit       | Undo edit / Redo edit buttons |
| Re-centre the camera           | Reset view button             |
| Pause, resume, finish, rebuild | On-screen controls            |

Controls and pitch inversion are configurable in the workshop. Losing focus or hiding the view pauses flight and clears held keys. Engine physics uses SI units at 120 Hz; rendering speed does not set the simulation timestep. See [the model notes](docs/model-notes.md) for the deliberately simplified aerodynamic and collision assumptions.

## Robot Vision

The robot learns genuine model weights in a dedicated TensorFlow.js CPU worker. It can use a linear perceptron, a nonlinear hidden-layer network, or a small convolutional network.

1. In **Data**, inspect the training examples, correct labels, select the examples to include, and optionally augment training families.
2. In **Train**, choose a model and bounded training settings. Follow actual training and validation measurements.
3. **Deploy** on the same 24-part held-out comparison batch. Pause the belt or advance one part at a time to inspect a decision. Review mistakes, adjust the training data, and compare another run. Repeated inspection means this is practice evidence, not a fresh generalization test.

The trained-model banner distinguishes active weights from draft edits: changing data or settings requires retraining before those edits affect the robot. Open **Inside the active model** to see the named input, actual class scores, weights, a sensor decision surface, or real convolution outputs. Scores are softmax outputs, not a guarantee of correctness. Test examples are used for scoring and inspection, never automatically copied into training. Model snapshots preserve validated training evidence with their learned weights. Older snapshots without historical evidence restore with that history explicitly unknown.

Sensor examples show precise readings and the declared factory rule; sensor augmentation stays within the same underlying class while preserving supplied labels. Image augmentation translates and dims only training-family images.

Training can be cancelled. Restoring saved weights clears unowned learning curves, since snapshots do not store those curves. Leaving or hiding the view terminates pending worker work. Local model saving happens after successful training; the last completed saved model can be restored after a cancellation.

## Curriculum and progression

Results show met/missed criteria, units and a suggested next experiment. The retry controls remain visible while scrolling the evidence. Comparable attempts show measured differences and the setup used; changing several things does not isolate which one caused a result. Recent notebook observations can be expanded to inspect their measurements and criteria.

Gameplay success unlocks the next mission in the same workshop. Optional concept checks are separate from gameplay progression. The notebook distinguishes exploration, mission completion, and a correct answer on a concept check; it does not claim that one answer proves mastery.

| Pack                                       | Initial coverage                                                                                           | Mapping status                                                                                                                  |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| IB Physics, first assessment 2025          | A.1 kinematics, A.2 forces and momentum, A.3 energy and power; A.4 torque and inertia at HL                | Checked against the publicly available guide                                                                                    |
| IB Computer Science, first assessment 2027 | Selected A.4 machine-learning concepts: neural networks, data quality, CNNs, evaluation and generalization | Topic-level connection confirmed by the public overview; exact objective and level labels withheld pending current-guide review |

Aerodynamic design details and practical model training extend beyond the mathematical scope of individual curriculum objectives. These are partial packs, with original prose and questions. [Detailed curriculum coverage and sources](docs/curriculum.md).

The notebook can export and import a versioned JSON progress backup. Invalid imports are rejected before replacing current progress. Aircraft have a separate validated JSON format. Recent attempt history is bounded to 30 records.

## Project structure

```text
src/core/             Shared mission types, curriculum registry, progress and IndexedDB
src/components/       Hub, notebook, concept-check debrief and accessible dialogs
src/games/flight/     Aircraft definitions, Rapier engine, Three.js world and editor
src/games/vision/     Datasets, TensorFlow engine, worker protocol, conveyor and inspectors
tests/                Shared boundaries and complete browser workflows
docs/                 Curriculum, model assumptions, verification and approved design
```

Game components are loaded on demand. Their engines are independently testable; mounting and unmounting the React views owns the rendering and worker resources. Public component inputs are defined in `src/core/types.ts`.

GitHub Actions verifies the application and deploys the static build to GitHub Pages from `main`. Hash routes and relative asset paths support repository subpaths. See [CONTRIBUTING](CONTRIBUTING.md) for adding a game or mission and [verification notes](docs/verification.md) for measured results and limits.

## Licenses

Original source code: [MIT](LICENSE). Original educational prose: [CC BY 4.0](LICENSE-CONTENT.md). [Third-party notices](THIRD_PARTY_NOTICES.md).
