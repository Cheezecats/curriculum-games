# Game Quality Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Check steps as evidence is obtained.

**Goal:** Strengthen both existing games through reliable controls, truthful experiments and actionable feedback.

**Architecture:** Keep game subsystems independent. Each game produces named criterion evidence from its existing mission evaluator; the shared debrief renders that evidence with units and comparable history. Optional bounded evidence/configuration fields extend version1 attempts without breaking old backups.

**Tech Stack:** Existing TypeScript/React/Vite, Three.js/Rapier, TensorFlow.js worker, Vitest/Playwright. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-06-game-quality-design.md`, within `2026-11-05-curriculum-games-design.md`.

## Global constraints

Retain six missions per game, current thresholds/starter solutions,128-part connected aircraft, SI units/fixed120Hz, genuine training/inference and disjoint data, optional concept checks, current industrial styling and static/local persistence. Do not assert detailed CS level mapping or learning efficacy.

## Review focus

- Drag gestures cannot accidentally alter selected aircraft parts; undo must restore selection and reject invalid builds without history changes.
- Fast or off-aperture gate crossings cannot disagree with the rendered target; heading camera must remain stable near vertical attitudes and at different render rates.
- Draft settings/data cannot be presented as the trained model; old task results and cancelled/hidden jobs cannot populate new task evidence.
- Sensor augmentation preserves underlying class and supplied label independently; inspectors display the active model's actual computations for a named sample.
- Imported optional evidence is bounded/validated; old backups still work; comparison excludes unrelated input tasks and lower-is-better metrics are not maximized.

## Task1 — Shared evidence and comparisons

**Owner/files:** Shared agent: `src/core/types.ts`, `progress.ts`, new `attempt-feedback.ts`; `src/components/ObjectiveChecklist.tsx`, `Debrief.tsx`, `Notebook.tsx`, `Modal.tsx`, `src/App.tsx`, `src/styles.css`, focused shared tests.

**Contract:** `ObjectiveEvidence {id:string;label:string;actual:string;target:string;passed:boolean;hint?:string}`. Add optional `AttemptResult.criteria?:ObjectiveEvidence[]`, `configuration?:Record<string,string|number|boolean>`. `ObjectiveChecklist({criteria,compact?})` is reusable by game and debrief. Comparable attempts match game, mission and configuration.task.

- [x] RED: old and extended backup roundtrip, malformed/big evidence/configuration rejected, energy/error/tilt/parameter bests decrease, unrelated tasks excluded, mission metrics include correct units/decisive evidence.
- [x] Implement bounded schema validation, feedback/units/deltas helper, criteria-first debrief and previous comparable setup/results; preserve quiz/unlock semantics.
- [x] GREEN focused tests and scoped type/lint; return changed files and evidence.

## Task2 — Flight control and experiment quality

**Owner/files:** Flight agent: `src/games/flight/**`, including new assessment/camera/gesture/history/gate helpers as necessary and meaningful tests.

**Contract:** `evaluateFlightMission(id,metrics):{completed:boolean;criteria:ObjectiveEvidence[]}`; `missionPassed` delegates and stays exported from engine. Attach measured criteria/configuration to onAttempt. Use shared ObjectiveChecklist for live objectives.

- [x] RED: camera heading/damping/near-vertical behavior, drag-vs-click, bounded undo/redo/selection/invalid edit, swept circular gate boundary/fast crossing, completion-evidence agreement and actual end reason.
- [x] Implement forgiving editor/history, camera/reset, shared gate geometry, end feedback, existing-threshold single-source evaluation. Name fixed courier inertia demonstration truthfully.
- [x] GREEN flight tests including existing stock solutions and physics invariants; return evidence.

## Task3 — Vision data, model and sorting quality

**Owner/files:** Vision agent: `src/games/vision/**`, helpers and focused tests.

**Contract:** `evaluateVisionMission(order,metrics):{completed:boolean;criteria:ObjectiveEvidence[]}`; existing missionComplete delegates. Optional correct/total permit integer targets. Criteria/configuration are derived from the active trained model, not the drawer's current settings.

- [x] RED: augmentation crosses no true class boundary and preserves wrong supplied labels; task change resets stale evidence; draft/active detection works after save/restore; inspector scores equal active inference; mission criteria match predicates.
- [x] Implement precise example evidence, validated optional provenance for actual training settings/data signature, active-vs-draft feedback, identified inspector, running bin/score feedback and pause/single-step. Name fixed held-out comparison batch honestly.
- [x] GREEN genuine-learning/worker/persistence/evidence tests; return evidence.

## Task4 — Integration and observed quality checks

**Owner/files:** Root: docs, `tests/e2e/quality.spec.ts`, relevant existing e2e, root configs only if needed, benchmark records.

- [x] Run the released clean baseline before implementation; isolate work from published main.
- [x] Playtest actual controls and capture before/after game screens; add regressions for undo/redo, end-state/checklist, active/draft reset, identified inspection and step behavior, comparison/import persistence.
- [x] Run format/types/lint/unit/build and Chromium/Firefox/WebKit workflows; record exact results, check viewport fit and errors.
- [x] Repeat native-graphics128-part benchmark and default training; review actual diffs independently and repair important findings.
- [ ] Commit, integrate/publish the verified quality update and verify the hosted engines. Preserve the original checkout and current saves.

## Execution rulings

Use disjoint subsystem ownership and one root integration branch. The native worktree tool could not verify the Desktop checkout and stalled on retry; local file reads also stalled for multiple agents. A fresh isolated clone at `/private/tmp/fieldwork-quality-20261106` avoids those reads. Root will return verified commits to the user's source checkout. Do not mutate the source checkout while the quality branch is being built. No dependency upgrades or broad rewriting.
