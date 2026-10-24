# Phase 8 plan: restyle the site to match the classic explorer

Brief: the author, 2026-10-23.
- **The aim:** the site takes the colour scheme and visual style of the single-file explorer
  (`explorer/oberth_explorer.html`, served at `/explorer/classic/`). It replaces the Phase 6 design
  system's look.
- **Unchanged:** pages, structure, data and behaviour.
- **Where the classic explorer and the Phase 6 plan conflict**, the classic explorer wins. Each
  conflict is noted in §8.
- **The classic explorer stays byte-identical.**

This is step 1: inventory, mapping, checks and a preview. No site code has changed. The preview
used a temporary stylesheet injected by a throwaway Playwright spec; neither is committed.

## 1. The classic explorer's design (`explorer/app.css`, `app.js`, `template.html`)

**Two themes.** Light by default; dark under `prefers-color-scheme: dark` unless `data-theme="light"`
is set, and under `data-theme="dark"`. This is the same mechanism the site uses.

| token | light | dark | used for |
|---|---|---|---|
| `--bg` | `#fcfcfb` | `#121211` | page surface ("project figure surface") |
| `--panel` | `#f3f2ee` | `#1b1b19` | figure panels, selects |
| `--ink` | `#0b0b0b` | `#edece7` | text; the Π²/96 bound (dashed) |
| `--ink-2` | `#52514e` | `#b6b4ab` | secondary text, tick labels, coast path, band median |
| `--muted` | `#898781` | `#8b897f` | eyebrows, tile labels, ring labels, unpowered arrival (dashed), non-Sun bodies |
| `--grid` | `#e1e0d9` | `#2b2b28` | gridlines, rings, tile top rules |
| `--axis` | `#c3c2b7` | `#4b4a45` | plot frame, control outlines, the loss band (60 % opacity) |
| `--accent` | `#2a78d6` | `#5d9ce8` | the burn (one colour), the reader's case marker, focus rings, checked controls |
| `--sun` | `#e9a93a` | `#e7b14e` | the Sun |
| `--critical` | `#c8302f` | `#f0605e` | "bad" chips, a case outside the atlas |
| `--ok` | `#1a8a5f` | `#3cc28d` | "good" chips |
| `--ramp-0…6` | `#e3eefb #9ec5f4 #6da7ec #3987e5 #256abf #184f95 #0d366b` | `#16263d #1a3a66 #1f5394 #2f72c4 #5b97e0 #94bdf0 #d3e5fb` | η atlas (one hue, faint → strong) |

**Type.** These are web fonts loaded from Google Fonts, not system fonts:

| role | face | stack |
|---|---|---|
| body | Barlow 400/500/600 | `"Barlow", "Helvetica Neue", Arial, sans-serif` |
| display | Barlow Semi Condensed 600/700 | `…, "Arial Narrow", "Helvetica Neue", Arial, sans-serif` |
| data | IBM Plex Mono 400/500 | `…, ui-monospace, "SFMono-Regular", Consolas, monospace` |

- **Steps:** 13, 15, 18, 24 and 34 px. Body is 15 px with line height 1.5.
- **h1:** 34 px Barlow Semi Condensed 700, letter-spacing 0.01em.
- **Eyebrows:** 13 px, 600, uppercase, tracked 0.08em, muted.
- **Readouts:** Plex Mono 18 px; the key readout 24 px.
- **Ticks:** Plex Mono 11 px. **Axis titles:** Barlow 12 px.

**Spacing, borders, radii.**
- **Page:** max 1240 px wide, 16 px gutters; gaps of 20, 16, 14, 12, 10 and 6 px.
- **Panels:** 8 px radius, 10 px padding, no border, no shadow.
- **Selects:** 6 px radius, 1 px `--axis` border, 6 × 8 px padding.
- **Segmented choices:** pills (999 px radius), 1 px `--axis` border, 5 × 10 px padding. The checked
  pill gets an accent border; radio buttons are drawn with `accent-color`.
