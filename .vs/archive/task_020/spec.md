# task_020 — Reader-interactive guides: profile, conditional content, receipt checklist, missing-parts email, step checks, YouTube video

Status: in progress (overnight /vsss 2026-09-23, chair-authored; no critique cycle — deadline).
Consumer: electroPioreactor AEP0.2 guide (docs.electroPioreactor.org/AEP), live by end of 2026-09-24.

## Goal

A reader states their setup once (how many units, optional kits, where they bought parts). The guide then
(1) hides steps/sections/parts that do not apply, (2) gives a "count what you received" checklist with
quantities multiplied by the unit count, (3) turns missing items into a pre-filled support email to the
right supplier, (4) ends steps with yes/no checks that reveal likely issues and a "contact us" email.
Plus a lite YouTube video option (draft hosting for AEP; no self-hosted files needed).

Everything must stay generic (no AEP names in docsandeye code) and text-first: with JavaScript off, every
page shows all content, conditional blocks labelled with their condition, checks as a readable list, and
the checklist as a table with per-unit quantities.

## Content model (all fields optional; existing projects must parse and build unchanged)

### Config (`docsandeye.config.yaml`)

```yaml
profile:                     # reader questions; order = display order
  - id: units                # kebab id; `units` has no special meaning except via `receipt.multiply_by`
    type: number             # number | boolean | choice
    label: "How many Pioreactors did you receive?"
    default: 1               # number: int >= min; boolean: bool; choice: one option value
    min: 1                   # number only (default 1)
    max: 50                  # number only (default 100)
  - id: temp-kit
    type: boolean
    label: "Do you have the Precision Temperature Upgrade Kit?"
    default: false
  - id: supplier
    type: choice
    label: "Where did your parts come from?"
    options:
      - {value: labcrafter, label: "LabCrafter kit"}
      - {value: pioreactor, label: "Pioreactor (direct)"}
      - {value: diy, label: "Sourced myself from the BoM"}
    default: labcrafter
receipt:
  multiply_by: units         # a number-type profile id; per-unit quantities are multiplied by it
  supplier_from: supplier    # a choice-type profile id naming who the reader bought from
contacts:                    # keyed by choice value of `supplier_from`, plus the reserved key `project`
  labcrafter: {name: "LabCrafter", email: "support@example.invalid", subject: "Missing parts: AEP0.2 kit"}
  pioreactor: {name: "Pioreactor", email: "..."}
  project:    {name: "AMYBO", email: "...", subject: "AEP0.2 guide: help with a step"}
```

Validation (schema problems with paths, as for existing config): profile ids unique kebab; `type` enum;
`options` required and non-empty for choice, forbidden otherwise; default type-checks; `receipt.multiply_by`
must name a number-type profile item; `receipt.supplier_from` a choice-type one; each `contacts` key must be
`project` or an option value of `supplier_from` (when receipt is set); `email` must contain `@`.
A contact without `email` is allowed (then the UI shows the name, no mailto).

### Conditions (`when`)

`when` is a mapping `{<profile id>: <value> | [<values>]}`; all keys must match (AND); a list is OR over values.
Booleans are YAML booleans. Numbers: exact value, or a string comparator `">=2"`, `"<2"`, `">1"`, `"<=3"`.
Validation at load (loader has the config): unknown profile id or a value not valid for that item's type/options
→ `schema` problem at the field path. Implement one pure function in core, `matchesWhen(when, profile)`, used
by both build-time code and (bundled) the client element.

Where `when` may appear:
- step frontmatter `when:` — the whole step.
- step `parts[]` / `tools[]` entries `when:`.
- step `checks[]` entries `when:`.
- component `receipt.when` (below).
- Markdown body blocks: an HTML comment pair on their own lines
  `<!-- when temp-kit=true -->` … `<!-- /when -->` (also `supplier=labcrafter,pioreactor`, `units>=2`,
  several conditions space-separated = AND). Comments keep the content readable on GitHub. The renderer
  wraps the enclosed Markdown in `<div class="docsi-when" data-when='<json>'>` with a visible label
  `<p class="docsi-when-label">Only if: <human text></p>`. Not nestable (a nested open is a `schema` problem
  reported by `docsandeye check`, file + line). Unclosed → problem. Parse errors must not crash the build
  silently: `check` reports them; the site build renders the text unwrapped.

### Component receipt data (component YAML)

```yaml
receipt:
  per: unit          # unit (default) | kit — kit quantity does not scale with units
  qty: 2             # default 1
  from: [labcrafter, pioreactor]   # choice values of `supplier_from` whose package contains this part; omitted = all
  when: {temp-kit: true}           # optional
  note: "Bag B, shared across units"  # optional free text shown in the checklist
```

Components without `receipt` do not appear in the checklist.

### Step fields (step frontmatter)

```yaml
when: {temp-kit: true}
receipt: true        # render the receipt checklist on this step (normally the first step)
profile: true        # render the profile form on this step (the guide index page always renders it)
checks:
  - id: bubbles      # kebab, unique within step
    question: "Do bubbles form on the cathode within 10 s?"
    issues:          # shown when the reader answers No; order kept
      - {problem: "No bubbles anywhere", fix: "Check the red lead is on the anode ..."}
    when: {...}      # optional
checks_draft: true   # optional; shows a small "Draft checks, under review" note
```

