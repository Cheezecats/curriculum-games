# Verification record

## Reference environment

Development machine: Apple M2 MacBook Pro, 16 GB RAM, macOS arm64, Node.js 24.14.0. Browser checks use isolated Playwright contexts, not a personal browser profile. Device serial numbers and credentials are not part of this record.

## Correctness checks

On 2026-11-06, `npm run check` passed TypeScript, ESLint, and **60 tests across seven suites**. These include actual Rapier dynamics, genuine TensorFlow.js training, model save/restore, startup/cancellation, progress, IndexedDB, and import validation.

The independent source review found and prompted regression fixes for reverse/rotating aerodynamic energy creation, an inertia/collider dimension mismatch, lost saved training evidence, and hidden-view initialization races. A scoped independent re-review found all four resolved.

Specific physical fixtures cover force/mass, ballistic motion, off-axis torque, true contact landings, battery exhaustion/partial steps, dissipative forces under reverse and rotational flow, render-rate invariance, valid/invalid aircraft, three flyable starters, mission stock solutions and rejected near misses.

Learning fixtures use genuine optimization and unchanged held-out data. The default nonlinear sensor model reaches its tested 80% target. The tested image fixture reaches at least 75% on ordinary held-out shapes and 65% on independently shifted shapes with training-only augmentation. Those are toy-task fixture results, not claims about arbitrary data or real-world vision.

## Browser observations

All 24 browser workflow checks passed in 2.5 minutes against the production preview. After selection and narrow-layout repairs, the six affected flight checks passed again across all three engines. Chromium, Firefox, and WebKit have each completed the real build/save/restore/fly/check/unlock workflow and the train/deploy/image-training/cancel/restore workflow. They also pass actual crash/rebuild/retry, locked-route/free-play and keyboard skip-navigation checks. The option 1 redesign was compared in combined source/implementation images, with the evidence and resolved findings in [design QA](../design-qa.md). Firefox's four gameplay checks took 32.8 seconds; WebKit's took 40.3 seconds. A keyboard skip-link regression was observed exiting the active workshop; its repair keeps the route and focuses content.

The test browsers run outside the restricted macOS execution sandbox because Chromium's Mach-port startup is blocked inside it. No personal browser profile is used. The in-app browser control connection timed out; local isolated browser capture is the working verification path.

## Performance and limits

The design targets 60 FPS at 1080p for a capped 128-part craft and default training under 30 seconds on the reference machine. Run `npm run benchmark` against a running app, or set `BENCHMARK_URL` to a production preview server. The report is written to `output/benchmark.json`.

On 2026-11-06, the final production build in regular Chromium's new headless mode (156.0.8078.4, channel `chromium`), with a 1920×1080 viewport, device scale 1, and 1400×430 drawing buffer, measured:

| Workload                                                                     | Result                                                        |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------- |
| 128-part aircraft, 6-second window, 337 airborne frame samples after warm-up | 60.0 mean FPS; 16.8 ms 95th-percentile frame interval         |
| Graphics device                                                              | ANGLE Metal Renderer: Apple M2; WebGL enabled                 |
| Default 16-epoch CNN, 72 training examples                                   | 1.39 seconds recorded worker training; 1.65 seconds wall time |
| Dedicated vision workers after exiting the game                              | 0, down from 1 during the game                                |
| Page errors during the benchmark                                             | 0                                                             |

[Recorded accelerated result](design/qa/benchmark-metal.json). Both measured targets were met for this bounded workload on the reference machine; this does not establish universal performance. The canvas occupies part of the 1080p interface, with its exact drawing-buffer dimensions disclosed above.

The separate Chromium headless shell used by the correctness suite fell back to SwiftShader software graphics in a diagnostic run. Its final fixture measured 29.0 mean FPS and 0.79 seconds of training ([record](design/qa/benchmark-software.json)); an earlier shell run before the redesign measured 56.1 FPS. These variable software-rendered results do not establish native GPU performance. The benchmark now records the graphics backend and defaults to the regular `chromium` channel; use `BENCHMARK_CHANNEL=shell npm run benchmark` to explicitly measure the shell. [Playwright documents the two headless implementations](https://playwright.dev/docs/browsers#chromium-new-headless-mode).

Results can change with viewport, refresh rate, graphics backend, device load, overlays, or training configuration. Repeat after material rendering or model changes.

Human enjoyment, long-term learning, exam improvement, complete syllabus coverage, and experimentally accurate aircraft engineering have not been established by these checks.