- **Notes:** a 2 px accent left rule.
- **Readout tiles:** a 2 px top rule (`--grid`; accent on the key tile).
- **Focus:** a 2 px accent outline with a 2 px offset.

**Charts.**
- **Gridlines and frame:** gridlines 1 px `--grid`; the plot frame 1 px `--axis`.
- **Trajectory:**
  - coast in `--ink-2` at 1.6 px;
  - the burn in `--accent` at 4 px with round caps, a single colour with no a·v encoding;
  - a ring (r 7 px) around a burn shorter than 8 px;
  - the unpowered arrival dashed (5, 4) in `--muted` at 1.2 px;
  - rings: r_p dashed (4, 4) in `--axis`, the others solid in `--grid`.
- **Loss chart:**
  - the band `--axis` at 60 %, its median `--ink-2` at 1.2 px;
  - the Π²/96 bound dashed (6, 4) in `--ink` at 1.4 px;
  - 1 % dotted (2, 3) in `--muted`;
  - the reader's case an accent dot (r 6) with a 2 px `--bg` ring.
- **Atlas:**
  - the ramp, interpolated;
  - a colour bar;
  - the reader's case an Ink ring (r 8) on a `--bg` halo, `--critical` if outside.

## 2. Mapping onto the site's roles

| site role | today (Phase 6) | proposed |
|---|---|---|
| page surface | Paper `#f8fafc` / `#131d28` | `--bg` |
| figure, finding and hero surface | Paper (no panels) | `--panel`, 8 px radius, 10 px padding (classic panels) |
| text | Ink | `--ink` |
| secondary text | Graphite | `--ink-2`; `--muted` only for non-text, see §4 |
| gridlines | Rule | `--grid` |
| plot frame and axes | Ink axes | frame `--axis`; the two axis lines `--muted` (§4) |
| control outlines | Graphite, 2 px radius | `--muted` (the fix in §4), classic radii: pills for segmented choices, 6 px for selects and inputs |
| focus ring | 2 px Ink, Paper offset | 2 px `--accent`, 2 px offset |
| links | underlined Ink | underlined blue: `--ramp-4` `#256abf` in light (§4), `--accent` in dark |
| a·v ramp | Burn (orange) | the classic blue ramp from `--ramp-2` to `--ramp-6` (derivation, §3) |
| η heatmap ramp | Slate | `--ramp-0…6` |
| v∞/v_esc family colours | Slate 3–7 | `--ramp-2…6` |
| simulation lines | Ink solid | `--ink-2` solid (curves), `--ink` (trajectories); line style unchanged |
| theory lines | Graphite dashed | `--ink` dashed (6, 4) |
| profile band | Slate 2 fill, Slate 5 edges | `--axis` at 60 % (light `#dcdcd6`, dark `#3c3b37`); edges `--muted` |
| published-case markers | hollow, Ink | hollow, `--ink` (derivation; the classic has none) |
| the reader's case | Ink ring with crosshair | accent dot with a `--bg` ring where the figure has no blue; Ink ring with a halo on blue (the atlas, the family curves), as the classic atlas |
| warnings (impact, SOI, capture) | icon, text, Ink outline | icon and text kept; `--critical` colour and outline (classic `.chip.bad`) |
| thresholds (0.1 %, 1 %) | dotted Graphite | dotted (2, 3) `--muted` |
| the Sun | Rule fill, Graphite edge | `--sun`; other bodies `--muted` |
| hero lanes, engine paths | Burn ramp; Ink with dashes | blue a·v ramp; `--ink`/`--ink-2` with the same dashes |
| type | Source Serif 4, Fira Sans, Fira Sans Condensed | Barlow, Barlow Semi Condensed, IBM Plex Mono; KaTeX unchanged for typeset math |

## 3. Derivations (no classic equivalent; each stays in the classic style)

