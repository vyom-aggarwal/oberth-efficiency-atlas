# Phase 6 plan: project website on GitHub Pages

Status: proposed on 2026-10-13. Awaiting the author's approval. No site code is written yet.

## 0. Findings that shape the plan

I measured these before planning.

- **Repository:** `vyom-aggarwal/oberth-efficiency-atlas` is public, so Pages with Actions works on a
  free plan. The base path will be `/oberth-efficiency-atlas/`.
- **Simulator:** `explorer/sim.js` is a UMD module (a browser global plus CommonJS).
  - One flyby takes 1.3–5.5 ms in node at rtol = 1e-12, for Π from 0.03 to 300, with 260–590 path
    samples. The hero can re-simulate on every drag frame on the main thread.
  - A Web Worker is only worth it for multi-run sweeps in the explorer. I will decide that by
    measurement.
- **Colours:** the committed paper figures use the blue sequential ramp for several jobs: a·v in the
  animation, η in the atlas (red–grey–blue diverging), the v∞/v_esc families, and density. The site
  reserves its strongest ramp for thrust alone, so site colours will differ from the paper PNGs. The
  freeze keeps the PNGs as they are (open question 1).
- **Typefaces:** I checked 15 candidate typefaces (18 files) with fontTools for figure styles,
  OpenType features and glyph coverage.
  - Barlow, Archivo, Public Sans, Atkinson Hyperlegible Next, Red Hat Text, Saira, Spectral,
    Newsreader and IBM Plex Serif have no Greek (η, Π, ε, τ, λ), so they fail for this subject.
  - Source Serif 4, Fira Sans, Literata and IBM Plex Sans have Greek, tabular figures and a true
    italic.
  - No candidate has ☉, ≲ or ∝, so those always go through KaTeX.
- **Engine trajectories:** the animation computes them in memory (`anim_engines.build_cases`,
  `trajectory`) and does not save them (open question 2).
- **Atlas:** the sweep atlas is drawn at three Δv/V slices with c̃ ≈ 1. It masks impact
  (r_min < R/r_p = 1/1.1) and marks burn-start radii of 10² and 10³ r_p as SOI guides. It does not
  grey out cells by body. The linear-response (Δv → 0) η atlas is the explorer's theory layer.
- **npm:** `npm install --before=<date>` applies the 14-day rule to the whole tree, transitive
  dependencies included. Versions eligible on 2026-10-13 (cutoff 2026-09-29):

  | package | version | | package | version |
  |---|---|---|---|---|
  | vite | 8.3.1 | | katex | 0.18.9 |
  | typescript | 7.0.2 | | markdown-it | 14.3.2 |
  | vitest | 5.0.2 | | @playwright/test | 1.63.0 |
  | lighthouse | 13.5.0 | | d3-scale, d3-axis, d3-selection, d3-shape, d3-array, d3-format, d3-zoom | latest stable |
  | @fontsource-variable/source-serif-4 | 5.3.0 | | @fontsource/fira-sans, @fontsource/fira-sans-condensed | 5.3.0 |

  Newer releases (vite 8.3.4, katex 0.19.0, playwright 1.64.0) are excluded by the rule.
- **Browsers:** Chrome and Playwright's Chromium are already on this machine. Local Playwright and
  Lighthouse runs need no download.

## 1. Information architecture

### Pages
| path | purpose |
|---|---|
| `/` | home: the long-form explorable explanation |
| `/explorer/` | the redesigned explorer |
| `/explorer/classic/` | the existing offline explorer (`explorer/oberth_explorer.html`), copied unchanged as the fallback |
| `/404.html` | not-found page |
| `/style/` | the checkpoint-1 style page. Dev only: excluded from the production build (open question 7) |

### Home sections (refined order)
The brief's order is kept, with four changes, each with its reason.

