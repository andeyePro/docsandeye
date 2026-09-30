# task_024 — non-leading multiple-choice checks

Source: Martin, 2026-09-28 (chat). "Checks should be less leading: 'Did you move the shunt…?' begs a maker in a rush to tick yes. 'Does X look like this or this' means they can quickly look and respond without any feel of which is correct. Each check item goes green with a tick when completed correctly, but it should not be obvious what correct is until the user has picked. The correct answer order should be evenly distributed, not always first, last or middle."

## Schema (packages/core)
- A check gains `options` (2..6). Each option: `label` (markdown inline, required), optional `image` (repo-relative path or https URL) + `alt` (required when image), `correct: true` on exactly one, and for wrong options an optional `fix` (what to do if the reader sees this).
- `issues` (the old yes/no form) stays valid for back-compat; a check has either `options` or the old form, not both (schema error).
- `question` for the option form is observational ("Where is the shunt connector?"), not yes/no.

## Order
- Authors list the correct option anywhere. At model build the engine reorders each check's options deterministically so that, across all option-form checks of a guide in reading order, the correct option's position cycles evenly (round robin over the option count, e.g. check k with n options puts correct at k mod n). Same output every build. Wrong options keep their relative order.
- Export the placement function and unit-test the distribution (no position > ceil(N/n)+1 for N checks).

## UI (packages/starlight-docsandeye, <docsi-checks> + Checks.astro)
- Options render as neutral choices (radio-like buttons, images as thumbnails with alt), no styling that hints the answer, no "correct" data exposed in the initial HTML as plain attributes a reader sees (a hashed/opaque marker per option is fine; view-source safety is not required, visual neutrality is).
- Pick correct → the check turns green with a tick, counted as checked (same store and "Step checked" behaviour as today's Yes).
- Pick wrong → that option is marked, its `fix` shows (plus the existing "Something else — contact us" line); the correct option is NOT revealed; the reader can pick again.
- Stored state restores on reload. Keyboard operable, axe-clean light and dark, 390 px without overflow.
- No-JS: options listed; a <details> per check reveals the answer.
- Legacy yes/no checks render exactly as today.

## Check guard (packages/cli `docsandeye check`)
- Warning per legacy yes/no check in a guide ("yes/no check: rewrite as options").
- Error: option form with zero or more than one correct, image without alt.

## Tests
- core: schema, placement distribution, export/interactive model.
- plugin: fixture step with an option check (text + one image option); e2e (Playwright suite in packages/starlight-docsandeye/e2e) covering wrong-then-right, tick, reload persistence, keyboard.
- Full vitest suite green; `npm run build` green. Commit in small commits on main in /workspace, messages ending with the Co-Authored-By trailer. Do not push. Do not touch /repos.
