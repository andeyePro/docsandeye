---
title: Reader-interactive guides
description: Ask the reader about their setup once, then hide what does not apply, give them a "count what you received" checklist with a missing-parts email, end steps with yes/no checks, and embed YouTube clips without loading YouTube.
---

A reader states their setup once: how many units, which optional kits, where the parts came from. The guide then hides the steps, parts and paragraphs that do not apply, multiplies the quantities in a receipt checklist, turns missing parts into a pre-filled email to the right supplier, and ends steps with yes/no checks that point at likely issues.

Everything stays text-first. With JavaScript off, every page shows all content, each conditional part labelled "Only if: …", the checks as a list with their issues folded in `<details>`, and the checklist as a table of per-unit quantities. Answers are kept in the reader's browser only if they agree (see [Saving in this browser](#saving-in-this-browser)) and never leave it except in an email the reader chooses to send.

The [example guide](/example/) uses every feature below.

## Profile: the reader's setup

Questions go in `docsandeye.config.yaml`, in display order:

```yaml
profile:
  - id: units
    type: number
    label: "How many lamps are you building?"
    default: 1
    min: 1
    max: 10
  - id: dimmer
    type: boolean
    label: "Are you fitting the optional dimmer?"
  - id: source
    type: choice
    label: "Where did your parts come from?"
    options:
      - {value: kit, label: "The kit"}
      - {value: diy, label: "Sourced myself"}
    default: kit
```

| Field | Meaning |
| --- | --- |
| `id` | Kebab-case, unique. What conditions name. |
| `type` | `number`, `boolean` or `choice`. |
| `label` | The question on the form. |
| `default` | Number: an integer from `min` to `max` (default `min`). Boolean: `true` or `false` (default `false`). Choice: one option `value` (default the first). |
| `min`, `max` | Number only. Default 1 and 100. |
| `options` | Choice only, required: `{value, label}` pairs; values are kebab-case. An option may add `implies` or `href` (below). |

An option `label` may contain Markdown links, `[text](url)`, and nothing else: "Sourced myself from [the BoM](https://example.invalid/bom)" shows "the BoM" as a link. Summaries and "Only if" labels use the plain text.

### Options that settle other answers, and options that are links

```yaml
  - id: model
    type: choice
    label: "Which lamp are you building?"
    options:
      - {value: desk, label: "Desk lamp (dimmer included)", implies: {dimmer: true}}
      - {value: wall, label: "Wall lamp", implies: {dimmer: false}}
      - {value: custom, label: "Custom build: I will say what I have"}
      - {value: floor, label: "Floor lamp: use the floor lamp guide", href: /floor/}
```

- `implies` maps other profile ids to the value this choice gives them (a number must be an integer in range; a choice value must be one of its options). While the option is chosen, those questions are hidden and their values are the implied ones, saved and used by every `when`. Choosing an option without `implies` shows the questions again, holding their last value. When two choices imply the same item, the later one in `profile` wins.
- `href` makes the option a link in the list, not a radio: it goes to that page (a path starting `/` is under your site base) and is never a value. It cannot be the `default`, cannot have `implies`, and a `when` cannot name it.

The guide page always shows the form. A step with `profile: true` shows it too, and every step page shows a one-line "Your setup: … — change" bar.

## Conditions: `when`

`when` maps profile ids to the value they must have. Every key must match; a list matches any of its values. Numbers match exactly or through a comparator string: `">=2"`, `">1"`, `"<2"`, `"<=3"`.

```yaml
when: {dimmer: true, source: [kit, diy], units: ">=2"}
```

A `when` may go on a whole step, on a `parts` or `tools` entry, on a check, and on a component's `receipt`. An unknown profile id, or a value of the wrong type or not among the options, is a `schema` problem at the field's path.

A step that does not apply stays in the guide list and sidebar, dimmed and marked "(not for your setup)"; its own page says so and links to the next step that does apply.

### Paragraphs

In a step body, wrap Markdown in a pair of comments, each on its own line:

```md
<!-- when dimmer=true -->
Leave 10 cm of spare cable at the base for the dimmer.
<!-- /when -->

<!-- when source=kit,diy units>=2 -->
Building more than one? Test each module now.
<!-- /when -->
```

Conditions are `id=value`, `id=a,b` (any of), or `id>=n`, `id>n`, `id<n`, `id<=n`; several, separated by spaces, must all hold. The comments keep the file readable on GitHub. On the site the block gets a visible "Only if: …" label. Blocks do not nest. A nested or unclosed block, or a condition that cannot be read, is reported by `docsandeye check` with the file line; the site still builds and shows that text unconditionally.

## Receipt checklist

Tell the guide how quantities scale and who the reader bought from:

