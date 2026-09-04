# Spec Critique — task_006 (cycle 1, fuzzy)

## Concerns

1. **[BLOCKING, AC4/output-layout]** `pumping-dovetail-platform.yaml` is grouped in the sentence "scad masters where a .scad exists under `Components/`", but no `PumpingDovetailPlatform` (or similarly named) directory exists under `Components/` at all — confirmed by listing (`Vial Cap`, `ElectrodeTopStop`, `GL45BottleHolder`, `PinchSlider`, `CO2 transfer`, `x Redundant`, `README.md` only). BoM 1.8's platform has neither a `.scad` source nor any committed STL/3MF anywhere in the repo, so this component can only ever be `master_format: none` with empty `derived_files` — a bare stub. The spec should say so explicitly instead of implying a scad source exists, or the Generator will spend effort hunting for a directory that isn't there.

2. **[BLOCKING, AC3]** No rule converts non-integer BoM quantities into `parts[].qty` (integer ≥ 1 per core's schema): 1.7 "1 pair" (pumps), 1.11/1.12 "1 per n units" (spare vial/flea), 4.7 "consumable" (SodaStream cylinder), 4.8 "shared" (Loctite). Is "1 pair" `qty: 1` (one pack) or `qty: 2` (two physical pumps)? Are consumable/shared spares represented at all, and if so with what qty? AC3's hedge "quantities... match the BoM where the BoM states per-unit quantities" doesn't define "per-unit," so a Reviewer has no rule to check a Generator's choice against, and two equally defensible conversions would both "pass."

3. **[BLOCKING, AC8]** The MEP-sharing rule's evidence source is undefined against the spec's own scope. The task's "Sources of truth" paragraph enumerates only the AsepticElectroPioreactor README/BoM, `Components/*/README.md` + `.scad`, and `CO2 transfer/*.md`. It never names a file under `MixedElectroPioreactor/` (which does exist in the repo — confirmed) as readable. AC8 nonetheless requires marking steps `[aep, mep]` "where the MixedElectroPioreactor assembly notes also perform the same step," with no path given and no license in the sources-of-truth list to open that tree. A Reviewer cannot verify such a claim without knowing which file substantiates it. Needs an explicit path (or an explicit "none exists yet, so no step gets `[aep, mep]` this cycle" fallback).

4. **[BLOCKING, AC9 vs. task-summary hard constraints]** Scope mismatch on "no git." The task summary's hard constraint is specific: never `git add`/`commit`/`push`/`pull`. AC9 is broader: "no git command was run against `/repos/electroPioreactor`," which read literally also bars `git status`/`git diff`/`git log` — yet AC9's own verification recipe requires the Reviewer to run exactly those. It's unstated whether the *Generator* may run read-only git commands (e.g. to self-check it left the tree untouched) without failing AC9, or whether only the Reviewer's read-only commands are exempt. Spec should say plainly: read-only git commands (status/log/diff) are permitted for both Generator self-check and Reviewer verification; only mutating commands are barred.

5. **[BLOCKING, AC3]** No component-identity rule for a step-mentioned noun that is a sub-item of a BoM line rather than the line itself. Steps 5, 6 and 8 repeatedly reference "the Vial" as a part, but the BoM's only relevant line is 1.1 "Pioreactor 40 ml v1.5" ("Ships with vial, stir bar and caps") — there is no BoM Ref for "Vial" on its own, nor for "stir bar." The output-layout rule ("one [component] per BoM line item that a step references") assumes a 1:1 step-mention-to-BoM-line mapping that breaks here: does "Vial" get its own invented component id, share 1.1's id, or go unmapped (which would itself violate AC3's "every part mentioned in a step body maps to a component")? Needs a stated rule for kit sub-items.

6. **[MINOR, AC3]** The BoM's Critical / Generic / Custom tier is consumed only to pick `kind` and then dropped — core's schema has no field for it, and the spec doesn't say whether that's an acceptable, deliberate simplification or whether it should land in the changelog note alongside the BoM Ref (as is already required for the Ref itself). Worth one sentence either way so a Reviewer isn't left guessing whether losing the tier counts as a fidelity gap.

7. **[MINOR, output-layout]** The stated `kind` mapping ("Critical custom printed → printed; Ships with/kit → kitted; else off-the-shelf") never produces `kind: assembly`, one of core's four enum values. Not necessarily wrong, but unstated whether `assembly` is simply unused for this BoM (plausible — nothing here is obviously a sub-assembly of other authored components) or whether, e.g., 2.3 (cap) + 2.4 (septum) should compose that way.

8. **[MINOR, AC2, checkability]** "No README sentence that gives an instruction, a measurement, a part number, a polarity or a safety warning is missing from the corresponding step body" is not a single checkable boolean for an 11-step, multi-hundred-line README — it depends on a Reviewer's unaided sentence-by-sentence recall. Recommend requiring the Generator's report to include a per-step correspondence note (or the Reviewer's recipe to explicitly be "read README step N and step-NN file side by side, list any dropped clause") so the check is reproducible rather than a single read-through's impression.

9. **[MINOR, AC9 recipe]** "`git log -1` is unchanged from the session start value recorded in the generator report" presumes the Generator captures that baseline as its first action. Spec should require the Generator's report to record `git -C /repos/electroPioreactor log -1 --format=%H` (read-only, consistent with concern 4) at the very start of the cycle, or a resumed/second cycle has nothing to diff against.

## Verdict

**revise**

## Iteration 2 — Concerns

All nine iteration-1 concerns are **resolved**, verified against the live repo:

1. Resolved — spec now states BoM 1.8 has no `.scad`/STL, gives explicit stub rule (`master_format: none`, empty files, supplier from Components/README.md's pioreactor.com link). Confirmed that link exists.
2. Resolved — new "Quantity rule" gives concrete conversions for "1 pair" (qty 2), and "1 per n units"/"shared"/"consumable" (qty 1, `cat: consumable`, appear only where used + step-00 spares list). Confirmed `consumable` is a valid `cat` value in task_001's schema (AC2/step schema).
3. Resolved — sources-of-truth paragraph now names `MixedElectroPioreactor/Assembly-EdMSc26.md` explicitly as the only MEP evidence file.
4. Resolved — new paragraph states read-only git (`status`/`log`/`diff`/`rev-parse`) is permitted for both Generator self-check and Reviewer verification; only mutating commands are barred.
5. Resolved — kit sub-items get explicit component ids (e.g. `pioreactor-vial-40ml`, `stir-bar`), confirmed against BoM 1.1 ("Ships with vial, stir bar and caps").
6. Resolved — tier now explicitly folded into the same first changelog note as the BoM Ref.
7. Resolved — spec states plainly `assembly` is unused for this BoM.
8. Resolved — AC2 now requires a per-step correspondence table in the generator report.
9. Resolved — task summary requires the Generator to record `git log -1 --format=%H` as its first action every cycle; AC9 checks against that recorded hash.

New, both minor, non-blocking:

10. **[MINOR, Quantity rule]** "supplier note 'sold as a pair'" for the pump component has no home in task_001's schema — `supplier` is `{name, url, mpn}` only, no `note` field. Elsewhere the spec is careful to route BoM-derived prose into the component's changelog note; this one instance says "supplier note" instead, which could lead the Generator to invent a non-schema key under `supplier`. Suggest wording it as "recorded in the changelog note" to match the established convention.
11. **[MINOR, AC9]** AC9 hardcodes the literal current dirty-state line (` M .gitignore`) rather than deriving it from a captured baseline. Confirmed accurate today (`git -C /repos/electroPioreactor status --short` → ` M .gitignore`), but `/repos/electroPioreactor` is a live `rw`-shared checkout Martin also uses directly; if that line changes for reasons unrelated to this task before/while the Generator runs, a literal string match produces a false failure. Since the spec already requires capturing a `git log -1` baseline as the Generator's first action, extending the same baseline capture to `git status --short` and diffing against it (rather than hardcoding the exact line) would be more robust — but this is a tightening suggestion, not a defect that blocks work today.

## Iteration 2 — Verdict

**pass**
