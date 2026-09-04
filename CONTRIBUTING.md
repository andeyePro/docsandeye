# Contributing to Docs&I

Thank you for helping. Docs&I (`docsandeye`) is AGPL-3.0 with an additional permission that keeps the guides you generate free of licence obligations (see LICENSE). Contributions are accepted under the andeye Contributor Licence Agreement.

## Before your first pull request

1. Read [CLA.md](CLA.md). You keep your copyright; you grant andeye Ltd a licence to relicense your contribution, which is what lets the project keep the output exception intact and ship builds the AGPL cannot reach.
2. Add your name to [CONTRIBUTORS.md](CONTRIBUTORS.md) in your own commit.
3. When the CLA check comments on your pull request, reply with the sentence it asks for. No forms.

## Working on the code

- Node 20 or later and Python 3.11 or later. `npm install` at the root installs every workspace; `npm test` runs the JavaScript suites; `python -m pytest render` runs the render-pipeline suite (OpenSCAD and CadQuery are optional at test time; tests that need the real binaries skip when they are absent).
- Conventional commits (`feat:`, `fix:`, `docs:`, `chore:`), with a body that says what changed and why.
- Open work lives in TODO.md; finished work is recorded in CHANGELOG.md in the same commit as the change.
- Never commit rendered video, machine-specific paths, local hostnames or IP addresses. The repository is public.
- Please do not copy CSS or JavaScript from other documentation sites into theme packs; re-implement from published token values only.

## Reporting problems

Open a GitHub issue with the smallest guide that reproduces the problem (a component YAML, a step, a video manifest). For anything about the electroPioreactor guide itself, use that repository.
