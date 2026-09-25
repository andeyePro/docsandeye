# task_022 — Reading aids: glossary tooltips, asides, readable summary bar

Consumer: the AEP0.2 guide (docs.electroPioreactor.org/AEP). Goal from Martin: text concise enough for power users, with explanations one tap away for novices; docs.pioreactor.com as the exemplar (short numbered steps, bold UI names, notes and warnings as callout boxes).

## 1. Glossary tooltips

Project file `docs/glossary.yaml`, optional:

```yaml
- term: septum            # matched case-insensitively as a whole word; `terms:` may list aliases
  terms: [septa]
  tip: "The silicone disc in the vial cap that seals every port and self-heals needle holes."
  link: https://…         # optional "read more"
```

- Loader parses it (schema problems reported by `check` as usual: `term` and `tip` required, `tip` ≤ 240 chars, no duplicate terms/aliases).
- In each step body, the FIRST occurrence of each term in the rendered HTML text (not inside code, links, headings, `<details><summary>`, or the frontmatter-driven lists) is wrapped as `<button type="button" class="docsi-term" aria-describedby="…" data-tip="…">septum</button>`, with a dotted underline. Click or tap shows a small popover with the tip (and the link if any) beside the word; Escape or a click elsewhere closes it; keyboard focus + Enter works; hover shows it after a short delay on pointer devices. Without JavaScript the word carries a `title` attribute and the popover markup is not rendered. Screen readers get the tip via `aria-describedby` on a visually hidden span.
- Also in check questions and issues, and in the receipt table's notes, first occurrence per block.
- The popover is one small element reused per page; total JS for this feature under 2 KB minified.
- `docsandeye check` warns for a glossary term that never appears in any step (dead entry).

## 2. Asides

Step bodies support Starlight's aside syntax `:::note`, `:::tip`, `:::caution`, `:::danger` with optional title, rendered with Starlight's own aside markup and styles (use `@astrojs/starlight`'s remark directive support: `starlightAsides` from `@astrojs/starlight/internal` or reimplement with `remark-directive` if not exported; must look identical to Starlight asides in the same site). Existing `safety` frontmatter renders as a `danger` aside titled "Safety" (replaces the current pink box).

## 3. Summary bar

The "Your setup" bar shows human labels, not ids: for a choice, the option label (its plain text); for a boolean, the question's short label with "yes"/"no" (config `profile[].short` optional, e.g. `short: "temperature kit"`; default the label); numbers as "3 Pioreactors" using optional `unit_label`/`unit_label_plural` on the item (default the id). Implied items show the same way.

## 4. Small layout points found on screenshots

- Guide index: the list of steps gets the same look as the sidebar list (no bare link plus "N parts" in grey); show step number, title, and parts count aligned in a table-like list.
- Parts and tools lists: the category tag (PART, PRINTED, PREV, TOOL) is lower-case small text right-aligned; "Only if:" labels read "Only with the temperature kit" using the same short labels as §3.
- Check questions render inline Markdown code (`config.ini`) as code, not literal backticks.

## Acceptance

- Tests for the glossary matcher (first occurrence only, word boundaries, case, skip code/links/headings/summaries, aliases), the glossary schema, the aside rendering, the summary formatter, the check-question inline code; fixture guide gains a glossary and an aside; built-fixture assertions (button markup, title attribute without JS, aside classes).
- `npm run build`, `npm test`, site build, synthetic `check` 0 errors; step pages under budget.
- Docs: `authoring/steps.md` (asides, glossary), `authoring/config.md` (short, unit labels).
