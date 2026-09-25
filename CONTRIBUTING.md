# Contributing to Docs&I

Thank you for helping. Docs&I (`docsandeye`) is AGPL-3.0 with an additional permission that keeps the guides you generate free of licence obligations (see LICENSE). Contributions are accepted under the andeye Contributor Licence Agreement.

## Before your first pull request

1. Read [CLA.md](CLA.md). You keep your copyright; you grant andeye Ltd a licence to relicense your contribution, which is what lets the project keep the output exception intact and ship builds the AGPL cannot reach.
2. Add your name to [CONTRIBUTORS.md](CONTRIBUTORS.md) in your own commit.
3. When the CLA check comments on your pull request, reply with the sentence it asks for. No forms.

## Working on the code

- Node 22 or later (see `.nvmrc`) and Python 3.11 or later. `npm install` at the root installs every workspace; `npm test` runs the JavaScript suites; `python3 -m unittest discover -s render/tests -t render` runs the render-pipeline suite (OpenSCAD and CadQuery are optional at test time; tests that need the real binaries skip when they are absent). These commands land with the packages.
- End-to-end tests: `npm run e2e` builds the plugin's interactive fixture site (`packages/starlight-docsandeye/fixtures/site-interactive`, into `dist-e2e/`), serves it with a small static server that honours `404.html`, and drives it in Chromium with Playwright: glossary tips from the keyboard, the saving consent, profile answers and conditions, the parts receipt, prev/next links, search, 404 and axe accessibility checks in light and dark. Run `npm run build` first, and once per machine `npx playwright install --with-deps chromium`. The suite lives in `packages/starlight-docsandeye/e2e/` (files `*.e2e.ts`; `npm run typecheck:e2e` type-checks it) and runs in CI on every push and pull request.
- The same suite runs against any built Docs&I site. `E2E_DIST` names the built site directory (the fixture build is then skipped and that directory is served); `E2E_GUIDE` is a guide path (default `/kit/`), `E2E_STEP` a step path with a glossary term, checks and a receipt, and `E2E_SEARCH` a term search finds. Tests that assert the fixture's own content skip themselves; the rest (glossary tip keyboard, consent, prev/next, search, 404, axe light and dark, receipt scaling with units) run. For example, from the repository root with electroPioreactor checked out beside it:

  ```sh
  E2E_DIST=../electroPioreactor/site/dist E2E_GUIDE=/AEP/ E2E_STEP=/AEP/step-05-set-up-electrolysis/ E2E_SEARCH=septum npm run e2e
  ```
- Conventional commits (`feat:`, `fix:`, `docs:`, `chore:`), with a body that says what changed and why.
- Open work lives in TODO.md; finished work is recorded in CHANGELOG.md in the same commit as the change.
- Never commit rendered video, machine-specific paths, local hostnames or IP addresses. The repository is public.
- Please do not copy CSS or JavaScript from other documentation sites into theme packs; re-implement from published token values only.

## Reporting problems

Open a GitHub issue with the smallest guide that reproduces the problem (a component YAML, a step, a video manifest). For anything about the electroPioreactor guide itself, use that repository.
