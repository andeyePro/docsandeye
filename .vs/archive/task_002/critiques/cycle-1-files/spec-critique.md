# Spec Critique — task_002 (cycle 1)

## Concerns

1. **[AC3/general, BLOCKING]** The `fake-bin/openscad` fixture is under-specified in two ways that affect determinism: (a) the argv-recording format is not pinned (JSON list? one-arg-per-line? shell-quoted?), so Generator and Tester could each guess differently and disagree on parsing; (b) executable-on-checkout is not addressed — git file modes are not guaranteed to survive every checkout path, and the spec should require the fixture's `setUp` to `os.chmod` it defensively rather than rely on the committed mode bit.

2. **[AC3, BLOCKING]** "a `--camera=` value corresponding to the job's view" only requires the mapping be "documented in `openscad.py`" — there is no canonical table in the spec itself. If the same author writes both the mapping and the test, the test can trivially assert "whatever the code produces" rather than a value chosen independently against a real requirement. The spec should pin the exact 7-number camera vector per `view`, or at minimum require the test to load the table from a spec-controlled fixture/constant, not from `openscad.py`.

3. **[AC3, BLOCKING]** Parameter serialisation covers only strings (quoted) and numbers (bare). Bool and list-valued `parameters` entries are unaddressed, and OpenSCAD's `-D` syntax differs for each (`true`/`false` bare, vectors as `[1,2,3]`). Since `options.explode`/`annotate` are handled specially but nothing forbids an arbitrary bool/list in `parameters`, this is a real gap, not a hypothetical one.

4. **[AC1/general, BLOCKING]** `master_format` is never enumerated. The example plan shows `scad` and `f3z`; AC6 implies `step` also exists. AC1 requires `PlanError` for "an unknown `master_format`" but the spec gives no closed set to validate against — Generator and Tester will each have to invent one.

5. **[AC4, BLOCKING]** "a preceding or implicit stl render" is a real fork in behaviour, not a phrasing nit: does an `svg` job with no prior `stl` job for the same key silently trigger an internal STL render step, and if so, does that step get its own manifest entry or `outputs` line? The spec must pick one and say whether the implicit render is job-invisible or job-visible in the manifest.

6. **[AC5 vs AC12, BLOCKING]** These two ACs conflict on abort semantics. AC5 says a missing-tool `scad` job "raises `DriverUnavailable`" and "the CLI exits with code 2" — worded as an immediate, whole-run abort. AC12 says a driver exception for one job is caught, marks that job `failed`, "does not abort the run," and the CLI exits 1 at the end. It is not stated whether `DriverUnavailable` is special-cased to abort immediately (contradicting "per job" failure handling) or is just another per-job exception (in which case exit code 2 vs the AC12 exit-1 rule needs a precedence rule for a run with both a missing tool and an unrelated failed job).

7. **[AC10, BLOCKING]** GLB byte-layout is under-specified at the padding level: glTF2 requires the JSON chunk padded with `0x20` and the BIN chunk padded with `0x00` to the 4-byte boundary — the spec says only "4-byte alignment," which a valid-looking-but-wrong implementation (e.g. zero-padding both) could satisfy while producing a technically non-conformant GLB that a real viewer would still choke on. Pin the padding bytes explicitly since this is exactly the kind of numeric detail a stdlib test can (and should) assert byte-for-byte.

8. **[AC10, BLOCKING]** The NORMAL accessor is required to be present with correct `count`/type but its *values* are never required to be geometrically correct (outward-facing, consistent with the STL's triangle winding). As written, an implementation that emits `NORMAL` as all-zero (or all-`[0,0,1]`) floats of the right count passes the letter of AC10 — a trivial test-evasion path the spec should close by requiring normals to match the source STL's per-face/vertex normals within a tolerance.

9. **[AC11, BLOCKING]** `doctor` must print `openscad: found <version>` on the found path, but nothing requires `fake-bin/openscad` to respond meaningfully to `--version`/`-v` with a parseable string, and no version-string format is specified. Without this, the "found" branch of `doctor` cannot be exercised without a real `openscad` binary, silently pushing it into the `skipUnless(shutil.which("openscad"))` bucket (already capped at two tests) or leaving it untested.

10. **[AC1, MINOR]** "raises `PlanError` naming the job index and field" doesn't say whether index/field are structured attributes on the exception or merely present in `str(exc)`. Either is testable, but leaving it open invites brittle regex-on-message tests instead of clean attribute assertions — worth pinning to `PlanError(index=..., field=..., message=...)` or similar.

11. **[AC6, MINOR]** The CadQuery SVG export's `opt={…}` is left as an ellipsis — the spec doesn't say which keys the driver must pass, so the "exact call shapes are asserted on the fake" claim in the prose is not fully backed by the AC text; a test can only assert the kwarg exists, not its contents.

12. **[AC7/AC8, MINOR]** Cache-skip's interaction with `hand-exported` jobs is only implicitly resolved (hand-exported jobs never reach a driver regardless of cache state, so AC8's skip logic is moot for them) — worth one sentence in the spec confirming hand-exported jobs are always re-recorded fresh each run rather than "cached," to close the ambiguity cleanly.