- **The a·v ramp.**
  - The classic paints the burn a single blue. The paper's engines animation colours a·v with the
    paper's blue ramp, which is the classic's ramp. So a·v takes seven steps interpolated in OKLab
    from `--ramp-2` to `--ramp-6`:
    - light `#6da7ec #4b92e8 #327dd8 #256abf #1c58a3 #144687 #0d366b`;
    - dark `#1f5394 #2a67b4 #3e7ecd #5b97e0 #81b0eb #a9caf4 #d3e5fb` (bright at high a·v).
  - The two faintest steps are left out because they are too faint for thin marks (§4).
  - **Alternative:** a warm ramp anchored on `--sun`. It would keep a·v and η apart (§5), but it is
    neither the classic's nor the paper's colour, and it would sit beside the amber Sun in the same
    figure. **Recommended: blue.**
- **The light/dark split:** none needed; the classic has both themes.
- **The atlas's special cells** (the classic atlas is theory-only, with none of these):
  - **η < 0:** the 45° hatch, drawn in `--critical`. The paper paints negative η red.
  - **impact:** the 135° hatch in `--ink-2`. The paper uses a solid grey, `#6f6e69`.
  - **no reliable η:** the dot texture in `--muted`.
  - The textures stay, so these cells never depend on colour alone.
- **Prose** (the article, the landing summary, captions). The classic has no long-form text.
  - Body prose: Barlow 18 px (the classic's step 1), line height 1.6, max 72 ch (the classic's lede
    measure).
  - Captions: 13 px `--ink-2`, as the classic's figcaption.
- **Headings.** The classic has only h1 (34 px Barlow Semi Condensed 700). By the same steps:
  - h2: 24 px, 700;
  - figure titles (h3): 18 px, 600;
  - the landing title: 34 px, which brings it to one line at 390 px. The fold and headline-budget
    tests will re-measure.
- **The landing findings and hero:** the classic's chart panels (`.charts`: 16 px gap, panel
  background, 13 px captions). The hero's canvas then paints `--panel`, not its own surface.
- **Readout tiles** (the explorer page): as the classic's tiles, η the key tile in Plex Mono 24 px.
- **Tables, tooltips, legends:**
  - tables: Plex Mono numbers, `--grid` rules;
  - tooltips: on `--panel`, with a 1 px `--axis` border and 6 px radius, as the classic's selects;
  - legends: 13 px `--ink-2`.

## 4. Palette checks

Run with a scratch script that reuses `site/tools/palette.mjs`'s colour maths (OKLab, WCAG 2). It
adds colour-vision simulation (Machado et al. 2009, severity 1).

**The classic palette as it stands.** 14 failures, all in the light theme except the control
outlines:

| check | light | dark | smallest fix that keeps the look |
|---|---|---|---|
| `--muted` as text (needs 4.5:1) | 3.50 on bg, 3.21 on panel | 5.34, 4.91: pass | Small text uses `--ink-2` (7.73 / 7.09). `--muted` stays for non-text, where it passes 3:1. |
| `--accent` as link text | 4.30, 3.94 | 6.59, 6.07: pass | Links use `--ramp-4` `#256abf` in light (5.26 / 4.82); focus rings and checked controls keep `--accent` (non-text, 4.30 / 3.94 ≥ 3). |
| `--ok` as text | 4.22, 3.87 | pass | The site shows no "good" chip; if one is ever added, use a darker green. |
| control outlines in `--axis` (needs 3:1) | 1.75, 1.60 | 2.11, 1.94 | Outline in `--muted` (3.50 / 3.21; dark 5.34 / 4.91). |
| plot frame in `--axis` | 1.75, 1.60 | 2.11, 1.94 | The frame is decorative. The two axis lines carrying ticks go to `--muted`; the rest stays `--axis`. |

**After the fixes:** 0 failures.
- **The η ramp:** OKLab lightness monotone in both themes; the smallest step 0.095 (light) and 0.082
  (dark), against a required 0.06; hue spread 3.5°.
- **The derived a·v ramp:** monotone; smallest step 0.062 / 0.071; faint end 2.44:1 on bg and 2.23:1
  on panel (light), 2.43 / 2.24 (dark), meeting the ≥ 2:1 thin-mark rule of Phase 6.

