# Option 1 implementation QA

Date: 2026-11-06. Final result: passed.

## Comparison target and evidence

- Source visual truth: [selected option 1](docs/design/selected-option-1.png), the first displayed Image Gen result selected by the user.
- Implementation: production preview at `http://127.0.0.1:4173/`, initial hub with zero progress, default light theme and no open dialog.
- Source and final implementation: 1487 × 1058 pixels; CSS viewport 1487 × 1058, device scale factor 1. No device chrome or density rescaling. The initial full-page capture was cropped to the same viewport for comparison.
- [Full-view final comparison](docs/design/qa/comparison-final.jpg): source on the left, implementation on the right in one combined input.
- Focused comparisons, also source left / implementation right: [typography](docs/design/qa/comparison-typography.jpg), [flight copy and controls](docs/design/qa/comparison-flight.jpg), [robot row](docs/design/qa/comparison-robot.jpg). These were opened and inspected in addition to the full view.
- Additional rendered evidence: [phone-width hub](docs/design/qa/mobile-final.jpg), [flight workshop](docs/design/qa/flight.jpg), [robot workshop](docs/design/qa/vision.jpg), [missions](docs/design/qa/missions.jpg), [notebook](docs/design/qa/notebook.jpg).

The in-app browser control connection timed out. Verification used isolated local Playwright browser contexts with no personal profile. Screenshots show rendered browser output, not composed HTML mockups.

## Comparison history

1. **Blocked — initial comparison.** [Combined evidence](docs/design/qa/comparison-initial.jpg) showed P2 typography and density drift: the display face was too narrow, the first image began around y367 rather than y342, and the robot image was about 292px tall rather than 237px. The robot action fell below the target viewport. Replaced display text with locally bundled Roboto Condensed Black, retained Anton for the wordmark, tightened the hero line height/padding, and changed the image ratios to 2.36 and 3.7.
2. **Blocked — responsive inspection.** The narrower page exposed missing spaces where desktop line breaks were hidden in two headings. Added real whitespace in the content and captured the production build again. A stale development-server transform was detected during capture; the server was restarted and final evidence was taken from the production bundle.
3. **Passed — post-fix hub comparison.** Final full-view and focused comparisons show the intended black/white/red hierarchy, asymmetric rows, large industrial images, flat dividers and square actions. Measured first image top y341.8 / height412.8; robot image top y804.6 / height237.0. Phone headings have correct spaces. No actionable P0/P1/P2 visual findings remain.

4. **Blocked — independent review.** Review found that selected battery/control parts shared the new red fill and lost their highlight. A 320px flight check also confirmed 357px content width. Added a distinct yellow selection tint plus black outline, recursive outline disposal, and a three-column mobile instrument grid.
5. **Passed — repair verification.** [Selected control surface](docs/design/qa/flight-selection-fixed.jpg) visibly has its yellow/black treatment; the selected-part panel agrees with the clicked part. [320px flight](docs/design/qa/flight-320-fixed.jpg) fits at measured scrollWidth320. Zero page errors. A scoped independent re-review found no actionable defect in either repair.

## Required fidelity surfaces

| Surface              | Observed result                                                                                                                                                                                                                                                                                                                    |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fonts and typography | Heavy condensed headings, two-line hero, compact wordmark and readable body text match the selected direction. Fonts are bundled locally. No fallback, clipping or truncated headings was observed. The exact generated mock typeface is unknown; small glyph-shape differences are P3.                                            |
| Spacing and layout   | Main margins, 70/30 flight row, 63/37 robot row, dividers, image proportions and action positions match the reference hierarchy. No horizontal overflow at widths390,768,1024,1487. Mobile stacks images and copy.                                                                                                                 |
| Colors and tokens    | White, near-black and vermilion `#ef2b12`; no pastel card theme or decorative gradients. Primary white-on-red labels use large bold type; small prose uses dark text. Keyboard focus has a visible red outline.                                                                                                                    |
| Image quality        | Both standalone generated illustrations follow the selected industrial, ivory and red art direction. Entire aircraft and meaningful robot subjects remain visible. No placeholder art replaces these images. The robot image uses a top-aligned crop to preserve its arm. Prompt/source provenance and original PNGs are retained. |
| Copy and content     | The source's central copy is preserved. Working mission links, browser-local completion counts, source links and notebook explanations are deliberate additions needed by the approved game plan. Curriculum claims remain scoped.                                                                                                 |

## Product and accessibility checks

Both workshop launch actions, six-mission selectors, free play, notebook, progress export, invalid import feedback, locked missions, optional checks and keyboard skip navigation were exercised. An actual hard landing produced measured evidence, then rebuilding and launching again worked. Training, deployment, genuine inspectors, cancellation and restore were exercised. Both games retain their actual engine/model data.

The hub, notebook and both game screens were inspected at desktop size. Phone-width hub text, images and controls were inspected after the whitespace repair. Width measurements found no horizontal overflow on the hub at the four listed breakpoints. These checks do not establish mobile flight playability; the release targets desktop keyboard browsers. Final capture recorded zero page or console errors. Focus/selected/disabled states remain distinguishable without relying only on color; dialogs use the existing keyboard/focus handling.

The selected mock contains illustrative game toolbars within the preview. The implementation uses clean promotional scene images with a real launch affordance, while the actual controls live inside the working games. This is an intentional functional adaptation, documented rather than presented as a screenshot of runtime graphics.

## Implementation checklist

- [x] Resolve and preserve the exact selected visual target.
- [x] Replace all preview placeholders with individually generated, inspected images.
- [x] Compare normalized full view and focused regions in combined inputs.
- [x] Repair typography, density and responsive heading defects; recapture.
- [x] Inspect the shared visual direction in both games, missions and notebook.
- [x] Check primary interactions, keyboard focus, browser errors and responsive hub widths.

## Follow-up polish

P3: an independently licensed face with even closer glyph shapes could further match the generated mock. Functional game graphics intentionally remain simpler than the promotional scenes. Human enjoyment and learning outcomes still need external play-testing. The final accelerated 128-part fixture measured 60.0 FPS on Apple M2; see [verification](docs/verification.md) for hardware, viewport, graphics-backend and training measurements.

final result: passed
