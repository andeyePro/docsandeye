---
title: Project configuration
description: Every field of docsandeye.config.yaml — theme, guides, denylist, hosting and the page byte budget — with one complete example.
---

`docsandeye.config.yaml` sits at the root of a Docs&I project, beside `docs/`. Every command finds the project by walking up from the working directory to the first `docsandeye.config.yaml`, so `--project <dir>` is only needed when you run from somewhere else. `docsandeye init` writes one for you.

## Complete example

```yaml
# The theme pack. `starlight` (the default) is the stock look; any other name
# resolves to @docsandeye/themes/<name>.css. See /themes/.
theme: pioreactor

# One entry per guide. `base` is the URL prefix its pages are published under.
guides:
  - id: lamp
    title: "Bench lamp"
    base: /lamp
  - id: lamp-service
    title: "Bench lamp: service"
    base: /lamp/service

# Extra paths the loader must never read, as globs relative to this file.
# The defaults below are always applied on top of whatever you list.
denylist:
  - drafts/**
  - "*.kicad_pcb"

# Where committed media is served from. See /authoring/media/#hosting.
hosting:
  provider: url-prefix
  base: https://media.example.org/lamp

# Initial-load budget for one step page, in KB (1024 bytes). See /carbon/.
byte_budget_kb: 150
```

Everything except `guides` has a default, so the shortest valid config is a `guides` list with one entry.

## Fields

| Field | Required | Default | Meaning |
| --- | --- | --- | --- |
| `theme` | no | `starlight` | Theme pack name. `starlight` ships inside the plugin; any other name must resolve to `@docsandeye/themes/<name>.css`, and an unknown name fails the build. See [Themes](/themes/). |
| `guides` | **yes** | — | At least one guide. Each entry is `id`, `title` and `base` (below). Duplicate `id`s are a validation error. |
| `denylist` | no | `[]` | Globs, relative to this file, that the project loader never reads. Merged with the defaults below. |
| `hosting` | no | `{ provider: local }` | Where media files are served from (below). |
| `byte_budget_kb` | no | `150` | Positive integer. The initial-load budget for a step page, in KB. `docsandeye check --dist dist` fails a page over budget. See [Carbon](/carbon/). |

## `guides`

| Field | Required | Meaning |
| --- | --- | --- |
| `id` | yes | kebab-case (`[a-z0-9]+(-[a-z0-9.]+)*`). What a step's `guide` frontmatter field names. |
| `title` | yes | Non-empty. The heading and sidebar label for the guide. |
| `base` | yes | Must start with `/`. The URL prefix for the guide's index and its step pages, so `base: /lamp` publishes `/lamp/` and `/lamp/step-01-.../`. |

A step with no `guide` field belongs to the first guide in this list, so a single-guide project never has to name it. See [Steps](/authoring/steps/).

## `denylist`

Your entries are added to a fixed default list, which is always applied and cannot be removed:

```yaml
private-notes/**
.claude/**
.vibe/**
.git/**
node_modules/**
```

The merged list is defaults first, then your entries, with duplicates dropped. A file matching any glob is invisible to `render`, `encode`, `check` and the site build. See [Denylist](/authoring/media/#denylist).

## `hosting`

`provider` names a registered provider; `base` is a URL prefix. Three providers ship: `local` (the default, copies media into the built site), `url-prefix` and `r2`. The last two require `base`, and a config that omits it is a validation error. Unknown provider names are rejected, listing the registered ones. Provider-specific keys beyond `provider` and `base` are allowed and passed through, and new providers plug in through core's `registerHostingProvider`. See [Hosting](/authoring/media/#hosting).

## Errors

A malformed config fails every command with `schema` problems that name the dotted path, for example `guides.0.base: must start with "/"` or `hosting.provider: unknown hosting provider "s3" (registered: local, r2, url-prefix)`. See [Exit codes](/cli/#exit-codes).
