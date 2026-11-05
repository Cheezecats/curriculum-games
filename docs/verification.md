# Verification record

## Reference environment

Development machine: Apple M2 MacBook Pro, 16 GB RAM, macOS arm64, Node.js 24.14.0. Browser checks use isolated Playwright contexts, not a personal browser profile. Device serial numbers and credentials are not part of this record.

## Correctness checks

On 2026-11-06, `npm run check` passed TypeScript, ESLint, and **60 tests across seven suites**. These include actual Rapier dynamics, genuine TensorFlow.js training, model save/restore, startup/cancellation, progress, IndexedDB, and import validation.

The independent source review found and prompted regression fixes for reverse/rotating aerodynamic energy creation, an inertia/collider dimension mismatch, lost saved training evidence, and hidden-view initialization races. A scoped independent re-review found all four resolved.

Specific physical fixtures cover force/mass, ballistic motion, off-axis torque, true contact landings, battery exhaustion/partial steps, dissipative forces under reverse and rotational flow, render-rate invariance, valid/invalid aircraft, three flyable starters, mission stock solutions and rejected near misses.

Learning fixtures use genuine optimization and unchanged held-out data. The default nonlinear sensor model reaches its tested 80% target. The tested image fixture reaches at least 75% on ordinary held-out shapes and 65% on independently shifted shapes with training-only augmentation. Those are toy-task fixture results, not claims about arbitrary data or real-world vision.

## Browser observations

Chromium, Firefox, and WebKit have each completed the real build/save/restore/fly/check/unlock workflow and the train/deploy/image-training/cancel/restore workflow. They also pass locked-route/free-play and keyboard skip-navigation checks. Firefox's four gameplay checks took 32.8 seconds; WebKit's took 40.3 seconds. A keyboard skip-link regression was observed exiting the active workshop; its repair keeps the route and focuses content.

The test browsers run outside the restricted macOS execution sandbox because Chromium's Mach-port startup is blocked inside it. No personal browser profile is used. The in-app browser control connection timed out; local isolated browser capture is the working verification path.

## Performance and limits

The design targets 60 FPS at 1080p for a capped 128-part craft and default training under 30 seconds on the reference machine. Run `npm run benchmark` against a running app, or set `BENCHMARK_URL` to a production preview server. The report is written to `output/benchmark.json`.

On 2026-11-06, a production build in headless Chromium 156.0.8078.4, with a 1920×1080 viewport, device scale 1, and 1350×473 drawing buffer, measured:

| Workload                                                                     | Result                                                        |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------- |
| 128-part aircraft, 6-second window, 315 airborne frame samples after warm-up | 56.1 mean FPS; 16.8 ms 95th-percentile frame interval         |
| Default 16-epoch CNN, 72 training examples                                   | 0.48 seconds recorded worker training; 0.56 seconds wall time |
| Dedicated vision workers after exiting the game                              | 0, down from 1 during the game                                |
| Page errors during the benchmark                                             | 0                                                             |

The measured flight mean is below the 60 FPS target. It is a bounded workload result on one machine, not a universal performance guarantee. The 30-second training target was met for this default task. Results can change with viewport, display refresh, graphics backend, device load, overlays, or a different training configuration. Repeat after material rendering or model changes.

Human enjoyment, long-term learning, exam improvement, complete syllabus coverage, and experimentally accurate aircraft engineering have not been established by these checks.
