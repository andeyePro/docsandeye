# Spec critique — task_005 (cycle 1)

## Concerns

1. **[BLOCKING, AC1]** The task_003 token contract lists `--docsi-logo-mark: none` explicitly captioned "the theme-cycle mark (task_005)" — implying the mark is meant to reach the DOM via a CSS custom property. But this spec's cycle mechanism (line 46) has `<docsi-theme>` build the mark into an inline `<svg><mask>` in JS, reading `marks/*.svg` files directly; nowhere does `pioreactor.css` or `starlight.css` set `--docsi-logo-mark`, and the token-value table (lines 32-40) omits it entirely. AC1 requires packs to "set every `--docsi-*` token from the contract" — a Reviewer cannot judge this pass/fail while one contract token is structurally unused by the shipped mechanism. Either the token is dead (task_003's contract line is wrong) or the mark mechanism is wrong; the two specs disagree and neither generator can resolve it alone.

2. **[BLOCKING, AC1]** Same table is also silent on `--docsi-stale-bg`, `--docsi-stale-fg`, `--docsi-media-col`, `--docsi-text-col` — four more contract tokens AC1 says packs must set "using only the values in the table." A Reviewer has no value to check these against, so this half of AC1 is unfalsifiable as written; either give values or state which contract tokens a pack is exempt from setting (layout tokens presumably shouldn't vary by pack at all).

3. **[BLOCKING, layout/AC3]** `site/astro.config.mjs` wires `components: { ThemeSelect: '@docsandeye/themes/ThemeSelect.astro' }`, but no `ThemeSelect.astro` file appears anywhere in this spec's file layout (only `src/docsi-theme.ts`, a vanilla element), and the package.json exports map (line 16) has no `"./ThemeSelect.astro"` entry — Node's `exports` field will reject that import path outright. The spec names the override mechanism but never specifies the Astro wrapper's shape, props, or how it mounts `docsi-theme.ts`.

4. **[BLOCKING, AC3 vs task_003]** task_003 gives the plugin's own `config:setup` hook a `components` override for `Sidebar` only (task_003 §Package layout, line 15); this spec's site config sets `components.ThemeSelect` at the top level. Whether Starlight's `updateConfig` deep-merges `components` (preserving both) or the plugin's call replaces the whole object (silently dropping one override) is unspecified in either spec and untested by task_003's AC11. A Reviewer cannot judge "the cycle control replaces Starlight's theme select" without knowing this actually survives the merge.

5. **[BLOCKING, AC5 vs AC7]** AC5 permits `docsandeye check --dist site/dist` to report "at most one budget warning"; AC7 requires "every step page ... stays under the 150 KB ... budget." Per task_004 AC7, budget warnings fire only on step pages, so these two criteria directly contradict — a build with one over-budget page passes AC5 and fails AC7. Pick one bar.

6. **[BLOCKING, AC5]** "`docsandeye render` emits a plan for it" undersells what the real CLI does: task_004 AC3 has `render` always spawn `python3 -m docsandeye_render` after writing the plan (no plan-only flag exists). Against the synthetic-guide fixture (built to avoid needing OpenSCAD), this either fails outright if python3/the render pipeline isn't present in this environment, or, if it is, may overwrite the deliberately-committed stub `manifest.json`/outputs with real render attempts. The spec doesn't say which behavior is expected or how the Reviewer should tell a legitimate failure from a broken example.

7. **[BLOCKING, legal]** Loading Roboto/Source Code Pro via a live `@import` to Google's Fonts CSS2 endpoint on the deployed `docs.andeye.com` sends every visitor's IP to Google at request time — the GDPR exposure this task's own review brief flags. The spec commits to this approach (line 37, AC2) without addressing it; self-hosting the two woff2 files is the standard mitigation and isn't mentioned as considered or rejected.

8. **[MINOR, AC2]** task_003's resolution order (its §Token contract) always uses the plugin's own bundled `src/styles/theme-starlight.css` for pack name `starlight`, falling back to `@docsandeye/themes/<name>.css` only for other names. That makes `packages/themes/starlight.css` in this spec's layout unreachable by the real resolution path — AC2 ("the starlight pack is a no-op and loads no fonts") may be testing a file nothing ever loads. Clarify whether this file exists only for direct-import consumers, and if so name them.

9. **[MINOR, T29/legal]** AC4's "picks `mark-pioreactor.svg` when non-empty" auto-activates on a file drop with no other code change, for a mark whose legal status is explicitly unresolved (T29). Documenting "names T29" is not the same as requiring sign-off before the swap is made; the README should say so explicitly rather than leaving activation frictionless.

10. **[MINOR, AC5]** `docsandeye check --dist site/dist` omits `--project`; task_004 AC11's cwd-walk-up discovery makes the result depend on the Reviewer's working directory when running the command, which isn't stated.

## Verdict

**revise**

## Iteration 2 — Concerns

Iteration-1 status: #1 resolved (task_003's contract now drops `--docsi-logo-mark`
entirely; mark handled by the element, not a token). #2 resolved (table now
lists `--docsi-stale-bg/-fg` and both badge tokens; layout tokens explicitly
excluded per amended contract). #3 resolved (`ThemeSelect.astro` is in the
file layout and the `exports` map). #4 resolved (task_003's contract states
the merge and user-key-wins rule; AC11 tests it against exactly this
`components.ThemeSelect` shape). #5 resolved (AC5 now says `warnings: 0`
and AC7 states it is "the same bar as criterion 5's zero warnings"). #6
resolved (summary format matches; hand-exported jobs still invoke the
runner, consistent with task_002). #7 resolved (fonts are now self-hosted,
no Google request). #8 resolved (`starlight.css` dropped from this
package; the stock pack lives in task_003). #9 resolved (activation now
needs a core config key, not just a file drop). #10 resolved (`--project`
added, cwd stated).

