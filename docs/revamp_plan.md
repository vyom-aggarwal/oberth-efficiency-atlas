# Phase 9 plan: a dark, portfolio-style revamp

**Brief** (the author, 2026-11-01): a dark interpretation of https://suhaslord.github.io/portfolio/, with this project's
content and data.
- The site becomes dark only: no light theme, no theme toggle, `color-scheme: dark`.
- The analysis freeze holds. Every contract that is not visual stays (§2.9).
- Work happens on the branch `phase-9-revamp`; main changes only through a pull request with green CI.

**Revised the same day, after the author's review of steps 1–2:**
- **Copying.** Copying from the reference is allowed, and the result should be close to it. Its repository is under
  the MIT licence, so attribution is required (§3). Its personal content stays out.
- **Distinctness.** The result must stay distinguishable: dark only, the live dive in place of the portrait, and our
  own structure, content, marquee text and preloader words.
- **Libraries:**
  - GSAP is allowed (§1, licence);
  - Lenis is allowed under four conditions (§2.6);
  - Barba is not; native cross-document View Transitions may stand in for it.
- **Decisions 1–6** are answered in §2.10. This revision applies them.

**Revised again on 2026-11-02, after the author's second review:**
- **Scope: every page.** The new styling covers the whole site: the landing page, the research article and every figure
  (charts, tooltips, legends, controls, tables, captions, section navigation, KaTeX), the explorer's whole interface,
  the references, the About page and the 404 page. Only the classic offline explorer at `/explorer/classic/` stays
  byte-identical, as the fallback (§2.12). The style page gains samples of an article figure, the explorer and the
  references (§2.11).
- **Less copying of signature features.** Styling may be borrowed: palette, typography, spacing, panels, general
  layout feel. The reference's distinctive interactions may not. Every adapted element is classified in §1.3, and each
  signature interaction is replaced by one of this project's own (§2.5, §2.6). The test: someone who knows both sites
  should not recognise any of them as the same trick.
- **Decisions:** GSAP is not used; the preloader's words are the flyby's stages in physical order; the four departures
  are approved; the closing line is the author's text, in a content slot (§2.10).

