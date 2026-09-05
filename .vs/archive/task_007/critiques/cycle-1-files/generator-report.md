# task_007 cycle 1 — Generator report

Branch `vsss/task_007-encode`, worktree `/workspace/.claude/worktrees/task_007`.

## Commits

| SHA | Package | Subject |
| --- | --- | --- |
| `d0df130` | core | `feat(core): buildMediaPlan emits build/media-plan.json for video manifests` |
| `6417952` | render | `feat(render): encode stage — EncoderDriver seam, ffmpeg driver, media manifest` |
| `cb8bc88` | cli | `feat(cli): docsandeye encode drives the Python video encode pipeline` |

Files created: `packages/core/src/media-plan.ts`, `render/docsandeye_render/media_plan.py`,
`render/docsandeye_render/encode.py`, `render/docsandeye_render/drivers/ffmpeg.py`,
`render/fixtures/media/**`, `packages/cli/src/encode.ts`.
Files edited additively: `packages/core/src/index.ts`, `render/docsandeye_render/drivers/base.py`,
`render/docsandeye_render/__main__.py`, `packages/cli/src/bin.ts`, `packages/cli/src/render.ts`,
root `.gitignore` (exactly two added lines). Nothing outside the Ownership list;
`package-lock.json` unchanged by `npm install`.

## Commands and final output lines

```
$ python3 -m unittest discover -s render/tests -t render
Ran 126 tests in 0.118s
OK (skipped=1)

$ npx vitest run packages/core packages/cli
Test Files  10 passed (10)
     Tests  220 passed (220)

$ PYTHONPATH=render python3 -m unittest discover -s .vs/cycle-1/scratch-tests \
      -t .vs/cycle-1/scratch-tests -p "test_*.py"
Ran 34 tests in 2.632s
OK

$ npx vitest run --config .vs/cycle-1/scratch-tests/vitest.config.ts
Test Files  1 passed (1)
     Tests  13 passed (13)

$ npm run typecheck            # packages/core
$ npm run typecheck --workspace docsandeye
(both clean, no output)

$ PATH=render/fixtures/media/fake-bin:$PATH PYTHONPATH=render python3 -m docsandeye_render \
      encode --plan render/fixtures/media/media-plan.json --out <tmp> \
      --project-root render/fixtures/media
encoded 2, cached 0, skipped 0, failed 0
exit=0

$ PATH=render/fixtures/media/fake-bin:$PATH PYTHONPATH=render python3 -m docsandeye_render doctor
openscad: not found
cadquery: not found
ffmpeg: found 7.1.1
```

## AC mapping

| AC | Where implemented | Scratch test(s) |
| --- | --- | --- |
| 1 Core media plan | `packages/core/src/media-plan.ts` (`buildMediaPlan`, exported from `index.ts` with `MEDIA_PLAN_VERSION`, `MEDIA_OUTPUT_DIR`, `MEDIA_RENDITIONS`) | `media.scratch.test.ts` → `AC1: buildMediaPlan` (5 tests, including a by-hand recompute of `vid-005-electrode-seating` from `aep-like` and the no-captions `vid-003-cap-fitting` case) |
| 2 Plan loading | `render/docsandeye_render/media_plan.py` (`load`/`loads`, reuses `plan.PlanError`) | `TestPlanLoading` (8 tests: version, missing `source`, missing `poster_source`, unknown `outputs` key, rendition 480, captions↔outputs.captions both ways) |
| 3 Encoder seam | `drivers/base.py` (`Probe`, `EncodeResult`, `@runtime_checkable EncoderDriver`); `drivers/ffmpeg.py` (`FfmpegDriver`); `encode.run(..., driver=…)` | `TestEncoderSeam` (isinstance True for `EncoderDriver`, False for `Driver`), `TestInjectedDriver` (a `FakeEncoder` drives a whole run) |
| 4 Exact call list | `FfmpegDriver.encode` + `_scale_argv`/`_poster`; `media_plan.rendition_keys` fixes the AV1-then-H.264 order | `TestExactCallList.test_job_a_and_job_b_call_lists` asserts the full 10-entry ordered argv list (6 for A, 4 for B) byte-for-byte against the normative lines; plus captions byte-equality and the manifest-entry assertions (`skipped_renditions: [1080]`, absent 1080 keys, absent `captions`, poster modes, `source_probe`, `source_stat`) |
| 5 Poster copy | `FfmpegDriver._poster`, `COPY_POSTER_SUFFIXES = {.webp, .avif}` | `TestPosterCopy` — `.webp` and `.avif` both give `poster_mode: copy`, identical bytes, no ffmpeg call writing the poster |
| 6 Missing tool | `FfmpegDriver.encode` raises `DriverUnavailable("ffmpeg not found", hint=INSTALL_HINT)` before probing; `probe` raises `"ffprobe not found"`; `encode.run` aborts or skips; `__main__._report` prints the two lines | `TestMissingTool` (4 tests, including the exact two stderr lines and exit 2 through `main()`) |
| 7 Cache | `encode.source_stat`, `encode._cache_hit` (status ∈ {encoded, cached}, `source_stat` equal, every recorded output present) | `TestCache` (5 tests: all-cached second run with zero ffmpeg calls, mtime change, size change, deleted output, `--force`) |
| 8 Exit codes and summary | `EncodeRunResult.exit_code`/`.summary`; `__main__._encode` + shared `_report`; `_doctor` appends `FfmpegDriver` | `TestCliSurface` (6 tests: summary line, failed→1, bad plan→1, doctor found/not-found, doctor line order) |
| 9 Determinism | `cache.save` (sorted keys, 2-space indent, trailing newline) reused unchanged; only `encoded_at` is time-derived | `TestDeterminism.test_manifests_differ_only_in_encoded_at` |
| 10 CLI `encode` | `packages/cli/src/encode.ts` + `bin.ts` case + `render.ts` `export function spawnPython` | `media.scratch.test.ts` → `AC10: docsandeye encode` (8 tests: plan bytes, argv/cwd/PYTHONPATH, flag order, exit-code propagation, invalid project, 66, python3 missing, `--help`) |
| 11 No committed video | `.gitignore` +`build/media/` +`*.webm`; fixture sizes 930/864/689/225/100/100/92 bytes | verified by `find render/fixtures/media -type f -exec wc -c` (see below) |
| 12 Tests | all four suites above green; no `skipUnless` tests added | — |