13. **[general, MINOR]** `OPENSCADPATH`'s `<project_root>/Components/lib` default has no override via CLI flag or plan field. Reasonable as a v0.1 default given the fixed project layout, but worth a one-line note that it's intentionally not configurable yet, so it isn't mistaken for an oversight.

## Verdict

revise

## Iteration 2 — Concerns

1. **[AC3, BLOCKING]** The closed-sets paragraph states `options.annotate` "is accepted and ignored in v0.1 (recorded in the manifest as `unsupported: ["annotate"]`)" — read literally, this fires whenever the key is present, regardless of its value. But the fixture png job explicitly sets `"annotate": false`, and AC3 asserts that exact job's manifest entry has `unsupported: []`, not `["annotate"]`. The spec never states the rule "`unsupported` gets `annotate` only when its value is truthy, not merely when the key is present" — that reading is inferable but not written, so Generator and Tester can each guess differently (record on mere presence vs. record only when `true`), and neither implementation would be clearly wrong per the text as written. Needs one sentence: "`annotate` is recorded in `unsupported` iff its value is `true`; a present-but-false or absent key never adds it."

2. **[AC5/AC12, BLOCKING]** The precedence rule for exit codes (2 on abort, else 1 on any failed job, else 0) is now resolved, but the exact CLI *output* on the abort path is not. AC12 says "The CLI prints failed jobs' keys and reasons to stderr before the summary line" as a general rule; AC5 separately says the abort path "exits 2 printing `openscad not found: install OpenSCAD 2024+ …`". It is unstated whether, on abort, the CLI prints (a) only AC5's install-guidance line, (b) AC12's per-job `key: reason` line followed by AC5's guidance line, or (c) both plus a final summary line whose counts must somehow account for jobs never reached (there is no "not-run" status in the manifest enum, only `rendered|cached|hand-exported|skipped|failed`). A Tester asserting exact stderr content or a summary line's presence on the abort path cannot derive the expected output from the current text alone.

3. **[general/AC3, MINOR]** The now-precise `-D` serialisation rule and argv order (`-D explode=1` emitted first, then one `-D` pair per `parameters` entry) leaves an edge case unaddressed: what happens if a job's `parameters` object itself contains a key literally named `explode`? The spec doesn't forbid this at load time (it's not in the `parameters`-rejection list), so a job could legally emit `-D explode=1` twice with two different values back-to-back. OpenSCAD's own "last `-D` wins" semantics make this non-fatal in practice, but the spec is silent on whether this collision should instead be rejected at load (analogous to the other `parameters` restrictions) — worth one clarifying sentence either way so Generator/Tester don't diverge on whether to guard against it.

## Iteration 2 — Verdict

revise

## Iteration 3 — Concerns

1. **[AC1/AC3, BLOCKING]** Iteration-2 concern 3 (the `explode`/`annotate` key collision) is now rejected at load, but the fix introduces a new field-value contradiction: "A `parameters` key named `explode` or `annotate` is rejected at load (`PlanError`, `field="parameters.explode"`)" pins the literal string `"parameters.explode"` even when the offending key is `annotate` — inconsistent with AC1's own pattern for the sibling validation two clauses earlier, `field="parameters.<name>"` (name-substituted). A Generator following the `parameters.<name>` pattern would emit `field="parameters.annotate"` for an `annotate`-keyed job; a Generator reading the closed-sets sentence literally would emit `field="parameters.explode"` regardless of which key triggered it. Both readings are defensible from the text as written, so Tester and Generator can diverge on an attribute assertion. One clause fixing whether the field name is name-substituted (matching the sibling rule) or hardcoded (and why) would close this.

## Iteration 3 — Verdict

revise

## Iteration 4 — Verdict

pass
