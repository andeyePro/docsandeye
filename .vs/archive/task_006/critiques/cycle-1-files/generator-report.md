# task_006 cycle 1 — Generator report

## Baseline (first action of the cycle)

```
git -C /repos/electroPioreactor rev-parse --abbrev-ref HEAD   -> AEP02
git -C /repos/electroPioreactor log -1 --format=%H            -> 6a63e0becbb48b7f9509f38afb62e9deac9a831e
git -C /repos/electroPioreactor status --short                -> " M .gitignore"
```

The pre-existing ` M .gitignore` (one added line, `.vibe-signals/`) is Martin's uncommitted local change; it was not staged, not committed and is still present after my commit, so `status --short` after the cycle equals the baseline.

Result: one commit on `AEP02`, `80780ae7b2e47862778d3d1fc3ff1a4efa864786`, parent `6a63e0be…`. Files touched: `docsandeye.config.yaml`, `docs/**` (83 new files), and the two stubs `AsepticElectroPioreactor/CARMA_PumpPriming/Assembly/README.md` and `.../Assembly/BoM.md`. No push, pull, fetch, checkout, switch, stash, reset or rebase was run. Nothing under `private-notes/` or `.claude/` was opened.

## What was written

| Deliverable | Count / note |
| --- | --- |
| `docsandeye.config.yaml` | theme pioreactor; guides aep (/AEP), mep (/MEP); byte_budget_kb 150; no denylist additions |
| `docs/components/*.yaml` | 69: 45 BoM lines (every line of sections 1–5), 10 kit sub-items, 1 README-only part (regulator outlet o-ring), 2 legacy printed parts (electrode-top-stop, pinch-slider), 11 tools (README Required/Recommended Tools; the schema needs `tools[].component` to resolve) |
| `docs/steps/*.md` | 12: step-00 plus one per README Method step 1–11 |
| `docs/README.md` | build notes, the Steps section and the MEP sharing evidence (see deviation 1) |
| `docs/media/README.md` | shoot list; no manifests (no committed media exists) |
| Stubs | Assembly/README.md, Assembly/BoM.md — written only after the self-check passed |

Component split: 45 BoM lines (1.1–1.12 = 12, 2.1–2.6 = 6, 3.1–3.9 = 9, 4.1–4.8 = 8, 5.1–5.10 = 10) → 45 components (the two printed BoM parts with masters, 1.9 and 2.3, are among them); 10 kitted sub-items; 1 README-only part; 2 legacy printed parts; 11 tools. 45 + 10 + 1 + 2 + 11 = 69.

## Per-step correspondence (README Method step → file → dropped clauses)

README = `AsepticElectroPioreactor/CARMA_PumpPriming/Assembly/README.md` at baseline `6a63e0be`. Titles are the README headings; where the heading carried a URL or a parenthetical NOTE, the title is the heading text and the URL/NOTE is the first body line (nothing dropped).

| README step (lines) | File | Title | Dropped clauses |
| --- | --- | --- | --- |
| Header, "What changed", "Before you start", Required/Recommended Tools, Spares (L1–42, L183–185) | step-00-before-you-start.md | Before you start | none. `Parts list: BoM.md` link re-pointed to `../components/` (BoM.md is now a stub); `AEP0.1.1_Assembly.md` link kept (path corrected). |
| 1 (L45–54) | step-01-connect-dovetail-platforms.md | Connect empty dovetail platforms in raft, with dovetails always to front and left | none textual. External `<img>` (L52, GitHub user-attachments) replaced by an italic pointer to the shoot list; TODO comment (L54) kept verbatim. |
| 2 (L56–63) | step-02-pioreactor-hardware-setup.md | Follow the Pioreactor 40 ml v1.5 hardware setup guide | none; heading URL kept as body line 1. |
| 3 (L64–72) | step-03-pioreactor-software-setup.md | Follow the Pioreactor software setup guide | none; heading URL kept as body line 1; bash block kept. |
| 4 (L73–77) | step-04-install-electropioreactor-plugin.md | Install the electroPioreactor plugin | none; "following AEP-Plugin/README.md" kept as body line 1 with both links (re-pointed `../../AEP-Plugin`). |
| 5 (L78–92) | step-05-set-up-electrolysis.md | Set up electrolysis | none; the "(NOTE: ~struck through~ lines …)" heading clause is body line 1; `~…~` strikethrough markers kept; TODO (L84) kept. |
| 6 (L93–100) | step-06-set-up-nutrient-solution-flow.md | Set up nutrient solution flow | none. |
| 7 (L101–112) | step-07-ports.md | Ports | none. |
| 8 (L114–148) | step-08-set-up-co2-sparging.md | Set up carbon dioxide sparging | none textual. Four external `<img>` (L116, L119, L122, L126) replaced by shoot-list pointers; TODO (L146) kept. |
| 9 (L149–170) | step-09-configure-sparging-and-electrolysis.md | Configure sparging and electrolysis | none; ini block kept verbatim. |
| 10 (L171–179) | step-10-calibrate-co2-flow.md | Calibrate CO₂ flow | none. |
| 11 (L180–181) | step-11-sterilise.md | Sterilise | none; the TODO comment is kept verbatim and one visible sentence sourced from BoM.md "Still to specify" ("Sterilisation procedure, pending PI approval") is added so the page is not blank. |