| # | section | figure and controls | data | provenance shown |
|---|---|---|---|---|
| 1 | Hero | live flyby; drag either end of the thrust arc, or use a log-Π slider drawn as the shared Π axis; η and Π annotate the plot | JS simulator; preset from `presets.json` | live simulation (validated JS port) |
| 2 | The question | prose only | – | – |
| 3 | The universal curve | loss/Δv against Π (log–log): profile-spread band; Π²/96 leading-order bound; 0.1% and 1% thresholds; cases (solid stack, nuclear thermal, SEP p10–p90 ranges, Hibberd, Maraqten); case toggles; arrival-speed family switch | `curve.json` | simulation band and cases; theory bound; published cases |
| 4 | Three regimes | η against Π; toggles for the asymptotes Π², (9/(2Π))^(1/3) and ln Π/Π; v∞/v_esc slider (snaps to the 15 sweep values) that moves Π_T | `regimes.json` | sweep medians (simulation); asymptotes (theory) |
| 5 | The atlas | η heatmap over (Π, v∞/v_esc); crosshair readout; steering toggle; Δv/V slice; impact contours; SOI greying; theory-contour layer; mission-sample layer | `atlas.json` (lazy) | simulation cells; Δv → 0 theory contours, labelled as such |
| 6 | Burn timing | Δv/c slider: thrust-acceleration profile (coloured as thrust); time midpoint; Δv-weighted mean; half-Δv point; recovered fractions | `timing.json` | closed forms (theory), with the simulation check values |
| 7 | Case study | Hibberd et al.'s burn: 0.099 m/s; thrust-margin curve (loss against thrust scale, with the 1% point) | `case.json` | simulation; published inputs |
| 8 | Engines compared | three synchronized top-down panels (solid stack; nuclear thermal; SEP-class, hypothetical at 3.2 R☉); one play/scrub control on the stretched timeline; energy-gain strip | `engines.bin` + `engines.json` (lazy) | simulation (the animation's own trajectories) |
| 9 | Limitations | prose; the J2 number from `j2_numbers.json` | `numbers.json` | – |
| 10 | Methods and reproducibility | test suite, fresh-clone audit, tag, rebuild command, links to repo docs | `repro.json` | – |
| 11 | References and disclosure | numbered references; AI-use disclosure linking `docs/ai_use_log.md` | build-time import | – |

**Changes from the brief, with reasons:**
- **Burn timing comes before the case study, and engines compared after it.** The case study sets up
  the dive geometry that the engine comparison reuses. This follows the README and paper order:
  whole picture, regimes, atlas, optimization, case study.
- **The atlas gains a mission-sample layer.** It carries the README's "Where real engines sit" and the
  Phase 2 mission figure, so that result has a home without a separate section.
- **SOI greying becomes a body selector:** none, Earth, Venus, Mars, Jupiter, Saturn.
  - With a body selected, cells whose burn starts outside that body's SOI (at the atlas's
    h = 0.1 R) are greyed.
  - With no body selected, the 10² and 10³ r_p guide lines from the paper figure remain.
- **A Limitations section is added** for your prose, with the J2 result as its one figure-free number.

### Explorer page
- **Inputs:** presets (the existing body × engine presets, plus the Hibberd preset still labelled
  "approximated as a parabolic arrival" with the Phase 4 arrival-orbit sensitivity), and direct inputs
  for Π, v∞/v_esc, Δv/v_p and Δv/c. Each input is a number field paired with a slider.
- **Steering:** prograde or inertial.
- **Trajectory view:** canvas with zoom and pan (wheel or pinch, drag, keyboard) and a reset.
- **Readouts:** η, Π, loss/Δv, r_min/r_p and v∞,out.
- **Warnings:** impact, and burn start outside the SOI when a body preset is active. Each has an
  icon and text, never colour alone.
- **Placement:** live placement on the universal curve and on the theory atlas, as the same ink
  ring used everywhere.
- **URL state:** the state lives in the URL query (`?Pi=…&v=…&dv=…&c=…&s=prograde`), with a
  copy-link button.
- **Fallback:** a link to `/explorer/classic/`.

### Every interactive figure
- Native `<input type=range>`, `<select>` and radio controls, so keyboard operation comes free. A
  visible 2 px ink focus ring with a 2 px paper offset.
