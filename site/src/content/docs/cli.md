---
title: CLI
description: "The docsandeye command line: init, render, encode, diff, export and check, with options and exit codes."
---

```sh
npx docsandeye --help
```

Six commands: `init`, `render`, `encode`, `diff`, `export` and `check`. `--help` on any of them prints its usage; `--version` prints the package version.

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

## encode

```sh
npx docsandeye encode --project examples/synthetic-guide
```

Writes `build/media-plan.json` from the project's `type: video` manifests and runs `python3 -m docsandeye_render encode` on it. Outputs land in `build/media/`: an AV1 WebM and an H.264 MP4 at 720 and 1080, a WebP poster, and the captions file when the manifest has one. `build/media/manifest.json` records each job's status, driver, outputs, poster mode, source probe and time.

| Option | Meaning |
| --- | --- |
| `--project` | Project root. Default as for `render`. |
| `--force` | Re-encode every job, ignoring the cache. |
| `--allow-missing` | Skip jobs whose encoder is not installed instead of failing. |

Encoding needs ffmpeg 7 or later with `libsvtav1`, `libx264`, `libopus` and `libwebp`. Without it the command exits 2, or records every job as `skipped` and exits 0 under `--allow-missing`. The last line of output is the summary: `encoded 1, cached 0, skipped 0, failed 0`.

`python3 -m docsandeye_render doctor` lists the render and encode tools it can find.

## diff

```sh
npx docsandeye diff --project examples/synthetic-guide
```

Restores old geometry from git so a stale photo or video can be shown beside the model as it is now. It writes `build/diff-plan.json`, then works through the plan and writes `build/render/old/manifest.json`.

The plan has one job per distinct `<component>@<version>` pair across the stale hero pins of every `STALE` media record. `CHANGED_IN_FRAME` pins are not planned. Each job carries the component's `derived_files` as candidates, every `.glb` first and then every `.stl`; other extensions are dropped. A component with no usable derived file still gets a job, so it can be reported.

For each job the command finds the commit that last carried the recorded version. The recipe is `git log -1 -G'^design_version: 1.0.0$' -- docs/components/lamp-base.yaml`: the last commit whose diff of the component file added or removed that line. That commit is usually the bump away from the old version, so the parent is preferred: if the parent still contains `design_version: 1.0.0` the geometry is taken from the parent, otherwise from the commit itself if it contains the line. If neither does, the job is skipped. A root commit has no parent to show, which counts as not containing it.

The first candidate that exists at that commit is read with `git show`. A `.glb` is written straight to `build/render/old/<component>@<version>.glb`. A `.stl` is written beside it and converted with `python3 -m docsandeye_render glb`, which reads a binary STL and writes the GLB. Old geometry always comes from git history. Nothing is re-rendered, and there is no separate archive.

| Option | Meaning |
| --- | --- |
| `--project` | Project root. Default as for `render`. |
| `--force` | Restore every job again, ignoring cached outputs. |

`build/render/old/manifest.json` records one entry per job key: its `status`, the `commit` the geometry came from, the `source` file restored, the `output` path and, where there is one, a `reason`. The status is `restored`, `cached`, `skipped` or `failed`. A job is `cached` when its output file is already on disk and the previous manifest recorded the same commit for that key with status `restored` or `cached`. `--force` restores it again anyway.

A job is skipped, not failed, for any of these reasons:

| Reason | Meaning |
| --- | --- |
| `not a git repository` | Every job, when the project root is outside a git work tree. |
| `no derived .glb or .stl` | The component declares no derived file a restore can use. |
| `no commit with design_version 1.0.0` | No commit in the history carries that version in the component file. |
| `no derived file committed at 0a1b2c3` | None of the candidates exists at that commit. |

A job fails when `git show` cannot read a file it has already found, or when the STL to GLB conversion exits non-zero. A missing `python3` is one of those cases: the job is recorded as `failed` with reason `python3 exited 2` and the command exits 1. Unlike `render` and `encode`, `diff` never exits 2.

Exit code 0 unless a job failed, so a project outside git, or one whose old versions were never committed, exits 0 with every job skipped. The last line of output is the summary: `restored 1, cached 0, skipped 0, failed 0`. In the example project the lamp base has no derived geometry, so its single job is skipped.

