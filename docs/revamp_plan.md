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

This document is steps 1 and 2. Step 2 adds only development-only material:
- the style page `/style-9/` (§2.11);
- the palette check `site/tools/phase9-palette.mjs`;
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

### 1.2 Adopt, adapt or drop (revised: copying allowed)

| element | decision | for this research site |
|---|---|---|
| Preloader | **adopt, with our words** | The stages of a powered flyby (§2.6), at most 2 s from the page's start, once a session, ended by any key, click, tap or wheel. Skipped under reduced motion or with a `#fragment`, and the content is in the DOM beneath it. |
| Name marquee | **adopt** | The title alone, "Oberth Efficiency Atlas —" (decision 5), with the reference's ticker. Added: a pause control (WCAG 2.2.2); still and wrapped under reduced motion. |
| Monogram behind the portrait | **drop** | Behind a figure panel this wide it showed only as a stray bar (style page, 2026-11-01). |
| Tilted portrait | **replace** | The live three-engine dive, straight, in a Void window on the Panel band: tilting a figure distorts it. |
| Location pill | **adapt** | The case pill, "Hibberd et al.'s dive, perihelion 3.2 R☉" (the value from `engines.json`), with a still Sun mark in place of the spinning globe. |
| Role line with arrow | **adopt** | The published headline. |
| "Selected work ↓" | **adapt** | "Findings ↓", a native in-page link. |
| Intro statement and round button | **adopt** | The author's summary slot; "Read the research". |
| Work list with previews | **adopt** | The three findings. Each preview is the live mini figure, not a screenshot. Changes: <ul><li>portrait panels (5:4), so each figure keeps its key in view;</li><li>an Ink "View" badge, since the accent never sits over a plot;</li><li>keyboard focus shows the preview beside the row.</li></ul> |
| "More work¹⁰" pill | **adapt** | "The full research⁷": the number of figures, from the content. |
| Gallery | **drop** | Screenshots of figures that are live elsewhere. |
| Recognition statistics | **adapt** | Key results as large numbers, each linked to its source file (§2.5). |
| Contact section | **adopt** | "Fly one yourself." with a round accent "Open the explorer" and pills. No e-mail. |
| Fine-print footer | **adapt** | Analysis tag, site-data commit, links (Source, About and licences, Cite). No local time. |
| Header, round menu button, drawer | **adopt** | The reference's structure and timings. Added: the round button leaves the tab order while hidden; the background is `inert` while the drawer is open. |
| Magnetic controls | **adopt** | The reference's springs and strengths. Fine pointers at 768 px and wider only; never under reduced motion; any key resets them. |
| Liquid buttons | **adopt** | Under reduced motion the fill appears without moving. |
| Closing curve | **adopt, natively** | A CSS scroll-driven animation where supported, a still curve elsewhere. The content's slide from under the curve is dropped: it hides the title until scrolled. |
| Lenis | **adopt, conditionally** | The author's four conditions, tested in pass 2 (§2.6). Fallback: native scrolling. |
| Barba curtains | **drop** (author) | Cross-document View Transitions as a progressive enhancement instead (§2.6). |
| GSAP | **not used** | §2.6, decision 7. |
| About page | **adopt** (decision 4) | Modelled on the reference's About page (§2.4). |
| Résumé and contact pages | **drop** | Personal. |

**How it stays distinguishable:**
- dark only;
- the live dive where the portrait was, and no monogram;
- our marquee line and preloader words;
- our sections: findings, key results, the explorer as the call to action, provenance in the footer;
- previews are live figures;
- the About page holds the citation, licences, reproducibility and the AI-use disclosure.

## 2. Design plan (step 2)

### 2.1 Interface palette: six named colours

A designed dark equivalent of the reference's palette, checked by `site/tools/phase9-palette.mjs` (all checks pass).