- An accessible text summary generated from the figure's data. Numbers come from the data, and the
  sentences are interface text.
- A "Show data" toggle that reveals a `<table>` of the plotted values.
- A complete static state at load: the figure is drawn at its default before any interaction.

### Prose placeholders
- **Files:** `site/content/<section>.md`. Each has front matter (working title, figure caption) and a
  body that starts as a TODO list of what the section needs to say, written as notes.
- **Rendering:**
  - Production renders a neutral placeholder line (open question 5).
  - The dev server shows the TODO notes.
  - Captions are prose, so they are yours and live in the same files.
- **Checking:** `scripts/check_numbers.py` runs over `site/content/` in CI.

## 2. Data export
**`scripts/export_site_data.py`** writes `site/public/data/*.json` from committed results and
numbers JSONs. Each file carries
`provenance: {git, generated_by, sources: {path: sha256}}`.

| file | contents | source | size | load |
|---|---|---|---|---|
| `numbers.json` | every number the site prints, keyed by its path in the source numbers JSON | `figures/*_numbers.json` | ~30 KB | eager |
| `presets.json` | hero case; explorer presets (body, engine, Hibberd approximation with its caveat) | `explorer/explorer_data.json`, `configs/` | ~10 KB | eager |
| `curve.json` | band (lo, mid, hi) on 400 Π points; bound; thresholds; case placements with source labels; arrival-speed family | `phase4.parquet` and `missions.parquet` via `fig_hero.profile_curves`, `on_grid`, `solar_samples` (imported, not copied); `fig_loss_vinf` selection; `hero_numbers.json`, `loss_vinf_numbers.json` | ~60 KB | eager |
| `regimes.json` | sweep η medians in log-Π bins per v∞/v_esc; asymptote curves; Π_T per v∞/v_esc | `sweep_nd.parquet`; `theory.large_pi_asymptote`, `parabolic_core_asymptote`, `tail_crossover_pi` | ~90 KB | eager |
| `atlas.json` | per Δv/V slice and steering law: cell mesh (Π, v∞/v_esc), η, r_min, burn-start radius, reliability flags; impact contours as polylines; theory η contours; per-body r_SOI/r_p | `sweep_nd.parquet` via `analysis.load`, `reliable`, `soi_ratio`; `theory.linear_response_eta`; `constants.py` | ~200 KB | lazy |
| `engines.bin` + `engines.json` | three trajectories (t, x, y, a·v, energy fraction), adaptively decimated, Float32; header with Π, loss, burn time | `anim_engines.build_cases` and `trajectory` (imported) | ~150 KB | lazy |
| `timing.json` | over a log grid of Δv/c: x̄, x_med, δ*, half-Δv δ, capture fraction | `optimize.x_centroid`, `x_median`, `timing_theory_delta`, `timing_half_dv_delta`, `timing_rule_capture`; check values from `phase3_numbers.json` | ~15 KB | lazy |
| `case.json` | Hibberd reference loss and placements; thrust-margin curve | `phase4.parquet`, `phase4_numbers.json` | ~20 KB | lazy |
| `repro.json` | tag, commit, test count (`pytest --collect-only`), audit result | git; pytest; the v1.0 audit report (to be committed under `docs/`) | ~2 KB | lazy |

- **Budget:** first-load data is about 190 KB. With fonts (~250 KB), KaTeX CSS and fonts (~70 KB)
  and JS (~120 KB), the first load is about 0.65 MB, under the ~1.5 MB limit.
- **Theory curves:** asymptotes, Π_T, timing closed forms and the linear-response contours are
  *evaluated* by calling the frozen library functions unchanged. Simulation data comes only from
  committed results (open question 3).
- **`tests/test_site_data.py`:**
  - every value in `numbers.json` equals its source JSON value;
  - every derived array is recomputed from the committed results and compared exactly;
  - cross-checks, e.g. the band ratio at Π = 0.01…1000 against `hero_numbers.json`, and the engine
    losses against `anim_numbers.json`.
- **`rebuild_all.py`** gains an `export_site_data` step.
- **`repro_audit.py`** compares `site/public/data/` and ignores `provenance`, which is a stamp.

