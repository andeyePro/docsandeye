# task_007 — v0.2 video encoding: `docsandeye_render encode` and `docsandeye encode`

## Task summary

Add the video encoding stage of v0.2. Given the project's media manifests (type `video`), the Python pipeline encodes each source clip twice (AV1 with SVT-AV1 in WebM/Opus, then H.264 in MP4/AAC) at two renditions (720p and 1080p), produces a WebP poster (converted from the authored poster, or generated from the clip when the authored file is missing), copies the WebVTT captions, and records everything in `build/media/manifest.json`; the CLI gains `docsandeye encode` to drive it. ffmpeg is the only encoder, behind an encoder seam parallel to the render pipeline's driver seam, so the whole stage is fixture-tested with a fake `ffmpeg`/`ffprobe` (ffmpeg is absent in the build container; real-toolchain verification happens on a Mac). Encoded outputs are never committed (CONTRIBUTING forbids rendered video); the stage writes them under `build/media/` and the plugin (task_008) copies them into `dist/` or a hosting provider serves them.

Decisions already made (Martin, 2026-09-04): AV1 first with H.264 fallback; 720p and 1080p only, no HLS/DASH; posters as WebP or AVIF, never JPEG; `preload="none"` facade; carbon measured, not asserted; Whisper is out of scope for v0.x (captions are authored). Codec parameters come from the research briefing: SVT-AV1 preset 6, CRF 28, `yuv420p10le`, Opus 96 kbps; x264 preset slow, CRF 20, `yuv420p`, AAC 128 kbps; `+faststart`.

## Ownership (exhaustive list of files this task may create or edit)

Create: `packages/core/src/media-plan.ts`; `render/docsandeye_render/media_plan.py`, `render/docsandeye_render/encode.py`, `render/docsandeye_render/drivers/ffmpeg.py`; `render/fixtures/media/**` (plan, sources as tiny placeholder files, an authored `.jpg` poster placeholder, a `.vtt`, `fake-bin/ffmpeg`, `fake-bin/ffprobe`); `packages/cli/src/encode.ts`.
Edit (additively): `packages/core/src/index.ts` (export the new module); `render/docsandeye_render/drivers/base.py` (add the `EncoderDriver` protocol beside `Driver`; do not change `Driver`); `render/docsandeye_render/__main__.py` (add the `encode` subcommand and the `ffmpeg:` doctor line); `packages/cli/src/bin.ts` (add the `encode` case and usage line); `packages/cli/src/render.ts` (export the existing Python-spawning helper so `encode.ts` reuses it — no behaviour change); root `.gitignore` (append exactly two lines: `build/media/` and `*.webm`).
Tester-owned: `render/tests/test_encode*.py`, `packages/core/test/media-plan.test.ts`, `packages/cli/test/encode.test.ts`. Nothing else.

## Media plan (normative; core emits `build/media-plan.json`, Python consumes)

```json
{"version": 1, "project_root": ".", "jobs": [
  {"key": "vid-005-electrode-seating", "media": "vid-005-electrode-seating",
   "source": "assets/video/vid-005-electrode-seating.mp4",
   "poster_source": "assets/video/vid-005-electrode-seating.jpg",
   "captions": "assets/video/vid-005-electrode-seating.en.vtt",
   "duration_s": 47, "renditions": [720, 1080],
   "outputs": {"av1_720": "build/media/vid-005-electrode-seating-720.webm", "h264_720": "build/media/vid-005-electrode-seating-720.mp4",
               "av1_1080": "build/media/vid-005-electrode-seating-1080.webm", "h264_1080": "build/media/vid-005-electrode-seating-1080.mp4",
               "poster": "build/media/vid-005-electrode-seating.webp", "captions": "build/media/vid-005-electrode-seating.en.vtt"}}]}
```

`poster_source` is always present (core's schema requires a video's `poster`). `captions` and `outputs.captions` are present only when the manifest has captions. `renditions` is always `[720, 1080]`; the pipeline decides skips. Jobs are sorted by `key`.

## Pipeline rules (normative)

