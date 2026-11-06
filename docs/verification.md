# Verification record

## Current game-quality update — 2026-11-06

This update strengthens the existing two-workshop play loops. It preserves all six missions per game, the selected visual direction, the original success thresholds and version1 saves.

- Flight now has bounded undo/redo, orbit-drag selection protection, a heading-following chase camera and reset view. The circular delivery check follows the cargo's actual swept world position. Live objectives and the review use the same mission evaluator; impact feedback reports measured pre-contact speeds.
- Robot Vision distinguishes draft edits from active trained weights, identifies the inspected input and actual model scores, and clears evidence when its input task changes. Sensor augmentation preserves the underlying class and the supplied label independently. Restored weights cannot inherit a cancelled model's learning curve.
- Sorting supports pause and one-part stepping with stable controls. Reviews show criteria, units, a next experiment and the previous comparable setup/results. Retry actions remain visible while the evidence scrolls; bounded imported evidence remains compatible with earlier saves.

The full format/type/lint/unit check passed **129 tests across 12 suites**. The final production build passed. **All 36 browser workflows passed**: 12 in Chromium (1.6 minutes) and 24 in Firefox/WebKit (2.3 minutes), including real training, flight, crash/rebuild, save/restore, cancellation, undo/redo, comparison evidence, identified inspection and exact single-step decisions.

Observed native-Chromium play-testing confirmed real yaw/roll flight with a stable horizon, accurate crash review and no page errors. At 1440×900 with the page unscrolled, the Pause control stayed at y798.45 with 56.80px height after feedback appeared; one step advanced 2→3 decisions. At 390×844, the review retry action stayed fully visible and the body width remained 390px. These observations and screenshots are in [the play-test record](design/quality-2026-11-06/observed-playtest.json), [paused sorting](design/quality-2026-11-06/vision-paused.png), [flight turn](design/quality-2026-11-06/flight-turn.png), [review](design/quality-2026-11-06/flight-review.png) and [narrow review](design/quality-2026-11-06/review-mobile.png).

The final review found one minor inspector inconsistency: editing a training label left an open inspector showing the previous label. The fix resolves the displayed training label by inspected sample ID while keeping the inferred input, held-out label and active model scores unchanged. The strengthened affected browser flow passed again in all three engines (3/3 checks, 36.9 seconds), including immediate label edits/reverts, score preservation, genuine retraining, image inspection, cancellation and restoration.

The quiet final benchmark used the Apple M2/16 GB reference machine, regular Chromium 156.0.8078.4 with Metal graphics, a 1920×1080 viewport and a 1400×430 flight drawing buffer:

| Workload                                                     | Measured result                                       |
| ------------------------------------------------------------ | ----------------------------------------------------- |
| 128-part aircraft, 6.009-second window, 337 airborne samples | 60.0 mean FPS; 16.8 ms 95th-percentile frame interval |
| Default 16-epoch CNN, 72 training examples                   | 0.80 seconds worker training; 0.97 seconds wall time  |
| Dedicated vision workers after exit                          | 0, down from 1                                        |
| Page errors                                                  | 0                                                     |

[Raw benchmark record](design/quality-2026-11-06/benchmark-metal.json). Both bounded targets were met on this machine. These measurements do not establish performance on other devices, enjoyment, improved learning or complete syllabus coverage. Repeated inspection uses the same held-out comparison batch and is practice evidence rather than a fresh generalization test.

[Release pipeline 42174672961](https://github.com/Cheezecats/curriculum-games/actions/runs/42174672961) passed verification and deployed the quality update from `c67981a`. The live HTTPS check returned 200, completed a real 76.8 m / 4.4 s flight, verified that an open inspector immediately follows an edited training label, trained the 16-epoch CNN in 0.64 s, read its four active feature maps and three actual scores, paused/stepped sorting 2→3, and confirmed workers 1→0 after exit. It recorded zero page errors or failed HTTP assets. [Hosted quality verification](design/quality-2026-11-06/live-verification.json). An earlier hosted probe timed out waiting for robot startup during intermittent network failures; a repeat of the unchanged script completed successfully. This does not establish startup reliability on every connection.

The sections below retain the earlier beta's verification and delivery history.

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

## Public delivery

The public source is [Cheezecats/curriculum-games](https://github.com/Cheezecats/curriculum-games) and the verified demo is [Fieldwork on GitHub Pages](https://cheezecats.github.io/curriculum-games/). [Release pipeline 42147084568](https://github.com/Cheezecats/curriculum-games/actions/runs/42147084568) passed the full check/build, actual WebGL 2 preflight in all three engines, and all 24 browser checks in 2.9 minutes, then deployed successfully.

The first hosted run passed 20 checks but could not initialize Firefox flight in Linux headless mode. Running the complete unchanged assertions in display-backed browsers under Xvfb resolved that environment failure. The pipeline now fails explicitly if WebGL 2 is unavailable and retains browser screenshots/traces as artifacts. This setup follows [Playwright's Linux headed-browser guidance](https://playwright.dev/docs/ci#running-headed).

A separate smoke check of the live HTTPS site returned 200, loaded both artwork assets, launched and reviewed an actual flight, trained the 16-epoch CNN and inspected its four active feature maps, and returned to the hub. The hosted model reported 1.37 seconds training in that check. Font license delivery returned 200 and the browser recorded zero page/console errors. [Live verification record](design/qa/live-verification.json). This smoke check verifies the hosted worker and relative asset routes; it is separate from the more complete local/CI play-through suites.
