# Spec Critique — task_007 (cycle 1)

## Concerns

1. **[BLOCKING, AC1/AC10]** Ownership header omits files the ACs require editing.
   AC1 says media-plan's `buildMediaPlan` is "exported from index.ts"; AC10 requires
   `docsandeye encode` to exist, which means a new `case 'encode'` + USAGE line in
   `packages/cli/src/bin.ts`. Neither `packages/core/src/index.ts` nor
   `packages/cli/src/bin.ts` appears anywhere in the Layout section (owns-list or
   tree). Unlike task_002/task_004 (which owned `render/**` / `packages/cli/**`
   wholesale), task_007's grant is file-scoped and silently excludes two files the
   spec itself requires touching. Generator has no authorization to make AC1/AC10
   pass as written.

2. **[BLOCKING, AC6/AC8]** Same gap for `render/docsandeye_render/__main__.py`: the
   Layout *tree* describes adding an `encode` subcommand and an `ffmpeg:` doctor
   line, but the parenthetical "owns" list at the top of Layout never names
   `__main__.py`. Needs adding to the owns-list explicitly (and likewise
   `packages/cli/src/render.ts` if `spawnPython`, currently unexported, is to be
   shared rather than duplicated for `encode.ts`).

3. **[BLOCKING, poster rule / AC1 / AC4]** The normative media-plan job schema (line
   26-33) carries no field for the manifest's authored `poster` path — only
   `source`, `captions`, `duration_s`, `renditions`, `outputs`. But the poster
   prose (line 35) requires the Python pipeline to decide between "generate from
   clip" (authored poster missing), "convert" (authored poster present, not
   webp/avif) and "copy" (authored poster already webp/avif) — decisions that need
   the authored poster's path, which core never puts in the plan. Confirmed against
   the real `aep-like` fixture: `vid-005`/`vid-003` manifests declare `poster:
   assets/video/*.jpg` but no such files exist on disk, and the media-plan JSON
   shown has nowhere to carry that path. AC4 (the only argv-checking AC) only ever
   exercises the generate-from-clip branch — convert/copy are unimplementable as
   specified and untested by any AC.

4. **[BLOCKING, AC3]** "`FfmpegDriver` satisfies the existing `Driver` protocol
   shape where applicable" is not a testable statement. `Driver` is
   `@runtime_checkable` with a `render(job, project_root, out_dir)` method; the
   spec's own contract names the method `encode(job, project_root, out_dir)` over a
   structurally different job (media job, not `plan.Job`). `isinstance(FfmpegDriver(),
   Driver)` is therefore `False`, not "shape-compatible where applicable" — there's
   no concrete assertion for a Tester to write. Either drop the protocol-compat
   claim or state precisely which members must line up (name/available/version) and
   which don't.

5. **[BLOCKING, manifest schema / AC4]** The manifest example (line 40-42) for a
   720p-source job shows `outputs` containing only `av1_720`/`h264_720`/`poster`/
   `captions` — the `av1_1080`/`h264_1080` keys are dropped, not nulled — but this
   is only inferable by diffing against the plan's example; no prose states it.
   State explicitly: "skipped renditions' keys are omitted from `outputs`, not
   present with null/empty values."

## Minor

6. `source_stat`'s shape (field names, mtime precision) is never shown — only
   named in prose (line 45), not in either JSON example. Behaviourally testable
   (AC7/AC9 don't need to inspect it directly) but under-specified for anyone
   auditing the manifest format.

7. AC10's "refuses an invalid project like `render` does (exit 1, no spawn)" is
   ambiguous: `bin.ts`'s `render` case returns `EXIT.NOINPUT` (66) when no project
   is found, and `EXIT.PROBLEMS` (1) only for a found-but-invalid project's content
   problems. Say which scenario the fixture exercises.

8. AC11's `.gitignore` edit targets the repo-root file, which is unowned by any
   task and a likely multi-worktree collision point; call out that it's an
   additive two-line change to reduce merge friction.

9. AC4 states the 1080p job's call sequence ends "... AV1 1080, H.264 1080, then
   the poster call" but for the 720p job says only "logs only the 720 pair" —
   doesn't say whether a poster (and captions) step still runs for that job. Spell
   out the full expected call list for both fixture jobs.

## Verdict

**revise**

## Iteration 2 — Concerns

Checked against iteration-1 items 1-9 (blocking 1-5, minor 6-9):

1-2. **Resolved.** Ownership now lists `packages/core/src/index.ts`, `packages/cli/src/bin.ts`,
   `render/docsandeye_render/__main__.py`, and `packages/cli/src/render.ts` explicitly under
   "Edit (additively)", each with what changes.
3. **Resolved.** `poster_source` is now a plan field (shown in the JSON example and named in
   AC1); all three poster modes have coverage — convert (job A default), generate (job B
   default), copy (AC5, via a test-time renamed copy of the committed `.jpg` fixture — no
   separate checked-in `.webp` fixture is needed or claimed).
4. **Resolved.** `EncoderDriver` is now a distinct, fully-named `Protocol` (name/available/
   version/probe/encode); AC3 states plainly `FfmpegDriver` is NOT a `Driver`, removing the
   unfalsifiable "shape-compatible where applicable" claim.
5. **Resolved.** Pipeline rules state omitted (not null) keys for skipped renditions explicitly;
   AC4 confirms for job B ("no `av1_1080`/`h264_1080` keys").
6-9. **Resolved.** `source_stat` shown in prose and JSON; AC10 spells out both the
   found-but-invalid (exit 1) and no-project (exit 66) cases; `.gitignore` change is called out
   as additive two lines with the exact lines given; AC4 now gives the full, ordered
   invocation list for both fixture jobs (6 and 4 calls respectively), including whether
   poster/captions run.

### New

10. **[BLOCKING]** AC4's two poster-call argv excerpts drop the leading `-y` that the normative
    Pipeline-rules lines require: poster convert is normatively `ffmpeg -y -i <poster_source>
    -c:v libwebp -quality 80 <out>` but AC4 writes `-i <abs vid-a.jpg> -c:v libwebp -quality 80
    <out>`; poster generate is normatively `ffmpeg -y -ss 1 -i <source> …` but AC4 writes `-ss 1
    -i <abs vid-b-720.mp4> …`. AC4 also asserts "each argv exactly as the normative lines" —
    self-contradictory with its own examples for exactly the two calls where the argv isn't
    otherwise obvious. A Tester copying the parenthetical literally will fail the "-y before -i
    consistently" property that the AV1/H.264 calls do observe. Fix: add `-y` into both
    parentheticals, or delete them and rely solely on "exactly as the normative lines."

## Iteration 2 — Verdict

**revise**

## Iteration 3 — Verdict

**pass**