Fixture sizes (AC11): `media-plan.json` 930, `fake-bin/ffmpeg` 864, `fake-bin/ffprobe` 689,
`src/vid-a.en.vtt` 225, `src/vid-a.mp4` 100, `src/vid-b-720.mp4` 100, `src/vid-a.jpg` 92.
Both fake binaries are committed mode `100755` (`git ls-files -s` confirms).

## Ambiguity choices

1. **Output paths come from `out_dir` + the plan's basename.** The spec gives both a plan
   `outputs` map (project-root-relative) and an `--out` directory. `MediaJob.output_path`
   takes the *file name* from the plan entry and joins it to `out_dir`, exactly as the
   render pipeline's `Job.output_path` does. In the CLI's normal case
   (`out_dir == <root>/build/media`) the two agree exactly; tests can point `--out`
   anywhere. Manifest `outputs` are recorded relative to the project root where possible
   (`encode._relative`, mirroring `runner._relative`), so the normal case records
   `build/media/vid-a-720.webm` — verified by
   `TestExactCallList.test_outputs_are_recorded_relative_to_the_project_root`.
2. **Missing plan `outputs` entries degrade rather than fail.** The spec enumerates four
   load-time errors and does not require every rendition key to be present. Rather than
   add unspecified strictness (which could reject a plan the Tester hand-builds) or risk a
   `KeyError` at encode time, `MediaJob.output_name` falls back to the canonical name
   (`<key>-<h>.webm` / `.mp4`, `<key>.webp`, the captions basename) when a key is absent.
   For plans core emits this is never exercised.
3. **`ffmpeg` availability is checked before probing.** AC6 wants "no ffmpeg on PATH" to
   report `ffmpeg not found`, but the probe runs first and would otherwise report
   `ffprobe not found`. `FfmpegDriver.encode` therefore checks `which(ffmpeg)` at the top;
   `probe` independently checks `which(ffprobe)`, so an ffmpeg-present/ffprobe-absent PATH
   still reports `ffprobe not found`. Both paths are tested.
4. **The fake `ffprobe` logs to `$DOCSI_FAKE_FFMPEG_LOG` too.** AC4's ordered list
   interleaves ffprobe and ffmpeg invocations in one log, so the ffprobe fixture appends the
   same `{"argv": …, "cwd": …}` line shape. The spec's fixture paragraph only describes its
   stdout; this is the only reading under which "six process invocations" is checkable.
5. **`failed`/`skipped` entries carry only what is known.** `poster_mode` and `source_probe`
   are omitted (not null) when the job never got that far; `reason` appears only when set,
   matching the spec's "only for skipped/failed" note. `source_stat` is recorded whenever the
   source file can be stat-ed.
6. **A cached entry is the previous entry re-stamped.** `outputs`, `skipped_renditions`,
   `poster_mode`, `source_probe`, `source_stat` and `encoded_at` are carried forward
   unchanged with `status: "cached"`, so a cache hit does not lose facts or churn timestamps.
7. **`__main__._render` now delegates to a shared `_report`.** Behaviour is byte-identical
   (the same two abort lines, the same failure lines, the same summary); the duplication was
   removed rather than copied. The existing `render/tests/test_cli.py` suite is green.
8. **Usage text.** The `bin.ts` exit-code line now reads `2 render/encode pipeline
   unavailable`. Nothing asserts the old wording (checked repo-wide).

## Unmet / notes for the Tester and Evaluator

- Nothing in the ACs is unmet.
- **No real-toolchain verification is possible here**: the container has no `ffmpeg`/`ffprobe`
  (and none was installed). Every encode path is exercised against the fixture fakes only.
  Real-toolchain confirmation on a Mac remains outstanding, as the spec anticipates.
- The fake `ffprobe` answers 720p when the *last argument* contains `720`. Job B's source is
  `src/vid-b-720.mp4`, so this holds wherever the fixture is copied — unless a temp directory
  name happens to contain `720` while a job-A path does not. The spec mandates this
  discriminator; tests that copy the fixture into `mkdtemp` inherit that (very small) risk.
- `.vs/cycle-1/scratch-tests/` holds the Generator's own tests plus a `vitest.config.ts`
  (root pinned to the repo, include pinned to `*.scratch.test.ts`). Run them with:
  `PYTHONPATH=render python3 -m unittest discover -s .vs/cycle-1/scratch-tests -t .vs/cycle-1/scratch-tests -p "test_*.py"`
  and `npx vitest run --config .vs/cycle-1/scratch-tests/vitest.config.ts`.
  They are gitignored (`.vs/cycle-*/`) and are not a substitute for the Tester's suites at
  `render/tests/test_encode*.py`, `packages/core/test/media-plan.test.ts`,
  `packages/cli/test/encode.test.ts` — none of which this agent created.
- `packages/cli` and `packages/core` must be built (`npm run build`) before the CLI suites
  run, as before.