## 3. Tech stack

| choice | decision | reason |
|---|---|---|
| Build | Vite 8.3.1, multi-page (`index.html`, `explorer/index.html`, `404.html`); TypeScript 7.0.2 (`tsc --noEmit` type check) | as the brief suggests |
| UI framework | **none**: plain TS modules, a ~40-line signal store, one function per figure | ~10 independent figures with local state; a framework adds runtime weight and no capability here |
| Charts | D3 modules: scale, axis, selection, shape, array, format, zoom. SVG for axes, annotations and hit targets; Canvas 2D for trajectories and the heatmap | as the brief suggests; no Plotly |
| Math | KaTeX 0.18.9 at build time (`renderToString` in a Vite plugin); KaTeX CSS and woff2 fonts self-hosted; no client KaTeX JS | build-time rendering, as asked |
| Math in charts | axis titles and legend math as absolutely positioned HTML overlays holding pre-rendered KaTeX; tick labels in Fira Sans with tabular figures | SVG cannot host KaTeX HTML without `foreignObject`, which is fragile |
| Markdown | markdown-it 14.3.2 at build time, with `$…$` passed to KaTeX; content injected at build | no client Markdown |
| Fonts | self-hosted woff2, Latin and Greek subsets: `@fontsource-variable/source-serif-4` (wght and opsz), `@fontsource/fira-sans`, `@fontsource/fira-sans-condensed` | Greek coverage, tabular figures and a true italic (§0) |
| Simulator | `explorer/sim.js` moves to `site/src/sim/oberth-sim.js` as an ES module with JSDoc types and `// @ts-check` | one shared module for all three users (below) |
| Worker | only for multi-run sweeps, if measured over ~16 ms | single runs take 1–5 ms |
| Tests | Vitest 5.0.2 (simulator smoke checks, URL-state round trip, data loaders); Playwright 1.63.0 (smoke, interaction, screenshots); Lighthouse 13.5.0 CLI, locally against Chrome; Python `tests/test_site_data.py` | |
| Packages | exact versions; `npm install --before=<today − 14 d>`; `site/scripts/check-package-age.mjs` fails if any locked package is younger than 14 days at lock time | the 14-day rule |
| Node | 24.18.1, pinned in `.nvmrc` and in the workflow | |

**Who uses the shared simulator module:**
- the site imports it;
- `scripts/build_explorer.py` inlines it, with a two-line adapter that sets `window.OberthSim`. The
  classic explorer's HTML bytes change but its behaviour does not; I'll log that.
- `tests/test_explorer_js.py` loads it by dynamic `import()`, at the same tolerances: |Δη| ≤ 1e-8.

## 4. Design plan, pass 1 (first draft)

### Palette (pass 1: seven named values)
| name | light | dark | role |
|---|---|---|---|
| Paper | `#f8fafc` | `#0e141c` | page and chart surface |
| Ink | `#17202b` | `#e7ecf0` | text, axes, trajectories, simulation marks |
| Graphite | `#535c66` | `#a3acb4` | secondary text, ticks, theory lines |
| Rule | `#d6dbe0` | `#2e363f` | gridlines, panel borders |
| Burn (ramp) | 7 steps, key `#be5802` | 7 steps, key `#df6e07` | a·v, the rate of orbital-energy gain |
| Slate (ramp) | 7 steps, key `#57708a` | 7 steps, key `#6d7e8f` | η heatmap, v∞/v_esc families |
| Signal | `#2a6fd6` | `#6ea0f0` | links, focus rings, the reader's case marker |

### Typefaces (pass 1)
- Source Serif 4 for prose and headings, at display optical size for the hero title.
- Fira Sans for the interface; Fira Sans Condensed for on-plot annotation.
- Fira Mono for numeric readouts and data labels.
- KaTeX for math.

### Layout (pass 1)
The home page puts a full-bleed hero band above a sticky left rail and a central prose column of
66ch. Figures break out to 960 px.

