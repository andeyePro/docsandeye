# Spec Critique — task_017 (cycle 1)

## Concerns

1. **BLOCKING (AC3).** The "whole-word, case-sensitive first occurrence" rule doesn't say how names with regex metacharacters are matched. The fixture itself has such names — `MMO anode (titanium mesh)` and `Vial Cap (2×6.1 mm + 5×3.2 mm ports)` (unescaped `(`, `)`, `+`, `.`). A naive `new RegExp('\\b'+name+'\\b')` can throw or silently mismatch (`+` becomes a quantifier, `.` matches any char). Spec must require literal/escaped matching, not raw interpolation into a `RegExp`.

2. **BLOCKING (AC3).** No rule for two components sharing an identical `name` (schema only enforces `id` uniqueness). Undefined which part "claims" the first occurrence, or whether both would independently match the same span.

3. **MINOR (AC3).** Whole-word match isn't exempted from existing Markdown constructs — a name sitting inside an existing `[text](url)` link or `` `code span` `` would still get bracket-wrapped, corrupting the Markdown. Not addressed either way.

4. **BLOCKING (AC3/4/5, coverage).** None of the three fixture step bodies actually case-sensitively whole-word-match any component `name` (bodies use lowercase informal mentions: "lid", "anode", "callipers" vs `Lid Assembly`, `MMO anode (titanium mesh)`, `Vernier callipers`). Every part/tool in the byte-exact expected files therefore falls through to the appended `## Parts`/`## Tools` block — the spec's headline inline-substitution mechanism (and concerns #1–#3) is never exercised by AC3's own fixtures. Require at least one body edit (or new sentence) that provably triggers the inline path.

5. **BLOCKING (AC4/5, coverage).** `project.title` ("Aseptic ElectroPioreactor") is byte-identical to `guides[0].title` in the fixture, so `index.md`'s H1 and `okh.yml`'s `name` can't distinguish "prefer project.title" from "prefer guide title" — a reversed-precedence bug still produces byte-identical expected output. AC5's project-removed variant only proves the fallback path, not precedence when both exist and differ.

6. **MINOR (AC3/4/5, coverage).** "Steps not in the first guide, in order/id order" is dead code as tested: two fixture steps declare `guide: aep`/`[aep, mep]` and the third has no `guide` at all, which defaults to `[defaultGuide]` = `[aep]` (per `load.ts`) — so all three steps are in guide `aep` and the remainder branch never runs. Tester can't add a step file (Ownership: "Nothing else"), so as scoped this branch has no test.

7. **BLOCKING (AC5, contradicts Ownership).** AC5's "a second model built from the same fixture with the project block removed" doesn't say how the Tester obtains it, while Ownership restricts the Tester to exactly the two named test files ("Nothing else") — ruling out a second on-disk fixture/config. Spec must pin the mechanism to an in-memory override, e.g. `{ ...model, config: { ...model.config, project: undefined } }`, so Generator and Tester don't independently assume incompatible approaches.

8. **BLOCKING (AC3/4/5, circularity).** `export-expected/**` is Generator-owned, and AC3–AC5 compare implementation output only against those Generator-authored files — a shared misunderstanding is invisible to the harness. Require the Tester to independently hand-derive at least one step file (e.g. `step-05-electrolysis.md`, which has both a part and a tool) and `okh.yml`'s header+bom directly from the fixture YAML, and assert equality to the committed expected files, not just actual-vs-expected.

9. **MINOR (AC1).** Every other schema in `schemas.ts` uses plain `z.object()`, which strips (doesn't reject) unknown keys — only `HostingSchema` opts into `z.looseObject`. To reject `project.foo` as AC1 requires, the new project schema needs `z.strictObject()`; spec should say so rather than leave it implicit.

10. **MINOR (AC4/5).** The step-file rule hardcodes a tool's displayed `cat` to the literal `tool` regardless of its actual schema field (which may be any `PART_CATEGORIES` value). The index/okh BOM's "cat of first use" doesn't say whether it uses that forced literal or the raw field for a component only ever used as a tool. Unexercised by the fixture (no tool sets a non-default `cat`).

11. **MINOR (AC5/AC6).** The emitter's quoting rules (`: `, `#`, leading/trailing space, leading special char) don't cover values a YAML 1.2 parser would round-trip incorrectly unquoted: numbers-as-strings (a free-string `version` like `"1.0"`), reserved scalars (`true`/`false`/`null`/`yes`/`no`/`~`), or an embedded newline in `description` (unconstrained free string). None of AC6's four sample inputs cover these, yet all are realistic `project.*` values.

12. **MINOR (AC7).** Spec doesn't say `export` must reuse `loadProjectSafely`/`formatProblem`/`EXIT` from `common.ts` (not listed under Edit) to keep "invalid project ⇒ exit 1" behaviour identical to `render`'s, rather than a divergent reimplementation.

13. **MINOR (AC9).** `emitYaml` is a deliberately narrow emitter (block sequences, 2-space indent, 4 quoting rules) promoted to the package's public surface. Not blocking since AC9 requires the export, but its doc comment should state the supported subset so it isn't mistaken for a general YAML serializer.

## Verdict

**revise**
