---
title: Steps
description: The step Markdown format, with frontmatter for parts, tools, renders, the 3D viewer, media and safety.
---

A step is one Markdown file under `docs/steps/`. The file name is the step id. The frontmatter names what the step needs; the body is the instruction text.

## Example

```md
---
id: step-02-fit-the-arm
order: 2
title: Fit the arm
guide: lamp
parts:
  - {component: lamp-arm, qty: 1, cat: printed}
  - {component: m3-screw, qty: 2, cat: part}
tools:
  - {component: hex-key-2mm, qty: 1}
renders:
  - {id: arm-front, component: lamp-arm, view: front, format: svg}
viewer: {component: lamp-arm, format: glb}
media: [vid-02-fit-the-arm]
safety: "Work with the power supply unplugged."
---
Stand the arm in the socket on top of the base. The flat side faces the cable slot.
```

## Frontmatter fields

| Field | Required | Meaning |
| --- | --- | --- |
| `id` | yes | Kebab-case identifier. Must equal the file name without `.md`. |
| `order` | yes | Integer, 0 or more. Steps are sorted by `order`, then by `id`. |
| `title` | yes | Page title and sidebar label. |
| `guide` | no | A guide id or a list of guide ids from `docsandeye.config.yaml`. Default: the first guide. An empty list makes a step that produces no page. |
| `branch` | no | A string or list of strings. Reserved for guide branches. |
| `parts` | no | List of part entries, below. |
| `tools` | no | List of tool entries, below. |
| `renders` | no | List of render entries, below. Render ids must be unique within the step. |
| `viewer` | no | One `{component, format}` entry for the in-page 3D viewer. `format` defaults to `glb`. |
| `media` | no | List of media ids from `docs/media/`. |
| `safety` | no | One sentence shown as a danger aside titled "Safety". |
| `when` | no | Show the step only for readers whose setup matches. See [Reader-interactive guides](/authoring/interactive/#conditions-when). |
| `receipt` | no | `true` shows the receipt checklist on this step. |
| `profile` | no | `true` shows the setup form on this step (the guide page always has it). |
| `checks` | no | Yes/no questions ending the step, each `id`, `question`, `issues` (`problem`, `fix`) and optional `when`. See [Step checks](/authoring/interactive/#step-checks). |
| `checks_draft` | no | `true` marks the checks as a draft under review. |

### Parts and tools

Each entry names a component and a quantity:

| Field | Default | Meaning |
| --- | --- | --- |
| `component` | required | A component id. |
| `qty` | `1` | Integer, 1 or more. |
| `cat` | `part` for parts, `tool` for tools | One of `part`, `printed`, `tool`, `consumable`, `prev`. |
| `when` | — | Show the entry only for matching setups. See [Conditions](/authoring/interactive/#conditions-when). |

### Renders

| Field | Default | Meaning |
| --- | --- | --- |
| `id` | required | Render id, unique within the step. |
| `component` | required | A component id. |
| `view` | `iso` | One of `front`, `back`, `left`, `right`, `top`, `bottom`, `iso`, `front-top-right`, `front-top-left`. |
| `explode` | `false` | Exploded view. The CAD master receives `explode=1`. |
| `annotate` | `false` | Reserved. Accepted and recorded as unsupported in this release. |
| `format` | `png` | One of `png`, `stl`, `svg`, `glb`. |

Every render and viewer becomes a job in `build/render-plan.json`. The job key is `component@version--render-id--hash`, where the hash covers the component's `parameters` and the render options. Two steps that ask for the same render share one job.

## Body

The body is Markdown, rendered with Astro's Markdown pipeline. Headings inside the body are `##` and below; the step title is the page `<h1>`.

Write the text so it stands alone. It is the fallback when a video is stale, and the whole content for a reader with video disabled.

Paragraphs that apply only to some setups go between `<!-- when … -->` and `<!-- /when -->` comments. See [Paragraphs](/authoring/interactive/#paragraphs).

### Links

Link to other steps and to files in the repository as you would on GitHub, relative to the step file:

```md
Next, [set up electrolysis](step-05-set-up-electrolysis.md).
Print the [vial cap](../../Components/Vial%20Cap) and see the [plugin README](../../AEP-Plugin/README.md#over-ssh).
```

On the site, a link to another step of the same guide goes to that step's page, keeping any `#fragment`. Any other path inside the project goes to the file or folder on GitHub, `<repo>/blob/<branch>/<path>`, when [`project.repo`](/authoring/config/#project) is set (`project.branch` defaults to `main`; an image loads from `raw` instead of `blob`). The project folder is taken to be the repository root. URLs with a scheme (`https:`, `mailto:`), site-absolute paths (`/…`) and bare `#fragments` are left alone.

A link the site cannot place is left as written, and `docsandeye check` warns with its line: a path that climbs above the project root, or, without `project.repo`, a path that is not a step of the guide. The same rules apply to `href` and `src` in raw HTML `<a>` and `<img>` tags, and to the `safety` note.

### Asides

Notes, tips and warnings go in Starlight's aside syntax and look exactly like Starlight's own asides elsewhere on the site:

```md
:::note
The vial clicks when it is seated.
:::

:::caution[Mind the edge]
The frame edge is sharp.
:::
```

The four kinds are `:::note`, `:::tip`, `:::caution` and `:::danger`. The title in square brackets is optional (the default is the kind's name) and may hold inline Markdown. The body is ordinary Markdown. Text that merely looks like a directive, such as `10:30` or `a:b`, is left as written.

### Glossary

Keep step text short for readers who know the words, and put the explanation one tap away for those who do not. List the terms in `docs/glossary.yaml` (optional):

```yaml
- term: septum
  terms: [septa]          # optional aliases, matched the same way
  tip: "The silicone disc in the vial cap that seals every port and self-heals needle holes."
  link: https://example.invalid/septum   # optional "Read more"
```

| Field | Required | Meaning |
| --- | --- | --- |
| `term` | yes | The word or phrase, matched as a whole word, in any case. |
| `terms` | no | Aliases (plurals, other spellings). |
| `tip` | yes | At most 240 characters. |
| `link` | no | A "Read more" link in the tip. |

No term or alias may appear twice. On each step page, the first use of each term in the body gets a dotted underline; click, tap, or focus and press Enter to show the tip beside it, and Escape or a click elsewhere closes it. On a mouse, hovering shows it after a moment. The first use in each check (question and issues) and in the receipt notes is marked the same way. Terms inside code, links, headings and `<summary>` are left alone. Without JavaScript the tip is the word's tooltip, and screen readers read it as the word's description.

`docsandeye check` reports an invalid entry as an error and a term that no step mentions as a warning.

## What the page shows

The step page shows the media first (renders, the 3D viewer and the step's photos and videos, with stale items folded into a "what changed" panel), then the title, the body, the parts and tools lists, the checks, the safety aside and the page's carbon figure.
