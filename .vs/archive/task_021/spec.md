# task_021 — Guide layout and profile follow-ups from the first live review

Status: in progress (chair-authored, 2026-09-24 evening; consumer: docs.electroPioreactor.org AEP0.2 site, live review by Martin).
Builds on task_020 (`.vs/archive/task_020/spec.md`): profile, when, receipt, checks, YouTube.

## 1. Profile: choices that imply other answers, and options that are links

Config `profile[].options[]` gains two optional fields:

```yaml
- id: model
  type: choice
  label: "Which electroPioreactor are you building?"
  options:
    - {value: aep-0-2, label: "AEP0.2", implies: {temp-kit: true}}
    - {value: aep-0-1-1, label: "AEP0.1.1", implies: {temp-kit: false}}
    - {value: custom, label: "Custom build (I will say what I have)"}
    - {value: mep, label: "Mixed-culture electroPioreactor: use the MEP guide", href: /MEP/}
```

- `implies`: mapping of other profile ids to values (validated like `when` values: must be valid for that item's type/options). When the chosen option implies an item, that item's question is hidden in `<docsi-profile>` and its value is the implied one (stored and used for `when`), overriding any earlier answer. Choosing an option without implications shows the question again with its stored or default value. Implied items are listed in the summary bar as normal.
- `href`: the option renders as a link (`<a>` in the radio group's list, same styling), not a radio; clicking navigates. It never becomes the item's value; validation forbids `default` naming it and forbids `implies` on it.
- Choice option `label` may contain a Markdown link `[text](url)`; render it as a link inside the label (only that syntax, no other Markdown). Used for "LabCrafter", "Pioreactor", "the BoM" with links.

Pure functions: `effectiveProfile(items, answers)` applies implications (last-wins on conflicts in item order) and is used by build-time and client code; unit tests for implication, override, un-implication when switching, href exclusion.

## 2. Step page layout: media above, full width

`StepPage.astro` stacks: media pane first at full content width (video or renders as figures), then the text. No side-by-side grid at any width. The video figure is the full column width with a 16:9 box. Renders/viewer follow the video in a row that wraps. Keep everything no-JS readable.

Stale video: when a step's video is STALE (hero changed), the top of the step shows the fresh content (text, renders) and the video moves to a section at the bottom, `## Older video`, introduced by one sentence generated from the staleness record: "This video shows <old name> where your kit has <new name>." followed by the existing what-changed details and, when both have a render/poster, the two images side by side (existing `<docsi-diff>`/render presentation; if none, text only). CHANGED_IN_FRAME keeps the video at the top with its note.

## 3. Check-off lists

Parts, tools and every receipt row (including "Not in your package") get a checkbox at the start of the row ("have it" / "done"). State persists with the other guide state (`docsandeye:parts:<guide>`, keyed by step id + component). A checked row is styled muted with a tick; nothing is hidden. Receipt: checking a row in "Not in your package" marks it sourced and removes it from the missing-parts email. No-JS: plain lists as now.

## 4. Storage opt-in

All persistence (profile, receipt counts, checks, check-offs) goes through one store with a consent gate:

- First time anything would be saved, a bar appears at the bottom: "Save your answers in this browser? They stay on this device." [Save] [Don't save]. No third-party anything; say so in one clause.
- Save: consent stored (`docsandeye:consent=yes`), everything persists as now.
- Don't save: nothing is written to storage (in-memory for the visit, as the storage-blocked path already does); a small persistent notice under the profile summary says "Not saved: your answers are lost when you leave. [Allow saving] [Hide this for now]". Hide = sessionStorage flag only if that itself is allowed, else in-memory.
- The bar never appears before the reader changes something. Consent is per browser, not per guide.
- Term used in the UI is "save in this browser", not "cookie" (nothing is a cookie). Document in `authoring/interactive.md`.

## 5. Guide navigation

- The guide index page's Starlight prev/next: next = first applicable step; step pages: prev/next = neighbouring steps of the same guide; the last step's next = the first Starlight sidebar entry after the guide's Assembly entry if the site config lists one (e.g. the guide's Protocol page), else none. Implement by passing `prev`/`next` in the `StarlightPage` frontmatter of the guide and step routes (Starlight supports `prev`/`next` overrides with `{link, label}`).
- The sidebar's "other guides" links stay.

## Acceptance

- Existing fixtures, synthetic example and both docs sites build; `npm test` green; new tests for every pure function and schema rule; the interactive fixture gains an `implies` option, an `href` option, a stale-video step layout assertion, check-off markup, and consent markup; happy-dom run of the built fixture: implication hides/sets the question, href navigates (link present, not a radio), check-offs persist under consent and do not persist without it, consent bar appears only after a change.
- Byte budget: AEP step-00 stays under 175 KB; synthetic under 150 KB.
- Docs page `authoring/interactive.md` updated (short).