The plugin copies the output of every `restored` or `cached` job into `dist/_docsandeye/render/old/` and shows it inside the stale panel. See [Old and new geometry](/staleness/#old-and-new-geometry).

## export

```sh
npx docsandeye export --project examples/synthetic-guide
```

Writes BuildUp-flavoured Markdown and an Open Know-How manifest computed from the loaded project model. No network, no render pipeline: the model is the only input.

`buildup/index.md` and one `buildup/<step-id>.md` per step come first, in the first guide's order and then any remaining steps by `order`. Each step file's body has its parts and tools substituted inline as BuildUp links where the component's name occurs literally in the text, for example `Seat the [MMO anode (titanium mesh)]{qty: 1, cat: part} and check the depth with the [Vernier callipers]{qty: 1, cat: tool}.` Anything not substituted is listed instead, under `## Parts` or `## Tools`:

```md
## Parts

- [Vial Cap (2×6.1 mm + 5×3.2 mm ports)]{qty: 2, cat: printed}
- [Electrode Top Stop]{qty: 1, cat: printed}
```

`okh/okh.yml` is an Open Know-How (OKH) manifest: a bill of materials built from every component referenced by a part or tool, plus whatever the optional [`project`](/authoring/config/#project) block in `docsandeye.config.yaml` supplies for the header (`name`, `repo`, `version`, `license`, `licensor`, `description`, `function`, `documentation-home`). A field the config does not supply is omitted from the manifest, never written empty.

| Option | Default | Meaning |
| --- | --- | --- |
| `--project` | nearest project | Project root, as for `render`. |
| `--out` | `build/export` | Output directory, relative to the project root. |

Re-running overwrites the plan's own files and touches nothing else under `--out`. The last line of output is the summary: `exported N buildup files, 1 okh manifest`. An invalid project prints its problems and exits 1 with nothing written; no project found exits 66.

## check

```sh
npx docsandeye check --project examples/synthetic-guide --dist site/dist
```

Validates every component, step and media file, runs the version-bump guard against git history and, with `--dist`, measures each step page's initial-load bytes and CO2e estimate, writing `build/carbon.json`.

| Option | Meaning |
| --- | --- |
| `--project` | Project root. Default as for `render`. |
| `--dist` | Built site to measure. |
| `--no-strict` | Report an over-budget page as a warning instead of an error. |
| `--strict` | Accepted for compatibility. It is the default and does nothing. |

A page over its [byte budget](/carbon/) is an error, so `check --dist` fails a build that grows past it. `--no-strict` demotes those to warnings. Nothing else changes with the flag: a skipped guard or a missing asset is a warning either way.

Problems print one per line on stderr as `file:path: code: message`. The last line on stdout is `errors: N, warnings: M`.

## Exit codes

| Code | Meaning |
| --- | --- |
| 0 | OK. |
| 1 | Problems reported, or the render or encode pipeline reported failures. |
| 2 | The render or encode pipeline is unavailable (`python3` or the tool missing) or aborted. |
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
| `DOCSANDEYE_RENDER_PYTHONPATH` | Directory holding the `docsandeye_render` package. Default: `render/` two levels above the CLI package, which is the repository's own `render/` when the CLI is run from a clone. |
| `DOCSANDEYE_MAINTAINER` | `1` adds the reshoot dashboard to the site build. |
| `DOCSANDEYE_BUILD_DATE` | `YYYY-MM-DD` reference date for the "updated" badge. Default today. |

`render`, `encode` and `diff` need the Python pipeline. A project scaffolded outside this repository has no `render/` beside it, and the published `docsandeye` package ships only `dist/` and `templates/`, so a standalone project must point `DOCSANDEYE_RENDER_PYTHONPATH` at a checkout of the repository's `render/` itself:

```sh
DOCSANDEYE_RENDER_PYTHONPATH=../docsandeye/render npx docsandeye render
```

A project scaffolded from a clone by [`init`](/getting-started/#1-init) needs nothing: its `file:` dependency links resolve back into the repository, and the default finds `render/` there. `docsandeye_render` will be published as a Python package alongside the first npm release; until then it comes from the repository.