- Probe first: `ffprobe -v error -print_format json -show_streams -show_format <abs source>`; parse the first video stream's `width`/`height` and `format.duration`.
- Renditions taller than the source height are skipped: their `outputs` keys are OMITTED from the manifest entry (never present with null) and listed in `skipped_renditions`.
- AV1 per kept rendition h: `ffmpeg -y -i <abs source> -vf scale=-2:<h> -c:v libsvtav1 -preset 6 -crf 28 -pix_fmt yuv420p10le -c:a libopus -b:a 96k -movflags +faststart <abs out .webm>`.
- H.264 per kept rendition h: `ffmpeg -y -i <abs source> -vf scale=-2:<h> -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart <abs out .mp4>`.
- Order per job: probe, then for h in [720, 1080] the AV1 call then the H.264 call, then the poster step, then captions.
- Poster step: if `<project_root>/<poster_source>` exists and its extension is `.webp` or `.avif` → copy bytes to `outputs.poster` (no ffmpeg call; the output keeps the `.webp` name from the plan even for `.avif` input — record `poster_mode: copy`); exists with any other extension → `ffmpeg -y -i <abs poster_source> -c:v libwebp -quality 80 <abs out .webp>` (`poster_mode: convert`); missing → `ffmpeg -y -ss 1 -i <abs source> -frames:v 1 -vf scale=-2:720 -c:v libwebp -quality 80 <abs out .webp>` (`poster_mode: generate`).
- Captions: copy `<project_root>/<captions>` byte-for-byte to `outputs.captions` (no ffmpeg call).
- Cache: `source_stat = {"size": <int bytes>, "mtime_ns": <int>}` of the source file is recorded; a job is `cached` when its key is in the manifest with status `encoded|cached`, `source_stat` is unchanged, and every recorded output path exists; `--force` re-encodes everything.
- Failures: a non-zero ffmpeg exit marks the job `failed` with the stderr text as `reason`; the run continues. `DriverUnavailable` (no ffmpeg on PATH) aborts the run unless `--allow-missing`, exactly as the render command does.

## Media manifest output (`build/media/manifest.json`, normative)

```json
{"version": 1, "jobs": {"vid-005-electrode-seating": {"status": "encoded|cached|skipped|failed", "driver": "ffmpeg",
  "outputs": {"av1_720": "…", "h264_720": "…", "poster": "…", "captions": "…"}, "skipped_renditions": [1080],
  "poster_mode": "copy|convert|generate", "source_stat": {"size": 12345, "mtime_ns": 1725450000000000000},
  "source_probe": {"width": 1280, "height": 720, "duration_s": 47.0}, "encoded_at": "…", "reason": "only for skipped/failed"}}}
```

Sorted keys, 2-space indent, trailing newline.

## Fixtures (`render/fixtures/media/`, Generator-owned)

`media-plan.json` with two jobs: job A `vid-a` — source `src/vid-a.mp4` (a 100-byte placeholder), `poster_source` `src/vid-a.jpg` (placeholder present), captions `src/vid-a.en.vtt` (a valid 3-cue WebVTT), probe answers 1920×1080; job B `vid-b-720` — source `src/vid-b-720.mp4` (placeholder), `poster_source` `src/vid-b-720.jpg` (file deliberately absent), no captions, probe answers 1280×720. `fake-bin/ffprobe` prints `{"streams":[{"codec_type":"video","width":1920,"height":1080}],"format":{"duration":"47.000000"}}`, or the 1280×720 variant when the last argument contains `720`. `fake-bin/ffmpeg`: `-version` → prints `ffmpeg version 7.1.1` to stdout, exit 0; otherwise appends one JSON line `{"argv": [...all args after the program name...], "cwd": "<cwd>"}` to `$DOCSI_FAKE_FFMPEG_LOG`, creates the file named by the LAST argument (always the output path in every ffmpeg invocation above) with content `fake-ffmpeg-output`, exits 0; with `$DOCSI_FAKE_FFMPEG_FAIL` set it prints `fake failure` to stderr and exits 1. Both committed mode 100755 and `chmod 0o755` in test setUp.

## Acceptance criteria