| name | value | role | contrast |
|---|---|---|---|
| **Void** | `#111214` | page; the preloader curtain; the dive's window in the hero | — |
| **Panel** | `#1b1c1f` | the hero band, figure panels, the menu drawer, the closing section | — |
| **Ink** | `#ecebe7` | text, and links (underlined); the main round button | 15.71 on Void / 14.28 on Panel |
| **Quiet** | `#a3a4a8` | secondary text; control outlines and axis lines | 7.53 / 6.84 |
| **Rule** | `#2f3135` | hairlines and gridlines (decorative) | 1.31 on Panel |
| **Signal** | `#445be8` | accent fills (with an Ink label), the open menu button, focus rings, selection | see below |

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
  - The preview badge, which rides over live plots, is Ink.
  - The explorer marks the reader's case on the universal curve with an accent dot today. That dot becomes Ink in
    pass 5.
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
  - **Transition:** until pass 1 the Phase 9 set is written beside the Phase 8 one: `site/src/styles/v9/fonts.css`,
    `v9-*` subsets and `manifest-v9.json`. `tests/test_site_fonts.py` checks both sets (§2.11).
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

**Navigation** (the reference's):
- **Header** (not sticky; it scrolls away): the wordmark on the left. Research, Explorer, References and About sit inline
  on the right at 900 px and wider, with the reference's hover dot.
- **The round menu button,** fixed at top right:
  - 80 px at 900 px and wider, where it appears once 42 % of the hero (or 100 px of an inner page) has scrolled away;
  - 54 px and always present below that.

  While hidden it is out of the tab order. It opens the drawer:
  - Panel, 37.5 vw wide (460–700 px), full width on phones;
  - display-size links with a dot on the current page;
  - secondary links: source, classic explorer, cite.

  The button turns into an accent close (×). The background is `inert`; Tab cycles between the button and the
  links; Escape closes; focus returns.
- **The article:** at 1180 px and wider it keeps its sticky side rail, restyled as a numbered list. Below that it keeps
  the sticky section bar, which carries the menu button at its right end, so two fixed elements never stack.
- **Sticky elements and scroll padding:** `shell.ts` keeps measuring every active sticky or fixed element and setting
  `scroll-padding-top`. `e2e/sticky.spec.ts` keeps its checks at 390, 768, 1024 and 1440 px, extended in pass 2 to the
  About page's sticky headings and to Lenis (§2.6).

### 2.5 The landing page

1. **Hero** (the Panel band, 100 svh, at least 800 px; at 390 px, in the order below):
   - the header;
   - the published headline with its arrow, first at narrow widths so it stays above the fold;
   - the live dive in a Void window (40 vw, at most 590 px), with its scrub control and clock;
   - the case pill on the left edge;
   - the marquee across the bottom;
   - the pause control (bottom left) and "Findings ↓" (bottom right).

   Its first frame is drawn beneath the preloader; its intro starts as the curtain clears (`landingHero`'s new
   `start` option).
2. **Intro:** the author's summary, a detail column of scope facts (`methods.json`), and a round, magnetic "Read the
   research" button.
3. **Findings** (rows, as in the reference's work list):

   | number | title | category |
   |---|---|---|
   | 01 | Loss against Π | universal curve |
   | 02 | Where real missions sit | atlas |
   | 03 | The Hibberd et al. check | case study |

   - **Preview:** a fine pointer gets the live mini figure in a 5:4 panel that follows it. Keyboard focus places the
     same panel beside the row.
   - **Below 768 px:** each row becomes a card with the figure inline.
   - **Links:** each row links to the figure in the research, or to the explorer while the article is unpublished.
4. **Key results** (large numbers, each from site data, with a link to its source file):

   | value | from |
   |---|---|
   | 135,720 simulated flybys | `phase2_numbers.json` |
   | 69 of 69 outputs reproduced from a fresh clone | the audit summary |
   | loss reaches 1 % of Δv at Π = 0.976 | `curve.json` |
   | the bound loss/Δv ≲ Π²/96 holds to a ratio of 1.010 for Π ≤ 1 | `rule_numbers.json` |

   The numbers do not count up.
5. **Closing section** (Panel under a flattening Void curve):
   - "Fly one yourself.";
   - a round accent "Open the explorer" (magnetic);
   - pills: Research, Source on GitHub, Classic explorer;
   - the fine-print footer.

### 2.6 Motion

One easing family: the reference's `cubic-bezier(.22, 1, .36, 1)`, and GSAP's named curves as cubic Béziers where the
reference uses them. Native scrolling, or Lenis under the conditions below; no scroll hijacking.

| animation | trigger | timing | under reduced motion |
|---|---|---|---|
| Preloader: our words, then the curtain lifts with its curved edge | first load of a session, no `#fragment` | words at 0, 180, 290, …, 620 ms; lift from 0.8 s over 950 ms; gone by 1.75 s by design, measured 1.83 s at both widths. Hard cap 2 s from the page's start (a late script shortens the lift; an inline failsafe removes it at 2 s). Any key, click, tap or wheel ends it. | not shown |
| Hero settle: headline, pill, marquee and header move into place | with the preloader | 1.3–1.5 s, expo out (content visible throughout) | none |
| The dive's intro sweep | first load of a session, after the preloader | 2.8 s (measured 2.84 s); any input ends it | final frame |
| Marquee drift | while in view | 55 px/s; turns with the scroll direction, up to 3× and 2.5° skew with scroll speed (Lenis's velocity); pause control | still, wrapped at display size |
| Menu drawer, curve, staggered links, veil | button | open 700/750 ms, links 35 ms apart; close 500 ms; instant from the keyboard | instant |
| Liquid fill | hover or focus | 500 ms | appears without moving |
| Magnetic pull | fine pointer at 768 px and wider | springs 600/44 (label 460/38) | off |
| Findings preview: follow, tilt, rail, badge; row text slides | fine pointer; focus places it, still | springs 360/34 and 180/25; rail 700 ms; text 650 ms | appears in place |
| Closing curve flattens | scrolling into the section (scroll-driven animation) | scrubbed | a still curve |
| Page transitions | navigating between pages (cross-document View Transitions, Chrome 126+) | at most 400 ms; an enhancement, ignored elsewhere | none |
| Section-head rise | entering the viewport, once | the reference's 1.05 s, power3 out | none |

**The preloader's words** (proposed; decision 8): Approach · Periapsis · Ignition · Burn · Cutoff · Escape, the stages
of a powered flyby, each with the reference's dot.

**The 1.5 s cap** now applies only to sequences that block content (the author). The preloader has its own 2 s cap, and
the dive intro, which never blocks content, has a 3 s cap.

**Lenis**, used only if all of the author's conditions hold, tested in pass 2:
1. It is never started under `prefers-reduced-motion`. It also needs a fine pointer at 768 px and wider, as in the
   reference, so touch keeps native scrolling.
2. Keyboard scrolling, section-nav and citation jumps, and focus scrolling still land targets fully visible.
   `e2e/sticky.spec.ts` gains a run with Lenis active (the page reports `data-scroll="lenis"`).
3. No sideways scroll at 360 px.
4. Lighthouse accessibility stays at 90 or above.

If any one fails, Lenis comes out, native scrolling stays, and I report it. Its settings are the reference's: lerp
0.095, smooth wheel, no touch sync, no anchor handling. Native anchor jumps keep `scroll-padding-top`, it pauses while
the drawer is open, and `[data-lenis-prevent]` keeps the drawer scrollable.

**View Transitions** (in place of Barba):
- `@view-transition { navigation: auto; }` inside `prefers-reduced-motion: no-preference`;
- the old page lifts away and the new one rises, at most 400 ms;
- every page keeps its own scripts and tests.

**GSAP is not used** (decision 7):
- **Coverage:** everything the reference does with it here is a timeline of transforms or a ticker. CSS transitions
  and the Web Animations API cover those with the same durations and equivalent curves. The springs are the reference's
  own code.
- **Cost:** it would add a second animation runtime and a non-open-source licence to an MIT repository.
- It can be added later if fidelity calls for it.

### 2.7 Wireframes

Landing, 1440 px (the first screen ends at 900; the style page's hero is this composition):
```
┌──────────────────────────────────────────────────────────────────────────────────────────┐ Panel band
│ Oberth Efficiency Atlas                               Research  Explorer  References  About │  (80 px round menu
│                       ┌──────────────────────────────┐                                     │   button appears
│                       │ live dive (Void window)      │    ↘                                │   after scrolling)
│                       │ Solid · Nuclear · SEP lanes, │                                     │
│ ┌──────────────────┐  │ the Sun, strip, key          │    [published headline,             │
│ │ Hibberd et al.'s ◉│  │ ──○───────── t = +413 h      │     statement type, 4–5 lines]      │
│ │ dive, 3.2 R☉     │  └──────────────────────────────┘                                     │
│ └──────────────────┘                                                                       │
│ …rth Efficiency Atlas — Oberth Efficiency Atlas — Oberth Effic…        (marquee, 216 px)     │
│ (❚❚)                                                                       Findings (↓)     │
└──────────────────────────────────────────────────────────────────────────────────────────┘
  [summary, statement type]                            Engines … Bodies … Sweep …    ( Read the research )
  01   Loss against Π          ┌──────────┐                            universal curve
  ─────────────────────────────│ live     │──────────────────────────────────────────────
  02   Where real missions sit │ preview  │ (View)                     atlas
  ─────────────────────────────│ 5:4      │──────────────────────────────────────────────
  03   The Hibberd et al. check└──────────┘                            case study
  135,720 ↗src        69 / 69 ↗src         Π = 0.976 ↗src          1.010 ↗src
 ╭──────────────────────────────────────────────────────────────────────────────────────────╮ curve (flattens)
  Fly one yourself.                                                  ( Open the explorer )   Panel
  ───────────────────────────────────────────────────────────────────────────────────────────
  (Research) (Source on GitHub ↗) (Classic explorer)
  Analysis v1.0-analysis   Site data 55381c7                     Links: Source · About and licences · Cite
```

Landing, 390 px:
```
┌──────────────────────────────┐ Panel
│ Oberth Efficiency Atlas  (≡) │  54 px round button
│ ↘                            │
│ [headline, 4 lines]          │  above the fold
│ ┌──────────────────────────┐ │
│ │ live dive (Void window)  │ │
│ └──────────────────────────┘ │
│ (Hibberd et al.'s dive ◉)    │
│ Oberth Efficiency Atl…       │  marquee, 96 px
│ (❚❚)            Findings (↓) │
└──────────────────────────────┘
 01 Loss against Π   universal curve
 ┌──────────────────────────┐  figure inline (cards below 768 px)
 └──────────────────────────┘
 …
 Fly one yourself. ( Open the explorer )
 fine print, stacked
```

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
  Fly one yourself. …   footer
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
| Anyone's name in the marquee | The project's title. The page's subject is a figure, not a person. |
| A greeting preloader | The six stages of a powered flyby, at most 2 s, once a session, skippable. |
| A portrait and monogram | The live three-engine dive in a straight window, and no monogram. |
| Screenshot previews | Live mini figures from the exported data, also shown on keyboard focus. |
| Statistics that count up | Static numbers, each linked to its source file. |
| "Let's work together" and an e-mail | "Fly one yourself." with the explorer as the action. |
| Local time in the footer | Provenance: the analysis tag and the site-data commit. |
| An accent as decoration | Fixed jobs only: fills, focus, selection. Never text, never in a plot. |

### 2.9 How the non-visual contracts are kept

| contract | how it is kept |
|---|---|
| **Data** | Every number from `site/public/data/*.json` with provenance; the key results add source links; `check_numbers` and the site-data tests unchanged. The pill's 3.2 R☉ comes from `engines.json`. |
| **Prose** | All prose is the author's. The About page's prose is in slots. TODO sections stay hidden in production. The published headline stays above the fold at both sizes. The preloader words and "Fly one yourself." are interface labels for the author to approve (§2.10). |
| **Figure meaning** | Simulation solid, theory dashed, published hollow; the SEP caveat; the hatching; the accent never in a plot (§2.1). |
| **Explorer** | Behaviour, URL state and the validated simulator unchanged. The classic explorer byte-identical. |
| **Accessibility** | <ul><li>Keyboard operation: the drawer's focus cycle, Escape and focus return; a keyboard path for every pointer effect.</li><li>Visible focus: accent rings at ≥ 3:1.</li><li>Text alternatives; WCAG AA (§2.1); no sideways scroll at 360 px.</li><li>Reduced motion: no preloader, no Lenis, no movement.</li><li>Lenis's conditions (§2.6).</li></ul> |
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

New, for the author:

7. **GSAP:** I recommend not using it (§2.6). Its licence and the 14-day rule both allow it.
8. **Preloader words:** Approach, Periapsis, Ignition, Burn, Cutoff, Escape (§2.6). The alternative is the symbols
   Δv, τ, t_b, Π, η.
9. **Departures from the reference** (all applied on the style page):
   - **Monogram:** dropped (§1.2).
   - **Preview:** portrait (5:4) instead of square, with an Ink badge.
   - **Closing section:** its content slide is dropped.
   - **Marquee:** gains a pause control.
10. **"Fly one yourself."** is my wording, kept from step 2. It is yours to replace.

### 2.11 The style page

`/style-9/`, development builds only, revised for the decisions:
- **The hero** in the landing composition: the header, the live dive in a Void window, the case pill, the headline,
  and the title marquee with its pause control.
- **The preloader**, the menu (round button and drawer), the liquid and magnetic buttons, the findings rows with live
  previews, and the closing section with its footer.
- **Colour** (the six names, each with its contrast), **type** (DM Sans and IBM Plex Mono, with Greek through the
  fallbacks), and the **controls**.
- **Lenis** for fine pointers, off under reduced motion.

**Screenshots:** `docs/screens/phase-9-style/`, made by `site/tools/style9-shots.mjs` against the dev server, at 1440
and 390 px:
- the preloader (a word at 0.45 s, the curtain lifting at 1.5 s);
- the hero's final frame and the menu open;
- reduced motion (at 390 px, full page);
- the full page;
- at 1440 px only (below 768 px there is no pointer preview): the hover preview and the keyboard-focus preview.

The script also measures the preloader's and the intro's lengths in page time.

**Checks** (2026-11-01):
- `phase9-palette.mjs` passes.
- `tests/test_site_fonts.py` passes for both font sets, including the Phase 9 Greek sources.
- The type check passes.

## 3. Copying and attribution

- **Notices:** `THIRD_PARTY_NOTICES.md` holds:
  - the reference's MIT notice, verbatim;
  - what is adapted and what is not;
  - the list of files with copied or adapted code: `site/src/styles/v9/components.css`, `site/src/styles/v9/style9.css`,
    `site/src/pages/style9.ts` and `site/style-9/index.html`.

  The list grows as passes 1–7 move this code into the site.
- **Headers:** each such file starts with a comment naming the source (repository and commit) and the licence.
- **Not used:** the portrait, the text, the images, the résumé and the contact details.
- **The built site** carries the notice through the About page, which shows the reference's MIT notice in full and the
  credit line. The minifier strips comments, so the page is where the notice travels.
- **Logs:** recorded in `RESEARCH_LOG.md` and `docs/ai_use_log.md` (Phase 9).
