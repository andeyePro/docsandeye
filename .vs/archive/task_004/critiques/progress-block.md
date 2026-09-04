## task_004 — cycle 1 (Generator)

- Commit `fdf6767` on `vsss/task_004-cli`: `packages/cli` (`docsandeye` CLI: init / render / check), root `package-lock.json`.
- Scratch tests `.vs/cycle-1/scratch-tests/cli.test.mjs` (node:test, 26 cases over the built `dist/bin.js`, fake python3, a real temp git repo, `fixtures/dist`): red before src existed → `# pass 26 / # fail 0` after.
- `npm run build -w docsandeye` ok (`dist/bin.js` starts `#!/usr/bin/env node`); `npm run typecheck -w docsandeye` ok; root `npm test` exit 0 (no vitest files yet).
- Real-Python smoke of `render --allow-missing` on a fixture copy: `rendered 0, cached 0, hand-exported 0, skipped 3, failed 0`.
- Ambiguity choices and two core contract gaps (equality-only guard cleared via `git merge-base --is-ancestor`; model exposes no component file paths) recorded in `.vs/cycle-1/generator-report.md`; `.vs/cycle-1/diff.patch` written.
- All 12 ACs believed met; no upstream files edited.
