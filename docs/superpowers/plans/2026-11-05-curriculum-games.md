# Curriculum Games Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Ship original flight-building and robot-vision browser games, each with six curriculum-linked missions and real measurable underlying mechanisms.

**Architecture:** One static Vite application with a lightweight shared hub/progression/persistence layer and dynamically imported game components. Flight and vision depend only on shared types/storage, so their implementations can be owned independently once those contracts exist.

**Tech Stack:** TypeScript, React, Vite, Three.js, Rapier 3D, TensorFlow.js workers, IndexedDB, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-05-curriculum-games-design.md`

## Global Constraints

- Original games; 3D flight, 2D vision; six missions each plus unrestricted free play.
- SI units, fixed 120 Hz flight simulation, 128-part construction limit, three working templates.
- Real training/predictions/feature maps; disjoint train/evaluation families and augmentations.
- Mission completion, exploration, and concept checks tracked separately; checks do not gate gameplay.
- Desktop browsers, English, local saves, static GitHub Pages build; no backend/accounts/paid APIs.
- Original prose with sources; precise CS objective/level tags stay pending until verified.
- 60 FPS and <30-second default training are measured targets, not unsupported claims.

## Review Focus

- Corrupt/oversized imports must fail atomically without losing current progress or aircraft (Tasks 1/2).
- Held keys and hidden/unmounted views must not move an aircraft or leave a training worker running (Tasks 2/3).
- Cancellation/retraining must not apply stale model results or grow tensors (Task 3).
- Completion must depend on real measurements, with non-solutions rejected (Tasks 2/3).
- Low frame rates, resizing, and paused tabs must not change simulated results or cause runaway catch-up (Task 2).

---

### Task 1: Shared contracts, persistence, progression, and application shell

**Files:** `src/core/types.ts`, `storage.ts`, `progress.ts`, `registry.ts`; `src/App.tsx`, `main.tsx`, `styles.css`; `src/components/*`; `tests/core.test.ts`; root configuration.

**Interfaces:** Produces `GameProps`, `MissionDefinition`, `AttemptResult`, `ControlSettings`, `ProgressData` in `types.ts`; `readRecord<T>(key, fallback): Promise<T>`, `writeRecord(key, value): Promise<void>` in `storage.ts`; pure progression/import/export helpers. Games export default components at `src/games/{flight,vision}/{Flight,Vision}Workshop.tsx` and named arrays `flightMissions` / `visionMissions` from `missions.ts`.

- [x] Write failing progression tests: a failed attempt explores but does not complete; passing a check does not invent gameplay completion; one game's results do not unlock the other; history capped at 30; malformed/nonfinite imports rejected atomically.
- [x] Run `npm test -- tests/core.test.ts`; observe missing behavior.
- [x] Implement versioned IndexedDB records, monotonic progress, validated import/export, bounded history, curriculum/mission hub, source notes, settings, and debrief.
- [x] Run the focused tests, `npm run typecheck`, and relevant browser flow.
- [x] Commit the independently usable shared application.

### Task 2: Flight builder, deterministic physics, renderer, and six missions

**Files:** Owned directory `src/games/flight/`, with `FlightWorkshop.tsx`, `missions.ts`, core engine/parts/blueprints, Three.js scene, subsystem stylesheet, and tests.

**Interfaces:** Consumes shared `GameProps` and storage helpers. Produces default `FlightWorkshop` and `flightMissions: MissionDefinition[]`; testable engine with fixed-step advancement, actual telemetry, and pause/resume/reset/dispose. Use IDs `flight-1` through `flight-6`. Calls `onAttempt` only for finished attempts; debrief must not interrupt active flight.

- [x] Write failing tests for mass/COM/inertia, blueprint validity/128-part cap, force/mass, ballistic motion, off-axis torque, nonnegative battery energy, dissipative drag, and equal trajectories at 30/60/120 rendering rates.
- [x] Run flight tests and confirm meaningful failures before implementing the core.
- [x] Implement builder and physics, with three flyable fixtures, real per-part forces, battery/motor bookkeeping, controlled test bench, and actual six mission predicates.
- [x] Prove stock solutions satisfy each predicate and near-miss invalid configurations fail.
- [x] Build the 3D world and editor, accessible controls, camera/orbit/pause/reset, real graphs/force/COM overlays, import/export and local saves, settings, debrief callbacks, lifecycle cleanup.
- [x] Run the core suite, typecheck, browser build/fly/crash/rebuild/complete flow, and record measured performance.
- [x] Commit the complete physics chapter after review fixes.

### Task 3: Genuine model training, worker lifecycle, and vision game

**Files:** Owned directory `src/games/vision/`, with `VisionWorkshop.tsx`, `missions.ts`, datasets/model/training worker/client, game visuals, subsystem stylesheet, and tests.

**Interfaces:** Consumes shared `GameProps` and storage. Produces default `VisionWorkshop`, `visionMissions: MissionDefinition[]`, genuine train/predict/inspect APIs. Use IDs `vision-1` through `vision-6`. Worker requests carry job IDs; cancellation/reset invalidate obsolete results.

- [x] Write failing tests for disjoint dataset families, input bounds, real held-out learning on sensor/image fixtures, inspector outputs matching active tensors, and stale-job rejection.
- [x] Run vision tests and confirm missing behavior.
- [x] Implement bounded procedural two-sensor and 16x16 grayscale datasets, perceptron/MLP/CNN presets, genuine TensorFlow.js learning/inference and intermediate activations in a CPU worker, starter models, cancellation/disposal, and model persistence.
- [x] Implement conveyor sorting, sample labeling/selection and augmentation, training progress, model inspectors, six measured mission predicates and free play.
- [x] Verify actual training improves held-out fixtures, reset/retrain/save/restore works, and default browser training meets the measured time budget.
- [x] Commit the complete CS chapter after review fixes.

### Task 4: Cross-browser integration, documentation, and public delivery

**Files:** `tests/e2e/*`, `playwright.config.ts`, `docs/*`, `README.md`, `CONTRIBUTING.md`, licenses/notices, `.github/workflows/*`; targeted integration repairs.

**Interfaces:** Uses both game exports and shared saved data without changing their contracts unless a documented ruling is necessary.

- [ ] Write failing browser checks for navigation, mission progression/check separation, save/restore/import, flight and vision play flows, and lifecycle disposal.
- [ ] Run them against the actual app and implement targeted repairs from observed failures.
- [ ] Run typecheck/lint/unit/integration tests and production build, then Chromium/Firefox/WebKit checks with real WebGL where available.
- [ ] Document controls, actual curriculum coverage/source scope, physics/model assumptions, reproducible performance measurements and any unverified checks.
- [ ] Configure CI and GitHub Pages; create source repository and publish the verified demo when account tools permit.
- [ ] Obtain independent whole-project review, repair important findings, rerun affected verification, and commit the finished result.

## Execution rulings

- The user explicitly requested implementation of the approved plan; routine implementation choices do not require another approval round.
- Empty workspace: create a dedicated `curriculum-games` repository on `codex/curriculum-games`, rather than a worktree of a nonexistent project.
- Independent flight and vision directories may be delegated concurrently under the parallel-agents workflow once shared contracts and dependency setup are stable. Root owns shared files, integration, and publication. All task gates retain meaningful tests and independent review.