1. **Core media plan.** `buildMediaPlan(model)` (exported from `@docsandeye/core`) returns the schema above for every `type: video` manifest, sorted by key, with `poster_source` from the manifest's `poster`, `captions` only when present; photos produce no job; a test recomputes one job by hand from the `aep-like` fixture.
2. **Plan loading (Python).** `media_plan.load(path)` validates version 1 and raises `PlanError` (the existing class) with `index`/`field` for a missing `source` or `poster_source`, an unknown `outputs` key, a rendition not in `{720, 1080}`, and `captions` present without `outputs.captions` (or vice versa).
3. **Encoder seam.** `drivers/base.py` gains `EncoderDriver` (a `typing.Protocol`, `@runtime_checkable`) with `name: str`, `available() -> bool`, `version() -> str | None`, `probe(source: Path) -> Probe`, `encode(job, project_root: Path, out_dir: Path) -> EncodeResult`; `FfmpegDriver` satisfies it (`isinstance(FfmpegDriver(), EncoderDriver)` is True) and is NOT a `Driver`; `encode.run(plan, out_dir, driver=…, force=False, allow_missing=False)` accepts an injected fake.
4. **Exact call list.** With the fixture `fake-bin` first on `PATH` and `DOCSI_FAKE_FFMPEG_LOG` set, running the fixture plan logs, in order, for job A: ffprobe(A), AV1 720, H.264 720, AV1 1080, H.264 1080, poster convert (`ffmpeg -y -i <abs vid-a.jpg> -c:v libwebp -quality 80 <abs out .webp>`) — six process invocations, each argv exactly as the normative lines with absolute paths — and copies the `.vtt` byte-for-byte; for job B: ffprobe(B), AV1 720, H.264 720, poster generate (`ffmpeg -y -ss 1 -i <abs vid-b-720.mp4> -frames:v 1 -vf scale=-2:720 -c:v libwebp -quality 80 <abs out .webp>`) — four invocations; B's manifest entry has `skipped_renditions: [1080]`, no `av1_1080`/`h264_1080` keys, no `captions` key, `poster_mode: generate`; A's has `poster_mode: convert` and all six output keys.
5. **Poster copy branch.** A test that points job A's `poster_source` at a `.webp` placeholder (temp copy of the fixture) gets `poster_mode: copy`, no ffmpeg poster call, and identical bytes in `outputs.poster`.
6. **Missing tool.** With no `ffmpeg` on PATH and `allow_missing=False`: the first job raises `DriverUnavailable`, the manifest is written with the jobs processed so far (that job `failed`, `reason: "ffmpeg not found"`), the CLI prints `<key>: ffmpeg not found` then `ffmpeg not found: install ffmpeg 7+ with libsvtav1, libx264, libopus, libwebp` to stderr, no summary, exit 2; with `--allow-missing`, jobs are `skipped` with that reason and the run continues (exit per AC8). `ffprobe` missing is handled identically with `ffprobe not found`.
7. **Cache.** A second run over the same plan encodes nothing (all `cached`, no ffmpeg calls); changing the source's size or mtime, or deleting any recorded output, re-encodes that job only; `--force` re-encodes everything.
8. **Exit codes and summary.** `python3 -m docsandeye_render encode --plan <file> --out <dir> [--force] [--allow-missing] [--project-root <dir>]` prints `encoded N, cached N, skipped N, failed N` to stdout and exits 2 on abort, 1 if any job is `failed`, else 0 (the render command's matrix); `doctor` prints `ffmpeg: found 7.1.1` with the fake or `ffmpeg: not found`, after the existing lines.
9. **Determinism.** `manifest.json` differs between two consecutive runs only in `encoded_at` values.
10. **CLI `encode`.** `docsandeye encode [--project <root>] [--force] [--allow-missing]` writes `<root>/build/media-plan.json` = `canonicalJson(buildMediaPlan(model)) + "\n"`, spawns `python3` with argv `['-m','docsandeye_render','encode','--plan','build/media-plan.json','--out','build/media','--project-root','.']` plus `--force`/`--allow-missing` in that order when given, `cwd = <root>`, and the same `PYTHONPATH` rule as `render` (the shared helper); propagates the child's exit code; with a found-but-invalid project (a `loadProject` problem) prints the problems and exits 1 without writing the plan or spawning; with no project found exits 66 like `render`; with no `python3` on PATH exits 2 with `python3 not found: install Python 3.11+`. `docsandeye --help` lists `encode`.
11. **No committed video.** Root `.gitignore` gains the two lines `build/media/` and `*.webm`; every file under `render/fixtures/media/` is under 1 KB except the `.vtt` (under 2 KB).
12. **Tests.** `python3 -m unittest discover -s render/tests -t render` passes with no real ffmpeg (at most two `skipUnless(shutil.which("ffmpeg"))` tests); `npx vitest run packages/core packages/cli` passes; the pre-existing render suites are unchanged and green.

## Out of scope

- The `<docsi-video>` element, stale-video UX, banners (task_008). Hosting providers beyond the existing seam. Whisper. Resolution ladders beyond 720/1080, HLS/DASH. Audio normalisation. Any behaviour change to the existing render pipeline or the `render` CLI command.
- Do not edit `README.md`, `TODO.md`, `CHANGELOG.md`, `.vs/tasks.json`, `.vs/progress.md`, or any file outside the Ownership list.

## Test location

`render/tests/test_encode*.py` (unittest), `packages/core/test/media-plan.test.ts`, `packages/cli/test/encode.test.ts` (vitest). Generator scratch tests under `.vs/cycle-1/scratch-tests/`.

## Proposed budget

3 cycles.

## Model plan

- Generator: **opus**, ceiling fable (Martin, 2026-09-05: Fable only where it brings a clear benefit over Opus — this task is wiring over settled seams, so Opus). Spec Critic: sonnet. Tester: haiku, ceiling sonnet.
