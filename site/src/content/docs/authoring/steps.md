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
| `safety` | no | One sentence shown in a safety box. |

### Parts and tools

Each entry names a component and a quantity:

| Field | Default | Meaning |
| --- | --- | --- |
| `component` | required | A component id. |
| `qty` | `1` | Integer, 1 or more. |
| `cat` | `part` for parts, `tool` for tools | One of `part`, `printed`, `tool`, `consumable`, `prev`. |

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

## What the page shows

The step page has two columns. The media column holds the renders, the 3D viewer and the step's photos and videos, with stale items folded into a "what changed" panel. The text column holds the title, the body, the parts and tools lists, the safety box and the page's carbon figure.
