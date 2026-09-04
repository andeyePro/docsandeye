## task_001 — cycle 1 — Generator (Fable 5.1)

- Commit `0d34621` on `vsss/task_001-core`: monorepo root (package.json workspaces, tsconfig.base.json, vitest.config.ts) + `packages/core` (`@docsandeye/core`) with errors, canonical-json, hosting, schemas, load, staleness, reshoot, render-plan, guard, index; fixtures `minimal/` and `aep-like/` (5 components incl. f3z + off-the-shelf, 2 guides, 3 steps, 2 videos + 1 photo = 1 STALE / 1 CHANGED_IN_FRAME / 1 FRESH, denylisted sentinels, stray README).
- Deps pinned: zod 4.5.4, yaml 2.9.0, semver 7.8.5, picomatch 4.0.7, vitest 5.0.0, typescript 7.0.2, @types/node 22.20.1.
- Verification: `npx tsc --noEmit -p packages/core` clean; `npm run build -w @docsandeye/core` emits dist/index.js + index.d.ts; scratch tests `npx vitest run --config .vs/cycle-1/scratch-tests/vitest.config.ts` 45/45 green (run red first); root `npm test` exit 0 (passWithNoTests until Tester files land).
- All 15 ACs implemented; ambiguity choices in `.vs/cycle-1/generator-report.md`. Flag: `Martin/Docs&I.md` was found staged in the worktree index (not by me) and was unstaged before committing.
