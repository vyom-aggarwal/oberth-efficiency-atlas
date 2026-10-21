# Phase 7 plan: a landing page and a references page

Brief: the author, 2026-10-21. The analysis freeze holds, and this is a site-only change. It works
inside the Phase 6 design system (`docs/site_plan.md` §5):
- the six colours, with Burn reserved for a·v;
- Source Serif 4 and Fira Sans;
- the provenance conventions;
- the generic-defaults rules.

## 1. Information architecture

| path | content | published |
|---|---|---|
| `/` | the landing page (§2) | always |
| `/research/` | the current long-form article, every section and figure, moved from `/` | only once at least one article section is published (proposal A) |
| `/references/` | the numbered list with stable anchors `#ref-1` … `#ref-10` | always |
| `/explorer/`, `/explorer/classic/`, `/404.html` | unchanged, apart from navigation | always |

**Navigation:** Research (conditional), Explorer, References, Source, then the theme switch. The
wordmark links to `/`. The header's Methods link goes, as the brief's list implies; the Methods
section stays in the article.

**Proposals, each with its reason:**
- **A. Leave `/research/` out of the production build while every section is TODO.** "Never link to
  an empty page" then holds by construction: the page does not exist. Dev and `SITE_SHOW_TODO=1`
  builds always include it, as now.
- **B. Redirect old anchors.** The deployed `/` currently serves `#references` and `#ref-n`. A few
  lines on the landing page send:
  - `#ref-n` to `/references/#ref-n`;
  - `#<article-section>` to `/research/#<section>` when that section is published.
- **C. Citations link across pages.** Every superscript points to `<base>references/#ref-n`: in
  Markdown (content plugin) and in `cite.ts`. The research page loses its References section; the
  AI-use disclosure section stays there.
- **D. One Open Graph image for every page:** the landing hero's final frame. Each page keeps its
  own `og:title`, `og:description` and `og:url`.

## 2. The landing page

