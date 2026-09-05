---
title: Media
description: Photo and video manifests, hero and in-frame pins, encoding, playback and hosting.
---

A media manifest is one YAML file under `docs/media/`. The file name is the media id. It describes one committed photo or video and pins the component versions it shows.

## Photo

```yaml
id: photo-01-printed-parts
type: photo
file: assets/photo/photo-01-printed-parts.png
shot_date: 2026-03-15
shot_by: "Docs&I example"
hero: [lamp-base@1.0.0]
in_frame: [lamp-arm@1.0.0, lamp-shade@1.0.0]
licence: CC-BY-SA-4.0
```

## Video

```yaml
id: vid-02-fit-the-arm
type: video
file: assets/video/vid-02-fit-the-arm.mp4
poster: assets/video/vid-02-fit-the-arm.png
captions: assets/video/vid-02-fit-the-arm.vtt
duration_s: 42
shot_date: 2026-05-20
shot_by: "Docs&I example"
hero: [lamp-arm@1.0.0]
in_frame: [lamp-base@1.1.0]
licence: CC-BY-SA-4.0
```

## Fields

| Field | Required | Meaning |
| --- | --- | --- |
| `id` | yes | Kebab-case identifier. Must equal the file name without `.yaml`. |
| `type` | yes | `photo` or `video`. |
| `file` | yes | Project-relative path of the photo or the video file. |
| `poster` | video only | Project-relative path of the poster image. Required for video, not allowed for photo. |
| `captions` | video only | Path of a WebVTT file. Not allowed for photo. |
| `duration_s` | video only | Length in seconds, greater than 0. Required for video, not allowed for photo. |
| `shot_date` | yes | `YYYY-MM-DD`. |
| `shot_by` | yes | Credit. May be empty. |
| `hero` | yes | List of pins, at least one. The components the shot is about. |
| `in_frame` | no | List of pins. Components visible but not the subject. |
| `narration_source` | no | Path of the narration script or transcript. |
| `licence` | no | SPDX identifier or free text. |

A pin is `component-id@version`, for example `lamp-base@1.0.0`. The component must exist and the version must not be newer than its current `design_version`.

## Hero and in frame

The pins drive [staleness](/staleness/). A changed hero makes the media stale: the page folds it away behind a summary of what changed. A changed in-frame component only adds a note under the media. Tag generously in `in_frame` and precisely in `hero`.

## Video encoding

`docsandeye encode` turns every `type: video` manifest into a set of outputs under `build/media/`, and records them in `build/media/manifest.json`. One job per manifest, keyed by the media id.

The names below are for the manifest `id: vid-02-fit-the-arm`.

| Output | File | Made by |
| --- | --- | --- |
| `av1_720`, `av1_1080` | `vid-02-fit-the-arm-720.webm`, `vid-02-fit-the-arm-1080.webm` | SVT-AV1 preset 6, CRF 28, 10-bit, Opus 96 kbps |
| `h264_720`, `h264_1080` | `vid-02-fit-the-arm-720.mp4`, `vid-02-fit-the-arm-1080.mp4` | x264 preset slow, CRF 20, 8-bit, AAC 128 kbps |
| `poster` | `vid-02-fit-the-arm.webp` | Copied, converted or generated (below) |
| `captions` | The `captions` file name, unchanged | Copied verbatim |

Both video codecs are written with `+faststart`. The parameters are fixed and not configurable.

A rendition taller than the source is skipped, not upscaled. A 720-high source produces the 720 pair only, and the manifest records `1080` under `skipped_renditions`.

The poster is made one of three ways. A `poster` file that is already `.webp` or `.avif` is copied byte for byte. Any other authored poster is converted to WebP at quality 80. If the file named by `poster` is not on disk, the encoder grabs the frame one second in and scales it to 720 high. The manifest records which happened as `poster_mode`.

Encoding needs ffmpeg 7 or later built with `libsvtav1`, `libx264`, `libopus` and `libwebp`. `python3 -m docsandeye_render doctor` reports whether it is installed. Jobs are cached on the source file's size and modification time, so an unchanged clip is not re-encoded.

## Playback

A step page renders each video as a `<docsi-video>` element wrapping a plain `<video preload="none">`. No video bytes are fetched until the reader presses play, so a video does not count toward the step page's [byte budget](/carbon/). The poster does.

The server writes the whole element: the poster, the lowest offered rendition as an AV1 `<source>` followed by an H.264 `<source>`, a captions `<track>` when the manifest has one, and a `<noscript>` download link. A video shown in flow is therefore legible and playable with JavaScript off. A [stale](/staleness/) one is gated behind a button, and the download link is the fallback.

With JavaScript on, the element upgrades in place. It switches both sources to the 1080 pair when 1080 is offered and the viewport is at least 1280 physical pixels wide (CSS pixels times device pixel ratio). It stays on the lowest rendition when the reader asked for less data: `Save-Data`, an `effectiveType` of `slow-2g`, `2g` or `3g`, or `prefers-reduced-data: reduce`. The swap happens before playback starts and, with `preload="none"`, fetches nothing.

A video whose job is missing from `build/media/manifest.json`, or whose job offers no complete rendition pair, degrades: the page serves the authored poster and the original `file` as a single source. Everything else on the page is unchanged. A project that has never run `encode` still builds and still plays.

## Hosting

`docsandeye.config.yaml` says where media files are served from. Three providers ship:

```yaml
hosting:
  provider: local
```

`local` is the default. The build copies every media file, poster and encoded output into the built site under `/_docsandeye/media/`, by file name.

```yaml
hosting:
  provider: url-prefix
  base: https://media.example.org/lamp
```

`url-prefix` copies nothing into the site. Each path is joined to `hosting.base` as written in the project, so `build/media/vid-02-fit-the-arm-720.webm` becomes `https://media.example.org/lamp/build/media/vid-02-fit-the-arm-720.webm`. Upload `build/media/` and `assets/` keeping their paths.

```yaml
hosting:
  provider: r2
  base: https://media.example.org/
```

`r2` is a Cloudflare R2 bucket behind a public domain. It resolves exactly as `url-prefix` does; the name records where the bytes live. Trailing slashes on `base` are collapsed.

`base` is required for `url-prefix` and `r2`. A config that omits it is a validation error. Other providers plug in through core's hosting registry, `registerHostingProvider`.

## Denylist

Paths matching a `denylist` glob in `docsandeye.config.yaml` are never read. `private-notes/**`, `.claude/**`, `.vibe/**`, `.git/**` and `node_modules/**` are always denied.
