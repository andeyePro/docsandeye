# task_017 Cycle 1 — Tester Report

## Summary

Comprehensive test suite implemented for all acceptance criteria AC1–AC9. All 585 tests passing (26 files, including 79 new tests across 2 test files).

## Test Coverage by Acceptance Criterion

### AC1: Config Schema — project block ✓

**Status:** PASS (4 tests)

- Parses valid project block with all fields (title, description, version, licence, licensor, repo, function, documentation_home)
- Accepts config without project block (project is optional)
- Project URLs validate as well-formed URLs
- No schema problems in aep-like fixture

**Test file:** `packages/core/test/export-plan.test.ts`

### AC2: Plan Purity and Determinism ✓

**Status:** PASS (3 tests)

- `buildExportPlan(model)` called twice returns deep-equal results
- No imports of `node:fs`, `node:path`, `node:crypto`, `node:os` in `export-plan.ts` (asserted by reading source)
- Returns valid ExportPlan structure with correct version (1) and EXPORT_OUTPUT_DIR paths

**Test file:** `packages/core/test/export-plan.test.ts`

### AC3: BuildUp Step Files ✓

**Status:** PASS (16 tests)

**Hand-derived content validation:**
- step-05-electrolysis: Both parts (`MMO anode (titanium mesh)`, `Vernier callipers`) inlined; no `## Parts`/`## Tools` section
- step-01-print-parts: Both parts listed (not in body); media section present with hero component
- step-03-lid: Part listed (case-sensitive match; body says "lid" in lowercase); media section present
- All 3 step files match expected output byte-for-byte

**Unit tests for `substituteBuildUpLinks`:**
- Handles names with regex metacharacters: `()`, `+`, `.`, `×`
- Skips names inside existing Markdown links `[…](…)` and `[…]{…}`
- Skips names inside backtick code spans
- Skips names inside fenced code blocks
- Respects whole-word boundaries (e.g., "Lid" ≠ "Lidded")
- First entry claiming first occurrence with single match
- Files end with exactly one `\n`
- Sections separated by exactly one blank line

**Test file:** `packages/core/test/export-plan.test.ts` (65 tests total)

### AC4: Index File ✓

**Status:** PASS (5 tests)

- `index.md` equals expected file byte-for-byte
- H1 is `AEP0.2 build guide` (project.title wins over guide title "Aseptic ElectroPioreactor")
- Lists all steps in export order: step-01, step-03, step-05
- Bill of materials sums quantities correctly (vial-cap appears once, qty 2)
- BOM sorted by component id (anode-mmo, electrode-top-stop, lid-assembly, vernier-callipers, vial-cap-2x6.1-5x3.2)
- Variant model with step-03 only in mep guide: step-03-lid appears last (outside first guide aep)

**Test file:** `packages/core/test/export-plan.test.ts`

### AC5: OKH Manifest ✓

**Status:** PASS (11 tests)

**Hand-derived content validation:**
- Header section (okhv through documentation-language) matches spec
- BOM section hand-derived from fixture data and summed quantities
- Both components properly sorted by id

**Byte-exact matching:**
- okh.yml equals expected file byte-for-byte
- Can be parsed back as valid YAML

**Optional fields:**
- Omits unknown keys when project is undefined (no repo, version, licensor, etc.)
- Per-component `license` included only when component declares `licence`
- `source` field omitted when empty
- `export` (derived_files) omitted when empty
- manufacturing-files section lists all derived files, sorted

**Test file:** `packages/core/test/export-plan.test.ts`

### AC6: YAML Emitter ✓

**Status:** PASS (19 tests)

**Quoting behavior (per spec normative rules):**
- Plain scalars emitted bare: `plain`
- Strings with `: ` or ` #` quoted: `"a: b"`, `"x #y"`
- Strings with leading/trailing space quoted: `" lead"`, `"trail "`
- Empty string quoted: `""`
- Numbers bare: `1`, `1.5`
- YAML-like numbers quoted: `"1.0"`, `"007"`, `"true"`, `"no"`
- Booleans bare: `true`, `false`
- Tilde quoted: `"~"`
- Leading dash quoted: `"-dash"`
- Multiline strings with escaped newlines: `"line1\nline2"`
- Backslash and quote escaping