### Media: YouTube

Media manifest gains `youtube: <11-char id>` (regex `^[A-Za-z0-9_-]{11}$`) plus optional `start_s`, `end_s`
(non-negative integers, end > start). With `youtube` set: `file` becomes optional; `poster` and
`duration_s` are no longer required for video; `captions` forbidden. The encode media plan skips youtube
media. The byte budget counts no video bytes for it. Export (`## Media` lines) links
`https://www.youtube.com/watch?v=<id>&t=<start_s>s`. Staleness works unchanged (hero pins).

## Site behaviour (starlight-docsandeye)

- Profile state: one `localStorage` key per guide, `docsandeye:profile:<guide id>`, JSON of answers; reads and
  writes wrapped in try/catch; absent → defaults. A new custom element `<docsi-profile>` (form: number
  input, checkbox, radio group; labelled; keyboard accessible) on the guide page, and on any step with
  `profile: true`. Every step page shows a one-line summary bar `<docsi-profile-summary>` ("Your setup: 2 ×
  units · temp-kit yes · LabCrafter kit — change") linking to the guide page form. Changing the profile
  dispatches a `docsandeye:profile` event on `document`; all elements re-evaluate live.
- Conditional elements carry `data-when` JSON. A single small client module evaluates them: non-matching →
  `hidden`. Guide index list items and Starlight sidebar entries for a non-matching step get
  `data-docsi-skipped` and are visually de-emphasised with "(not for your setup)" rather than removed; the
  step page itself shows a notice "This step doesn't apply to your setup (<condition>). Skip to <next step
  title>." with a link. Without JS: all shown, labels visible.
- Receipt checklist `<docsi-receipt>`: a table of components with `receipt`, grouped by `per` (per unit,
  per kit), showing name, expected quantity (qty × units for `per: unit`), and a "received" number input
  defaulting to expected; rows whose `from` excludes the reader's supplier are shown in a separate "Not in
  your package — source these yourself" group with the component's `supplier` link if any. Rows failing
  `when` hidden. Received counts persist (`docsandeye:receipt:<guide id>`). When any received < expected, a
  "Missing parts" panel lists them and offers a `mailto:` to `contacts[<supplier>]` with subject and a body
  listing name × missing count, units ordered, and the page URL; when the contact has no email or the
  supplier is one with no contact (e.g. diy), show each missing part's `supplier.url` link instead. Body
  must be URL-encoded; keep mailto under ~1800 chars (truncate list with "and N more").
- Checks `<docsi-checks>` at the end of a step (after parts, before safety): each question with Yes/No
  radio buttons; No reveals its issues and a "Something else — contact us" `mailto:` to `contacts.project`
  (subject + step title; body: step title, question, reader's profile summary, page URL). Answers persist
  (`docsandeye:checks:<guide id>`). When all visible checks are Yes, show "Step checked" and mark the step in
  the guide list and sidebar with a tick. Without JS: questions rendered as a list, each with its issues in
  `<details>`.
- YouTube: `<docsi-youtube>` facade — a button with poster (authored poster if any, else a neutral
  placeholder with the title and duration; NO request to YouTube before click) that on click inserts
  `<iframe src="https://www.youtube-nocookie.com/embed/<id>?autoplay=1&start=<s>&end=<s>&rel=0"
  allow="autoplay; encrypted-media; picture-in-picture; fullscreen" title=...>`. Without JS: a plain link
  to the watch URL. The stale flow (recorded-with banner, "watch the older video") must work with it the same
  way it does with `<docsi-video>`.
- Per-page JS stays small: all new elements in the existing registering script or a lazily loaded chunk;
  step pages must still pass the 150 KB byte budget on the synthetic example.

## Acceptance criteria

1. Existing fixtures, the synthetic example and the site build unchanged; all existing tests pass.
2. Core: schema tests for every new field (valid + each invalid case above, with problem paths);
   `matchesWhen` truth table incl. comparators and lists; body `when` comment parser (wrap, label text,
   nested/unclosed problems); receipt aggregation function `buildReceipt(model, guideId, profile)` pure and
   tested (per unit vs kit, from filtering, when filtering, ordering by component name).
3. `docsandeye check` reports new schema/body problems with file and path.
4. Plugin: a new fixture guide exercising profile, a conditional step, a conditional body block, a
   conditional part, receipt with two suppliers and a kit-scoped item, checks with issues, and one youtube
   media item; `astro build` test asserts the rendered HTML (data-when attributes, labels, noscript
   fallbacks, mailto contacts present in data attributes, no youtube.com/ytimg request URL in the HTML
   other than inside the click-to-load data attribute and the noscript link).
5. Client logic that decides visibility, mailto construction and receipt maths lives in pure functions with
   unit tests (no DOM needed); elements are thin.
6. Synthetic example gains a small demo of each feature so docs.andeye.com shows it; site docs page
   `authoring/interactive.md` documents the fields (short, with one example each); config.md, steps.md,
   media.md link to it.
7. `npm run build` and `npm test` green; `docsandeye check --project examples/synthetic-guide --dist site/dist`
   0 errors.