## 5. The same colour for two quantities

- **a·v and η share the blue ramp** (ΔE 0 at matching steps). They never meet in one figure, but
  they do share a page:
  - the landing page: the hero (a·v) and "Where real missions sit" (η);
  - the explorer: the trajectory (a·v) and the theory atlas (η);
  - the article: the hero and Figure 7 (a·v) against Figure 4 (η).

  Each figure keeps its own labelled scale. The paper figures have the same overlap: the animation's
  a·v and the atlas's η are both blue. The alternative is the warm a·v ramp in §3.
- **The accent and the ramp's middle steps:**
  - ΔE: 4.7 against `--ramp-3` and 5.0 against `--ramp-4` in light; 1.7 against `--ramp-4` in dark.
  - Consequence: an accent case marker would vanish on η cells or blue family curves.
  - Fix: on blue backgrounds the reader's case becomes an Ink ring on a halo, as the classic atlas
    already does (§2).
- **`--critical` against `--ok`:**
  - ΔE 28.4 normally, but only 7.0 for the worst colour-vision deficiency.
  - Consequence: red and green are confusable.
  - Fix: chips always carry text and an icon. The site has no "good" chip anyway.
- **The `--sun` amber** stays far from the blue a·v ramp (ΔE 26.8, worst deficiency 24.6).

## 6. Fonts

- **Not system fonts.** The classic loads Barlow, Barlow Semi Condensed and IBM Plex Mono from Google
  Fonts.
- **Greek coverage.** None of the three covers Greek: Google serves Barlow and Barlow Semi Condensed
  in Latin, Latin-ext and Vietnamese only, and IBM Plex Mono adds Cyrillic. So η, Π, Δ and τ always
  come from the fallback fonts.
- **Measured on Windows** (Chrome's `CSS.getPlatformFontsForNode`):
  - body Greek renders in Arial, display Greek in Arial Narrow, data Greek in Consolas;
  - ☉ comes from Segoe UI Symbol, and two of ∞, ₚ, ⁻, ≤ from Times New Roman. The current site has
    the same symbol fallbacks.
- **Not tested on macOS, iOS or Android** (no such machine here). From each platform's documented
  font coverage:
  - macOS and iOS: Greek from Helvetica Neue in the stacks, and from SF Mono via `ui-monospace`;
  - Android: from Roboto through `sans-serif`, and from Droid Sans Mono through `monospace`.

  All include Greek, so η, Π, Δ and τ should render on all four.
- **Proposal:**
  - Self-host the three families from the pinned `@fontsource` 5.3.0 packages (published 2026-07-19,
    within the 14-day rule), Latin and Latin-ext subsets. That avoids Google requests and works
    offline.
  - Leave Greek to the system stacks, exactly as the classic does.
  - Remove Source Serif 4, Fira Sans and Fira Sans Condensed, which nothing would use.
  - Keep KaTeX's fonts for typeset math.
- **Alternative:** keep Fira Sans's small Greek subset as a fallback, so Greek glyphs have the same
  widths on every platform, CI's Linux runner included. The classic doesn't do this. **Recommended:
  the classic's way.** The layout tests check overlaps, not exact widths, and the headline budget
  test runs in CI and will catch any drift.

## 7. The paper figures' palette

- **The classic light theme is the paper palette** (`src/oberth_atlas/plotting.py`): `SURFACE`,
  `INK`, `INK_2`, `MUTED`, `GRID` and `AXIS` are identical, and `--accent` is `SERIES[0]`.
- **`--ramp-1…6` equal `BLUE_RAMP[1…6]`.** Only the faintest step differs: `#e3eefb` against
  `#cde2fb`.
- **The paper colours a·v** (the engines animation) and **η** (the atlas, diverging from red through
  grey) with that blue ramp, which matches the proposal in §2–3.
- **Differences that remain:**
  - the paper has no dark theme;
  - some paper figures use the categorical orange (`SERIES[1]`, theory asymptotes in `fig_regimes`)
    and aqua (`SERIES[2]`), which neither the classic nor the site uses;
  - the paper's negative-η red is `#e34948` (the classic's `--critical` is `#c8302f`);
  - the paper's font is Segoe UI / DejaVu Sans.