The README does not skip or merge any number: steps 1–11 are contiguous.

## Safety placement

| Warning (spec list) | Source sentence | Placed |
| --- | --- | --- |
| Cylinder pressure / PPE / mismatched adapter | README L134 (verbatim, including the adapter-instructions link) | step-08 `safety`, and in the body at 8.12 |
| Solenoid manual override closed | README L125 | step-08 `safety` and body 8.5 |
| 3/2 venting solenoid | BoM 3.1 (L39) quoted verbatim — the README Method text has no venting sentence | step-08 `safety`; also the solenoid-valve changelog note |
| Electrode polarity | BoM 3.3 (L41) "Colour-code red anode, black cathode, and never swap." and BoM 2.2 (L29) "Must stay strictly cathodic …" quoted verbatim; the README's own red/anode black/cathode instructions are in the body (5.4, 5.5) | step-05 `safety` |
| 10% electrolysis clamp | README L90 (verbatim) | step-05 `safety` and body 5.12; also body 4 and 9.3 |
| Hydrogen / oxygen | No warning sentence exists in Assembly/README.md, BoM.md or Components/ (grep: only the CO₂ "clears oxygen bubbles" mechanism at L146 and Loctite's hydrogen rating). Nothing invented. | — |
| PC-CF printing temperature | No such sentence exists anywhere in the sources (grep for PC-CF finds material statements only: BoM 2.3, Vial Cap.scad comments). Nothing invented. | — |

## MEP pairing (guide: [aep, mep])

Evidence file: `MixedElectroPioreactor/Assembly-EdMSc26.md` (baseline). Only one step is shared:

| Step | AEP README lines | Assembly-EdMSc26.md lines | Operation |
| --- | --- | --- | --- |
| step-01-connect-dovetail-platforms | 45–50 | 16 ("Place the dovetail raft on the bench with dovetails to front and left.") and 17 (raft layout: SodaStream rear, product left of media, pumps in front, electroPioreactor at the front) | Lay out the dovetail raft |

Considered and rejected (recorded in docs/README.md): step-05 vs MEP L23–25 and L40–55 (same purpose, AEP0.1-generation o-ring cap and top stop — the AEP0.2 text would misdirect an MEP builder); step-06 sub-step 6.2 (README L95) vs MEP L18 (12 V PSU only, not the pump setup); MEP L27–28 is a PWM note. Steps 2, 3, 4, 7, 8, 9, 10, 11 have no MEP equivalent (MEP L3: CO₂ stack arrives pre-built). No SSID, password or unit hostname from the MEP file was copied — line numbers only.

## BoM → component mapping

Ids are stable kebab-case without AEP/product version numbers (AC10): `pioreactor-40ml` not `…-v1-5`, `raspberry-pi` not `…-5`, `gl45-bottle` not `…-250ml`; names keep the BoM item text verbatim. Every changelog note starts "Imported from BoM.md item N (tier; AEP0.2)".

| BoM | Component id | kind | supplier | parameters from the specification | used in steps (qty, cat) |
| --- | --- | --- | --- | --- | --- |
| 1.1 Pioreactor 40 ml v1.5 | pioreactor-40ml | off-the-shelf | — | volume 40, hw 1.5 | 02 (1), 05 prev |
| 1.2 XR upgrade kit | xr-upgrade-kit | off-the-shelf | — | 45/90/135° | 02 (1) |
| 1.3 Precision Temperature Upgrade Kit | precision-temperature-upgrade-kit | off-the-shelf | — | MLX90632, SPEC | 02 (1), 03 prev |
| 1.4 Raspberry Pi 5 | raspberry-pi | off-the-shelf | — | ram ≥ 1 GB | 02 (1) |
| 1.5 27 W USB-C power supply | usb-c-power-supply | off-the-shelf | — | 27 W, 5.1 V, 5 A, 15.3 W draw | 02 (1) |
| 1.6 microSD card | microsd-card | off-the-shelf | — | ≥ 32 GB, A2/U3/V30, OS ≥ 26.5.0 | 03 (1) |
| 1.7 12 V peristaltic pumps (1 pair) | peristaltic-pump | off-the-shelf | Pioreactor (Components/README.md link) | 12 V, sold as pair | 06 (2) |
| 1.8 Pumping dovetail platform | pumping-dovetail-platform | off-the-shelf, master none, no files | Pioreactor (Components/README.md link) | PLA/PETG, 0.2 mm, 20 %, SD cutout | 01 (1) |
| 1.9 Dovetail holders for GL45 bottles | gl45-bottle-holder | printed, scad `Components/GL45BottleHolder/GL45_holder.scad`, 3 STLs derived, v1.1.0 | — | bottle_ml 250 | 01 (2, printed) + render + viewer |
| 1.10 GL45 caps | gl45-cap | off-the-shelf | Pioreactor (Components/README.md "Caps" link) | PP, 1/8" ports, autoclavable | 06 (2) |
| 1.11 Spare vial | spare-vial | off-the-shelf | — | 40 ml glass | 00 (1, consumable) |
| 1.12 Spare magnetic flea | spare-magnetic-flea | off-the-shelf | — | PTFE, octagonal, 10 mm | 00 (1, consumable) |
| kit of 1.1 | pioreactor-vial-40ml, stir-bar, stock-vial-cap | kitted | — | — | vial: 02 (1), 05/06 prev; stir-bar: 02 (1); stock cap: unreferenced (not used in AEP0.2) |
| kit of 1.1 named at README 2.4 | eye-spy, optics-cover, screw-8mm, led-cap, stemma-qt-wire | kitted | — | — | 02 (2, 3, 12, 1, 1) |
| kit of 1.2 named at README 2.4 | xr-top-vial-holder, xr-o-ring | kitted | — | — | 02 (1, 1) |
| 2.1 MMO anode | mmo-anode | off-the-shelf | — | 100 mm, 6 mm OD, 4 mm ID, Ti, IrO2-Ta2O5, hollow | 05 (1); 07, 08 prev |
| 2.2 Stainless steel cathode | stainless-steel-cathode | off-the-shelf | — | 100 mm, 6 mm, 316 | 05 (1); 07 prev |
| 2.3 Vial cap and electrode holder | vial-cap | printed, scad `Components/Vial Cap/Vial Cap.scad`, derived `Vial Cap.stl`, v2.0.0, depends_on bosl2, supersedes electrode-top-stop@1.0.0 | — | electrodes 2, el_d 6.2, n_ports 5, port_d 2.2, openings 1, seal septum, pieces 1 | 05 (1, printed) + iso + exploded renders + viewer; 07 prev |
| 2.4 Silicone septum, 2mm thick | silicone-septum | off-the-shelf | — | 2 mm | 05 (1); 07 prev |
| 2.5 0.2 µm hydrophobic vent filters (5) | hydrophobic-vent-filter | off-the-shelf | — | 0.2 µm PTFE, 25 mm, F Luer-Lok in, M slip out | 08 (3) |
| 2.6 Stainless steel needle port (1) | needle-port | off-the-shelf | — | 75 mm blunt, F luer-lock, 304/316 | 07 (4) |
| 3.1 Solenoid valve | solenoid-valve | off-the-shelf | — | 1/8", 12 V DC, 3/2 venting, manual override | 08 (1); 09 prev |
| 3.2 Wiring, solenoid | solenoid-wiring | off-the-shelf | — | 2-core, 12 V | 08 (1) |
| 3.3 Wiring, electrode cables (1) | electrode-cable | off-the-shelf | — | 2 runs, red anode / black cathode | 05 (2) |
| 3.4 Ring terminals (2) | ring-terminal | off-the-shelf | — | M3 | 05 (2) |
| 3.5 Thumb screws (2) | thumb-screw | off-the-shelf | — | M3 | 05 (2) |
| 3.6 M3 nuts (2) | m3-nut | off-the-shelf | — | M3, A2/A4 | 05 (2) |
| 3.7 M3 spring washers (2) | m3-spring-washer | off-the-shelf | — | M3 stainless | 05 (2) |
| 3.8 Crimp connector | crimp-connector | off-the-shelf | — | — | 05 (1); 08 prev |
| 3.9 Crimp housing | crimp-housing | off-the-shelf | — | — | 05 (1); 08 prev |
| 4.1 Dovetail holder, CO₂ cylinder | co2-cylinder-dovetail-holder | printed, master none (no source in repo) | Printables 855700 (Components/README.md link) | SodaStream diameter | 01 (1, printed); 08 prev |
| 4.2 CO₂ regulator | co2-regulator | off-the-shelf | — | 3/8" JG push-fit outlet, relief valve | 08 (1); 10 prev |
| 4.3 Cylinder-to-regulator adapter | cylinder-regulator-adapter | off-the-shelf | KegLand, mpn KL15578 (README 8.11) | pin-adjustment, W21.8 → TR21-4 | 08 (1) |
| 4.4 12 V power supply | power-supply-12v | off-the-shelf | — | 12 V, ≥ 1 A, 2.1 × 5.5 mm centre + | 02 (1); 06 prev |
| 4.5 1/4" to 1/8" reducing hexagon nipple | reducing-nipple | off-the-shelf | — | 1/4" M → 1/8" M | 08 (1) |
| 4.6 1/8" blanking plug | blanking-plug | off-the-shelf | — | 1/8", Ni-brass, NBR o-ring | 08 (1) |
| 4.7 SodaStream CO₂ cylinder (consumable) | sodastream-co2-cylinder | off-the-shelf | SodaStream (BoM link) | TR21-4 | 08 (1, consumable) |
| 4.8 Loctite 577 (shared) | loctite-577 | off-the-shelf | — | anaerobic, 0.25 mm gap, 10–60 min, 24 h, H2-rated | 08 (1, consumable) |
| 5.1 CO₂ needle valve | co2-needle-valve | off-the-shelf | — | 1/8" BSPP/NPS M, 4/6 mm hose, 4 bar, 1 bar working | 08 (1); 10 prev |
| 5.2 Polyurethane CO₂ tube, 1 m | polyurethane-co2-tube | off-the-shelf | — | 6 × 4 mm, 1 m, 10 bar | 08 (1) |
| 5.3 1/16" barb to male luer lock (2) | barb-1-16-to-male-luer-lock | off-the-shelf | — | 1/16", male | 06 (2) |
| 5.4 1/16" barb to female luer lock (2) | barb-1-16-to-female-luer-lock | off-the-shelf | — | 1/16", female | 06 (2) |
| 5.5 1/8" barb to male luer lock (2) | barb-1-8-to-male-luer-lock | off-the-shelf | — | 1/8", grips 4 mm | 08 (1) |
| 5.6 Silicone tubing, 50 cm | silicone-tubing | off-the-shelf | — | 1/8" × 1/16", 50 cm, autoclavable | 06 (1); 10 prev |
| 5.7 Luer lock cap | luer-lock-cap | off-the-shelf | — | — | 08 (1); 10 prev |
| 5.8 Male-to-male luer lock adapter (2) | male-to-male-luer-lock-adapter | off-the-shelf | — | — | 08 (1) |
| 5.9 Silicone feed tube, tubular anode | anode-feed-tube | off-the-shelf | — | 1 mm ID, 3 mm OD | 08 (1) |
| 5.10 250 ml GL45 borosilicate bottle (2) | gl45-bottle | off-the-shelf | The Consumables Company (BoM link) | 250 ml, GL45, 70 mm | 06 (2) |
| — (README 8.2 only) | regulator-outlet-o-ring "8mm ID 2mm CS o-ring" | off-the-shelf | — | 8 mm ID, 2 mm CS | 08 (1). **BoM gap**: the README fits an o-ring the BoM does not list. |
| — legacy | electrode-top-stop (scad, STL + 3mf derived, v1.0.0 2025-11-17), pinch-slider (scad, STL derived, v1.0.0 2025-12-03) | printed | — | scad defaults | unreferenced (superseded / dropped in AEP0.2, per "What changed") |
| — tools | computer-with-microsd-reader, phillips-ph0-screwdriver, gas-cylinder-wrench, vernier-callipers, analytical-balance, cryogenic-gloves, eye-face-protection, lab-coat, needle-nose-pliers, multimeter, banded-oil-filter-wrench | off-the-shelf | — | size/accuracy/rating where the README gives one | 00 (all); 02, 03, 05, 06, 08 as used |

## Quantity decisions

- `peristaltic-pump` qty 2 in step-06 ("1 pair"; changelog: sold as a pair with pump tubing).
- `electrode-cable` qty 2 in step-05: BoM qty 1 but "One run per electrode"; two physical runs (red, black) are fitted.
- `hydrophobic-vent-filter` qty 3 in step-08 (one entry, two exhaust; BoM buys 5). `barb-1-8-to-male-luer-lock` and `male-to-male-luer-lock-adapter` qty 1 each in step-08 (BoM 2 each; one fitted).
- `needle-port` qty 4 in step-07: ports 3–6 (Media In, Media Out, Gas Out, Gas Out – safety) are needles; port 8 is "Spare port (sealed)" and 7 is syringe-through-septum. BoM 2.6 qty 1 tops up the four that ship with the Pioreactor.
- Consumables/shared/spares: `sodastream-co2-cylinder` and `loctite-577` appear only in step-08 (qty 1, cat consumable); `spare-vial`, `spare-magnetic-flea` only in step-00 (qty 1, cat consumable).
- Kit sub-items at step-02 take the README's stated counts (2 eye-spys, 3 optics covers, 12 screws, 1 LED cap, 1 wire, 1 holder, 1 O-ring).
- `cat: prev` marks a part fitted in an earlier step and handled again (vial, electrodes, cap, 12 V supply, regulator, needle valve, solenoid, connector).
- Attribution judgement calls the Reviewer should weigh: step-06 lists gl45-bottle, gl45-cap, silicone-tubing and the 1/16" barbs because the pump/bottle plumbing the README delegates to the upstream pump guide is the operation of that step, although the README text names only pumps and tube lengths; step-01 lists only the three platforms (the SodaStream, bottles, pumps and Pioreactor are named as layout landmarks and are fitted in their own steps).

## Vial Cap parameter check (AC4)

`Components/Vial Cap/Vial Cap.scad` defaults (read 2026-09-04): `electrodes = 2`, `el_d = 6.2`, `n_ports = 5`, `port_d = 2.2`, `openings = 1`, `seal = "septum"`, `pieces = 1`. Martin's description (2 electrode ports of 6 mm, 5 small ports, 1 large septum opening) matches the defaults; all seven are set explicitly in `vial-cap.yaml` and the 2.0.0 changelog note records the check. The .scad's names are `n_ports` and `port_d`, not the spec's `ports` / `port_dia`. `el_d 6.2` is the modelled bore for the 6 mm OD electrodes (BoM 2.1/2.2). Not set: `el_len` (default 60 vs the BoM's 100 mm electrodes) and `insertion_depth` (default 23) — the README's standard insertion depth is still a TODO, so the column height stays at the file defaults and the note says so. The self-check re-derives each default from the file with a regex and reports "match" for all seven.

