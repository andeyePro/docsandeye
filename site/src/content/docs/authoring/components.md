---
title: Components
description: The component YAML format, one file per part, with design_version and CAD source files.
---

A component is one YAML file under `docs/components/`. The file name is the component id: `docs/components/lamp-base.yaml` holds `id: lamp-base`. The project itself — its guides, theme, hosting and budgets — is configured in [`docsandeye.config.yaml`](/authoring/config/).

## Example

```yaml
id: lamp-base
name: Lamp base
kind: printed
design_version: 1.1.0
master_format: scad
source_files:
  - cad/lamp-base.scad
parameters:
  slot_width: 8
licence: CC-BY-SA-4.0
changelog:
  - {version: 1.0.0, date: 2026-03-02, note: "Initial release."}
  - {version: 1.1.0, date: 2026-05-11, note: "Cable slot widened to 8 mm."}
```

## Fields

| Field | Required | Meaning |
| --- | --- | --- |
| `id` | yes | Kebab-case identifier. Must equal the file name without `.yaml`. |
| `name` | yes | Display name. |
| `kind` | yes | One of `printed`, `off-the-shelf`, `kitted`, `assembly`. |
| `design_version` | yes | Release semver `MAJOR.MINOR.PATCH`. No pre-release or build suffix. |
| `master_format` | yes | One of `scad`, `step`, `f3z`, `none`. |
| `source_files` | see below | Repo-relative paths of the CAD master files. |
| `parameters` | no | Map of name to string, number, boolean or a list of those. Passed to the renderer and part of the render cache key. |
| `derived_files` | see below | Repo-relative paths of hand-exported outputs (`.svg`, `.png`, `.glb`, `.stl`). |
| `depends_on` | no | List of component ids this one is built from. |
| `supersedes` | no | Pin `id@version` of the component this one replaces. |
| `licence` | no | SPDX identifier or free text. |
| `supplier` | no | `name` (required), `url`, `mpn`. For off-the-shelf parts. |
| `changelog` | no | List of `{version, date, note}`. Versions must be unique. Sorted by version at load. |

## Rules

- `source_files` must be empty when `master_format` is `none`, and non-empty otherwise.
- `derived_files` must be non-empty when `master_format` is `f3z`. Fusion archives have no headless renderer, so you export the drawings by hand.
- A component with `master_format: none` and `derived_files` is also hand-exported. The render pipeline records the files and produces nothing. The first file listed is the one a step's render or viewer uses, so put the file you want shown first.
- `changelog` versions must be unique. Entries are sorted ascending at load, so write them in any order.
- Dates are `YYYY-MM-DD`.

## Versioning

`design_version` is bumped by the designer. `docsandeye check` compares two git facts for every component with source files: the last commit that touched any source file, and the last commit that changed `design_version`. If the source changed after the last bump, the check fails. A bump in a later commit than the source change clears it.

Media manifests pin components at a version, `lamp-base@1.0.0`. The [staleness](/staleness/) engine compares those pins against the current `design_version`. A pin newer than the current version is an error (`future-pin`).

## Hand-exported components

The example guide uses `master_format: none` with `derived_files` for its printed parts, so it builds without OpenSCAD:

```yaml
id: lamp-shade
name: Lamp shade
kind: printed
design_version: 1.0.0
master_format: none
derived_files:
  - assets/renders/lamp-shade.glb
  - assets/renders/lamp-shade.stl
```

The GLB was made from a binary STL with the pipeline's own converter:

```sh
PYTHONPATH=render python3 -c 'from docsandeye_render.glb import stl_to_glb; stl_to_glb("lamp-shade.stl", "lamp-shade.glb")'
```