So with this restyle the site matches the paper's palette for every role the two share. Whether
that retires the planned v1.1-figures recolour is the author's call, recorded in step 2.

## 8. Conflicts with the Phase 6 design plan

The author's preference wins in each case.

| Phase 6 rule (pass 2, generic defaults) | the classic explorer | follow |
|---|---|---|
| cool Paper, no warm cream | warm grey surface `#fcfcfb`, panel `#f3f2ee` | classic |
| no single accent; links and focus in Ink | one blue accent: burn, case, focus, checked controls | classic (links fixed for contrast) |
| no SaaS-card kit: figures on Paper, no panels | figures in tinted 8 px panels (flat, no shadow) | classic |
| no ALL-CAPS tracked eyebrows | uppercase tracked eyebrows for control groups | classic |
| no monospace data labels | IBM Plex Mono for ticks and readouts | classic |
| no big-number tiles | readout tiles with a 24 px key value | classic (explorer readouts) |
| no pill buttons | pill-shaped segmented choices | classic (controls only; entry links stay links) |
| status gets no colour | red/green chips | classic colour, keeping the icon and text |
| Burn ramp = a·v, the only strong colour | blue for burn, η and accent | classic (§5) |
| serif prose, display serif title | sans throughout | classic |

Unchanged:
- no gradients;
- no fade-and-slide;
- no arrows after links;
- no middle-dot meta strings;
- figures unnumbered on the landing page.

## 9. Preview: current against proposed

`docs/screens/phase-8-proposal/`: the landing hero, Figure 2 (the universal curve) and Figure 4 (the
atlas), at 1440 and 390 px in both themes. In each image the current look is on the left and the
proposed look on the right.

The proposed side uses a temporary token override with the §4 fixes, plus three preview-only rules:
- headings in Barlow Semi Condensed;
- figure panels;
- link colour.

Passes 2 and 3 add what the preview lacks:
- pill controls, tiles and eyebrows;
- the hero canvas on the panel colour, the amber Sun;
- Plex Mono on the canvas ticks;
- Ink rings for the case on blue;
- the critical warnings.

## 10. Step 2, after approval

Three commits, as briefed:
1. **Tokens:**
   - `tools/palette.mjs` emits the mapped palette, with the checks above as its pass/fail rules;
   - `base.css` roles;
   - `fonts.css` for the three self-hosted families (Source Serif 4 and Fira Sans removed);
   - the type scale.
2. **Components:** controls (pills, selects, eyebrows), panels, tables, tooltips, legends, readout
   tiles, warnings, links and focus.
3. **Charts:**
   - axes and frames, Plex Mono ticks;
   - lines and dashes per §2, the band, thresholds;
   - the Sun, the case markers, the atlas textures;
   - the hero and Figure 7 canvases on the panel colour.

Then:
- the Open Graph image;
- `check_all.py`, Playwright on all three builds (the label-placement, fold and headline-budget tests
  re-measure), and Lighthouse in CI;
- the v1.1-figures decision in the research log;
- screenshots of every page at 1440 and 390 px in both themes.

## 11. Decisions for the author

1. **The a·v ramp:** blue, as the classic and the paper (recommended), or a warm ramp kept apart
   from η (§3, §5)?
2. **Greek glyphs:** system fallbacks, as the classic (recommended), or a self-hosted Greek subset
   for identical metrics everywhere (§6)?
3. **The derivations in §3:** prose at 18 px Barlow, heading sizes, the atlas textures (η < 0 in
   red, impact in grey), and panels for the landing findings. Approve or adjust.
4. **The contrast fixes in §4:** darker blue links in light, `--muted` outlines and axis lines, and
   `--ink-2` for small secondary text. These are the minimum for WCAG AA. Any you'd rather handle
   differently?