### Wireframes (values shown come from the data; nothing is typed)
```
LANDING, 1440 px                                          page Paper, flat, both themes
+--------------------------------------------------------------------------------------------------+
| Oberth Efficiency Atlas                       [Research]  Explorer  References  Source    Theme    |
|                                                                                                  |
|  HERO: one shared log-radial view, drawn sideways at this width (legs to the left, Sun at right)  |
|   30 r_p        10 r_p         3 r_p   (dashed Rule rings, Graphite labels)                       |
|   incoming  ------------------------------------------------------------.                         |
|                                                                          `.     lane 1  Solid       |
|                                                            .-.             :    lane 2  Nuclear     |
|                                                           ( Sun )          :   lane 3  SEP*        |
|                                                            `-'            .'   (burn arcs on the    |
|   exits: Solid stack ---  Nuclear thermal - -  SEP-class* . .  ----------'     a.v ramp, beside    |
|                                                                                their own paths)    |
|  Solid stack ---            Nuclear thermal - -           SEP-class* . .                           |
|  burn 3.51 min, Pi = 0.0326  burn 3.00 h, Pi = 1.67        burn 27.5 d, Pi = 368                    |
|  loss 1.19 x 10^-5 of dv     loss 2.79 % of dv             loss 75.9 % of dv                        |
|  t = +413 h from perihelion [=============================================o]  a.v, W/kg 10^2 [ramp] 10^8 |
|  * hypothetical at 3.2 R_sun                                                     Show data        |
|                                                                                                  |
|  Oberth Efficiency Atlas                   h1, Source Serif display 57 px, left-aligned            |
|  [headline: author slot, 27 px serif, one or two lines]                                           |
|  [summary: author slot, prose 19 px, 66ch]                                                        |
|  Read the research     Open the explorer     View the source on GitHub    (underlined links, 19 px) |
|                                                                                                  |
|  Findings                                                                                        |
|  Loss against Pi, with the 1 % line           Three regimes of eta_W against Pi                    |
|  [live thumbnail, about 600 x 300]            [live thumbnail]                                      |
|  [caption: author slot]                       [caption: author slot]                                |
|  In the research | In the explorer            ...                                                   |
|  Energy kept by each engine                   Where real missions sit                              |
|  [strip; its cursor follows the hero clock]   [eta atlas thumbnail with mission samples]           |
|                                                                                                  |
|  Reproducibility and scope                                                                        |
|  Fresh-clone audit   69 of 69 outputs reproduced identically (commit f185234, 2026-10-19)          |
|  Tests               608 in the suite; 600 passed in the audited clone                             |
|  Analysis tag        v1.0-analysis (commit 976b4d8)                                                |
|  Sweep               135,720 simulated flybys                                                     |
|  Engines             Hydrolox, Methalox (vac), Nuclear thermal, Hall thruster, Gridded ion; solid stack (case study) |
|  Bodies              Sun, Venus, Earth, Mars, Jupiter, Saturn                                      |
|  Rebuild and audit   docs/repro.md                                                                |
|                                                                                                  |
|  footer, labelled pairs: Author, Cite this project (citation block), Licence,                      |
|  AI-use disclosure, Source code, Offline explorer                                                  |
+--------------------------------------------------------------------------------------------------+

LANDING, 390 px
+--------------------------------------+
| Oberth Efficiency Atlas   Menu Theme |
|   in          out   (drawn upright:  |
|    |  : : :  |       Sun at bottom)  |
|     \  (Sun) /                       |
|      `.____.'                        |
|  lanes: Solid / Nuclear / SEP*       |
| t = +413 h from perihelion           |
| [=============================o]     |
| a.v, W/kg 10^2 [ramp] 10^8           |
| --- Solid    burn 3.51 min, ...      |
| - - Nuclear  burn 3.00 h, ...        |
| . . SEP*     burn 27.5 d, ...        |
| * hypothetical at 3.2 R_sun          |
| Oberth Efficiency Atlas  (h1 39 px)  |
| [headline slot]                      |
| [summary slot]                       |
| Read the research                    |
| Open the explorer                    |
| View the source on GitHub            |
| Findings: four, stacked, full width  |
| Reproducibility and scope: pairs     |
| footer                               |
+--------------------------------------+
```
At 390 × 844 the h1 starts at about 680 px, above the fold. At 1440 × 900, the title, the headline and
the entry links are above the fold.

### The hero
- **Data:** `engines.bin` and `engines.json`, the animation's own trajectories, already exported.
- **View:** the animation's log-radial view (ρ = 1 + log₁₀ r/r_p) with its 3, 10 and 30 r_p rings.
  It is drawn sideways at 768 px and up, where it is wider than tall, and upright below that.
- **Telling the engines apart without colour:** the line styles of the engines strip (solid, dashed,
  dotted, all Ink), and direct labels.
- **Burn arcs side by side:**
  - The three paths nearly coincide around perihelion, so each burn arc is drawn on the a·v ramp in
    its own lane, offset outward from its path. Lane 1 is the Solid stack, lane 2 Nuclear thermal,
    lane 3 SEP-class.
  - The pinpoint chemical burn and the smeared SEP arc then sit side by side.
  - Along the path the arcs are exact; only the offset is schematic. A legend line says so.
- **The caveat:** the label "SEP-class*" with the note "* hypothetical at 3.2 R☉", both from
  `engineLabel()`, under the scrub control at every width.
- **Engine facts:** burn time, Π and loss for each engine, in a key under the drawing, from
  `engines.json` with source pointers. These are labels on the figure, not number tiles.
- **Accessibility:**
  - the canvas has a summary generated from the data;
  - "Show data" opens the three engines' table;
  - the scrub control is a native range input, with time shown as `aria-valuetext`.

### The hero sequence (at most 3.0 s, on first load, once)
0. **0.0 s:** the static frame appears at once (no fade): the Sun, the rings and the three full paths
   in Rule. The clock sits at the window's start.
1. **0.0–2.4 s:** the clock sweeps the window uniformly in asinh(t/τ), the scrub control's own
   scale, so perihelion gets most of the screen time.
   - Each engine's marker travels its path, and the travelled path turns Ink in its line style.
   - Each lane lights on the Burn ramp while its engine fires: the SEP arc grows through the whole
     sweep, the nuclear arc burns in about 0.3 s at perihelion, and the solid stack's pinpoint flashes
     at the apex.
2. **2.4–2.8 s:** the clock holds at the window's end, and the direct labels at the three exits
   appear (appear, not slide).
3. **2.8–3.0 s:** the final frame. The scrub control then belongs to the reader, and the page marks
   the hero `data-intro="done"`.

Rules:
- Any reader input during the sequence (a key, the pointer, a scroll, the scrub) ends it at the
  final frame, as the article hero already does.
- With `prefers-reduced-motion`, the final frame is drawn at once (`data-intro="skipped"`).
- **Once:** per browser session, through `sessionStorage` wrapped in try/catch, so coming back from
  the explorer does not replay it. If storage is unavailable, it plays once per load (proposal E).

### Findings (four small live figures; proposal F)
Each finding has:
- a figure title (interface text, no "Figure n": nothing cites them by number);
- a live drawing from exported data, with a hover or focus readout through `common.tooltip`, and an
  accessible summary;
- a caption slot for the author;
- one link: "In the research" when its section is published, else "In the explorer" with a state.

| finding | drawing | data (loaded when near the viewport) | link |
|---|---|---|---|
| Loss against Π, with the 1 % line | the profile band (Slate), Π²/96 dashed (theory), the 1 % line, and the Π at which loss reaches 1 % marked from `curve.thresholds` (sourced); the three hero engines placed on it | `curve.json` (35 KB) | `/research/#universal-curve`, else the explorer's Hibberd preset (shows the curve placement) |
| Three regimes of η_W against Π | the sweep medians for the middle v∞/v_esc family, the asymptotes dashed, regime names on the curve as in the article figure | `regimes.json` (156 KB) | `#regimes`, else the explorer at `?preset=jupiter.gridded_ion` (large Π) |
| Energy kept by each engine | the energy-gain strip from `engines.bin`, three line styles; its cursor follows the hero clock (a linked view, already loaded) | none extra | `#engines`, else the explorer's Hibberd preset |
| Where real missions sit | the η atlas cells (Slate) for the default slice, with the mission samples as Ink dots | `atlas.json` + `missions.json` (308 KB) | `#atlas`, else `?preset=earth.hall` |

