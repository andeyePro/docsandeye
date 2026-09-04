# task_006 — the electroPioreactor AEP0.2 guide content (`--fuzzy`)

## Task summary

Author the first real Docs&I project: convert the AEP0.2 assembly instructions and bill of materials in the electroPioreactor repository (branch `AEP02`, mounted read-write at `/repos/electroPioreactor`) into a `docs/` tree of components, steps and media manifests plus `docsandeye.config.yaml`, so that `docs.electroPioreactor.org/AEP` can be built from it with the plugin, and so that a sibling `/MEP` guide can later share most of the components and steps. This task writes files in that repository and commits them locally on the `AEP02` branch (Martin, T26: "feel free to commit"); it never pushes, pulls, rebases or resets there, and it never edits the existing `Assembly/README.md` or `BoM.md` (T28 pending: replace or coexist is Martin's call).

Sources of truth, in this order: `AsepticElectroPioreactor/CARMA_PumpPriming/Assembly/README.md` (11 numbered steps under "Method", plus "What changed from AEP0.1.1", "Before you start", tools and spares), `Assembly/BoM.md` (numbered items with Critical / Generic / Custom flags and specifications), `Components/*/README.md` and the `.scad` sources for the printed parts, `Components/CO2 transfer/*.md` for the "why this part" material, and `MixedElectroPioreactor/Assembly-EdMSc26.md` as the only evidence for which steps the MEP guide shares. `private-notes/**` and `.claude/**` are denylisted and must never be read.

Git in `/repos/electroPioreactor`: read-only commands are always permitted; `git add` of the new files and `git commit` on the current branch (which must be `AEP02`, checked first with `git rev-parse --abbrev-ref HEAD`) are permitted for the Generator at the end of a cycle, using the commit trailer convention of this repo; `push`, `pull`, `fetch`, `checkout`, `switch`, `stash`, `reset`, `rebase` and any edit to tracked files are barred. The Generator's report records `git -C /repos/electroPioreactor log -1 --format=%H` and `git -C /repos/electroPioreactor status --short` as its first action of every cycle (the baseline AC9 compares against).

Mode is `--fuzzy`: fidelity to the source text, correct part attribution and preserved safety content are judged by a Reviewer from the diff.

Sequencing (chair commitment): dispatched after task_001 and task_004 have merged to `main`, so `docsandeye check` can validate the result. Renders are not required to exist for this task (task_002's pipeline needs OpenSCAD, absent in the container); the render plan must build.

## Output layout (in `/repos/electroPioreactor`; the only files this task creates or edits)

```
docsandeye.config.yaml            theme: pioreactor; guides: [{id: aep, title: "Aseptic ElectroPioreactor (AEP0.2)", base: /AEP}, {id: mep, title: "Mixed ElectroPioreactor", base: /MEP}]; denylist adds nothing beyond defaults; byte_budget_kb: 150
docs/components/*.yaml            one per BoM line item that a step references, plus the printed parts, plus one per kit sub-item a step names (the vial, stir bar and caps that ship with BoM 1.1 become their own `kind: kitted` components, e.g. pioreactor-vial-40ml, stir-bar); ids kebab-case from the item name; kind from the BoM (custom printed → printed; ships-with / kit → kitted; else off-the-shelf; `assembly` is unused for this BoM); supplier {name, url, mpn} only when the BoM or Components/README.md gives them; the BoM Ref and tier are recorded in the component's first changelog note, e.g. note: "Imported from BoM.md item 2.3 (Critical, custom; AEP0.2)" — core's schema has no bom_ref or tier field and ids/names must not carry them
Quantity rule                     `parts[].qty` is the number of physical items the step uses: "1 pair" of pumps → the pump component with qty 2 (the changelog note records "sold as a pair"); "1 per n units", "shared" and "consumable" items (spare vial, spare flea, SodaStream cylinder, Loctite) appear only where a step uses them, with qty 1 and cat consumable, and in step-00's spares list
docs/components/vial-cap.yaml     master_format scad, source_files ["Components/Vial Cap/Vial Cap.scad"], design_version 2.0.0 (the AEP0.2 septum generation; changelog: 1.x = AEP0.1 o-ring generation, 2.0.0 = septum + top-stop one-piece), parameters left at the .scad defaults (T27 pending), depends_on [bosl2]
docs/components/electrode-top-stop.yaml, pinch-slider.yaml, gl45-bottle-holder.yaml   scad masters (Components/ElectrodeTopStop/ElectrodeTopStop.scad, Components/PinchSlider/PinchSlider.scad, Components/GL45BottleHolder/GL45_holder.scad) with the committed STLs as derived_files
docs/components/pumping-dovetail-platform.yaml   BoM 1.8 is a purchased Pioreactor part (Components/README.md links pioreactor.com): kind off-the-shelf, master_format none, empty source_files and derived_files, supplier from that link
docs/steps/step-NN-<slug>.md      one per README Method step, order = NN, title = the README heading; body = the README's sub-steps converted to Markdown with the same wording (light copy-editing only: fix numbering, no new claims); parts/tools from the sub-steps' mentions cross-referenced to component ids; renders for each printed part the step introduces (view iso png, plus an exploded png where the .scad has an explode parameter); viewer for the printed part; safety: the README's warnings verbatim (3/2 venting solenoid, electrode polarity, hydrogen/oxygen, cylinder pressure, PC-CF printing temperature) on the steps where they occur; guide: [aep] except steps for which MixedElectroPioreactor/Assembly-EdMSc26.md contains the same operation, which get [aep, mep]; the generator report lists each such pairing with the line numbers on both sides; if no equivalent exists, no step is shared this cycle
docs/steps/step-00-before-you-start.md   order 0: the README's "What changed", "Before you start", tools and spares, as the guide's first page
docs/media/                       manifests only for media that exists in the repo today as committed files (none expected); external Vimeo/user-attachments images are NOT ingested — a `docs/media/README.md` explains the shoot list: for each step, the hero components a future clip must declare
docs/README.md                    two paragraphs: what this tree is, how to build it (docsandeye check / render / astro build), and that Assembly/README.md remains the canonical human-readable instructions until Martin decides (T28)
```

## Acceptance criteria (heuristic, judged from the diff and by running the CLI)

1. `docsandeye check --project /repos/electroPioreactor` reports zero errors; warnings are listed in the generator report.
2. Every numbered Method step in the README has exactly one step file, in order, with the README's heading as the title (if the README skips or merges a number, the step file keeps the README's number and the report says so); the generator report contains a per-step correspondence table (README step → file → "dropped clauses: none" or the list), and the Reviewer checks it by reading each README step and its file side by side: no README sentence that gives an instruction, a measurement, a part number, a polarity or a safety warning may be missing.
3. Every part mentioned in a step body maps to a component (a BoM line, a kit sub-item, or a printed part) whose `name` matches the source item and whose `kind`, `supplier` and specification-derived `parameters` (where the BoM gives numbers, e.g. electrode 100 mm × 6 mm) are consistent with the BoM; `qty` follows the Quantity rule above.
4. Printed parts reference the real `.scad` sources under `Components/` with correct paths (spaces preserved); the render plan from `buildRenderPlan` lists a job for each of them; parameters are left at the source defaults with a `changelog` note that the per-variant values are unknown (Martin, T27: the most recently produced STL is the one in use).
5. The README's safety warnings appear in `safety:` on the right steps and are not paraphrased into something weaker.
6. Links out to docs.pioreactor.com and to the Components/ READMEs are preserved as Markdown links; nothing from upstream Pioreactor documentation is copied in.
7. No content from `private-notes/**`, no LAN IPs, hostnames, SSIDs, MACs, personal emails or session identifiers anywhere in `docs/`.
8. The `mep` guide has no step files of its own yet; shared steps are marked `[aep, mep]` only where `MixedElectroPioreactor/Assembly-EdMSc26.md` performs the same operation, and a `docs/steps/README.md` line lists which steps those are with the evidence line numbers.
9. No existing tracked file in the repository is modified and the only git mutations are the final `git add` + `git commit` of the new files on `AEP02`: the Generator records both `git -C /repos/electroPioreactor log -1 --format=%H` and `git -C /repos/electroPioreactor status --short` at the top of its report as the baseline; the reviewer checks that `status --short` equals the baseline (the new files having been committed), that `log -1` is exactly one commit ahead of the baseline hash, and that `git show --stat HEAD` touches only `docs/**` and `docsandeye.config.yaml`.
10. Component and step ids are stable kebab-case that will survive an AEP0.3 (no version numbers inside ids).

## Out of scope

- Videos, photos, posters, captions; the shoot list README is the only media output.
- Editing `Assembly/README.md`, `BoM.md` or anything else that already exists; pushing.
- The MEP guide's own steps.
- Renders themselves (no OpenSCAD in the container); the plan must build, the outputs are produced on the Mac later.
- BuildUp/OKH export.

## Review focus

- Fidelity: nothing invented, nothing dropped, safety intact.
- Attribution: parts to steps, BoM numbers to parameters.
- Hygiene: nothing from private-notes, no PII, no upstream copying, no repository files touched, no git.
- Schema correctness under the real CLI.

## Proposed budget

3 cycles.

## Model plan

- Generator: **opus**, ceiling fable (pre-authorised). Rationale: long but judgment-over-prose conversion, not novel machinery.
- Spec Critic: sonnet. Reviewer: sonnet (`--fuzzy`).
- Fable rung: pre-authorised (--fable-subagents) but not the starting tier.