```yaml
receipt:
  multiply_by: units      # a number-type profile id
  supplier_from: source   # a choice-type profile id
contacts:
  kit: {name: "Kit shop", email: "orders@example.invalid", subject: "Missing parts"}
  project: {name: "The project", email: "help@example.invalid", subject: "Guide help"}
```

`contacts` keys are option values of `supplier_from`, plus `project` for step checks. `email` must contain `@`; a contact without one is shown by name only.

Give each component the reader should count a `receipt`:

```yaml
receipt:
  per: unit          # unit (default) or kit: a kit quantity does not scale
  qty: 4             # default 1
  from: [kit]        # whose package contains it; omitted means every supplier
  when: {dimmer: true}
  note: "Two for the arm, two for the module"
```

Components without `receipt` are not in the checklist. A guide's checklist lists the components its steps use, plus any receipt component no step uses (a spares bag, say).

Put `receipt: true` on a step, usually the first, to show the checklist there. The reader sees each part with a "have it" box, its expected count (`qty` × units for `per: unit`) and a "received" box. Parts whose `from` leaves out the reader's supplier move to "Not in your package — source these yourself", with the component's `supplier` link. When a count comes up short, a "Missing parts" panel lists the shortfall and offers an email to that supplier's contact, pre-filled with the parts, the number of units and the page address. If the supplier has no email address, the panel links each missing part's supplier instead. A row ticked "have it" is never in the email; ticking a "Not in your package" row marks it sourced.

Every step's parts and tools lists get the same box at the start of each row. A ticked row is muted with a tick, never hidden. Ticks are remembered per guide, per step and component, with the other answers. Without JavaScript the lists are plain lists.

## Step checks

End a step with yes/no questions:

```yaml
checks:
  - id: lights
    question: "Does the module light when you plug in the supply?"
    issues:
      - {problem: "Nothing lights", fix: "Check the plug is fully home."}
      - {problem: "It flickers", fix: "Reseat the module."}
checks_draft: true   # optional: "Draft checks, under review"
```

The checks come after the parts list and before the safety box. Answering No reveals that question's issues and a "Something else — contact us" email to `contacts.project`, naming the step, the question and the reader's setup. When every check that applies is Yes, the step shows "Step checked" and gets a tick in the guide list and sidebar. Check `id`s are kebab-case and unique within the step.

## Saving in this browser

Nothing is saved until the reader agrees. The first time they change anything (an answer, a count, a check, a tick) a bar appears at the bottom: "Save your answers in this browser? They stay on this device and nothing is sent to anyone else." with **Save** and **Don't save**.

- **Save** remembers the choice (`docsandeye:consent=yes` in `localStorage`) and saves everything, now and from then on, for every guide on the site.
- **Don't save** writes nothing: the answers last for the visit. A small notice under the setup summary says "Not saved: your answers are lost when you leave." with **Allow saving** and **Hide this for now** (hidden for the rest of the browser tab).

Nothing here is a cookie and nothing involves a third party, so the wording is always "save in this browser".

## Guide navigation

The guide page's "Next" goes to the first step that applies. Each step's "Previous" and "Next" go to its neighbours (the first step's "Previous" is the guide page). The last step's "Next" is the entry after the guide's own in your Starlight `sidebar`, if there is one, so a guide can lead on to its protocol page:

```js
sidebar: [
  { label: 'Lamp', items: [{ label: 'Assembly', link: '/example/' }, { slug: 'lamp/using-it' }] },
],
```

A `slug` entry takes its label from that page's title.

## Step layout

A step shows its video (or renders) first, full width, then the text. When a video is stale (a hero component changed since filming), the step leads with the current text and renders, and the video moves to an "Older video" section at the end: "This video shows Lamp arm v1.0.0 where your kit has Lamp arm v2.0.0.", then what changed and, when both geometries exist, the old and current models side by side.

## YouTube clips

A media manifest can point at YouTube instead of a file you host:

```yaml
id: vid-05-fit-the-dimmer
type: video
youtube: DocsAndI000    # the 11-character video id
start_s: 5              # optional
end_s: 35               # optional, after start_s
shot_date: 2026-09-23
shot_by: "Docs&I example"
hero: [dimmer-module@1.0.0]
```

With `youtube`, `file`, `poster` and `duration_s` are optional and `captions` is not allowed. The page shows a play button with your `poster` (or a plain placeholder with the step title and length) and requests nothing from YouTube until the reader presses it; the player then loads from `youtube-nocookie.com`. Without JavaScript it is a link to the video. `encode` skips it, it adds no video bytes to the [byte budget](/carbon/), `export` links its watch page, and [staleness](/staleness/) works as for any clip. See [Media](/authoring/media/).