Exploded renders: `Vial Cap.scad` has `view = "exploded"` (an exploded assembly view) and gets `explode: true`; the other three .scad files have no explode/exploded parameter and get none. gl45-bottle-holder gets an iso render + viewer at step-01; electrode-top-stop and pinch-slider are not introduced by any AEP0.2 step so have no render jobs (5 jobs total in the plan).

## Deviations and decisions for the Reviewer / chair

1. **`docs/steps/README.md` cannot exist under the current core loader.** `loadProject` parses every `*.md` in `docs/steps/` as a step (load.ts `MARKDOWN_EXTENSIONS`, no README exclusion), so a README there is three schema errors and would fail AC1. The Steps section and the MEP sharing evidence (AC8) live in `docs/README.md` instead, with the reason stated. Chair decision needed: either core skips `README.md`/`_*.md` in collections, or the spec points AC8 at `docs/README.md`.
2. Step titles: for README steps 2, 3, 4 and 5 the heading carried a URL / "following …" / a NOTE; the title is the heading text and the remainder is the first body line, verbatim.
3. Relative links re-pointed from `Assembly/` to `docs/steps/` (`../../Components/Vial%20Cap`, `../../AEP-Plugin`, …); the "Parts list: BoM.md" and "Procure the Bill of Materials" links now go to `../components/`. docs.pioreactor.com links and the adapter-instructions PDF link are unchanged; nothing from upstream Pioreactor documentation is copied.
4. External images (five `<img>` to GitHub user-attachments) are not ingested; each is replaced by an italic pointer to the shoot list, and `docs/media/README.md` lists what the replacement photo must show.
5. Tools are components (`kind: off-the-shelf`, `master_format: none`) because step `tools[].component` must resolve; their notes say "not a BoM line".
6. Kit sub-items the README names at 2.4 (eye-spy, optics cover, 8 mm screw, LED cap, STEMMA-QT wire, XR top vial holder, XR O-ring) are `kitted` components per the spec's "one per kit sub-item a step names"; `stock-vial-cap` exists because BoM 1.1 ships caps, but is unreferenced (AEP0.2 does not use it).
7. `regulator-outlet-o-ring` is a BoM gap (README 8.2 fits it; BoM has no line). Recorded in its changelog note.
8. Supplier fields only where BoM.md or Components/README.md gives a link/part: pioreactor.com (pumps, dovetail platform, GL45 caps), Printables 855700 (CO₂ cylinder holder), The Consumables Company (bottle), SodaStream (cylinder), KegLand KL15578 (adapter, mpn from README 8.11). Components/README.md's amzn.eu short links were not used (not product specifications, and the BoM commit deliberately avoids vendor links). Supplier links in `Components/CO2 transfer/README.md` "Current Solution" were not copied for the same reason; the solenoid, regulator and needle-valve notes point at those selection files instead.
9. `vial-cap.supersedes: electrode-top-stop@1.0.0` — the one-piece cap replaces the separate top stop ("What changed"); the schema allows a single pin.
10. Stubs: the H1 titles are kept and the body is one paragraph with links to docs.electroPioreactor.org/AEP and the `docs/` tree. **BoM.md additionally keeps its "Still to specify" section verbatim** (the blocking list for Gerrit and the secondary list): it is open work, not guide content, and has no home in the component/step schema — dropping it would lose information. If the chair wants a pure stub, that section needs a new home first.
11. HTML `<!-- TODO … | assignee: @… -->` comments are preserved verbatim inside step bodies (fidelity); they contain GitHub-style handles only, no emails.
12. Git hooks: `/repos/electroPioreactor/.git/config` sets `core.hooksPath = /workspace/.git/hooks`, which holds only `*.sample` files, so no content guard ran on this commit (the repo's own `.git/hooks/pre-commit` Martin/ guard is bypassed by that setting — pre-existing, not changed). My self-check's PII grep (LAN IPs, `.local`, emails, MACs, session ids, SSID/password, `ed04/ed05`, `private-notes`) ran over all 84 written files instead and is clean.
13. `docsandeye check` does not exist yet; the self-check imports task_001's built `packages/core/dist/index.js` read-only and runs `loadProject`, `stepsForGuide` and `buildRenderPlan` on `/repos/electroPioreactor` — zero problems (this is the AC1 evidence for the cycle). Warnings: none emitted by the loader. Unreferenced components (informational): electrode-top-stop, pinch-slider, stock-vial-cap.
14. Dates in changelogs: BoM imports are dated 2026-09-04 (today); printed parts use the .scad's first-commit date from `git log` (Vial Cap 2025-10-16 / 2026-07-15, ElectrodeTopStop 2025-11-17, PinchSlider 2025-12-03, GL45 holder 2026-05-27 / 2026-05-29).

## Self-check

Script: `.vs/cycle-1/scratch-tests/selfcheck.mjs` (Node 20, imports task_001 core dist read-only). Generators: `gen_components.py`, `gen_steps.py` (Python 3, stdlib; PyYAML is not installed so YAML is emitted as JSON-quoted flow scalars, which the real `yaml` parser then validated). Render plan saved to `scratch-tests/out/render-plan.json`. First run found two issues, both fixed before the stubs were written: `docs/steps/README.md` parsed as a step (deviation 1) and a false positive of my own email regex on the `electrode-top-stop@1.0.0` pin (regex tightened). Final run:

```
loaded: 69 components, 12 steps, 0 media
ok   loadProject reports zero problems
ok   config guides are [aep, mep]
ok   theme pioreactor
ok   byte_budget_kb 150
ok   component field checks done
ok   step orders 0..11, unique
ok   step cross-references done
ok   mep guide = [step-01]
ok   aep guide has 12 steps
components not referenced by any step (expected: superseded/dropped/kit-in-box): electrode-top-stop, pinch-slider, stock-vial-cap
ok   render jobs for vial-cap: vial-cap-exploded, vial-cap-iso, viewer
ok   render jobs for gl45-bottle-holder: gl45-bottle-holder-iso, viewer
note: electrode-top-stop has 0 render jobs (not introduced by an AEP0.2 step)
note: pinch-slider has 0 render jobs (not introduced by an AEP0.2 step)
render plan: 5 jobs
ok   vial-cap parameters match the description (2 electrodes, 5 ports, 1 opening, el_d 6.2)
scad default electrodes = 2 ; docs 2 ; match
scad default el_d = 6.2 ; docs 6.2 ; match
scad default n_ports = 5 ; docs 5 ; match
scad default port_d = 2.2 ; docs 2.2 ; match
scad default openings = 1 ; docs 1 ; match
scad default seal = septum ; docs septum ; match
scad default pieces = 1 ; docs 1 ; match
ok   PII grep over 84 files done

ALL CHECKS PASSED
```

## Final `git -C /repos/electroPioreactor show --stat HEAD`

```
commit 80780ae7b2e47862778d3d1fc3ff1a4efa864786
Author: Martin Currie <6342315+Aqueum@users.noreply.github.com>
Date:   Fri Sep 4 21:41:10 2026 +0000

    AEP0.2: Docs&I guide content - components, steps, media shoot list
    
    Converts Assembly/README.md and BoM.md into a docs/ tree for the
    docs.electroPioreactor.org/AEP guide: 69 component files (every BoM line
    a step references, the kit sub-items the README names, the four printed
    parts with their .scad masters and committed STLs, the tools), 12 step
    files (step-00 plus one per README Method step, wording preserved, the
    README's warnings in safety: on steps 5 and 8), docsandeye.config.yaml
    declaring the aep and mep guides, docs/README.md (build notes and the
    MEP step-sharing evidence) and the docs/media shoot list. step-01 is the
    only step shared with the MEP guide.
    
    The old Assembly/README.md and BoM.md become stubs pointing to the guide
    and to docs/; the BoM's "Still to specify" list stays in BoM.md because
    it has no home in the guide schema.
    
    Co-authored-by: Claude Fable 5.1 using vibe.andeye.com
    Claude-Session: https://claude.ai/code/session_01Q3X47LSUAt94jTAtiBUetd

 .../CARMA_PumpPriming/Assembly/BoM.md              |  74 +--------
 .../CARMA_PumpPriming/Assembly/README.md           | 184 +--------------------
 docs/README.md                                     |  21 +++
 docs/components/analytical-balance.yaml            |  10 ++
 docs/components/anode-feed-tube.yaml               |  10 ++
 docs/components/banded-oil-filter-wrench.yaml      |   9 +
 docs/components/barb-1-16-to-female-luer-lock.yaml |  10 ++
 docs/components/barb-1-16-to-male-luer-lock.yaml   |  10 ++
 docs/components/barb-1-8-to-male-luer-lock.yaml    |  10 ++
 docs/components/blanking-plug.yaml                 |  10 ++
 docs/components/co2-cylinder-dovetail-holder.yaml  |  11 ++
 docs/components/co2-needle-valve.yaml              |  10 ++
 docs/components/co2-regulator.yaml                 |  10 ++
 docs/components/computer-with-microsd-reader.yaml  |   9 +
 docs/components/crimp-connector.yaml               |   9 +
 docs/components/crimp-housing.yaml                 |   9 +
 docs/components/cryogenic-gloves.yaml              |  10 ++
 docs/components/cylinder-regulator-adapter.yaml    |  11 ++
 docs/components/electrode-cable.yaml               |  10 ++
 docs/components/electrode-top-stop.yaml            |  10 ++
 docs/components/eye-face-protection.yaml           |   9 +
 docs/components/eye-spy.yaml                       |   9 +
 docs/components/gas-cylinder-wrench.yaml           |  10 ++
 docs/components/gl45-bottle-holder.yaml            |  11 ++
 docs/components/gl45-bottle.yaml                   |  11 ++
 docs/components/gl45-cap.yaml                      |  11 ++
 docs/components/hydrophobic-vent-filter.yaml       |  10 ++
 docs/components/lab-coat.yaml                      |   9 +
 docs/components/led-cap.yaml                       |   9 +
 docs/components/loctite-577.yaml                   |  10 ++
 docs/components/luer-lock-cap.yaml                 |   9 +
 docs/components/m3-nut.yaml                        |  10 ++
 docs/components/m3-spring-washer.yaml              |  10 ++
 .../components/male-to-male-luer-lock-adapter.yaml |   9 +
 docs/components/microsd-card.yaml                  |  10 ++
 docs/components/mmo-anode.yaml                     |  10 ++
 docs/components/multimeter.yaml                    |   9 +
 docs/components/needle-nose-pliers.yaml            |   9 +
 docs/components/needle-port.yaml                   |  10 ++
 docs/components/optics-cover.yaml                  |   9 +
 docs/components/peristaltic-pump.yaml              |  11 ++
 docs/components/phillips-ph0-screwdriver.yaml      |  10 ++
 docs/components/pinch-slider.yaml                  |  10 ++
 docs/components/pioreactor-40ml.yaml               |  10 ++
 docs/components/pioreactor-vial-40ml.yaml          |  10 ++
 docs/components/polyurethane-co2-tube.yaml         |  10 ++
 docs/components/power-supply-12v.yaml              |  10 ++
 .../precision-temperature-upgrade-kit.yaml         |  10 ++
 docs/components/pumping-dovetail-platform.yaml     |  11 ++
 docs/components/raspberry-pi.yaml                  |  10 ++
 docs/components/reducing-nipple.yaml               |  10 ++
 docs/components/regulator-outlet-o-ring.yaml       |  10 ++
 docs/components/ring-terminal.yaml                 |  10 ++
 docs/components/screw-8mm.yaml                     |  10 ++
 docs/components/silicone-septum.yaml               |  10 ++
 docs/components/silicone-tubing.yaml               |  10 ++
 docs/components/sodastream-co2-cylinder.yaml       |  11 ++
 docs/components/solenoid-valve.yaml                |  10 ++
 docs/components/solenoid-wiring.yaml               |  10 ++
 docs/components/spare-magnetic-flea.yaml           |  10 ++
 docs/components/spare-vial.yaml                    |  10 ++
 docs/components/stainless-steel-cathode.yaml       |  10 ++
 docs/components/stemma-qt-wire.yaml                |  10 ++
 docs/components/stir-bar.yaml                      |  10 ++
 docs/components/stock-vial-cap.yaml                |   9 +
 docs/components/thumb-screw.yaml                   |  10 ++
 docs/components/usb-c-power-supply.yaml            |  10 ++
 docs/components/vernier-callipers.yaml             |   9 +
 docs/components/vial-cap.yaml                      |  13 ++
 docs/components/xr-o-ring.yaml                     |   9 +
 docs/components/xr-top-vial-holder.yaml            |   9 +
 docs/components/xr-upgrade-kit.yaml                |  10 ++
 docs/media/README.md                               |  22 +++
 docs/steps/step-00-before-you-start.md             |  65 ++++++++
 docs/steps/step-01-connect-dovetail-platforms.md   |  24 +++
 docs/steps/step-02-pioreactor-hardware-setup.md    |  34 ++++
 docs/steps/step-03-pioreactor-software-setup.md    |  22 +++
 .../step-04-install-electropioreactor-plugin.md    |  12 ++
 docs/steps/step-05-set-up-electrolysis.md          |  47 ++++++
 .../steps/step-06-set-up-nutrient-solution-flow.md |  26 +++
 docs/steps/step-07-ports.md                        |  23 +++
 docs/steps/step-08-set-up-co2-sparging.md          |  77 +++++++++
 .../step-09-configure-sparging-and-electrolysis.md |  32 ++++
 docs/steps/step-10-calibrate-co2-flow.md           |  20 +++
 docs/steps/step-11-sterilise.md                    |  10 ++
 docsandeye.config.yaml                             |   5 +
 86 files changed, 1126 insertions(+), 256 deletions(-)
```

`git -C /repos/electroPioreactor status --short` after the commit: ` M .gitignore ` (equals the baseline). `git log -1 --format=%H`: `80780ae7b2e47862778d3d1fc3ff1a4efa864786`; parent `6a63e0becbb48b7f9509f38afb62e9deac9a831e`.
