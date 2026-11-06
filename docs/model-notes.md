# Model notes

## Flight simulation

Aircraft coordinates use +X forward, +Y up, +Z to the right. The assembly grid is 1 m; physical cube colliders are 0.96 m per side, with a 4 cm gap between neighboring cells. Individual part masses and aero areas are in `blueprints.ts`. A single Rapier dynamic rigid body carries all colliders, so its mass, centre of mass, and inertia change with construction. The inspector uses the same physical cube dimensions as the solver.

Time advances in 1/120 s steps. Gravity is 9.81 m/s² downwards. The UI caps long rendering gaps and pauses when hidden rather than applying a large catch-up impulse. Tests supply identical time-indexed inputs at 30/60/120 render schedules.

Every part sees the rigid body’s translational velocity plus local velocity from angular motion. That velocity is transformed into aircraft coordinates before forces are computed. Aerodynamic and motor forces act at the part’s actual world location, generating torque about the actual centre of mass.

Wing and control-surface lift uses dynamic pressure with a simplified angle-of-attack curve, an incidence offset, and a gradual post-stall reduction. The lift vector is perpendicular to local relative flow. Parasitic and induced drag oppose relative velocity, including backward and rotating flow. Regression tests check nonpositive aerodynamic power on unpowered parts in those cases. This is a pedagogical model with tuned coefficients, not computational fluid dynamics or an experimentally validated airfoil model.

At full throttle each motor can provide 24 N along the aircraft’s forward axis. Its electrical demand is

```text
thrust × max(5 m/s, |local forward speed|) / 0.72 + 20 W × throttle
```

The floor provides a bounded static-thrust power cost; 0.72 is an assumed conversion efficiency. Each battery stores 60 kJ. The final partially powered timestep scales thrust to the remaining energy. Energy consumption never becomes negative, and an empty battery provides no thrust.

Aircraft geometry is intentionally simple: thin visual wing meshes use cubic physical colliders, parts stay rigid during a flight, engines point forward, and 90° rotation rolls aerodynamic surfaces about the forward axis. Ground/contact events use Rapier contact manifolds and pre-impact velocity to distinguish a gentle landing from a crash. Contact normals and collider identity distinguish the launch platform from the valley floor, including tall or translated assemblies. There is no structural stress or collision-duration model for calculating real impact forces.

The delivery target is an orange ring at x = 65 m, centred at y = 37 m, z = 0, with an inner aperture radius 9.7 m. Delivery sweeps each cargo block’s actual transformed world centre through the ring plane, linearly interpolating within the fixed physics step. The ring is a target rather than a physical impact obstacle. A body origin crossing beside a translated aircraft does not count as parcel delivery.

### Bench

The bench disables gravity, airflow, ground, and initial motion. It measures acceleration under 10 N through COM, angular acceleration under 10 N at a 2 m arm, and the centered-force result. The explicitly labelled preset inertia example uses two equal-mass Cargo courier layouts, moving the same cargo block from above the centre to the nose. Both responses come from the rigid-body solver. The same measured values are shown and used by mission predicates. The preset example is independent of edits to the current aircraft; the force/torque bench measures the current design.

## Vision models and data

The worker uses the browser-compatible TensorFlow.js CPU backend. It trains a linear softmax model, an MLP with one tanh hidden layer, or a small convolution/ReLU/max-pool/dense classifier. Training settings are bounded; the image input is 16×16 grayscale and the image classes are procedural circle, square, and triangle parts.

Data has seeded training, validation, and test families. Augmentation creates variants only from selected training examples, retaining their parent family. Shifted evaluation uses separate dimmed/transformed test examples. Predict requests contain only sensors or pixels. The application compares those predictions with ground truth after inference to score a batch. The deterministic held-out comparison batch repeats for fair comparisons. Once a player has inspected its labels and tuned choices using that feedback, another run is not fresh evidence of generalization. Sensor jitter is constrained to preserve the underlying factory-rule class and keeps the supplied label, including intentional label errors.

The sample-label audit mission intentionally corrupts nine training labels. Repair evidence counts included, correctly repaired originals against the declared audit fixture. Snapshot provenance is generated from completed training: actual epochs, elapsed training time, whether training-family variants were used, and repaired-label count. New snapshots additionally record actual learning rate, training-row count, and a deterministic data signature for comparing the draft with trained weights. It is validated and saved with the weights. Legacy saves without that evidence remain explicitly unknown; the application does not infer past training from a model’s accuracy.

Weights, softmax model scores, decision-surface samples, losses and feature maps are actual active-model computations. The inspector identifies the source/input and displays its actual model scores. A perceptron’s displayed sensor equation subtracts class-zero weights/bias from class-one weights/bias. Feature maps are responses to the inspected input, not illustrations of assumed semantic features. Small procedural tasks make the computation inspectable; they do not demonstrate real-world visual recognition quality.

Worker request IDs and lifecycle generations reject obsolete responses. Hiding, cancelling, resetting, or leaving invalidates deferred initialization and terminates active work. Owned tensors are disposed during replacement and teardown. The application offers explicit restoration/retraining after cancellation or hiding. Cancelled/hidden progress is cleared; restoring weights does not claim to restore an unsaved training curve. Fresh training retains its own measured curve.
