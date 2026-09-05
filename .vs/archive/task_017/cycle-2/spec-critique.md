# Spec Critique — task_017 (cycle 2)

## Cycle-1 concern resolution

All 13 cycle-1 concerns are resolved in the revised spec, checked against `schemas.ts`, `load.ts`, `index.ts`, `common.ts`, `bin.ts`, `render.ts` and the fixture:

1. Resolved — "matched LITERALLY (every regex metacharacter in the name escaped …)" is now explicit.
2. Resolved — "Two components with identical `name`: the earlier entry claims the first occurrence, the later one falls through to the list."
3. Resolved — "not inside a fenced code block, an inline code span, or an existing Markdown link `[…](…)` / `[…]{…}`" is now explicit, and AC3 requires unit cases for link/code-span exemption.
4. Resolved — the mandated fixture edit (new last sentence on step-05) contains the literal substrings `MMO anode (titanium mesh)` and `Vernier callipers`, case-sensitive and whole-word, so the inline path is genuinely exercised; confirmed no existing core test asserts step-05's `.body` (`grep -n "\.body\b" packages/core/test/*.test.ts` only hits `schemas.test.ts` against other fixtures), so the edit is safe.
5. Resolved — `project.title: "AEP0.2 build guide"` now differs textually from `guides[0].title` (`"Aseptic ElectroPioreactor"`), so precedence is observable in the byte-exact `index.md`/`okh.yml` fixtures.
6. Resolved — AC4 now exercises the remainder branch via an in-memory model variant (`step-03-lid`'s `guide` replaced by `['mep']`) rather than requiring an untestable on-disk fixture.
7. Resolved — AC5's project-removed variant is pinned to `{ ...model, config: { ...model.config, project: undefined } }`, compatible with the Tester's "nothing else" file restriction.
8. Resolved — AC3 and AC5 both now require the Tester to independently hand-derive at least one BuildUp file (`step-05-electrolysis.md`) and the OKH header+bom from raw fixture data, breaking circularity against the Generator-authored `export-expected/**`.
9. Resolved — "The schema is a `z.strictObject`" is now stated normatively, matching the fact that every other schema in `schemas.ts` is a plain `z.object` (silently stripping) except `HostingSchema`'s `z.looseObject`.
10. Resolved — "`cat` is always the entry's own `cat` field as loaded (tools default to `tool` per the schema; a tool declaring another category keeps it)" replaces the old forced-literal behaviour.
11. Resolved — the quoting rule now covers reserved YAML 1.2 scalars and numeric-looking strings, and AC6's sample list (`1.0`, `007`, `true`, `no`, `~`, `line1\nline2`, embedded `"`) exercises them.
12. Resolved — "loads the project through the existing `loadProjectSafely`, `formatProblem` and `EXIT` helpers in `packages/cli/src/common.ts`" is now explicit.
13. Resolved — "Its doc comment states the supported subset: … nothing else (no anchors, flow style, comments, multi-line block scalars)" is now explicit.

## New concerns (cycle 2)

1. **BLOCKING (AC5/AC6).** The `okh.yml` template's `bom` entry shows `export: [<derived_files…>]              # omitted when empty; a block sequence, one path per line`. The literal template uses YAML **flow-sequence** brackets (`[...]`), but the trailing comment on the same line calls it "a block sequence, one path per line" — and the emitter's own stated subset explicitly excludes flow style ("nothing else (no anchors, flow style, comments, multi-line block scalars)"). Two incompatible readings: (a) follow the literal template bytes and emit `export: [Assemblies/Lid/Lid v3.step, Assemblies/Lid/Lid v3.stl]`; (b) follow the parenthetical + emitter-subset rule and emit
   ```
   export:
     - Assemblies/Lid/Lid v3.step
     - Assemblies/Lid/Lid v3.stl
   ```
   This is not hypothetical: `lid-assembly` (referenced by `step-03-lid`'s part) has two `derived_files` (`Assemblies/Lid/Lid v3.step`, `Assemblies/Lid/Lid v3.stl`), so its bom entry's `export` field is a real two-item list in the byte-exact `okh.yml` fixture required by AC5, and AC6 separately requires "a nested mapping-in-sequence sample matches the `bom` layout above byte-for-byte" — which inherits the same ambiguity. Fix: make the template's `export:` line an actual block sequence (drop the brackets) so it agrees with the emitter's documented no-flow-style rule.

2. **BLOCKING (AC3, coverage).** The BuildUp step-file template shows only one placeholder bullet under `## Parts` / `## Tools` and never states an ordering or spacing rule for *multiple* fallback entries in the same section (contrast with `## Media`, which explicitly says "one line per media entry in the step's `media` order"). Two incompatible readings when a section has 2+ entries: (a) a "tight" list, one bullet per line with no blank line between them, in the step's declared `parts`/`tools` order (the substitution-processing order stated earlier); (b) a "loose" list with one blank line between each bullet, consistent with "Sections are separated by exactly one blank line" read at bullet granularity. This is directly exercised, not hypothetical: `step-01-print-parts.md`'s body ("Print every part listed below before you start assembly.") matches neither `Vial Cap (2×6.1 mm + 5×3.2 mm ports)` nor `Electrode Top Stop` literally, so **both** of its two parts fall through to `## Parts`, and the byte-exact `step-01-print-parts.md` expected file (AC3) depends entirely on this choice. Worse, the Tester's independent hand-derivation (AC3's anti-circularity requirement) is pinned to `step-05-electrolysis.md`, which has zero fallback entries in either section — so a Generator/Tester mismatch on this rule for step-01 would only be caught by comparing against the Generator's own `export-expected/**` file, which is exactly the circularity AC3 was trying to close. Fix: state explicitly, e.g. "entries are listed one per line, no blank line between them, in the step's declared order (parts) / declared order (tools)."

## Verdict

**revise**
