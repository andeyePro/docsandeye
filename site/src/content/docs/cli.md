---
title: CLI
description: "The docsandeye command line: init, render and check, with options and exit codes."
---

```sh
npx docsandeye --help
```

Three commands: `init`, `render` and `check`. `--help` on any of them prints its usage; `--version` prints the package version.

## init

```sh
npx docsandeye init ../bench-lamp --guide lamp --title "Bench lamp"
```

Creates a Docs&I project in the named directory: `docsandeye.config.yaml`, a Starlight site wired to the plugin, and one example component and step.

| Option | Default | Meaning |
| --- | --- | --- |
| `--guide` | `main` | Kebab-case guide id. Becomes the URL prefix. |
| `--title` | `Hardware Guide` | Guide title. |
| `--force` | off | Overwrite the files the template writes. Other files are left alone. |

Without `--force`, `init` refuses when `docsandeye.config.yaml` or `astro.config.mjs` already exists (exit 65).

## render

```sh
npx docsandeye render --project examples/synthetic-guide
```

Writes `build/render-plan.json` and runs `python3 -m docsandeye_render` on it. Outputs land in `build/render/`, with `build/render/manifest.json` recording each job's status, driver, outputs and time.

| Option | Meaning |
| --- | --- |
| `--project` | Project root. Default: the nearest directory above the current one with `docsandeye.config.yaml`. |
| `--force` | Re-render every job, ignoring the cache. |
| `--allow-missing` | Skip jobs whose render tool is not installed instead of failing. |

The last line of output is the summary: `rendered 0, cached 0, hand-exported 3, skipped 0, failed 0`.

## check

```sh
npx docsandeye check --project examples/synthetic-guide --dist site/dist
```

Validates every component, step and media file, runs the version-bump guard against git history and, with `--dist`, measures each step page's initial-load bytes and CO2e estimate, writing `build/carbon.json`.

| Option | Meaning |
| --- | --- |
| `--project` | Project root. Default as for `render`. |
| `--dist` | Built site to measure. |
| `--strict` | Treat warnings as errors. |

Problems print one per line on stderr as `file:path: code: message`. The last line on stdout is `errors: N, warnings: M`.

## Exit codes

| Code | Meaning |
| --- | --- |
| 0 | OK. |
| 1 | Problems reported, or the render pipeline reported failures. |
| 2 | The render pipeline is unavailable (`python3` missing) or aborted. |
| 64 | Usage error. |
| 65 | `init` refused to overwrite an existing project. |
| 66 | No project found, or the `--dist` directory does not exist. |

## Problem codes

| Code | Meaning |
| --- | --- |
| `invalid-yaml` | The file is not well-formed YAML, or the frontmatter fence is unterminated. |
| `schema` | A field is missing or has the wrong shape. |
| `id-mismatch` | `id` does not match the file name. |
| `unknown-component` | A part, tool, render, viewer or pin names a component that does not exist. |
| `unknown-media` | A step lists a media id with no manifest. |
| `unknown-guide` | A step names a guide not declared in the config. |
| `future-pin` | A pin is newer than the component's current `design_version`. |
| `duplicate-id` | Two files declare the same id. |

## Environment

| Variable | Meaning |
| --- | --- |
| `DOCSANDEYE_RENDER_PYTHONPATH` | Directory holding the `docsandeye_render` package. Default: the repository's `render/`. |
| `DOCSANDEYE_MAINTAINER` | `1` adds the reshoot dashboard to the site build. |
| `DOCSANDEYE_BUILD_DATE` | `YYYY-MM-DD` reference date for the "updated" badge. Default today. |
