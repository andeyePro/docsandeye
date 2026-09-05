---
title: Staleness
description: How a changed component marks a photo or video stale, what the page and the video player show, and the reshoot dashboard.
---

Every media manifest pins the components it shows at a version. At build time the staleness engine compares each pin against the component's current `design_version`.

## Statuses

| Status | Condition | On the page |
| --- | --- | --- |
| `FRESH` | Every pin matches the current version. | The media shows in place. |
| `CHANGED_IN_FRAME` | No hero pin differs, but an `in_frame` pin does. | The media shows in place with a note naming what changed. |
| `STALE` | Any hero pin differs. | The media is folded into a panel headed "A photo exists for this step, but Lamp base has changed since it was taken (v1.0.0 → v1.1.0)". A video reads "filmed" instead of "taken". The panel lists the component's changelog entries between the two versions. Opening it reveals the media. |

Text and renders are never stale. They are the primary content whenever media steps back. Within a step, STALE media sits below the renders and the media that is still in flow.

## Stale video

A video carries its staleness into the player.

A `CHANGED_IN_FRAME` video plays in place. Under it sits the note naming what changed: "Lamp base also appears in this video and has changed since it was filmed (v1.1.0 → v1.2.0)." The note is written by the build, so it is there with JavaScript off.

A `STALE` video is demoted. The step page shows the folded panel, its summary reading "A video exists for this step, but Lamp arm has changed since it was filmed (v1.0.0 → v1.1.0)", then the changelog entries between the two versions, then a `Watch the older video` button. The player itself is hidden until the button is pressed. Pressing it reveals the player and removes the button; nothing plays until the reader presses play. With JavaScript off the button does nothing, and a plain download link below the panel keeps the clip reachable.

Any video that is not `FRESH` also carries a version banner: "Recorded with Lamp arm v1.0.0, current is v1.1.0". It names the first changed hero for a `STALE` clip and the first changed in-frame component for a `CHANGED_IN_FRAME` one. The banner appears when the player upgrades and stays visible for the whole of playback.

## Example

`lamp-base` is at `design_version: 1.1.0`. The photo of the printed parts was shot at `lamp-base@1.0.0`, so it is `STALE`. Its panel shows the 1.1.0 changelog entry: "Cable slot widened to 8 mm so a moulded plug passes through." The photo of the LED module has `lamp-base@1.0.0` in frame only, so it is `CHANGED_IN_FRAME` and shows a note. See [step 1](/example/step-01-print-the-parts/) and [step 3](/example/step-03-fit-the-led-module/) of the example guide.

## Sidebar badges

The sidebar marks each step:

- `stale media` when any of the step's media is `STALE`;
- `updated` when a component the step uses has a changelog entry dated within 30 days of the build date.

The build date defaults to today. Set `DOCSANDEYE_BUILD_DATE=2026-09-04` to fix it.

## Reshoot dashboard

Build with `DOCSANDEYE_MAINTAINER=1` and the site gains `/reshoot/`: one row per component that appears in any media, sorted by the number of stale hero shots, with every appearance and its role. It answers "what do I need to film again, and why".

## Rules

- A pin newer than the component's current version is a validation error, `future-pin`.
- A pin naming an unknown component is an error, `unknown-component`.
- Versions compare as semver. `1.0.0` and `1.1.0` differ; the engine does not treat patch bumps specially.