```
HOME, 1440 px (pass 1)
+------------------------------------------------------------------------------------------------+
| Oberth Efficiency Atlas                                       Explorer  Methods  Repo  [theme] |
+------------------------------------------------------------------------------------------------+
|######## HERO: always-dark band, radial "sunlight" glow behind the planet #######################|
|#  How much of the Oberth bonus                                         +------------------+   #|
|#  does a real engine keep?             incoming '.                     |      99.2 %      |   #|
|#                                                  '.  ( planet )       |  of bonus kept   |   #|
|#                                                    :=burn arc=:       |    Pi = 0.76     |   #|
|#                                       outgoing   .'                   +------------------+   #|
|#  burn duration  [-----------o----------------------]                                         #|
|################################################################################################|
| 01 The question      |  FIGURE 2 · SIMULATION + THEORY                                          |
| 02 Universal curve   |  The universal curve                                                     |
| 03 Three regimes     |  +--- card: rounded corners, soft shadow ----------------------------+   |
| 04 The atlas         |  | [Cases v]  [Arrival speeds o]                                    |   |
| ...                  |  |  plot                                                            |   |
| (sticky rail)        |  +------------------------------------------------------------------+   |
|                      |  prose (66ch)                         | margin notes, hairline rule      |
|                      |  Open the explorer ->                                                    |
| footer: v1.0-analysis · MIT · built with Vite                                                   |
+------------------------------------------------------------------------------------------------+

HOME, 390 px (pass 1)
+--------------------------------------+
| Oberth Efficiency Atlas      = [◐]   |
|###### dark hero band, glow ##########|
|# How much of the Oberth bonus      #|
|# does a real engine keep?          #|
|#     '.  (planet) :=arc=:          #|
|#     99.2 %  of bonus kept          #|
|# [--------o--------------]          #|
|######################################|
| 02 THE UNIVERSAL CURVE          [v]  |  (sticky bar)
| prose ...                            |
| +-- card -----------------------+    |
| | plot                          |    |
| +-------------------------------+    |
+--------------------------------------+
```

```
UNIVERSAL CURVE FIGURE, 1440 px (pass 1)
FIGURE 2 · SIMULATION + THEORY
The universal curve
[Cases: (x) solid stack (x) nuclear thermal (x) SEP-class (x) Hibberd (x) Maraqten]  [Arrival speed: off | family]
 loss/dv
 100% +                                                                         ....''''
  10% +                                                           ....''''
   1% +- - - - - - - - - - - - - - - - - - - - - - - - - - /- - - - - - - - - - - -  1% loss
 0.1% +- - - - - - - - - - - - - - - - - - - - - - -/- - - - - - - - - - - - - - -  0.1% loss
      +                                     / band: profile spread
      +               * Hibberd    / Pi^2/96 (leading-order bound, Signal blue)
      +       |--o--| solid-stack range (p10-p90)
      +--------+--------+--------+--------+--------+--------+--------+
      0.001    0.01     0.1      1        10       100      1000    Pi = t_b / tau
 tooltip: Hibberd et al. 2026 · Pi 0.0326 · loss 0.099 m/s · results/phase4.parquet

UNIVERSAL CURVE FIGURE, 390 px (pass 1)
FIGURE 2 · SIMULATION + THEORY
[Layers v]
+--------------------------------+
| plot, full width, 4:5          |
+--------------------------------+
key: o solid  ^ NTP  [] SEP  * Hibberd  <> Maraqten
Show data >
```

