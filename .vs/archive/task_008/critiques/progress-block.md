## task_008 cycle 1 — Generator (Fable 5.1)

- Commits on `vsss/task_008-video-ux`: `935ed5f` (starlight-docsandeye: `<docsi-video>` facade, STALE flow, media manifest, fixtures incl. `project-hosted`/`site-hosted`, `project-nomanifest`/`site-nomanifest`), `066db46` (cli: strict default limited to over-budget lines, `--no-strict`).
- `astro build`: `fixtures/site`, `fixtures/site-hosted`, `fixtures/site-nomanifest` all complete; registering script 6281 bytes (four elements).
- Scratch suites (`.vs/cycle-1/scratch-tests/`): 22 unit/CLI + 10 build assertions green after red-first. `packages/core`+`themes` 188/188, python render suite OK.
- Expected reds in Tester-owned suites: build.test.ts "data-docsi-video=reserved" and reshoot "vial-cap is first" (top-stop now ties on stale heroes and sorts first); cli.test.ts "--strict treats warnings as errors" (default is `errors: 1, warnings: 2` with the CLI fixture — the spec's `warnings: 0` does not fit that fixture's missing asset).
- Report: `.vs/cycle-1/generator-report.md`; diff: `.vs/cycle-1/diff.patch`.
