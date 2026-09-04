---
title: Media
description: Photo and video manifests, hero and in-frame pins, posters and hosting.
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

## Posters and playback

This release shows a video as its poster only. Playback, AV1 and H.264 encoding and captions arrive in the next release. Keep posters small; the poster counts toward the step page's [byte budget](/carbon/).

## Hosting

`docsandeye.config.yaml` says where media files are served from:

```yaml
hosting:
  provider: local
```

`local` copies every media file and poster into the built site under `/_docsandeye/media/`. `url-prefix` leaves the files out of the site and prefixes each `file` and `poster` path with `hosting.base`:

```yaml
hosting:
  provider: url-prefix
  base: https://media.example.org/lamp
```

Other providers plug in through core's hosting registry.

## Denylist

Paths matching a `denylist` glob in `docsandeye.config.yaml` are never read. `private-notes/**`, `.claude/**`, `.vibe/**`, `.git/**` and `node_modules/**` are always denied.