```
EXPLORER, 1440 px (pass 1)
+------------------------------------------------------------------------------------------------+
| Oberth Efficiency Atlas    Home  Explorer  Methods  Repo                               [theme] |
+----------------------------+-----------------------------------------------+-------------------+
| +-- card: Case ----------+ |                                               | +-- card -------+ |
| | [Preset: Earth, H2/O2 v] |   trajectory canvas                           | | eta   0.99170 | |
| | Pi        [0.7617] --o-| |   wheel/pinch zoom, drag pan, keys            | | Pi    0.7617  | |
| | vinf/vesc [0.30  ] -o--| |   arc coloured by a.v; impulsive exit dashed  | | loss  0.21 %  | |
| | dv/vp     [0.030 ] o---| |                                               | | rmin  0.998   | |
| | dv/c      [0.30  ] --o-| |   [reset view]                                | +---------------+ |
| | (o) prograde ( ) inert.| |                                               | ! impact warning  |
| | [Copy link ->]         | |                                               |                   |
| +------------------------+ |                                               |                   |
+----------------------------+-----------------------+-----------------------+-------------------+
| card: your case on the universal curve           | card: your case on the atlas (theory)       |
+------------------------------------------------------------------------------------------------+

EXPLORER, 390 px (pass 1)
+--------------------------------------+
| Explorer                     = [◐]   |
| [Preset: Earth, H2/O2            v]  |
| +-- trajectory canvas, 1:1 -------+  |
| +---------------------------------+  |
| eta 0.99170 · Pi 0.7617 · loss 0.21% |
| > Parameters                         |
| > On the universal curve             |
| > On the atlas                       |
+--------------------------------------+
```

### Design principles (pass 1)
1. **Colour means thrust.** The burn ramp appears only where an engine is firing. Everything else is
   ink, graphite and slate.
2. **Annotate on the data.** Use direct labels and leader lines, as on a mission-design plot.
   Legends only where direct labels would collide.
3. **Every layer states its provenance.** Simulation is solid, theory is dashed, and published cases
   are hollow markers, the same in every figure. Tooltips name the source file or reference.
4. **One Π axis.** Every Π axis spans the same decades with the same ticks, and marks the 0.1% and
   1% thresholds in the same place. The reader's case is the same marker everywhere.
5. **Still until touched.** Every figure is complete at load and moves only in response to input.

## 5. Design plan, pass 2 (review against generic defaults)

| default to avoid | pass 1 | verdict | change |
|---|---|---|---|
| warm cream background, terracotta accent | Paper `#f8fafc` is cool; Burn's middle steps are orange | partial: a warm hue on a light page | Kept: the warm hue is a ramp that encodes thrust, never an accent. Paper stays cool. |
| near-black background, single acid/vermilion accent | dark Paper `#0e141c` (L 0.19); hero always dark; orange arc the only colour | **match** | Hero sits on the page Paper in both themes. Dark Paper lifted to a blue night-chart slate, `#131d28` (L 0.225). Dark Burn re-stepped as a full ember-to-pale-gold ramp in blackbody order, shown with its scale. Orange never appears on UI chrome. |
| broadsheet layout with hairline rules | margin-note column behind a hairline rule; hairlines between sections | **match** | One prose column. References become numbered superscripts with a popover and the list at the end. Space and titles separate sections. Gridlines only inside plots. |
| SaaS-card kit | figure cards and explorer panels with rounded corners and soft shadows | **match** | Figures sit on Paper, framed by their own axes. Explorer regions are separated by space and one Rule line where needed. Inputs drawn like instruments: 1 px ink outline, 2 px radius. No shadows, no gradients. |
| ALL-CAPS tracked eyebrows | "FIGURE 2 · SIMULATION + THEORY" | **match** (and middle dots) | "Figure 2" in sentence case before the title. A provenance key in the legend row: "Simulation" with a solid-line glyph, "Theory, Δv → 0" with a dashed glyph, "Published" with a hollow marker. |
| meta strings with middle dots | footer; mobile readout row; tooltips | **match** | Labelled pairs: definition lists in the footer and tooltips; label–value cells in the readout row. |
| monospace for small data labels | Fira Mono readouts | **match** | Fira Mono dropped. All numbers in Fira Sans with `tabular-nums lining-nums`. |
| "→" after links | "Open the explorer →", "Copy link →" | **match** | Plain underlined links; buttons named by action ("Copy link"). |
| 01/02/03 markers on non-sequences | numbered nav rail | **match** (the numbers add nothing) | Nav shows plain titles with a tick at the current section. "Figure n" stays: captions and prose cite figures by number. |
| fade-and-slide on every section | figures fade in on scroll | **match** | Removed. The hero's single sequence is the only motion on load. |
| big number with small label in the hero | "99.2 % of bonus kept" tile | **match** | η and Π become annotations on the plot, with leaders to the exit branches and the arc, at figure-text size. The drawing is the bold element. |
| (also checked) gradient wash | radial glow behind the planet | **match** | Flat surfaces only. |
| (also checked) one link-and-focus accent colour | Signal blue | **conflicts with principle 1** | Signal dropped: links are underlined Ink; focus is a 2 px Ink ring with a 2 px Paper offset; the reader's case is an Ink ring with a crosshair. Six named colours remain. |

