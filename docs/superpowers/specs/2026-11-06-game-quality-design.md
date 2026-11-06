# Game quality reinforcement

This pass executes the existing approved game design and the user's 2026-11-06 request to strengthen game quality. It preserves the selected industrial frontend direction and the original two-workshop scope. The user has already delegated the balance of fun, quality and breadth in the approved brief; the choices below are implementation judgments within that scope.

## Intent

Make experiment → play → inspect → revise → retry more useful. Address observed contradictions and control defects before expanding content. Existing starter aircraft/models remain accessible baselines; gameplay success and optional checks remain separate.

## Approaches considered

A visual-only pass improves first impressions but leaves camera, data and evidence defects intact. New missions add breadth while making these defects harder to diagnose. The selected implementation approach strengthens the existing play loops: dependable flight controls/editing, truthful model experiments and actionable results. This is the implementer's recommendation and routine scope choice, not a claim that the user picked specific new controls.

## Changes

- Flight: heading-following, horizon-stable chase camera; orbit drags do not select parts; reset view; bounded undo/redo for valid connected builds; rendered gate aperture matches swept crossing detection; truthful end reasons and recorded-run state; live objective evidence from the same evaluator as completion.
- Vision: class-preserving augmentation without silently correcting supplied labels; exact selected sensor evidence; active trained model distinct from editable draft; clear stale results on task changes; inspect a named input and actual class scores; running sorting feedback, pause/single-step; describe the repeated fixed held-out batch honestly; criterion-based completion evidence.
- Shared results: units and decisive measurements rather than the first nine arbitrary fields; met/unmet objective rows and a measured next experiment; previous comparable attempt and configuration; validated optional evidence/configuration in version1 saves; explicit directions for meaningful best metrics.

## Boundaries

Keep 120Hz Rapier physics, SI units,128 parts, genuine TensorFlow.js workers and bounded models, disjoint training/evaluation families, six missions per game, existing success thresholds, static hosting and local saves. No new subject, accounts, backend, fresh evaluation-batch mechanism, mandatory quizzes, or curriculum mapping claims. The inertia example must be labelled as a fixed equal-mass courier demonstration, not the player's current aircraft. Softmax values are model scores, not calibrated certainty.

## Evidence and delivery

Meaningful red/green tests pin the mathematical and state defects. Observed browser checks cover actual changed controls and invalid/edge paths in Chromium/Firefox/WebKit; inspect screenshots and resource cleanup, then repeat the capped-flight/training benchmark. Preserve old saves and import validation. Independent review precedes integration and publication. Claims about enjoyment and learning remain limited to what is actually observed.
