# Phase 9 plan: a dark, portfolio-style revamp

Brief: the author, 2026-11-01. A dark interpretation of the aesthetic of https://suhaslord.github.io/portfolio/,
with this project's content and data. The site becomes dark only: no light theme, no theme toggle,
`color-scheme: dark`.
- Inspiration, not copying: no code, CSS, images, text or assets from the reference.
- The analysis freeze holds; every contract that is not visual stays (§2.9).
- Work happens on the branch `phase-9-revamp`; main changes only through a pull request with green CI.

This document is steps 1 and 2. Step 1 changed no site code. Step 2 adds only a development-only style page
(`/style-9/`, §2.11) and the palette check `site/tools/phase9-palette.mjs`.

## 1. The reference (step 1)

**Captures** (Playwright, 2026-11-01, in `runs/reference/`, not committed: they are someone else's work):
- the load sequence as frames from 0.15 to 4.5 s, at 1440 × 900 and 390 × 844;
- the hero, each viewport of the page, and the footer;
- the menu: at 1440 px from the floating button after scrolling, at 390 px from the header;
- hover states on four rows of the work list;
- computed measurements (`measurements*.json`): fonts and sizes, colours, CSS custom properties, transitions,
  section geometry, the marquee's speed and the preloader's timing.

**Licence:**
- The repository (`suhaslord/portfolio`) is under the MIT License, "Copyright (c) 2026 SuahsTheLord".
- MIT would permit reuse with attribution, but the brief rules it out anyway: no code, CSS, text, images or assets
  are taken. The portrait, project images and text are personal content in any case.
- **Typefaces,** all under the SIL Open Font License 1.1, none commercial: DM Sans (the only face on the home page),
  Space Grotesk, Lora and IBM Plex Mono.
- **Libraries:** GSAP with ScrollTrigger, Lenis (smooth scrolling) and Barba (page transitions).

### 1.1 Inventory of the aesthetic

**Layout grid and margins.**
- Full-bleed bands with a page padding of 3 vw (43 px at 1440).
- Lists span the content width as rows separated by hairlines, with three columns: a small index number at the far
  left, a large title, and a category in the right third.
- Rows are about 110 px tall at 1440 px, and sections are separated by 150–200 px of space.
- Structure comes from hairlines and space, not boxes. The only tiles are the gallery thumbnails.
- At 390 px the list becomes cards: image on top, title, category, index.

**Type.**
- **One family at one weight:** DM Sans 400 everywhere. Measured sizes run 12, 14, 17.3 (body, 1.2 vw), 38 (row
  titles and statements), 52–58, 72–86 (display) and 216 px (the marquee); at 390 px, 11–16, 29 (rows) and 86 px.
- **Tracking:** tight on large sizes (−0.025 em on the marquee).
- **Type as a graphic element:**
  - the owner's name as a continuous marquee across the bottom of the hero, bleeding off both edges, drifting at
    about 18 px/s;
  - a giant faint monogram behind the portrait;
  - recognition figures ("2nd", "Top 50", "31h") set as large typographic objects;
  - the drawer's navigation links at display size.

**Colour roles** (light page, dark accents):

| role | value |
|---|---|
| page | white `#fff` |
| text, and the dark contact section and menu | near-black `#1c1d20` |
| the hero band, with white type | mid-grey `#999d9e` |
| secondary text | muted `#626469` |
| hairlines | pale `#d7d7d4` |
| the accent: the main round button, the "View" badge, the menu's close button | electric indigo `#455ce9` |
| the preloader | darker black `#141517` |

**Spacing rhythm:** generous and regular. Large gaps between sections, consistent row heights, small labels set
well apart from the large type they annotate.

**Motion** (one easing curve, `cubic-bezier(.22, 1, .36, 1)`, a quick start with a long settle):
- a preloader cycling greetings in several languages for about two seconds (0.6–2.6 s), then a curtain lift;
- the marquee's slow drift;
- scroll-triggered reveals;
- work rows on hover: the title dims and slides right, and an arrow fades in (0.3–0.4 s);
- a preview card following the pointer, with a "View" badge (media scale 0.8 s);
- round buttons: a fill and a label roll (0.25–0.55 s) and a magnetic pull toward the pointer;
- the menu drawer sliding in from the right with staggered links (about 0.5 s) over a page veil;
- page-to-page curtain transitions (Barba);
- smooth scrolling (Lenis);
- a globe icon rotating in a 5.4 s loop.

**Interactions.**
- **Navigation:** inline links at desktop width; a round 80 px floating menu button once the header has scrolled
  away; a right-hand drawer with display-size links and secondary links, the button turning into an accent close (×).
- **Lists and buttons:** hover previews in the work list; magnetic round calls to action; pill buttons for secondary
  links; a superscript count on "More work¹⁰".

**Page structure** (home):
1. the hero (name marquee, portrait, location pill, role line, "Selected work ↓");
2. an intro statement with an "About me" round button;
3. the selected-work list and "More work";
4. a gallery of research thumbnails;
5. recognition statistics;
6. "Let's work together" with a round button and pill links;
7. a fine-print footer (version, local time, links).

### 1.2 Adopt, adapt or drop

| element | decision | for this research site |
|---|---|---|
| Greeting preloader (about 2 s) | **drop** | Personal, longer than the 1.5 s cap, and it hides the page. The only load motion is the title reveal (§2.6). |
| Name marquee | **adapt** | The project's own line: "Oberth Efficiency Atlas — Π = t_b/τ — η = B_fin/B_imp —", the title with its two defining quantities. A real `h1`, a pause control, static under reduced motion. |
| Giant monogram behind the portrait | **adapt** | A giant η in Rule behind the dive panel, decorative and hidden from assistive technology. |
| Tilted portrait card | **adapt** | The live three-engine dive in a straight panel: tilting a figure distorts how it reads. |
| Location pill with a spinning globe | **adapt** | A case pill, "Hibberd et al.'s dive, perihelion 3.2 R☉", with a static Sun mark. Perpetual motion is dropped. |
| Role line with an arrow | **adapt** | The author's published headline in statement type, its arrow pointing at the dive. |
| "Selected work ↓" round button | **adapt** | "Findings ↓", a native in-page link. |
| Intro statement, detail column, "About me" button | **adopt** | The author's summary slot as the statement; scope facts from `methods.json` as the detail column; a round "Read the research" button. |
| Work list with pointer-following previews | **adopt** | The three findings as a numbered list. The preview is the live mini figure, not a screenshot. Keyboard focus shows it beside the row; touch screens show it inline. |
| "More work¹⁰" pill | **adapt** | "The full research⁷": the superscript is the number of figures in the article, from the content. |
| Research thumbnail gallery | **drop** | It would need screenshots of figures that are live elsewhere, and duplicate the findings. |
| Recognition statistics | **adapt** | Key results as large numbers, each with a link to its source file (§2.5). |
| "Let's work together", round button, e-mail pills | **adapt** | "Fly one yourself.", a round "Open the explorer" button, and pills for the research, the source and the classic explorer. No e-mail. |
| Footer avatar | **drop** | Personal. |
| Fine print: version, local time, links | **adapt** | The analysis tag and commit, the site-data commit, the licences, and the citation with Copy. Local time is meaningless here. |
| Inline header links, floating round menu button, drawer | **adopt** | With a focus trap, Escape to close, and focus returned to the button (§2.4). |
| Barba page transitions | **drop** | A multi-page site with native navigation; a curtain would hide content between pages. |
| Lenis smooth scrolling | **drop** | Ruled out by the brief: native scrolling only. |
| Magnetic buttons | **adopt, narrowly** | Only the two primary round buttons, only for fine pointers, with an ordinary keyboard path. |
| Button fill and label roll | **adopt** | At most 400 ms; under reduced motion, a colour change only. |
| Scroll reveals | **adapt** | Section heads only, once. Content is visible without JavaScript and under reduced motion. |
| Curved top edge of the closing section | **adopt, static** | A fixed curve, not morphed on scroll. |
| Light body, dark footer | **adapt** | Dark only, in layers: the page on Void, the hero band and panels on Panel, the closing section back on Void under a curved Panel edge. |
| Résumé, About and Contact pages | **drop** | Personal. The project equivalent is an About the project page, proposed in §2.4. |

## 2. Design plan (step 2)

### 2.1 Interface palette: six named colours

A designed dark equivalent of the reference's palette, not an inversion: its preloader black becomes the page, its
dark contact section the raised surface, its near-black ink an off-white, and so on. It is checked by
`site/tools/phase9-palette.mjs` (all checks pass).

| name | value | role | contrast (on Void / Panel) |
|---|---|---|---|
| **Void** | `#111214` | page background; the closing section | — |
| **Panel** | `#1b1c1f` | the hero band, figure panels, cards, the menu drawer | — |
| **Ink** | `#ecebe7` | text | 15.71 / 14.28 |
| **Quiet** | `#a3a4a8` | secondary text; control outlines and axis lines | 7.53 / 6.84 (≥ 4.5 text, ≥ 3 outlines) |
| **Rule** | `#2f3135` | hairlines, gridlines (decorative) | 1.31 on Panel |
| **Signal** | `#c27bff` | the accent: round buttons (with a Void label, 6.76:1), focus rings, links, the reader's case off blue data | 6.76 / 6.14 |

- **Void and Panel** differ by 4.5 OKLab lightness units, enough to read as two layers without a border.
- **Signal moved off indigo.** The reference's indigo `#455ce9` would sit ΔE 8.3 from the η ramp, and a first
  violet-shifted indigo `#7c6cff` ΔE 11.6 from an a·v step, with a white label at only 3.86:1. Electric violet
  `#c27bff` clears every data blue by ΔE 15.9 and takes a Void label. It keeps the reference's electric, cool
  accent without meaning "data".
  - Under colour-vision deficiency no cool accent stays apart from blue (worst ΔE 5.0), and warm ones collide with
    the Sun or the red hatching. So the rule from Phase 8 stands: the accent never marks anything on blue data, where
    the reader's case is an Ink ring.

### 2.2 Data colours: unchanged, re-validated on the new surfaces

- **The colours:** the η and a·v ramps, the red and grey hatching, the Sun and the dot texture all stay exactly as the
  site's dark theme has had them since Phase 8: the classic explorer's dark steps, which are the paper's blue ramp
  with its lightness reversed, so strong reads bright on dark.
  - **Interpretation to confirm:** "the paper-matched blue ramp" on a dark-only site means these dark steps. The
    paper's light steps would draw strong η in near-black blue on a near-black page.
- **Checks on the new surfaces** (`phase9-palette.mjs`; all pass):

  | check | on Void | on Panel | rule |
  |---|---|---|---|
  | faintest a·v stroke `#1f5394` | 2.43:1 | 2.21:1 | ≥ 2 |
  | η < 0 hatching `#f0605e` | 5.84 | 5.31 | ≥ 3 |
  | impact hatching `#b6b4ab` | 9.02 | 8.20 | ≥ 3 |
  | no-reliable-η dots `#8b897f` | 5.34 | 4.85 | ≥ 3 |
  | the Sun `#e7b14e` | 9.64 | 8.76 | ≥ 3 |

  - **Ramps:** lightness monotone, smallest steps 0.082 (η) and 0.071 (a·v), against 0.06 required.
  - **Critical against every η step:** worst colour-vision ΔE 17.6, against ≥ 8.
- **The rendered faintest stroke,** measured from pixels on the style page's live dive (§2.11):
  - step 1 `#1f5394` at full strength, 279 px at 1440 and 141 px at 390, on the panel colour `#1b1c1f` sampled
    from the canvas;
  - 2.21:1 at both widths, equal to its token and above 2:1.

  It stays in `e2e/av-stroke.spec.ts` for every canvas through the build.
- **Data figures always sit on Panel,** where the faintest stroke is 2.21:1. No data surface is lighter than Panel.

### 2.3 Typography

| family | licence | role | why |
|---|---|---|---|
| **Commissioner** (Kostas Bartsokas), weights 400 and 600 | SIL OFL 1.1 | display, interface, prose | **Native Greek:** η, Π, Δ and τ in titles and labels render in the same face, not a fallback. Of the candidates with Greek, its proportions are closest to the reference's DM Sans (a difference of 0.026, against 0.057 for Manrope and 0.105 for Inter Tight; fontTools, 2026-11-01). A crisp grotesque with enough warmth for long reading. DM Sans itself is OFL and would be allowed, but has no Greek. |
| **Fira Mono**, 400 and 500 | SIL OFL 1.1 | data: ticks, readouts, table numbers, code | Native Greek; proportions 0.020 from IBM Plex Mono. |
| KaTeX's fonts | MIT | typeset maths | Unchanged. |

- **Packages:** `@fontsource/commissioner` and `@fontsource/fira-mono` 5.3.0 (published 2026-07-19), pinned under
  the 14-day rule, Greek subsets included.
- **Fallbacks:** `site/tools/fonts.py` keeps the Greek-and-symbol pipeline. Greek fallbacks will rarely be needed
  now; the symbols face still supplies ∝ and ☉, and ₚ, ⁻, ⁿ and → where a family lacks them.
- **Weights:** 400 for almost everything, as in the reference. 600 only for figure titles and engine names (the
  author's Phase 8 decision, kept).
- **Scale** (fluid; the value at 1440 px, then at 390 px):

  | step | at 1440 | at 390 | used for |
  |---|---|---|---|
  | marquee | 216 | 96 | the hero line (`clamp(96px, 15vw, 216px)`), tracking −0.035 em |
  | display | 86 | 44 | section titles, the closing line, the references' numbers |
  | figure | 64 | 40 | key-result numbers (Fira Mono, tabular) |
  | statement | 38 | 24 | the headline, the summary, findings rows |
  | h3 | 22 | 20 | figure titles (600) |
  | prose | 18 | 18 | article text: line height 1.6, measure 66 ch |
  | interface | 15 | 15 | controls, navigation |
  | small | 13 | 13 | eyebrows, labels, captions |
  | tick | 11 | 11 | tick labels (Fira Mono) |

- **Oversized type as a graphic element:** the hero marquee; numbered display titles for sections ("01  Findings");
  the key-result numbers; the references list's numbers; the closing line. Never body text.

### 2.4 Information architecture and navigation

**Pages:**
- **`/`** the landing page;
- **`/research/`** the article (built only once a section is published; unchanged rule);
- **`/explorer/`**, with `/explorer/classic/` byte-identical;
- **`/references/`**;
- **proposed: `/about/`, the project.** It would hold how to cite (with Copy), the licences and third-party material,
  reproducibility (the fresh-clone audit, from `methods.json`), the AI-use disclosure (a link to the log, and the
  author's slot), and the author.
  - **Why it earns its place:** today these sit in an eight-block footer and a TODO article section. One page gives
    them a findable home and lets the footer become the reference's light fine-print row.
  - **Prose:** its slots are the author's, hidden in production until written. Its facts come from data.
  - **The article's disclosure section** stays where it is.

**Navigation:**
- **Header** (not sticky): the wordmark "Oberth Efficiency Atlas" on the left; Research, Explorer, References and
  About inline on the right at 900 px and wider.
- **A round floating menu button** (56 px, fixed at top right) appears once the header has scrolled away, and always
  below 900 px. It opens a right-hand drawer on Panel, with:
  - display-size links, a dot on the current page;
  - secondary links: source, classic explorer, cite;
  - the button turning into a Signal close (×).

  The drawer has a focus trap; Escape and the button close it, and focus returns to the button.
- **The article:** at 1180 px and wider it keeps its sticky side rail, restyled as a numbered list. Below that it
  keeps the sticky section bar, which then carries the menu button at its right end, so two fixed elements never
  stack.
- **Sticky elements and scroll padding:** `shell.ts` keeps measuring every active sticky or fixed element (the
  floating button, the section bar) and sets `scroll-padding-top` from them. `e2e/sticky.spec.ts` keeps its checks
  at 390, 768, 1024 and 1440 px, adapted to the new elements:
  - no overlap;
  - Tab and Shift+Tab to a control, section links and citation links all leave the target fully visible.

### 2.5 The landing page

Your suggestion, with these improvements: the marquee carries the two defining quantities, previews are live, the
key results link to their sources, and the closing section is built around the explorer.

1. **Hero** (the Panel band; title, headline and entry links above the fold at 1440 × 900 and 390 × 844):
   - the header;
   - the live three-engine dive in a straight panel, with its scrub control and clock;
   - the case pill;
   - the author's headline in statement type, with its arrow;
   - the marquee across the bottom, with its pause control;
   - round "Findings ↓" and pill entry links: Research, Explorer, Source.
2. **Intro:** the author's summary (statement type), a detail column of scope facts (engines, bodies, the sweep's
   size; `methods.json`), and a round, magnetic "Read the research" button.
3. **Findings** (numbered list):

   | number | title | category |
   |---|---|---|
   | 01 | Loss against Π | universal curve |
   | 02 | Where real missions sit | atlas |
   | 03 | The Hibberd et al. check | case study |

   - **Hover or focus:** the live mini figure (the existing finding modules) in a floating panel. It follows the
     pointer; with focus it sits at the row's right.
   - **Each row:** its title links to the figure in the research, or to the explorer fallback while the article is
     unpublished. The author's caption shows under the title once written.
   - **Below 900 px:** each row is a card with the figure inline.
4. **Key results** (large numbers; each value from site data with provenance, and a small link to its source file):

   | value | from |
   |---|---|
   | 135,720 simulated flybys | `phase2_numbers.json` |
   | 69 of 69 outputs reproduced from a fresh clone | the audit summary |
   | loss reaches 1 % of Δv at Π = 0.976 | `curve.json` |
   | the bound loss/Δv ≲ Π²/96 holds to a ratio of 1.010 for Π ≤ 1 | `rule_numbers.json` |

   The numbers do not count up: data should not animate (§2.8).
5. **Closing** (Void, under a curved Panel edge):
   - "Fly one yourself." at display size;
   - a round Signal button, "Open the explorer";
   - pills: Research, Source on GitHub, Classic explorer;
   - the fine-print row: analysis tag, data commit, licences, Cite (Copy).

### 2.6 Motion

No scroll hijacking and no smooth-scroll library. Every animation is CSS or a few lines of
`requestAnimationFrame`; GSAP, Lenis and Barba are not used. Easing: one curve, `cubic-bezier(.22, 1, .36, 1)`.

| animation | trigger | duration | under reduced motion |
|---|---|---|---|
| Title reveal: the marquee's first pass and the headline rise from a mask | first load in a session (`sessionStorage`) | 900 ms, staggered 40 ms; the whole load sequence ≤ 1.5 s | none |
| The dive's intro sweep (today 4.8 s) | first load in a session, with the reveal | compressed to 1.5 s | final frame |
| Marquee drift | continuous while in view (paused off-screen) | 60 s per loop; a pause/play button (WCAG 2.2.2) | the line once, wrapped at display size (a still 216 px line would cut the title), no pause control |
| Section-head fade-up | entering the viewport, once | 500 ms, 16 px | none |
| Menu drawer: slide, staggered links, veil | button or keyboard | 450 ms, 30 ms stagger, veil 300 ms | instant |
| Round button: fill and label roll | hover or focus | 350 ms | colour change only |
| Magnetic pull, two primary buttons only | pointer move (fine pointer only) | spring, at most 8 px | off |
| Findings row: title shift, arrow fade-in | hover or focus | 300 ms | colour change only |
| Findings preview: follows the pointer, scales in | hover (fine pointer); focus places it beside the row | 250 ms in, eased follow | appears in place, no follow |

- **The load sequence never hides content.** The text is in the HTML from the start. The reveal only transforms it
  from a mask that starts visible without JavaScript. Crawlers and keyboard users get the full page at once, and
  focusing during the reveal ends it.
- **Pointer effects are enhancements:** they are disabled on touch (`pointer: coarse`), and every one has a keyboard
  equivalent (focus shows the same state).

### 2.7 Wireframes

Landing, 1440 px (the first screen ends at 900):
```
┌──────────────────────────────────────────────────────────────────────────────────────────┐ Panel band
│ Oberth Efficiency Atlas                                  Research  Explorer  References  About │
│                                                                                            │
│  (◉ Hibberd et al.'s dive,        ┌──────────────────────────────┐   ↘                       │
│    perihelion 3.2 R☉)              │  live dive: Solid · Nuclear  │   [author's headline,      │
│                         η (giant,  │  · SEP lanes on a·v, the Sun │    statement type,         │
│                          faint)    │  ──○──────────── t = +413 h  │    2–3 lines]              │
│                                    └──────────────────────────────┘                           │
│ (Research) (Explorer) (Source)                                         ( Findings ↓ )        │
│ …erth Efficiency Atlas — Π = t_b/τ — η = B_fin/B_imp — Oberth Efficiency Atlas — Π = t…  (❚❚) │ marquee
└──────────────────────────────────────────────────────────────────────────────────────────┘
  [summary, statement type, 2–4 lines]                 Engines: Hydrolox, …                    Void
                                                        Bodies: Sun, Venus, …     ( Read the  )
                                                        Sweep: 135,720 flybys     ( research  )
  Findings ─────────────────────────────────────────────────────────────────────────────────
  01   Loss against Π                                        universal curve           ↗
  ──────────────────────────────────────────────────── ┌─────────────┐ ──────────────────────
  02   Where real missions sit                          │ live preview│  atlas
  ──────────────────────────────────────────────────── └─────────────┘ ──────────────────────
  03   The Hibberd et al. check                               case study
  ─────────────────────────────────────────────────────────────────────────────────────────
  135,720          69 / 69            Π = 0.976            1.010
  simulated        outputs reproduced loss reaches 1 %     bound ratio, Π ≤ 1
  flybys ↗src      fresh clone ↗src   of Δv ↗src           ↗src
 ╭──────────────────────────────────────────────────────────────────────────────────────────╮ curve
  Fly one yourself.                                                   ( Open the explorer )   Void
  (Research) (Source on GitHub) (Classic explorer)
  Analysis v1.0-analysis (976b4d8)   Site data 55381c7   MIT / CC BY 4.0   Cite (Copy)
```

Landing, 390 px (the first screen ends at 844):
```
┌──────────────────────────────┐ Panel
│ Oberth Efficiency Atlas  (≡) │
│ [author's headline, 3 lines] │
│ ┌──────────────────────────┐ │
│ │ live dive (196 px cap)   │ │
│ │ ─○────────── t = +413 h  │ │
│ └──────────────────────────┘ │
│ (◉ perihelion 3.2 R☉)        │
│ Oberth Efficiency Atl… (❚❚)  │ marquee, 96 px
│ (Research) (Explorer)        │
│ (Source)    ( Findings ↓ )   │
└──────────────────────────────┘
 [summary]                        Void
 Engines … Bodies … Sweep …
 ( Read the research )
 01 Loss against Π   ↗
 ┌──────────────────────────┐
 │ figure inline            │
 └──────────────────────────┘
 02 Where real missions sit ↗
 …
 135,720 simulated flybys ↗
 69 / 69 reproduced ↗
 ╭────────────────────────────╮
 Fly one yourself.
 ( Open the explorer )
 fine print, stacked
```

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
                 02  The universal curve …
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
│ c  ────○  2.98  │ │ (Reset view)  wheel/pinch to zoom       │ │ …                      │
│ (prograde)(inert)│ └─────────────────────────────────────────┘ │ ⚠ warnings (Critical)  │
│ (Copy link)     │                                             └────────────────────────┘
└─────────────────┘ ┌ WHERE THIS CASE SITS ────────────────────────────────────────────────┐
                    │ universal curve (Signal dot)            │ theory atlas (Ink ring)    │
                    └──────────────────────────────────────────────────────────────────────┘
```

Explorer, 390 px:
```
 Oberth Efficiency Atlas  (≡)
 Explorer
 CASE: preset, sliders, steering, Copy link
 TRAJECTORY panel
 RESULTS: η at figure size, then tiles in two columns
 warnings
 WHERE THIS CASE SITS: two panels, stacked
```

References, 1440 and 390 px:
```
 References                                                                         (display)
 ─────────────────────────────────────────────────────────────────────────────────────────
 1    [reference 1, as in references data]                                                 ↗
 ─────────────────────────────────────────────────────────────────────────────────────────
 2    …
 (390 px: the number above each entry, at display size in Quiet; the entry below)
```

### 2.8 Pass 2: where it would read as a generic portfolio template, and what changed

| generic template trait | changed to |
|---|---|
| A name marquee (anyone's name scrolls) | The marquee carries the project's two defining quantities: it reads as this project, not as a layout. |
| A greeting preloader | Dropped. The page is the first frame; only the title rises, at most once a session. |
| Pointer-following screenshot previews | Live mini figures drawn from the exported data, also shown on keyboard focus. |
| Statistics that count up | Static numbers, each linked to the file it comes from. Data does not perform. |
| A tilted portrait-style card | A straight, interactive figure panel: tilting a chart misleads. |
| "Let's work together" and an e-mail address | "Fly one yourself." with the explorer as the action. |
| Magnetic, wiping buttons everywhere | Two primary buttons only. Everything else is a plain link or pill. |
| Local time in the footer | Provenance: the analysis tag and the site-data commit. |
| A violet accent as decoration | It has fixed jobs (action, focus, the reader's case off blue data) and never marks data. |
| Uniform display type everywhere | Display sizes only for the marquee, section numbers, results and the closing line; prose stays readable at 18 px. |

### 2.9 How the non-visual contracts are kept

| contract | how it is kept |
|---|---|
| **Data** | Every number still comes from `site/public/data/*.json` with its provenance. The key results add source links. `check_numbers` and the site-data tests are unchanged. |
| **Prose** | All prose is the author's. TODO sections stay hidden in production, and the published headline stays (above the fold, tested at both sizes). |
| **Figure meaning** | Simulation solid, theory dashed, published hollow; the SEP "hypothetical at 3.2 R☉" caveat; hatching for η < 0, impact and no reliable η. |
| **Explorer** | Behaviour, URL state and the validated simulator are unchanged. The classic explorer stays byte-identical (checked in the build). |
| **Accessibility** | Keyboard operation, visible focus (Signal ring, 2 px), text alternatives, reduced motion, WCAG AA (§2.1), no sideways scroll at 360 px. The panel-text, notation and sticky specs stay. |
| **Performance** | Lighthouse ≥ 90 for accessibility, best practices and SEO in CI, with performance reported. The hero frame time stays within its budget. No animation library is added. |
| **Packages and fonts** | Pinned under the 14-day rule; self-hosted through `fonts.py`. |
| **Deploys** | Stay manual. |

### 2.10 Decisions for the author

1. **The accent:** electric violet `#c27bff`, moved off indigo to stay clear of the data blues (§2.1). Or keep closer
   to the reference's indigo and accept a ΔE of 8–12 from the data?
2. **Data colours:** the dark steps the site already uses, as the dark-only reading of "the paper-matched blue ramp"
   (§2.2).
3. **Typography:** Commissioner and Fira Mono for native Greek (§2.3). Or DM Sans and IBM Plex Mono, as in the
   reference, with Greek from fallbacks?
4. **An About the project page** (§2.4): yes or no.
5. **The marquee line:** the title with Π = t_b/τ and η = B_fin/B_imp, or the title alone?
6. **The dive's intro** compressed from 4.8 s to 1.5 s to meet the load-sequence cap (§2.6).

### 2.11 The style page

`/style-9/`, development builds only: the new tokens, the type scale with the marquee, one data figure (the live
three-engine dive on Panel), the controls (a round magnetic button, pills, the segmented switch, the Π slider, a
select) and one motion example (the marquee, with its pause control and reduced-motion behaviour).
- **Isolation:** the page uses the new token sheet alone, so the rest of the site is untouched until pass 1.
- **Screenshots:** `docs/screens/phase-9-style/` at 1440 and 390 px.
- **The faintest a·v stroke** is measured there from rendered pixels.