### Palette after pass 2: six named colours
Generated in OKLCH and checked with the dataviz validator: ordinal ramp checks (monotone L,
adjacent ΔL ≥ 0.06, light end ≥ 2:1 on the surface, one hue within 40°) and WCAG text contrast.

| name | light | dark | role | check |
|---|---|---|---|---|
| Paper | `#f8fafc` oklch(0.985 0.003 230) | `#131d28` oklch(0.225 0.026 252) | page and chart surface | – |
| Ink | `#17202b` | `#e9edf2` | text, axes, trajectories, simulation marks, links, focus, reader's case | 15.7:1 / 14.5:1 on Paper |
| Graphite | `#535c66` | `#a9b2bb` | secondary text, ticks, theory lines (dashed) | 6.5:1 / 7.9:1 |
| Rule | `#d6dbe0` | `#343e4a` | gridlines, band fill, input outlines at rest | non-text |
| Burn | `#e6a25a #e18628 #d36d02 #be5802 #aa4302 #952e02 #782414` | `#933f28 #b64b1a #d2600c #e87a1c #f79942 #ffba72 #ffdbaf` | a·v only (hero, explorer, engines, timing profile) | all ramp checks pass; light end 2.07:1 / 2.42:1; hue spread 33° / 36° |
| Slate | `#e8f0f6 #c1cfda #9caebf #798fa4 #57708a #385371 #1a3658` | `#222f3f #3b4a5a #566677 #738495 #91a3b3 #b0c3d3 #d0e5f4` | η heatmap; v∞/v_esc families; profile band | monotone and one hue (15°). The light end is meant to recede (heatmap only, never thin marks) |

- **Burn and Slate are distinct:** mid Burn against mid Slate has normal-vision ΔE 20.1 and CVD
  ΔE 16.8 in light mode (21.6 and 15.6 in dark), above the 15 and 8 floors.
- **Status gets no colour:**
  - impact and SOI warnings use an icon, text and an Ink outline;
  - negative-η and impact cells in the atlas use the 45° and 135° line texture in Ink, not red.
- **Dark mode is selected, not inverted:** its own steps, with Burn anchored bright at high a·v.

### Typography after pass 2
| role | face | sizes, desktop / 390 px | notes |
|---|---|---|---|
| Hero title | Source Serif 4, opsz 60, wght 560 | 57 / 39 px | the only display size |
| Section title (h2) | Source Serif 4, opsz 36, wght 600 | 33 / 27 px | sentence case |
| Figure title (h3) | Source Serif 4, opsz 24, wght 600 | 23 / 20 px | "Figure n" in Graphite, then the title |
| Prose | Source Serif 4, opsz auto, 400, italic for variables | 19 / 17 px, line height 1.6, max 66ch | under 75 characters per line |
| Caption, note | Source Serif 4, 400 | 16 / 15 px | |
| Interface | Fira Sans 400 and 500 | 16 / 16 px | controls, nav, readouts (`tabular-nums lining-nums`) |
| Label | Fira Sans 400 | 13 / 13 px | ticks, legends, table cells (`tabular-nums`) |
| Annotation | Fira Sans Condensed 400, 500, italic | 14 / 13 px | on-plot labels and leaders |
| Math | KaTeX | inherits | Π, η, v∞/v_esc, Π²/96, R☉ |

The scale is a 1.2 ratio from 19 px: 13, 16, 19, 23, 27, 33, 39, 47, 57.

