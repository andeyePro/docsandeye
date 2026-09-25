# task_023 — Review follow-ups in the engine

From the critical review of the AEP0.2 site (2026-09-25). Each item is small; together they remove the things a reader would notice.

1. **Glossary `exclude`**: an entry may list `exclude: ["mm OD", "OD,"]`, phrases (case-insensitive) in which the term must not be matched; a candidate match whose surrounding text (up to 12 characters each side) contains any excluded phrase is skipped and the search continues to the next occurrence. Schema: optional array of non-empty strings. Tests.
2. **Draft material is maintainer-only**: the `checks_draft` badge is rendered only when the site builds in maintainer mode; a receipt/component `receipt.note` that starts with `DRAFT:` (case-insensitive) is omitted for readers (maintainers see it in full). Tests on both modes.
3. **Inline Markdown in check questions and issues**: bold, code, links and emphasis render (a tiny inline-only Markdown render, or the same remark processor restricted to inline); no block elements. Tests.
4. **Safety first**: the `safety` danger aside renders at the top of the step body (after the media pane, before the first paragraph), not after the checks. Update the layout test.
5. **Label links**: a choice option whose label contains a `[text](url)` link renders the radio label as plain text and the link as a separate small "site" link after the label (outside the `<label>`), so clicking the label never navigates. Tests.
6. **Lower-case page paths**: Starlight lowercases slugs, so content pages under `site/src/content/docs/AEP/` get canonical `/aep/protocol/` while the file sits at `/AEP/protocol/`. In the plugin's docs (authoring/config.md, getting-started) recommend lower-case folders for companion pages next to a guide, and make the plugin's sidebar entries for a guide accept `pages: [{label, slug}]` in the guide config so companion pages appear under the guide's own sidebar group with correct hrefs (Starlight's own href for that slug). Keep the existing "Other guides" list.
7. **Option spacing**: the profile radio list uses about 50 px per option; tighten to normal line spacing (0.35 rem gap, no extra margin).
8. **Sitemap and canonical**: verify after 6 that every canonical URL in the built site points at an existing file (add a test over the fixture site).

Acceptance: `npm run build`, `npm test` green, site build, synthetic `check` 0 errors; docs updated where a field changed.
