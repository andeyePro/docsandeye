# Changelog

Done-work log for Docs&I (`docsandeye`), newest first. Open work is in TODO.md.

## 2026-09-04

- [x] **task_001 `@docsandeye/core`** — `0d34621` (generator, Fable) + `827fe71` (tester, 159 vitest tests): content schemas for components, steps, media and config; project loader with picomatch denylist; staleness engine and canonical `staleness.json`; reshoot index; render plan with SHA-256 params-hash keys; version-bump guard; hosting-provider registry (the Plus seam). Root npm workspaces, vitest 5, TypeScript 7. Spec archived at `.vs/archive/task_001/spec.md`.
- [x] **Hygiene round 2** — CONTRIBUTING now says Node 22 and the real test commands; `.gitattributes` (LF text, binary render and media types), `.editorconfig`, SECURITY.md (private disclosure via contact.andeye.com). Specs for all six v0.1 tasks moved to in progress on Martin's instruction to proceed.
- [x] **Repo hygiene after the spec round** — README licence section now points at the landed files, a Prerequisites section (Node 22, Python 3.11+, optional OpenSCAD/CadQuery), the font decision noted in the roadmap; TODO annotates the Plus/Pro seam as part of the core hosting registry and drops the CHANGELOG item (this file exists); `.nvmrc` pins Node 22; the confidential `Martin/` briefing untracked (a1cc656).
- [x] **Licence files** — `4052db2`: LICENSE (AGPL-3.0 + Docs&I Output Exception under section 7), CLA.md (andeye CLA v1.0 verbatim), CONTRIBUTORS.md, CONTRIBUTING.md and the CLA Assistant Lite workflow. Landed before any outside contribution so the copyright holder can grant the exception. Wording of the exception queued for Martin's review (Docs&I-fromClaude).