### Revised hero wireframes (pass 2)
```
HOME HERO, 1440 px (pass 2): page Paper, flat, both themes
+------------------------------------------------------------------------------------------------+
| Oberth Efficiency Atlas                                  Explorer   Methods   Source   Theme   |
|                                                                                                |
|  How much of the Oberth bonus does a real engine keep?                                         |
|                                                                                                |
|     incoming                                     Pi = t_b / tau = 0.76                         |
|        `.                                          (arc length ~ Pi r_p) ----.                 |
|           `-.          .--.                                                 |                 |
|              `-.     ( body )  ##########  thrust arc, Burn ramp by a.v      v                 |
|              _.-'     `--'    <-drag either end to lengthen the burn->                        |
|          _.-'  - - - - - - - - impulsive exit                                                 |
|      _.-'      ------------ finite exit      eta = 0.992 of the impulsive bonus kept          |
|                                                                                                |
|   Pi  0.001      0.01      0.1   |  1         10        100       1000    (slider = Pi axis)  |
|       |----------|---------|-----|--o---------|---------|---------|      0.1% and 1% marked  |
|   a.v scale: [##########] Burn ramp, W/kg (nondimensional in the hero)                         |
+------------------------------------------------------------------------------------------------+

HOME HERO, 390 px (pass 2)
+--------------------------------------+
| Oberth Efficiency Atlas   Menu Theme |
| How much of the Oberth bonus does    |
| a real engine keep?                  |
|  `.     .--.                         |
|    `-. (body)####   Pi = 0.76        |
|   _.-'  `--'                         |
|  - - impulsive    eta = 0.992        |
| Pi |---|---|-o-|---|---|             |
|  (thumb hit area 44 px)              |
+--------------------------------------+
```

**The orchestrated moment.** On first load:
1. The incoming branch draws in toward the body.
2. The arc ignites at periapsis and spreads to its default length, heating through the Burn ramp.
3. The finite exit peels away from the dashed impulsive exit, and the η annotation settles.

The sequence lasts about 2.4 s and runs once. With `prefers-reduced-motion`, the final frame is drawn
immediately. After that, motion only follows the reader's drag.

### Other wireframes after pass 2
The structure of the universal-curve and explorer wireframes is unchanged. These changes apply:
- no cards, shadows, eyebrows, arrows or Signal blue;
- the provenance key sits in the legend row;
- the mobile readout row becomes label–value cells;
- the explorer's three regions are divided by space and one vertical Rule line.

## 6. Open questions for the author
1. **Colour divergence.** The site reserves Burn for a·v. The committed paper figures keep the blue
   ramp for a·v and η. Accept the difference (paper figures frozen), or plan a separate re-colour
   after the freeze?
2. **Engine trajectories.** I recommend that `export_site_data.py` *import* the animation's own
   `build_cases` and `trajectory`, which is the same code path and gives identical arrays, with a
   test against `anim_numbers.json`. The alternative is an `--export` flag added to
   `anim_engines.py`, which changes a frozen script.
3. **Theory evaluation.** The export evaluates theory curves by calling the frozen library functions
   (asymptotes, Π_T, timing closed forms, linear-response contours). Is that acceptable as "reading"?
4. **The IA changes in §1:** the order, the mission-sample layer, the body selector for SOI, and the
   Limitations section.
5. **Placeholders in production.** Show a neutral line ("Text for this section is in preparation."),
   or hide unwritten sections from the deployed site until the prose lands?
6. **Playwright in CI.** It adds about 2–3 minutes per push and catches a broken build before deploy.
   I recommend yes.
7. **The `/style/` page.** Dev only (recommended), or deployed unlinked with `noindex`?
8. **Section titles.** I use the brief's titles as working titles in front matter. You may rename them
   along with the prose.

## 7. After approval: checkpoint 1
- Build `/style/` showing the tokens, the type scale, one chart (the universal curve with real
  data) and one control set, in both themes.
- Screenshot it at 1440 and 390 px, then stop for review.
- Log decisions and deviations in RESEARCH_LOG.md as they are made, and commit after each
  meaningful step.