### Reproducibility and scope
- A `dl.facts` list of labelled pairs, as in the methods section.
- **Values:**
  - `methods.json`: the audit, the tests and the tag;
  - a new `methods.scope` block in the exporter:
    - the mission engines and bodies, from `configs/atlas/presets.yaml`;
    - the sweep's row count, from `figures/phase2_numbers.json#/sweep/rows`;
    - each with its `src`.
- The block links to `docs/repro.md`.

### Footer
Labelled pairs on every page:
- Author;
- Cite this project, a short citation block with a "Copy" button;
- Licence;
- AI-use disclosure, linking to `docs/ai_use_log.md`;
- Source code;
- Offline explorer.

There is no LICENSE or CITATION.cff in the repository yet (proposal G).

### Prose slots
- **Files:** `site/content/landing/headline.md`, `summary.md`, and one caption file per finding.
  Each starts as TODO notes.
- **Production:** a slot is omitted while its file has TODO, with no placeholder line. The layout
  closes up, so the page reads as finished.
- **Dev:** the dev server shows the TODO notes, as now.
- **`SITE_PLACEHOLDERS=1`** (development mode only; the production build refuses it) fills every
  slot with bracketed text of its target length, for the "filled" screenshots.

## 3. What it reuses
- **Page and data:**
  - `shell.ts`, for the header, menu and theme switch;
  - the header and footer partials, extended;
  - the content plugin, for TODO hiding, KaTeX and Markdown;
  - `lib/dom`, `lib/data`, `lib/format`, `lib/cite`, `lib/theme` and `lib/engine-label`.
- **The hero:** the engines figure's drawing (log-radial mapping, rings, Sun, path, a·v ribbon) moves
  into a shared `charts/dive-view.ts`. Figure 7 and the landing hero both use it, so the article's
  figure does not change.
- **Figures:** `charts/common.ts`:
  - `logAxes`, `piTick` and `place`;
  - `LabelPlacer` and `labelRow`;
  - `tooltip`, with its redraw-safe state, and `hitTarget`;
  - `dataTable`.