**Approved on 2026-11-02** (the author's third review; §2.10, items 11–13):
- the findings keep both steering and opening in place;
- row 02 does not steer the dive;
- the other replacements are approved;
- the preloader's stages get an assertion of their physical placement (§2.6);
- the preloader's 2 s cap gets a test against the production build (§2.6);
- the build stops for review after pass 3, the landing page (§2.13).

This document is steps 1 and 2. Step 2 adds only development-only material:
- the style page `/style-9/` (§2.11);
- the palette check `site/tools/phase9-palette.mjs` (folded into `tools/palette.mjs` in pass 1);
- the Phase 9 font set, generated beside the Phase 8 one until pass 1.

## 1. The reference (step 1)

**Captures** (Playwright, 2026-11-01, in `runs/reference/`, not committed: they are someone else's work):
- the load sequence as frames from 0.15 to 4.5 s, at 1440 × 900 and 390 × 844;
- the hero, each viewport of the page, and the footer;
- the menu, and hover states on four rows of the work list;
- computed measurements (`measurements*.json`).

After the author allowed copying, I read its code at commit `c98c5cc` (`runs/reference-src/`, not committed):
`js/site.js`, `js/motion.js`, `css/site.css` and the pages' markup.

**Licences:**
- **The repository** (`suhaslord/portfolio`): the MIT License, "Copyright (c) 2026 SuahsTheLord". The notice is kept
  verbatim in `THIRD_PARTY_NOTICES.md` (§3).
- **Typefaces:** all under the SIL Open Font License 1.1 — DM Sans, Space Grotesk, Lora and IBM Plex Mono.
- **Libraries,** as the reference vendors them:
  - **GSAP 3.15.0:**
    - Licence: the "GSAP Standard 'no charge' License" (Webflow; effective 2025-04-30, read at
      https://gsap.com/standard-license on 2026-11-01).
    - Free for anyone, commercial use included. It is not an open-source licence.
    - It forbids use in no-code visual animation tools that compete with Webflow, and removing GSAP's own notices.
    - 14-day rule: 3.15.0 was published 2026-04-13, so it qualifies.
    - **Not used here** (§2.6, decision 7).
  - **Lenis 1.3.27:** MIT. Published 2026-10-15, 17 days ago, so it qualifies. Used, with the author's conditions.
  - **Barba 2.10.3:** not used (author).

### 1.1 Inventory of the aesthetic

The step-1 findings, confirmed and made exact by the code:

**Layout grid and margins.**
- Full-bleed bands with a page padding of 3 vw (43 px at 1440).
- Lists run the content width as rows between hairlines:
  - a small index number at the far left;
  - a large title (5.25 vw);
  - a category in the right quarter.
- Rows are about 220 px tall at 1440 px.
- Structure comes from hairlines and space, not boxes.

**Type.**
- **One family at one weight:** DM Sans 400.
- **Sizes:** 12–17 px for small text, 38 px for statements, 5.25 vw for row titles, 6.1 vw for the closing title,
  15 vw for the marquee (216 px at 1440).
- **Tracking:** −0.045 em on headings, −0.025 em measured on the marquee.

**Colour roles** (a light page with dark accents):

| role | value |
|---|---|
| page | `#fff` / `#f7f7f5` |
| ink, the menu drawer, the contact section | `#1c1d20` |
| the hero band | `#999d9e` |
| secondary text | `#626469` |
| hairlines | `#d7d7d4` |
| the accent: open menu button, round-button fills, the contact call to action | `#455ce9` |
| the preloader | `#141517` |

**Motion,** from the code:
- **Preloader:** "Hello" in twelve languages, 120 ms apart, then the label lifts. The curtain rises 115 % over 950 ms
  (expo in-out) while its curved bottom edge flattens. About 2.6 s in all.
- **Hero settle:** after the curtain, the hero's text rises from 110 px down (1.3 s, expo out) and the marquee from
  180 px down (1.5 s).
- **Marquee:** a JavaScript ticker, 0.055 px/ms. Its direction follows the scroll direction, it speeds up to 3× with
  scroll speed, and it skews by up to 2.5°.
- **Menu:**
  - the drawer slides in over 700 ms (power4 out);
  - a 300 px ellipse on its left edge flattens over 750 ms;
  - the links move in from 75 px and 4° rotation, 35 ms apart, 750 ms, expo out;
  - a 300 ms veil.

  Opened from the keyboard, the menu appears without motion.
- **Magnetic controls:** springs (stiffness 600, damping 44). The pull is 100 px for round buttons, 28 px otherwise, or a
  `data-magnet` fraction of the width. The label follows at half the pull.
- **Work preview:**
  - a square (28 vw) follows the pointer on a softer spring, tilting with its horizontal speed (up to 2.8°);
  - a vertical rail inside slides to the hovered row's image (700 ms, expo out);
  - a "View" badge tracks the pointer exactly;
  - the row's title slides left 25 px and its category right 25 px (650 ms).
- **Buttons:** a "liquid" fill, an ellipse 150 % wide and 200 % tall, rises from below (500 ms).
- **Closing section:** a page-coloured curve over its top edge flattens as it scrolls in (scrubbed), and its content
  slides down from under it.
- **Smooth scrolling:** Lenis (lerp 0.095), for fine pointers only.
- **Page changes:** Barba curtains labelled with the page's title.

**Page structure.**
- **Home:**
  1. hero (name marquee, tilted portrait, monogram, location pill, role line, "Selected work ↓");
  2. intro statement with an "About me" round button;
  3. the selected-work list;
  4. a gallery;
  5. recognition statistics;
  6. the contact section with a round call to action and pills;
  7. a fine-print footer.
- **About:**
  - a display page title;
  - a divider with a round button straddling it;
  - an intro with copy beside a portrait;
  - a disciplines grid and recognition figures;
  - experience lists, with a sticky heading in a left column (28 %) and rows on the right;
  - the same contact section and footer.

### 1.2 Adopt, adapt or drop (revised 2026-11-02: styling borrowed, interactions our own)

| element | decision | for this research site |
|---|---|---|
| Preloader | **replace** (§1.3) | Our own: a flyby drawn on the Void, the stages in physical order (§2.6). Kept from the brief: at most 2 s from the page's start, once a session, ended by any key, click, tap or wheel; skipped under reduced motion or with a `#fragment`; the content in the DOM beneath it. |
| Name marquee | **replace** (§1.3) | The title at the same size, "Oberth Efficiency Atlas —" (decision 5), moved by the dive's clock instead of a ticker (§2.6). |
| Monogram behind the portrait | **drop** | Behind a figure panel this wide it showed only as a stray bar (style page, 2026-11-01). |
| Tilted portrait | **replace** | The live three-engine dive, straight, in a Void window on the Panel band: tilting a figure distorts it. |
| Location pill | **adapt** | The case pill, "Hibberd et al.'s dive, perihelion 3.2 R☉" (the value from `engines.json`), with a still Sun mark in place of the spinning globe. |
| Role line with arrow | **adapt** | The published headline, under a short Ink rule (no arrow). |
| "Selected work ↓" | **adapt** | "Findings ↓", a native in-page link. |
| Intro statement and round button | **adopt** (layout) | The author's summary slot; "Read the research". |
| Work list with previews | **replace** (§1.3) | The three findings as rows (the reference's row layout, kept as styling) that steer the docked dive and open in place (§2.5). No pointer-following preview, no badge. |
| "More work¹⁰" pill | **adapt** | "The full research⁷": the number of figures, from the content. |
| Gallery | **drop** | Screenshots of figures that are live elsewhere. |
| Recognition statistics | **adapt** | Key results as large numbers, each linked to its source file (§2.5). |
| Contact section | **adopt** (layout) | The author's closing line (a content slot), a round accent "Open the explorer" and outline links. No e-mail. Its curved top edge is replaced (§1.3). |
| Fine-print footer | **adapt** | Analysis tag, site-data commit, links (Source, About and licences, Cite). No local time. |
| Header and drawer | **adopt** (layout) | The header's layout and the drawer's layout and focus handling. The round button that morphs to × is replaced by a text pill; the drawer's curved edge and rotated link stagger go (§1.3). |
| Magnetic controls | **drop** (§1.3) | Controls stay where they are. |
| Liquid buttons | **replace** (§1.3) | The round and outline shapes stay; hover and focus change colour, with no rising fill. |
| Closing curve | **replace** (§1.3) | A straight edge with the escape leg drawn over it (§2.6). |
| Lenis | **adopt, conditionally** | The author's four conditions, tested in the optional pass 8 (§2.6, §2.13). Until then, and as the fallback: native scrolling. |
| Barba curtains | **drop** (author) | Cross-document View Transitions as a progressive enhancement instead (§2.6). |
| GSAP | **not used** (author, 2026-11-02) | §2.6. |
| About page | **adopt** (layout; decision 4) | Modelled on the reference's About page (§2.4). |
| Résumé and contact pages | **drop** | Personal. |

**How it stays distinguishable:**
- dark only;
- the live dive where the portrait was, and no monogram;
- every interaction is this project's own (§1.3): the flyby preloader, the title moved by the dive's clock, the dive
  docking beside the findings that steer it, the rows opening in place, the menu pill, the escape leg;
- our sections: findings, key results, the explorer as the call to action, provenance in the footer;
- the About page holds the citation, licences, reproducibility and the AI-use disclosure.

### 1.3 Audit: general styling or signature interaction (2026-11-02)

The author's rule: styling may be borrowed (palette, typography, spacing, panels, general layout feel); the reference's
distinctive interactions may not. Every element adapted in the first revision, classified:

| element | class | reason | becomes |
|---|---|---|---|
| Palette roles: a dark ink and panel, one indigo accent | styling: keep | Colour roles are styling. Ours is a dark re-derivation with its own checks (§2.1). | — |
| Typography: DM Sans at one weight, the size scale, tracking | styling: keep | Type is styling (decision 3). | — |
| Spacing: 3 vw padding, hairline rows, band rhythm | styling: keep | Layout feel. | — |
| Hero composition: centred media, edge pill, statement on the right, a large title at the bottom | styling: keep | A still composition; the content is ours. | The dive leaves it to dock beside the findings (§2.5). |
| Header layout, inline links | styling: keep | Ubiquitous. | The hover dot under links (a reference detail) becomes an underline, as every link here. |
| Rows layout: index, large title, category, hairlines | styling: keep | A still list layout. | — |
| Round and outline button shapes and sizes | styling: keep | Shapes are styling. | — |
| Closing section and footer layout | styling: keep | A still layout. | — |
| Drawer layout and its focus handling | styling: keep | A side drawer is generic; the keyboard handling is good practice. | — |
| **The cursor-following graph preview** (a 5:4 panel on a spring, tilting with speed, a rail of figures, a "View" badge, the row's text sliding apart) | **signature: replace** | The reference's most recognisable trick (the author's example). | The rows steer the docked dive; each row opens in place to its live figure (§2.5). |
| **The preloader's curved-curtain lift** (and the centred cycling word with its dot) | **signature: replace** | A curtain lifting with a curved edge that flattens is the reference's hallmark; the centred word cycling with a dot is its greeting. | A flyby drawn on the Void: a dot flies a hyperbola past the Sun, each stage named at its point, then the screen fades (§2.6). |
| **Curved section edges** (the closing section's curve that flattens on scroll; the drawer's curved edge) | **signature: replace** | The same hallmark as the curtain. | Straight edges. Over the closing band, the escape leg draws itself as it scrolls in (§2.6). The drawer's edge is plain. |
| **Magnetic buttons** | **signature: replace** | A pointer-following pull is a hallmark of the reference's genre, and it moves a control from under the pointer. | Nothing: controls stay put. This project's motion lives in its figures. |
| **Liquid buttons** | **signature: replace** | The elliptical fill rising from below is the reference's button hover. | A plain colour change on hover and focus (150 ms). |
| **The round menu button morphing to ×** | **signature: replace** | A hamburger turning into × is generic, but an 80 px disc that pops in after the hero, turns indigo and morphs is the reference's. | A text pill, "Menu" or "Close", that fades in once the header has gone (§2.4). |
| Drawer links' rotated stagger | signature: replace | The 4° rotation and 35 ms stagger are the reference's. | The links arrive with the drawer. |
| **The marquee** (a ticker drifting without end, turning with the scroll direction, skewing with scroll speed) | **signature: replace** | The drifting name ticker is the reference's headline motif. | The title moves only with the dive's clock (§2.6). It moves for less than 5 s on its own, so it needs no pause control. |
| Hero settle after the preloader | general: keep, simplified | Content rising into place is generic. | A 24 px rise as the preloader fades. |
| Smooth scrolling (Lenis) | library: keep, conditionally | Many sites use it; the author's conditions apply. | — |
| Footer links' underline on hover | general: keep | A ubiquitous micro-pattern. | — |
| Section heads rising into view | general: drop | Not needed: the motion budget goes to the figures. | — |

## 2. Design plan (step 2)

### 2.1 Interface palette: six named colours

A designed dark equivalent of the reference's palette, checked by `site/tools/palette.mjs` since pass 1 (step 2 used
`phase9-palette.mjs`); all checks pass.

| name | value | role | contrast |
|---|---|---|---|
| **Void** | `#111214` | page; the preloader curtain; the dive's window in the hero | — |
| **Panel** | `#1b1c1f` | the hero band, figure panels, the menu drawer, the closing section | — |
| **Ink** | `#ecebe7` | text, and links (underlined); the main round button | 15.71 on Void / 14.28 on Panel |
| **Quiet** | `#a3a4a8` | secondary text; control outlines and axis lines | 7.53 / 6.84 |
| **Rule** | `#2f3135` | hairlines and gridlines (decorative) | 1.31 on Panel |
| **Signal** | `#445be8` | accent fills with an Ink label (the round "Open the explorer"), focus rings, selection | see below |

**The accent** (decision 1) is the reference's indigo, moved by the least that passes:
- The exact `#455ce9` takes an Ink label at 4.44:1, below 4.5. As a focus ring it gives 3.53:1 on Void and 3.21:1 on
  Panel, which pass.
- The nearest variant that passes every accent job is `#445be8`: ΔE 0.31 (OKLab × 100; about 2 is just noticeable).
  It was found by a search over a fine OKLCH grid around the original. It gives:
  - an Ink label at 4.51:1;
  - rings at 3.49:1 on Void and 3.17:1 on Panel.
- **Never text:** as text it would be 3.5:1, so links are Ink and underlined.
- **Never inside a plot area, legend or colour scale** (the author's rule). Its closest data blue is η step 3 at
  ΔE 8.3 (2.5 under colour-vision deficiency), which is why the rule exists. Consequences:
  - The explorer marks the reader's case on the universal curve with an accent dot today. That dot becomes Ink in
    pass 5 (shown Ink on the style page's explorer sample).
  - The steered dive dims and emphasises with Ink, Quiet and opacity, never the accent.
  - A test from pass 4 fails if a chart module or chart stylesheet reads `--signal` or `--accent`.

### 2.2 Data colours: unchanged, re-validated

The site's existing dark-mode steps (decision 2): the η and a·v ramps, the red and grey hatching, the Sun and the dot
texture. All checks pass on both surfaces:

| check | on Void | on Panel | rule |
|---|---|---|---|
| faintest a·v stroke `#1f5394` | 2.43:1 | 2.21:1 | ≥ 2 |
| η < 0 hatching `#f0605e` | 5.84 | 5.31 | ≥ 3 |
| impact hatching `#b6b4ab` | 9.02 | 8.20 | ≥ 3 |
| no-reliable-η dots `#8b897f` | 5.34 | 4.85 | ≥ 3 |
| the Sun `#e7b14e` | 9.64 | 8.76 | ≥ 3 |

- **Ramps:** lightness is monotone, with smallest steps of 0.082 (η) and 0.071 (a·v), against 0.06 required.
- **Critical against every η step:** worst colour-vision ΔE 17.6, against ≥ 8.
- **Surfaces:** the hero's dive sits on Void (the faintest stroke at 2.43:1). Figures elsewhere sit on Panel (2.21:1,
  measured from rendered pixels in step 2). No data surface is lighter than Panel. `e2e/av-stroke.spec.ts` keeps
  checking every canvas.

### 2.3 Typography (decision 3)

| family | licence | role |
|---|---|---|
| **DM Sans** 400, 400 italic, 600 | SIL OFL 1.1 | display, interface, prose (the reference's face) |
| **IBM Plex Mono** 400, 500 | SIL OFL 1.1 | data: ticks, readouts, table numbers, code |
| **Commissioner** (Greek only) | SIL OFL 1.1 | DM Sans's first fallback: every Greek letter, so Greek renders identically everywhere |
| **Fira Mono** (Greek only) | SIL OFL 1.1 | IBM Plex Mono's first fallback, for Greek |
| KaTeX's fonts | MIT | typeset maths (unchanged) |

- **Packages:** `@fontsource/dm-sans` 5.3.0 and `@fontsource/ibm-plex-mono` 5.3.0, both published 2026-07-19, pinned
  under the 14-day rule. The step-2 packages `@fontsource/commissioner` and `@fontsource/fira-mono` are removed.
- **The pipeline:** `site/tools/fonts.py` cuts the Greek subsets from Google Fonts' versioned files, pinned by sha256,
  as it already does.
  - **Licences:** each subset ships its copyright notice and the OFL text (`LICENSE-commissioner.txt`,
    `LICENSE-fira-mono.txt`). Neither family declares a Reserved Font Name.
  - **Signs neither Greek face has:** → (with ∝ and ☉) comes from Noto Sans Math, and ⁻ ⁿ ₚ from Arimo.
  - **Transition:** until pass 1 the Phase 9 set was written beside the Phase 8 one (`site/src/styles/v9/fonts.css`,
    `v9-*` subsets, `manifest-v9.json`). Pass 1 made it the only set, in `fonts.css`, checked by `tests/test_site_fonts.py`.
- **Metrics** (fontTools):

  | fallback / primary | x-height ratio | cap-height ratio | advance |
  |---|---|---|---|
  | Commissioner / DM Sans | 1.016 | 0.982 | — |
  | Fira Mono / IBM Plex Mono | 0.979 | 1.013 | 0.6 em, as Plex Mono |

  Greek sits at the size of the text around it, and mono columns stay aligned, so no `size-adjust` is needed.
- **Weights:** 400 almost everywhere, as in the reference. 600 for figure titles and engine names (Phase 8).
- **Scale** (the value at 1440 px, then at 390 px):

  | step | at 1440 | at 390 | used for |
  |---|---|---|---|
  | marquee | 216 | 96 | the hero's title (`clamp(96px, 15vw, 216px)`), tracking −0.025 em |
  | display | 86 | 44 | section titles, the drawer's links, the About title; tracking −0.045 em |
  | row title | 76 | 30 | the findings rows (5.25 vw) |
  | figure | 64 | 40 | key-result numbers (IBM Plex Mono) |
  | statement | 38 | 24 | the headline, the summary |
  | h3 | 22 | 20 | figure titles (600) |
  | prose | 18 | 18 | article text: line height 1.6, measure 66 ch |
  | interface | 15 | 15 | controls, navigation |
  | small | 13 | 13 | eyebrows, labels, captions |
  | tick | 11 | 11 | tick labels (IBM Plex Mono) |

### 2.4 Information architecture and navigation

**Pages:**
- **`/`** the landing page;
- **`/research/`** the article (built only once a section is published; unchanged rule);
- **`/explorer/`**, with `/explorer/classic/` byte-identical;
- **`/references/`**;
- **`/about/`** (decision 4), modelled on the reference's About page. Its prose is the author's, in slots hidden in
  production until written. Its facts come from data:
  1. **Title:** "About" at display size, then a hairline divider with a round button straddling it ("Cite", which
     copies the citation).
  2. **Intro:** the author's slot. Where the reference has a portrait, the citation card (`site.json`: the reference
     line and BibTeX, with Copy).
  3. **Sections,** each with a sticky heading in a left column (28 %) and rows on the right, as in the reference's
     experience lists:
     - **Citation:** formats from `CITATION.cff` via `site.json`.
     - **Licences:**
       - code under MIT, content under its licence (`LICENSE-content.md`), fonts under OFL 1.1;
       - third-party notices, including the reference's MIT notice verbatim and Lenis's;
       - the design credit, "Design adapted from Suhas Beemineni's portfolio (MIT licence)", linking to
         https://suhaslord.github.io/portfolio/ (the author's wording).
     - **Reproducibility:** the fresh-clone audit, from `methods.json`.
     - **AI-use disclosure:** the author's slot and a link to `docs/ai_use_log.md`.
     - **Author:** the author's slot.
  4. **Closing section and footer,** as on every page.

  The article's disclosure section stays where it is.

**Navigation** (the reference's layout, our own control):
- **Header** (not sticky; it scrolls away): the wordmark on the left. Research, Explorer, References and About sit inline
  on the right at 900 px and wider, underlined on hover and on the current page.
- **The menu pill,** fixed at top right: a text button reading "Menu", or "Close" while the drawer is open (no icon,
  no morph).
  - At 900 px and wider it fades in once the header has scrolled out of view; below 900 px it is always there.
  - While hidden it is out of the tab order.

  It opens the drawer:
  - Panel, 37.5 vw wide (460–700 px), full width on phones, with a straight edge;
  - display-size links, the current page marked by a short bar (the section rail's marker);
  - secondary links: source, classic explorer, cite.

  The background is `inert`; Tab cycles between the pill and the links; Escape closes; focus returns. From the
  keyboard the drawer opens and closes without motion.
- **The article:** at 1180 px and wider it keeps its sticky side rail, restyled as a numbered list. Below that it keeps
  the sticky section bar, which carries the menu pill at its right end, so two fixed elements never stack.
- **Sticky elements and scroll padding:** `shell.ts` keeps measuring every active sticky or fixed element and setting
  `scroll-padding-top`. `e2e/sticky.spec.ts` keeps its checks at 390, 768, 1024 and 1440 px, extended in pass 2 to the menu pill, in pass 6 to the
  About page's sticky headings, and in the optional pass 8 to Lenis (§2.6).

### 2.5 The landing page

1. **Hero** (the Panel band, 100 svh, at least 800 px; at 390 px, in the order below):
   - the header;
   - the published headline under a short Ink rule, first at narrow widths so it stays above the fold;
   - the live dive in a Void window (40 vw, at most 590 px), with its scrub control and clock;
   - the case pill on the left edge;
   - the title across the bottom, moved by the dive's clock (§2.6);
   - "Findings ↓" (bottom right).

   Its first frame is drawn beneath the preloader; its intro starts as the preloader clears (`landingHero`'s `start`
   option).
2. **Findings, beside the docked dive** (the author's preferred direction; my design):

   | number | title | category | the dive shows | why (from the data) |
   |---|---|---|---|---|
   | 01 | Loss against Π | universal curve | every burn, the paths quietened so the burns stand out, the clock at the end | Figure 01 marks these three engines by Π and loss: the lengths of their burns are Π made visible |
   | 02 | Where real missions sit | atlas | nothing: the dive keeps its state (the author, 2026-11-02) | the atlas covers six bodies and the dive one, so no state of the dive stands for it |
   | 03 | The Hibberd et al. check | case study | the solid stack alone, the clock just after its burn | the case study is Hibberd et al.'s reference stack, the dive's solid stack |

   - **Docking** (1100 × 700 and larger): the hero and the findings share one grid. The dive is sticky in a column that
     spans both. As the headline scrolls away, the dive slides from the screen's centre into that column (its offset
     follows the scroll; in one step under reduced motion), and the rows arrive in the left column beside it. It
     stays docked to the end of the findings, then scrolls away with them.
   - **Steering:** pointing at a row or focusing it moves the dive to that row's state. The clock eases there in
     500 ms (at once under reduced motion); the engines not lit fade to a quarter, in the canvas, the energy strip and
     the key. The row pointed at stays Ink and the others go Quiet. Leaving the rows restores the reader's own clock.
     Scrubbing the dive takes it back from the rows. `landingHero` gains `steer()` for this; it changes nothing on a
     page that does not call it.
   - **Row 02 has no state** (the author, 2026-11-02). Pointing at it or focusing it counts as pointing at nothing,
     so the dive keeps what the other sources give it: a focused or open row, else the reader's own clock. With row
     03 open, pointing at row 02 keeps row 03's state; moving from row 01 to row 02 returns the dive to the reader's
     clock, as leaving the rows does.
   - **Visible before any hover:** each row's category column shows the line styles of the engines it lights (the
     dive's key; none for row 02), so the link between rows and dive is never hover-only. Focus also announces the
     state (the row's description; row 02 has none).
   - **Opening in place** (every width): each row is a disclosure (a heading's button, `aria-expanded`). It opens to
     its live mini figure, the author's caption slot and the link to the research (or the explorer while the article
     is unpublished). One row is open at a time; an open row also holds the dive's state. Each figure is drawn the
     first time its row opens.
   - **Below 1100 px** (or under 700 px tall): no dock. The dive stays in the hero, and the rows open in place.
   - **The intro** (the author's summary, scope facts and "Read the research") sits after the findings, so nothing
     comes between the hero and the dock.
3. **Intro:** the author's summary, a detail column of scope facts (`methods.json`), and a round "Read the research"
   button.
4. **Key results** (large numbers, each from site data, with a link to its source file):

   | value | from |
   |---|---|
   | 135,720 simulated flybys | `phase2_numbers.json` |
   | 69 of 69 outputs reproduced from a fresh clone | the audit summary |
   | loss reaches 1 % of Δv at Π = 0.976 | `curve.json` |
   | the bound loss/Δv ≲ Π²/96 holds to a ratio of 1.010 for Π ≤ 1 | `rule_numbers.json` |

   The numbers do not count up.
5. **Closing section** (Panel, a straight top edge with the escape leg over it; on every page):
   - the author's closing line (the content slot `content/landing/closing.md`; hidden in production until written);
   - a round accent "Open the explorer";
   - outline links: Research, Source on GitHub, Classic explorer;
   - the fine-print footer.

### 2.6 Motion

One easing family, `cubic-bezier(.22, 1, .36, 1)` (expo out where a move settles). Native scrolling, or Lenis under the
conditions below; no scroll hijacking. Every interaction below is this project's own (§1.3).

| animation | trigger | timing | under reduced motion |
|---|---|---|---|
| Preloader: a flyby drawn, the stages named at their points, then a fade | first load of a session, no `#fragment` | flight 120–1120 ms from the page's start, a 150 ms hold, a 350 ms fade: gone at 1.62 s on time. A late script shortens the flight so the fade ends by 1.8 s; measured on the dev server: faded by 1.71–1.80 s, removed by 1.72–1.95 s (six runs). The inline failsafe removes it at 2 s. Any key, click, tap or wheel ends it. | not shown |
| Hero settle: headline, pill, title and header rise 24 px | as the preloader fades | 700 ms, expo out (content in place throughout) | none |
| The dive's intro sweep | first load of a session, after the preloader | 2.8 s (measured 2.81–2.83 s); any input ends it | final frame |
| The title, moved by the dive's clock | the intro, the reader scrubbing | its offset is the angle the solid stack has swept around the Sun, as a fraction of the whole sweep, times one line's width: it creeps in on approach, rushes through perihelion and slows on escape. Still whenever the clock is. | still, wrapped at display size |
| The dive docking beside the findings | scrolling past the headline (1100 × 700 and larger) | its offset follows the scroll over 30 % of the screen's height (smoothstep) | in one step |
| Steering the dive from a row | pointing at or focusing row 01 or 03 (row 02 has no state) | the clock eases 500 ms; the engines not lit fade to 25 % | at once |
| A row opening in place | click, tap, Enter or Space | content fades in, 280 ms | at once |
| Menu: pill, scrim, drawer | the pill | the drawer slides in 380 ms, out 300 ms; the pill fades in 200 ms once the header has gone; from the keyboard, no motion | instant |
| Button states | hover or focus | colour change, 150 ms | instant |
| The escape leg | the closing band scrolling in (scroll-driven animation) | draws itself, scrubbed; its end dot appears last | drawn whole |
| Page transitions | navigating between pages (cross-document View Transitions, Chrome 126+) | at most 400 ms; an enhancement, ignored elsewhere | none |

**The preloader** (my design): one hyperbola, e = 1.5, in the dive's radial mapping ρ = 1 + log₁₀(r/r_p), the Sun at
its focus on the left, as in the hero. A dot flies it from the upper right. Its timing is half Kepler's (the hyperbolic
mean anomaly) and half uniform in angle, so it visibly speeds through perihelion without the turn vanishing in two
frames. The burn arc (±35° about perihelion) is drawn heavier. The stages appear at their points, in physical order
(the author, decision 8): **Approach, Ignition, Periapsis, Cutoff, Escape**. They stay up once shown, so none has to be
read in passing. Then the screen fades. No curtain, no curved edge, no centred word.

**Its checks** (the author, 2026-11-02):
- **Placement.** The geometry and timing live in `site/src/lib/flyby.ts`. `flyby.test.ts` asserts that:
  - the stages come in the flight's order;
  - Ignition and Cutoff are the burn arc's ends, with equal Kepler times either side of periapsis (a centred burn), so
    Ignition comes before Periapsis;
  - Periapsis is the path's closest point to the Sun;
  - every mark is a vertex of the drawn path and lies on the conic;
  - the incoming leg is drawn above the apse line;
  - each name sits on the path's convex side.

  Pass 3 adds an end-to-end check on the landing page: every mark is in the drawn path's stroke, and the marks switch
  on in physical order.
- **The 2 s cap.** A Playwright test against the production build asserts that the preloader is gone by 2.0 s from
  navigation start. It is enforced locally and report-only in CI (`PRELOADER_CAP=report` in the workflow, the numbers
  in the job summary), as the hero frame time is. Added in pass 3, when the preloader reaches the landing page.

**The title** has no ticker and never moves by itself for more than the intro's 2.8 s. WCAG 2.2.2 asks for a pause
control only for motion that lasts more than 5 s, so the pause control approved in decision 9 is no longer needed and
is gone.

**The 1.5 s cap** applies only to sequences that block content (the author). The preloader has its own 2 s cap, and the
dive intro, which never blocks content, has a 3 s cap.

**Lenis**, deferred to the optional pass 8 (§2.13), and used then only if all of the author's conditions hold:
1. It is never started under `prefers-reduced-motion`. It also needs a fine pointer at 768 px and wider, as in the
   reference, so touch keeps native scrolling.
2. Keyboard scrolling, section-nav and citation jumps, and focus scrolling still land targets fully visible.
   `e2e/sticky.spec.ts` gains a run with Lenis active (the page reports `data-scroll="lenis"`).
3. No sideways scroll at 360 px.
4. Lighthouse accessibility stays at 90 or above.

If any one fails, Lenis comes out, native scrolling stays, and I report it. Its settings are the reference's: lerp
0.095, smooth wheel, no touch sync, no anchor handling. Native anchor jumps keep `scroll-padding-top`, it pauses while
the drawer is open, and `[data-lenis-prevent]` keeps the drawer scrollable and leaves the explorer's wheel zoom to the
explorer.

**View Transitions** (in place of Barba):
- `@view-transition { navigation: auto; }` inside `prefers-reduced-motion: no-preference`;
- the old page lifts away and the new one rises, at most 400 ms;
- every page keeps its own scripts and tests.

**GSAP is not used** (the author, 2026-11-02). CSS transitions, scroll-driven animations and the Web Animations API cover
everything above.

### 2.7 Wireframes

Landing, 1440 px, first screen (the style page's hero is this composition):
```
┌──────────────────────────────────────────────────────────────────────────────────────────┐ Panel band
│ Oberth Efficiency Atlas                               Research  Explorer  References  About │  ( Menu ) pill fades in
│                       ┌──────────────────────────────┐                                     │   once the header
│                       │ live dive (Void window)      │    ──                               │   has gone
│                       │ Solid · Nuclear · SEP lanes, │                                     │
│ ┌──────────────────┐  │ the Sun, strip, key          │    [published headline,             │
│ │ Hibberd et al.'s ◉│  │ ──○──────────                │     statement type, 4–5 lines]      │
│ │ dive, 3.2 R☉     │  │ t = +413 h from perihelion   │                                     │
│ └──────────────────┘  └──────────────────────────────┘                                     │
│ …rth Efficiency Atlas — Oberth Efficiency Atlas — Oberth Effic…  (title, 216 px; moves with   │
│                                                                    the dive's clock)  Findings (↓) │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

Landing, 1440 px, scrolled: the dive has slid into the dock column and stays there through the findings:
```
                                                                                     ( Menu )
  01  Findings                                         ┌──────────────────────────────┐
  ─────────────────────────────────────────────────    │ live dive, docked (sticky)   │
  01   Loss against Π        ─ ‐‐ ··  universal curve (+) │ row 03 pointed at: Solid lit, │
  ─────────────────────────────────────────────────    │ the others faint; the clock  │
  02   Where real missions sit       atlas         (+) │ just after its burn          │
  ─────────────────────────────────────────────────    │ ──────○──────                │
  03   The Hibberd et al. check  ─   case study    (−) │ t = +0.0458 h from perihelion│
       ┌ live mini figure, open in place ────────┐     └──────────────────────────────┘
       │ caption slot · In the research          │
       └─────────────────────────────────────────┘
  [summary, statement type]          Engines … Bodies … Sweep …        ( Read the research )
  135,720 ↗src        69 / 69 ↗src         Π = 0.976 ↗src          1.010 ↗src
 ─────────────────────────────────────────────────────────────────────────────────────── straight edge
  ___________________________________________________________________________________●  escape leg (draws in)
  [closing line: the author's slot]                                  ( Open the explorer )   Panel
  ───────────────────────────────────────────────────────────────────────────────────────────
  (Research) (Source on GitHub ↗) (Classic explorer)
  Analysis v1.0-analysis   Site data 55381c7                     Links: Source · About and licences · Cite
```

Landing, 390 px:
```
┌──────────────────────────────┐ Panel
│ Oberth Efficiency Atlas (Menu)│  the pill, always there
│ ──                           │
│ [headline, 4 lines]          │  above the fold
│ ┌──────────────────────────┐ │
│ │ live dive (Void window)  │ │
│ └──────────────────────────┘ │
│ (Hibberd et al.'s dive ◉)    │
│ Oberth Efficiency Atl…       │  title, 96 px
│                 Findings (↓) │
└──────────────────────────────┘
 01 Loss against Π           (+)
    ─ ‐‐ ··  universal curve
 ┌──────────────────────────┐  opens in place: figure, caption, link
 └──────────────────────────┘
 …
 [closing line] ( Open the explorer )
 fine print, stacked
```

404, 1440 and 390 px: the header, "Page not found" at display size, one statement-size line, the links as outline
pills (Home, Research, Explorer, References, Single-file explorer), then the closing section and footer.

About, 1440 px (`/about/`):
```
 Oberth Efficiency Atlas                                    Research  Explorer  References  About
 About                                                                          (display, 86)
 ─────────────────────────────────────────────────────────────( Cite )─────────────────────
 [author's intro slot, statement type]                ┌ citation card ─────────────────┐
                                                      │ reference line, BibTeX (Copy)  │
                                                      └────────────────────────────────┘
 Citation        │ formats from CITATION.cff ……………………………………………………………
 (sticky, 28 %)  │ ───────────────────────────────────────────────────────────────────
 Licences        │ Code: MIT · Content: LICENSE-content.md · Fonts: OFL 1.1
                 │ Design adapted from Suhas Beemineni's portfolio (MIT licence) ↗
                 │ Third-party notices: the reference's MIT notice, Lenis's (verbatim)
 Reproducibility │ fresh-clone audit: 69 / 69 outputs, commit, date (methods.json)
 AI use          │ [author's slot] · docs/ai_use_log.md ↗
 Author          │ [author's slot]
 ╭─────────────────────────────────────────────────────────────────────────────────────────╮
  [closing line] …   footer
```

About, 390 px: the title, the divider with Cite, the intro and the citation card stacked; each section's heading above
its rows (not sticky).

Article, 1440 px (`/research/`):
```
 Oberth Efficiency Atlas                                    Research  Explorer  References  About
┌─────────────┐  01  The question                                                (display, 86)
│ 01 Question │  [prose, 18 px, 66 ch] ……………………………………………………
│ 02 Hero     │  ┌─────────────────────────────────────────────────────────────────┐ Panel
│ 03 Curve  ● │  │ Figure 1  [figure title]             (title 600)                 │
│ 04 Regimes  │  │ [figure]                                                         │
│ …           │  │ legend · controls · Show data                                    │
│ sticky rail │  └─────────────────────────────────────────────────────────────────┘
└─────────────┘  [caption, Quiet]
```

Article, 390 px:
```
┌──────────────────────────────┐ sticky section bar (Panel)
│ 03 The universal curve ▾ (≡) │   the menu button inside it
└──────────────────────────────┘
 03
 The universal curve   (display, 44)
 [prose]
 ┌────────────────────────────┐
 │ Figure 2 …                 │
 └────────────────────────────┘
```

Explorer, 1440 px:
```
 Oberth Efficiency Atlas                                    Research  Explorer  References  About
 Explorer                                                                              (display)
┌ CASE ───────────┐ ┌ TRAJECTORY ─────────────────────────────┐ ┌ RESULTS ───────────────┐
│ Preset [▾     ] │ │                                         │ │ η                      │
│ Π  ──○──  0.03  │ │   live trajectory (Panel)               │ │ 0.999991  (figure, 64) │
│ v∞ ─○───  0     │ │                                         │ │ loss/Δv   1.64 × 10⁻⁵  │
│ Δv ──○──  0.024 │ │                                         │ │ Π         0.0326       │
│ (prograde)(inert)│ │ (Reset view)  wheel/pinch to zoom       │ │ ⚠ warnings (Critical)  │
│ (Copy link)     │ └─────────────────────────────────────────┘ └────────────────────────┘
└─────────────────┘ ┌ WHERE THIS CASE SITS ────────────────────────────────────────────────┐
                    │ universal curve (Ink dot, was the accent) │ theory atlas (Ink ring)  │
                    └──────────────────────────────────────────────────────────────────────┘
```

Explorer, 390 px: the case controls, the trajectory panel, the results (η at figure size, then tiles in two columns),
the warnings, and "Where this case sits" in two stacked panels.

References, 1440 and 390 px: rows as in the findings list (the number at left, the entry, an arrow ↗). At 390 px the
number sits above each entry.

### 2.8 Pass 2: where it would read as a generic template, and what changed

| generic template trait | changed to |
|---|---|
| Anyone's name in a drifting marquee | The project's title, moved only by the dive's clock. |
| A greeting preloader | A flyby drawn, its five stages named in physical order, at most 2 s, once a session, skippable. |
| A portrait and monogram | The live three-engine dive in a straight window, and no monogram. |
| Screenshot previews that follow the cursor | Rows that steer the dive and open in place to live figures. |
| Statistics that count up | Static numbers, each linked to its source file. |
| "Let's work together" and an e-mail | The author's closing line, with the explorer as the action. |
| Local time in the footer | Provenance: the analysis tag and the site-data commit. |
| An accent as decoration | Fixed jobs only: fills, focus, selection. Never text, never in a plot. |

### 2.9 How the non-visual contracts are kept

| contract | how it is kept |
|---|---|
| **Data** | Every number from `site/public/data/*.json` with provenance; the key results add source links; `check_numbers` and the site-data tests unchanged. The pill's 3.2 R☉ comes from `engines.json`. |
| **Prose** | All prose is the author's. The About page's prose and the closing line are in slots. TODO sections stay hidden in production. The published headline stays above the fold at both sizes. The preloader's words are the author's (decision 8); the rows' state descriptions are interface text. |
| **Figure meaning** | Simulation solid, theory dashed, published hollow; the SEP caveat; the hatching; the accent never in a plot (§2.1). A steered dive only fades engines and moves the clock: it draws nothing the data do not hold. |
| **Explorer** | Behaviour, URL state and the validated simulator unchanged; restyled in pass 5. The classic explorer at `/explorer/classic/` byte-identical (§2.12). |
| **Accessibility** | <ul><li>Keyboard operation: the drawer's focus cycle, Escape and focus return; the findings rows are a disclosure list, and focusing a row steers the dive as pointing does (its description says what the dive shows).</li><li>Visible focus: accent rings at ≥ 3:1.</li><li>Text alternatives; WCAG AA (§2.1); no sideways scroll at 360 px.</li><li>Motion: nothing moves on its own for more than 5 s (WCAG 2.2.2).</li><li>Reduced motion: no preloader, no Lenis, no movement; the dock and the steered clock change in one step.</li><li>Lenis's conditions (§2.6).</li></ul> |
| **Performance** | Lighthouse at least 90 for accessibility, best practices and SEO in CI, performance reported. The hero frame time within budget. Lenis adds 5.4 kB gzipped (`lenis.min.js`, measured); GSAP is not added. |
| **Packages and fonts** | Pinned under the 14-day rule; self-hosted through `fonts.py`. |
| **Attribution** | `THIRD_PARTY_NOTICES.md`, a header in every file with copied or adapted code, the About page's credit and notices (§3). |
| **Deploys** | Stay manual. |

### 2.10 Decisions

Answered by the author on 2026-11-01:
1. **Accent:** the reference's indigo, never in a plot area, legend or colour scale. Applied: `#445be8`, the nearest
   variant that passes (§2.1).
2. **Data colours:** the existing dark steps. Applied.
3. **Fonts:** DM Sans and IBM Plex Mono, with Commissioner's and Fira Mono's Greek as fallbacks through `fonts.py`.
   Applied (§2.3).
4. **About page:** yes, modelled on the reference's. Planned for pass 6 (§2.4).
5. **Moving title:** the title alone. Applied.
6. **Load sequences:**
   - a preloader of about 2 s at most;
   - the dive intro at most 3 s, once a session, ended by any input.

   Applied. My step-2 plan said the dive intro took 4.8 s. That was wrong: it has been 2.8 s since Phase 7
   (`DONE_MS = 2800`), so it already met the 3 s rule.

Answered by the author on 2026-11-02:

7. **GSAP:** not used.
8. **Preloader words:** the flyby's stages in physical order, Approach, Ignition, Periapsis, Cutoff, Escape (a centred
   burn ignites before periapsis). Applied (§2.6).
9. **Departures from the reference:** approved: no monogram; 5:4 previews if previews survived (they did not: §1.3);
   no closing content slide; a pause control on the marquee (no longer needed: the title never moves on its own for
   more than 5 s, §2.6).
10. **Closing line:** a content slot, the author's text (`site/content/landing/closing.md`, a TODO note with my step-2
    wording as a candidate). Applied.

Answered by the author on 2026-11-02 (the plan and style page approved):

11. **The findings design** (§2.5): keep both, the docked dive steered by the rows and the rows opening in place.
12. **Row 02:** it does not steer the dive; hovering or focusing it leaves the dive as it is, and it still opens in
    place. The perihelion state is removed. Applied (§2.5).
13. **The other replacements** (§1.3): approved. The preloader's stages get an assertion of their physical placement,
    and its 2 s cap a test against the production build (§2.6).

### 2.11 The style page

`/style-9/`, development builds only, revised for the decisions of 2026-11-02:
- **The hero** in the landing composition: the header, the live dive in a Void window, the case pill, the headline,
  and the title moved by the dive's clock.
- **01 Findings**, straight after the hero: the dive docks beside the rows, which steer it and open in place.
- **The preloader** (the flyby), the menu (pill and drawer), the plain button states, and the closing section with
  the escape leg, the closing-line slot and the footer.
- **02 Colour** (the six names, each with its contrast), **03 Type** (DM Sans and IBM Plex Mono, with Greek through the
  fallbacks), **04 Controls**.
- **Samples of the other pages** (the author: every page is restyled), live and in the new system:
  - **05 Article:** the numbered section rail (the sticky bar below 1180 px), one section with its TODO notes (the
    author's, as development builds show them) and Figure 2 with its legend, controls, tooltips, data table and
    caption. The content plugin's new `<!--#section:id-->` places the one section.
  - **06 Explorer:** the whole interface, with the reader's case an Ink dot on the curve.
  - **07 References:** the list as rows.
- **Lenis** for fine pointers, off under reduced motion.
- Figure 2 and the explorer mount when they near the viewport, never before the preloader has gone.

**Screenshots:** `docs/screens/phase-9-style/`, made by `site/tools/style9-shots.mjs` against the dev server, at 1440
and 390 px (the list is in `docs/screens/README.md`): the preloader in flight and with every stage up; the hero
mid-intro and final; the menu; a row open in place; the closing section; the article, explorer and references samples;
reduced motion; the full page. At 1440 px also: the dive mid-slide, steered by the pointer and by keyboard focus, and
Figure 2 with a tooltip open.

The script also measures the preloader's and the intro's lengths in page time.

**Checks** (2026-11-02): the palette check, the font tests for both sets, the type check, vitest (the content
plugin's new directive included) and the site-data tests pass.

### 2.12 Scope: every page (the author, 2026-11-02)

| page | what changes | pass |
|---|---|---|
| Every page | Tokens and fonts; the header, the menu pill and drawer; the closing section and footer; dark only (the theme switch goes) | 1–2 |
| `/` | The hero, the docked dive and the findings, the intro, key results, the closing section (§2.5) | 3 |
| `/research/` | The numbered rail and section bar; display-size section titles with numbers; prose at 18 px and 66 ch; every figure in a Panel: titles, legends, controls, tooltips, "Show data" tables, captions, KaTeX; the TODO banners (development only) | 4 |
| Every figure | The chart modules are unchanged (they read the token names); the HTML around them is restyled (`site/src/styles/v9/pages.css`). The accent never enters a plot, legend or scale; a pass-4 test enforces it | 3–5 |
| `/explorer/` | Four Panel regions with quiet titles; η at figure size; controls as pills; the reader's case an Ink dot; warnings in Critical with icon and text (unchanged) | 5 |
| `/references/` | Rows between hairlines, the number in IBM Plex Mono; a cited entry reached by its link ringed in Signal | 6 |
| `/about/` | New (§2.4) | 6 |
| `/404.html` | Display title, a statement line, the links as outline pills (§2.7) | 6 |
| `/explorer/classic/` | **Nothing:** byte-identical, the offline fallback. Today `e2e/pages.spec.ts` checks only that it is served; pass 1 adds a test that compares the built file byte for byte with `explorer/oberth_explorer.html` | 1 (the test) |

(Corrected 2026-11-02: this table first had the article as pass 3 and the landing page as pass 4, against the brief's
order in §2.13.)

### 2.13 Step 3: the build, in the brief's seven passes

Each pass is committed with a title and message, followed by the fast checks (`check_all.py --fast`). If a usage limit is
near, the work stops at the end of a pass.
1. **Tokens, fonts and base layout:**
   - `tools/palette.mjs` takes over `phase9-palette.mjs`'s checks and writes a dark-only `palette.css`. The six
     interface colours are defined there, the accent found by its search; the data colours are still read from the
     classic's dark block.
   - `fonts.py` writes only the Phase 9 set, and the Phase 8 families are removed.
   - `base.css` takes the Phase 9 type scale, spacing and element defaults.
   - The light theme and the theme switch go: `color-scheme: dark`, and no inline theme script.
   - A test compares `/explorer/classic/` byte for byte with `explorer/oberth_explorer.html`.

   The pages keep their present layout in the new colours and type until their own pass.
2. **Navigation, page shell and footer** on every page:
   - the header, the menu pill and drawer, the closing section and footer;
   - the sticky-element and scroll-padding tests extended to the pill.

   Native scrolling and no page transitions (the author, 2026-11-02: Lenis and View Transitions move to pass 8).
3. **The landing page** (§2.5):
   - the hero, the preloader (`lib/flyby.ts`), the docked dive and the findings rows, the intro and key results;
   - the preloader's end-to-end placement check and its production cap test;
   - the fold and headline budget re-measured.

   **Review point** (the author, 2026-11-02): stop with screenshots at 1440 and 390 px, including:
   - the docked dive with each row hovered;
   - a row opened in place;
   - the preloader mid-flight;
   - reduced motion.
4. **The research article and its figures,** with the test that no chart module or chart stylesheet reads the accent.
5. **The explorer:** the reader's case an Ink dot.
6. **The references page, the About page and the 404 page.**
7. **The Open Graph image.**

Then the full `check_all.py`, the full Playwright suite on all three builds, the fold and headline budget, screenshots
of every page and the motion states, and the pull request.

8. **Optional, after the author's final review and only if the budget allows** (the author, 2026-11-02, to protect the
   weekly usage): Lenis with its four condition tests (§2.6), and the cross-document View Transitions. Until then the
   site uses native scrolling and no page transitions, and the production site does not bundle Lenis (only the
   development style page uses it).

## 3. Copying and attribution

- **Notices:** `THIRD_PARTY_NOTICES.md` holds:
  - the reference's MIT notice, verbatim;
  - what is still adapted after the audit (§1.3): layouts and proportions (header, drawer, rows, buttons' shapes, hero
    composition, closing section and footer), the drawer's focus handling, the preloader's once-a-session gate and
    the Lenis settings;
  - what is no longer used: every signature interaction in §1.3, and the personal content;
  - the list of files with copied or adapted code: `site/src/styles/v9/components.css`, `site/src/styles/v9/style9.css`,
    `site/src/pages/style9.ts` and `site/style-9/index.html`. The new `site/src/styles/v9/pages.css` holds none.

  The list follows the code as passes 1–7 move it into the site.
- **Headers:** each such file starts with a comment naming the source (repository and commit), the licence and what in
  it is adapted.
- **Not used:** the portrait, the text, the images, the résumé and the contact details.
- **The built site** carries the notice through the About page, which shows the reference's MIT notice in full and the
  credit line. The minifier strips comments, so the page is where the notice travels.
- **Logs:** recorded in `RESEARCH_LOG.md` and `docs/ai_use_log.md` (Phase 9).