11. **[BLOCKING, AC3/ThemeSelect contract]** `ThemeSelect.astro` renders
    `<docsi-theme data-pack="{config.theme}">`, but nothing states how this
    file — which lives in `@docsandeye/themes`, a package separate from
    `starlight-docsandeye` — obtains `config`. The only `config` object in
    scope anywhere in these specs is task_003's `virtual:docsandeye/model`
    export (loaded via its own Vite plugin), which is that package's
    internal contract, not declared as a public API or as a dependency of
    `packages/themes/package.json`. Without an explicit import path (or a
    prop Starlight itself passes), a reviewer can't check that the rendered
    `<docsi-theme` actually carries the right `data-pack` value, only that
    the tag exists.

12. **[BLOCKING, AC2 font plan]** The named upstream sources
    (`google/fonts` apache/roboto, `adobe-fonts/source-code-pro`) hold
    full-charset master TTF/OTF files; Google's actual latin-only woff2
    subsets are generated on the fly by fonts.gstatic.com's serving layer,
    not stored as static files in those repos. "latin subset only" (line
    37) is not achievable by simply downloading files from those
    repositories — it requires a subsetting step (e.g. `fonttools`/
    `pyftsubset`) that appears nowhere in this task's dependencies or file
    layout. Without naming the subsetting tool/step, AC2's 250 KB budget
    and "only the weights listed ship" are unfalsifiable: the Generator may
    ship full-charset files (risking the byte budget) or invent an
    unspecified tool.

13. **[MINOR]** "fetched from the upstream GitHub repositories" doesn't say
    whether via `git clone` (github.com) or raw-file HTTP (typically
    raw.githubusercontent.com/objects.githubusercontent.com) — worth the
    Generator confirming reachability early rather than mid-cycle, since
    the container's GitHub allowlist may or may not cover those subdomains.

14. **[MINOR]** The example project's components use a `derived_files`
    field (line 22) that doesn't appear in any schema shown across these
    four specs (task_001's schema isn't in scope here); AC6 holds the
    *authoring docs* to real field names in `packages/core/src/schemas.ts`
    but the example project's own config isn't held to the same bar, and a
    wrong field name would break AC5's "zero problems under core."

## Iteration 2 — Verdict

**revise**

## Iteration 3 — Concerns

Iteration-2 status, all resolved: #11 (`ThemeSelect.astro` now imports
`{ config }` from `virtual:docsandeye/model`; task_003's virtual module
exports `config`, which is the parsed `docsandeye.config.yaml` object — the
same object task_005's own example config shows with a `theme` field, so
`config.theme` is a real, typed property, not an invented one). #12 and #13
moot: the font decision (line 45) ships no font files and makes no external
request at all, so no subsetting tool or upstream-repo fetch is needed;
grep confirms no `woff`, `pyftsubset`, `fonttools`, `gstatic` or
`googleapis`-fetch residue anywhere in the spec, and no `fonts/` directory
in the file layout. #14 resolved as far as this worktree can check: the
example's components now use core's `derived_files` field by name (line
24) rather than an unspecified export mechanism; task_001's schema itself
is out of scope for this critique per the read-only file list, same
limitation as iteration 2.

No new contradiction: `grep -n` for `font|woff2|virtual:docsandeye|derived_files|fonts/`
across the current spec turns up only the font-decision paragraph, AC1's
`fonts.googleapis` negative check, AC2, the `ThemeSelect.astro` import line,
and the `derived_files` line — all mutually consistent, nothing orphaned.

## Iteration 3 — Verdict

**pass**
