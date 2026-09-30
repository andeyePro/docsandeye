# task_025: a picture for every part (vendored models, renders, photo sheets)

Status: DRAFT spec for Martin's approval (written overnight 2026-09-30 by /vsss; not started).

Source: Martin, 2026-09-29 (chat, from the bath):
- "Docs&I needs a way to access Printables and other repo models for the rendering … I wonder if we're best pulling a copy into our repo? That way if the internet goes down anyone with a copy of our repo has everything they need to start from scratch."
- "OK with photos where the supplier genuinely doesn't provide CAD files. Need instructions on how to shoot these on a plain white sheet of paper so the background can be cleanly removed (ideally via an automatic service). We should minimise the number of photos as they take much more time to fix on every revision."
- "Are you producing PDF layout sheet(s) for printing? Otherwise this is more work not less."
- Camera kit: "A stack of books doesn't help with an overhead photo … I'd recommend a Manfrotto Magic Arm with phone clip at one end and Super Clamp at the other. A softbox set, light tent or ring flash and no natural light would give more consistent results." Ask what a maker already has first; if none, a light tent large enough for an A4 sheet.
- "Gerrit is Linux so all this needs to work on Linux as well as macOS."
- Goal behind it: "it would be really helpful to include [a render] for each part in the kit-checking list and the BoM, the latter including links."

## Outcome

Every row of a guide's parts count ("Count what you received"), every step's Parts list, and the components (BoM) page shows a small picture of the part, with a link to its source or supplier. Printed and CAD-available parts get automatic renders from files kept in the project repository; parts with no CAD get one photo each, shot on printed layout sheets, many parts per sheet, with the background removed automatically and offline. A part's picture is tied to its `design_version`, so a revision flags only the pictures that changed.

## Existing seams to build on (do not rebuild)

- Components: `master_format` `scad | step | f3z | none`, `source_files`, `derived_files`, `supplier {name, url}` (packages/core/src/schemas.ts).
- Render plan and cache keyed on component version and parameters (packages/core/src/render-plan.ts, `build/render/`), consumed by the Python pipeline in `render/` with drivers `openscad` and `cadquery` (STEP masters to STL/SVG/GLB; CadQuery is the optional `step` extra). STEP support therefore already exists; this task wires vendored files into it, it does not add FreeCAD.
- Staleness by `design_version` for media (packages/core/src/staleness.ts); reuse for photos.
- Lightbox for media images (`<docsi-lightbox>`).

## Part A: vendored model files (`docsandeye fetch`)

- Component schema gains optional `source: {url, licence, files?, retrieved?}`. `licence` is an SPDX id or `LicenseRef-printables-standard` (Printables' Standard Digital File License, which forbids redistribution).
- `docsandeye fetch [--project P] [component...]` downloads each `source.url` into `<project>/cad/vendor/<component-id>/` with a `PROVENANCE.yaml` (url, retrieved date, sha256 per file, licence, redistributable true/false). Printables model pages are resolved to their file downloads; where a download needs a login, the command says so and `docsandeye fetch --import <component> <file...>` files a manual download with the same provenance.
- Redistributable licences (allowlist: CC0-1.0, CC-BY-4.0, CC-BY-SA-4.0, CERN-OHL-*, GPL-*, MIT, Apache-2.0, BSD-*) are committed. Anything else goes to a gitignored `cad/vendor-private/` and `check` warns: "not redistributable: rendered and linked, not committed". The site links the source either way.
- A vendored STL/3MF/STEP becomes a render input: `master_format` gains `stl` and `3mf` (OpenSCAD `import()`), STEP stays on the CadQuery driver.
- Runs on Linux and macOS (Node and curl only; no browser automation).

## Part B: photo sheets for parts with no CAD

- `docsandeye photos sheets [--project P] [--guide G]` lists components needing a photo (no master, no vendored model, no current photo for this `design_version`) and writes `build/photos/sheets-<date>.pdf`: A4 portrait, printed at 100 %, one box per part sized from the component's `parameters` (`length_mm`, `od_mm`, …) with a minimum size, part id and name printed in the margin outside the box, four corner fiducials for de-skewing, a 50 mm scale bar, and a sheet number. Parts are packed to minimise the number of sheets.
- `docsandeye photos import [--project P] <photo...>` finds the sheet by its fiducials, straightens it, cuts each box, removes the background with rembg (open source, local, no upload), trims to the part, and writes `docs/photos/<component>@<version>.webp` (transparent background, max 480 px). The import reports which boxes were empty.
- Tools: Python 3 with `opencv-python-headless` and `rembg` as a `photos` extra of the existing `render/` package; the command checks for them and prints the install line for Linux and macOS.
- New docs page "Photographing parts": first use what you already have (a light tent, else softboxes, else a ring flash; if none, an A4-sized light tent), no daylight, matte white paper, phone held level overhead on a support (if none, a Manfrotto Magic Arm with a phone clip and a Super Clamp, long enough for the light tent), no flash on the phone, the scale bar in shot, one sheet per photo.

## Part C: pictures on the site

- Parts list rows, receipt rows and the components page show a 48 px thumbnail (render, else photo, else nothing, never a placeholder), lazy-loaded WebP, opening the full picture in the lightbox. Receipt rows keep their current layout on a 390 px screen.
- The components page links each part to its source (vendored model's `source.url`) and supplier.
- Byte budget: thumbnails count towards `byte_budget_kb`; a step page stays within it (the AEP budget is 200 KB).
- `check` warns per component in a guide with no picture, grouped as "needs a photo" or "needs a model".

## Acceptance criteria

1. Unit tests (core): `source` schema, licence classification, provenance hashing, photo staleness by version, sheet packing (every part fits its box; boxes never overlap; fewest sheets for the fixture).
2. `docsandeye fetch` on a fixture with a local HTTP server: a CC-BY file is committed with correct provenance; a Standard-licence file lands in `vendor-private/` and `check` warns.
3. `photos sheets` on the fixture produces a PDF whose boxes, labels and fiducials are where the layout file says (checked by parsing the PDF, not by eye).
4. `photos import` on a synthetic photo (the sheet rendered, perspective-warped, parts drawn in) recovers every part within 2 mm of its box and writes one WebP per part with a transparent background.
5. Site fixture: thumbnails on parts list, receipt and components page; axe clean light and dark; 390 px no overflow; byte budget respected; Playwright e2e added.
6. The whole flow runs in this Linux container and on the Mac claude account (macOS).
7. Full vitest suite and `npm run build` green; CHANGELOG entry.

## Out of scope

- Shooting or importing the AEP0.2 photos themselves (Martin or Gerrit, once the tools exist).
- Supplier photos (licensing).
- Printables login automation.

## Open questions for Martin

- Thumbnail size: 48 px suits the receipt; bigger on the components page (e.g. 120 px)?
- Commit the photos (WebP, ~20 KB each) to the project repository, like renders? Default yes.
