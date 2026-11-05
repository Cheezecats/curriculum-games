# Curriculum Games

This is an original browser-game collection. The approved spec is in `docs/superpowers/specs/2026-11-05-curriculum-games-design.md`; implementation tasks are in the matching plans file.

- Run shell commands with `login: false`. Do not assign the zsh `path` variable (it also replaces PATH).
- Use Node >=22.12 and npm. Root owns package/config files and integration.
- Follow meaningful test-first development for simulation, model, progression, persistence, and lifecycle behavior. Configuration, prose, and styling do not need mirrored tests.
- Never fake physics, learning curves, predictions, model weights, feature maps, or progress. Inspectors display data from the same engine/model used for gameplay.
- Physics uses SI units and a fixed 120 Hz step. Rendering timing must not alter simulation outcomes.
- Game modules export a default React component accepting `GameProps` from `src/core/types.ts`, and a named missions array from `missions.ts`.
- Flight files belong under `src/games/flight/`; vision files under `src/games/vision/`. Keep subsystem styles in their respective directories. Coordinate before modifying shared types or root config.
- Save using `readRecord`/`writeRecord` from `src/core/storage.ts`; catch save errors in the UI without discarding the live run.
- CSS design tokens: `--paper`, `--ink`, `--muted`, `--line`, `--orange`, `--lime`, `--teal`, `--panel`; fonts are system sans and monospace. DOM controls must have accessible names.
- Curriculum prose is original and cited. Exact CS objective/level labels remain unverified until checked against a current guide. Avoid claims of complete syllabus coverage or validated learning efficacy.
- Do not commit on behalf of another task, alter another task's files, publish, or spawn further agents when delegated a subsystem. Return changed paths, meaningful red/green test evidence, and any remaining concerns.
