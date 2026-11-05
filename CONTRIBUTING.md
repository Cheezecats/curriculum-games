# Contributing

Start with `npm ci` and `npm run dev`. Keep game rules and measurement separate from presentation. A useful contribution makes something fun to experiment with and makes the mechanism easier to inspect.

## Before opening a change

- Run `npm run check`, `npm run build`, and the browser workflows relevant to the change.
- For simulation, training, progress, persistence, or lifecycle changes, add a meaningful regression test and observe the failure before repairing it.
- Verify interface changes in both workshops. Keep unrelated changes out of a focused contribution.
- Test controls, focus, resizing, pause/retry and leaving/reopening the view in a browser when changing gameplay UI.
- Record performance measurements with browser, hardware, dimensions, workload and duration; avoid universal FPS claims from one device.

## Adding a mission

Mission definitions live alongside their game. Provide a unique ID/order, original brief and objective, concepts, curriculum version/scope, sources, and an optional original concept check. Implement its success predicate from actual engine/model measurements and test a successful fixture plus a near miss. A source reference is not permission to reproduce its prose.

Mission completion unlocks the next mission in the same game. Concept checks remain optional and independent. Keep free play open. For unverified curriculum detail, retain an explicit pending mapping rather than inventing objective IDs or level labels.

## Adding a game

Follow `GameProps` in `src/core/types.ts`, export a default workshop component and a lightweight mission array, and register the metadata in `src/core/registry.ts`. Dynamically import the heavy component. The view owns its resources: remove input listeners, stop animation, dispose geometry/tensors, terminate workers, and invalidate pending results when it unmounts.

Use `readRecord` / `writeRecord` for versioned IndexedDB records. Validate imported data before replacing current state. A storage failure should leave the live experiment usable and offer an export when available.

## Content and art

Keep explanations concrete and connected to recorded observations. Use original or compatible licensed assets and preserve attribution. Code contributions use MIT; original mission prose and questions use CC BY 4.0. Add third-party credits when introducing dependencies or assets.