- **Styles:** `dl.facts`, the ramp-bar legend, the range-input style and the Burn and Slate tokens.
  No new colours or type sizes.
- **Tooling:**
  - `tools/og-image.mjs`, pointed at the landing hero;
  - `tools/lighthouse.mjs`, with pages `/`, `/research/`, `/explorer/` and `/references/`, at
    mobile and desktop;
  - `e2e/layout.ts` and the fixtures.

## 4. Pass 2: against the Phase 6 list of generic defaults

| default to avoid | landing risk | decision |
|---|---|---|
| warm cream background, terracotta accent | an orange hero | Paper stays cool. Burn appears only on the burn arcs and their scale. |
| near-black background, single accent | a dark "space" hero band | The hero sits on page Paper in both themes, with no band and no stars. |
| broadsheet layout, hairline rules | rules between landing sections | Space and h2 titles separate sections. Gridlines only inside plots. |
| SaaS-card kit | feature cards for findings, pill buttons for entry points | Findings are figures framed by their own axes. Entry points are underlined links. |
| ALL-CAPS tracked eyebrows | "FINDINGS", "REPRODUCIBLE" | Sentence-case h2 only. |
| meta strings with middle dots | the scope line, the footer | Labelled pairs (`dl`) throughout. |
| monospace data labels | audit hashes, numbers | Fira Sans, tabular figures. |
| "→" after links | "Open the explorer →" | Plain link text, no arrows. |
| 01/02/03 markers | numbered findings | Unnumbered. Nothing cites them by number. |
| fade-and-slide on scroll | findings sliding in | None. The 3 s hero sequence is the only motion on load. |
| big number with small label | "69/69", "608 tests", "75.9 %" tiles | None. Numbers sit in sentences, keys and labelled pairs. |
| gradient wash | a glow behind the Sun | Flat surfaces. |
| one accent colour | a coloured primary button | Ink links and focus rings, as everywhere. |
| landing templates (new) | centred hero title with a subtitle and three CTA buttons; icon feature grid; logo strip | The drawing comes first. The title, headline and links sit left-aligned under it. No icons or logos. |

## 5. Build order and tests (after approval)
1. **`/references/` and the route move.**
   - Build the references page, the move to `/research/`, conditional navigation, cross-page
     citations and the legacy redirect.
   - Update the existing specs to `/research/`.
   - Add tests: every citation link resolves to an existing anchor, and a production build with
     every section TODO has no Research link and no `/research/`.
2. **The landing page,** in this order:
   - the `dive-view` refactor, with Figure 7's tests unchanged;
   - the hero;
   - the findings;
   - reproducibility and scope;
   - the footer;
   - the prose slots;
   - the Open Graph image.
3. **Tests** (Playwright on the landing page):
   - no console errors;
   - no sideways scroll at 360, 390, 768 and 1440 px;
   - the sequence runs once and is skipped under reduced motion;
   - scrubbing moves the clock and the strip's cursor;
   - every entry link resolves under the base path;
   - the Research link stays hidden while no section is published.

   Also: the Lighthouse gate extended to `/` and `/references/`, and every article spec passing at
   `/research/`.
4. **Screenshots** at 1440 and 390 px in both themes, in two states: production (slots empty) and
   `SITE_PLACEHOLDERS=1` (slots filled). Then stop for review.

Deviations are logged in RESEARCH_LOG.md as they are made. Deploys stay manual.

## 6. Open questions
- **E.** Should the hero sequence play once per session (proposed) or once per page load?
- **F.** Four findings or three? Dropping "Where real missions sit" saves 308 KB of lazily loaded
  data. Are the explorer states in the table above the ones you want?
- **G.** The footer needs your name as you want it cited, and a licence. I propose:
  - a `CITATION.cff`, which GitHub's "Cite this repository" button also reads, as the single source
    of the footer's citation block;
  - a `LICENSE` file of your choice, for example MIT for the code and CC BY 4.0 for the text and
    figures.

  Until they exist, the footer omits those rows rather than showing a placeholder.
- **A–D:** do proposals A to D in §1 suit you?