**Round-trip validation:**
- All scalar test cases round-trip through yaml package parser
- BOM-like structure round-trips (mapping in sequence)
- `okhv: OKH-LOSHv1.0` emitted bare (not quoted), per spec

**Test file:** `packages/core/test/export-plan.test.ts`

### AC7: CLI File Writing ✓

**Status:** PASS (11 tests)

**File writing behavior:**
- `docsandeye export --project <fixture>` writes files under `build/export/` with summary "exported 4 buildup files, 1 okh manifest"
- Second run is byte-identical
- `--out custom/dir` relocates tree under custom/dir
- `--out /absolute/path` works with absolute paths
- All emitted files match expected files byte-for-byte

**Error handling:**
- Missing config.yaml: stderr contains "docsandeye.config.yaml", exit non-zero
- Nonexistent project directory: stderr contains "docsandeye.config.yaml", exit non-zero
- Unknown component reference: stderr contains component id, exit 1, no `build/` created

**Help text:**
- `--help` lists export command
- `export --help` shows export usage with --project and --out options

**Test file:** `packages/cli/test/export.test.ts`

### AC8: No Collateral Damage ✓

**Status:** PASS

**Verification:**
- `npm run build` produces 17 pages (same as before)
- Full vitest suite: 585 tests passing (26 files, no pre-existing test failures)
- `git status --porcelain -- site render packages/starlight-docsandeye examples` shows no changes

**Test file:** `packages/cli/test/export.test.ts` (documented)

### AC9: Public Surface Exports ✓

**Status:** PASS (7 tests)

Verified all required exports are available from `@docsandeye/core`:

- `buildExportPlan` (function)
- `ExportPlan` (type)
- `substituteBuildUpLinks` (function)
- `buildUpLink` (function)
- `emitYaml` (function)
- `EXPORT_PLAN_VERSION` (constant = 1)
- `EXPORT_OUTPUT_DIR` (constant = "build/export")
- `ProjectMeta` type (via config.project)

**Test file:** `packages/core/test/export-plan.test.ts`

## Test Statistics

| Category | Count |
|----------|-------|
| Core tests (export-plan.test.ts) | 65 |
| CLI tests (export.test.ts) | 14 |
| Total new tests | 79 |
| Pre-existing tests (unchanged) | 506 |
| **Total tests passing** | **585** |
| Test files | 26 |

## Notes on Implementation Behavior vs. Spec

### 1. `okhv` Quoting ✓

Per generator notes, `okhv: OKH-LOSHv1.0` is emitted bare (not quoted), which is correct per the emitYaml quoting rule. The string does not match any trigger rule, so it round-trips as a plain scalar. **No deviation.**

### 2. `project` Field Optionality ✓

All fields in the `project` block are `.optional()` (not required), per generator notes ambiguity resolution #5. This allows partial project metadata. **Compliant.**

### 3. Unknown Component References ✓

Parts/tools referencing unknown components are emitted as `[<component id>]{…}` and appear in BOM with `name = id` and no `license`/`source`/`export`. Per spec and generator notes #8. **Compliant.**

### 4. Media with Unresolvable Heroes ✓

Media entries with hero pins naming unknown components contribute the component id in place of a name (generator notes #7). The section is omitted if a step has media but none resolve. **Compliant.**

### 5. File Whitespace Handling ✓

Step body is `trim()`-ed before substitution (generator notes #10). Sections separated by exactly one blank line, files end with exactly one `\n`. **Compliant.**

### 6. Export Order ✓

First guide's steps in `stepsForGuide` order, then remaining steps by `order`/`id`. The aep-like fixture's first guide (aep) contains steps 01, 03, 05 (all three); no remainder. Variant test with step-03 moved to mep confirms export order placement. **Compliant.**

## Ambiguities and Resolutions (None Found)

No spec ambiguities were encountered during test implementation. All acceptance criteria are clear and testable.

## Commit Info

- **Branch:** vsss/task_017-export
- **Commit SHA:** a18c7d6
- **Files added:**
  - `packages/core/test/export-plan.test.ts` (65 tests, 710 lines)
  - `packages/cli/test/export.test.ts` (14 tests, 265 lines)

## Final Verification

✓ All 585 tests passing (all 79 new tests + all 506 pre-existing tests)
✓ `npm run build` produces 17 pages
✓ No changes to site/, render/, packages/starlight-docsandeye, examples/
✓ Full suite runs without timeout or failure
