# The website

The site presents the analysis. It reads committed outputs and never changes the analysis code
(`src/oberth_atlas/`), its results or its scripts. The plan and every decision behind it are in
`docs/site_plan.md` and `RESEARCH_LOG.md` (Phase 6).

**The look** (Phase 8, `docs/restyle_plan.md`) is the classic explorer's, which is also the paper figures'
palette:
- **Colour:** the warm grey surface with flat 8 px panels; one blue accent; the blue η ramp; the derived a·v ramp.
- **Type:** Barlow, Barlow Semi Condensed and IBM Plex Mono.
- **Controls:** pills.
- **One surface per panel:** canvases paint their panel's colour (`--surface`); controls and tooltips take the
  other surface (`--raised`).
- **Notation is typeset:** `src/lib/notation.ts`, applied by the DOM helpers to every string they append, turns
  "v_esc" or "r^−1.5" into sub- and superscripts and sets file names in running text as code.

## Pages
Phase 7 (`docs/landing_plan.md`) gave the site a landing page and a references page:
- **`/`** is the landing page:
  - the hero, Hibberd et al.'s dive flown by the three engines in one view, with each burn in its
    lane on the a·v ramp, the energy-gain strip, and a scrub control;
  - the title, the author's headline, the entry links, then the author's summary (in that order, so a
    written headline keeps the links above the fold);
  - three findings, each a small live figure with the author's caption and one link;
  - reproducibility and scope;
  - the footer, with the citation from `CITATION.cff` (with a Copy button where the clipboard API
    exists, that is, on https and localhost) and the licences.

  **The fold:** at 1440 × 900 and 390 × 844, the hero's figure title, the page title, the headline
  and the entry links fit above the fold. `e2e/fold.spec.ts` checks this in two states:
  - with the slots as published (the production build: only what the author has written, never a placeholder
    or TODO; since 2026-10-25, the headline);
  - with every slot filled (the placeholder build: the author's text where written, placeholder text elsewhere,
    such as an ≈80-character headline and a two-sentence summary).

  **The headline budget:** `HEADLINE_BUDGET` in `plugins/content-plugin.ts`, 100 characters.
  - `e2e/headline-budget.spec.ts` measures the longest headline that still fits (124 characters at
    390 × 844, 444 at 1440 × 900, after the Phase 8 restyle; 114 and 365 before) and fails if the budget
    exceeds it.
  - The build prints a warning when the written headline is over the budget.
- **`/research/`** is the long-form explanation (moved from `/`). It has:
  - the live hero flyby;
  - Figures 2–7: the universal curve, three regimes, the atlas, burn timing, the case study,
    engines compared;
  - the J2 facts, methods, and the AI-use disclosure.

  It is built only while at least one of its sections is published, or when unfinished content is
  shown. The Research links (navigation, landing entry) appear only then, so no page links to an
  empty article.
- **`/references/`** is the numbered reference list, with anchors `#ref-1`, `#ref-2`, …. It is
  always published.
  - Citations anywhere on the site link there.
  - An old link to `/#ref-n` is redirected there.
- **`/explorer/`** simulates one flyby live. It has presets, warnings, and placement on the
  universal curve and the theory atlas, and keeps its state in the URL.
- **`/explorer/classic/`** is the single-file offline explorer, copied unchanged.
- **`/404.html`** is the not-found page.
- **`/style/`** is the design reference. It is built only in development mode.

## Stack
- **Build:** Vite 8.3.1 (multi-page) and TypeScript 7.0.2, with no UI framework. Charts use D3
  modules, SVG and Canvas 2D.
- **Math:** KaTeX, rendered at build time, so the page ships no client-side math code.
- **Prose:** Markdown, rendered at build time.
- **Fonts** (Phase 8: the classic explorer's), all self-hosted:
  - Barlow (body and prose), Barlow Semi Condensed (headings, annotations) and IBM Plex Mono (ticks,
    readouts), from the pinned `@fontsource` packages, Latin and Latin-ext;
  - after each, a Greek-and-symbol fallback cut by `site/tools/fonts.py` from pinned Google Fonts files
    (Arimo, Roboto Condensed, Noto Sans Mono, Noto Sans Math; OFL 1.1), so η, Π, Δ, τ and ∞ have the
    same glyphs on every platform, CI included;
  - `tests/test_site_fonts.py` checks the subsets and that every displayed character has a
    self-hosted glyph.
- **Node:** 24.18.1 (`site/.nvmrc`).
- **Packages:** pinned exactly, with the 14-day age rule (`npm install --before=…`;
  `npm run check-age` verifies the lockfile).
- **Palette** (Phase 8): the classic explorer's, read from `explorer/app.css` by `npm run palette`,
  which checks it and writes `src/styles/palette.css` (vitest re-runs the checks).
  - The a·v ramp (`--av-1…7`, the classic blue ramp from step 2 to 6) is used only for a·v; the η
    ramp (`--ramp-0…6`) for η and the arrival-speed family.
  - Dark mode is the classic's own set of steps.
- **The simulator** is the validated JS port of the Python integrator, `src/sim/oberth-sim.js`.
  `tests/test_explorer_js.py` checks it against Python to |Δη| ≤ 1e-8.

## Where things are (`site/`)

| path | what |
|---|---|
| `content/` | the author's prose: one Markdown file per article section, and the landing page's slots in `content/landing/` (`content/README.md`) |
| `partials/` | header and footer |
| `src/charts/` | one module per figure, plus `common.ts` (axes, labels, tooltips, tables) |
| `src/explorer/` | the explorer: state (URL), presets, view, placement |
| `src/controls/` | the Π-axis slider and the snap slider |
| `src/sim/` | the simulator and the shared path drawing |
| `public/data/` | the exported data (do not edit: regenerate) |
| `public/og-image.png` | the social preview (1200 × 630), made by `npm run og-image` |
| `plugins/` | build-time content (sections, TODO hiding, social tags) and KaTeX |
| `e2e/` | Playwright specs |
| `tools/` | palette, package age, Lighthouse, the preview image |

## Data
`scripts/export_site_data.py` writes `site/public/data/*.json` (and `engines.bin`) from committed
results, numbers JSONs and configs.
- Every displayed number carries a pointer to its source (`{value, src}`).
- Each file records the git commit and the sha256 of every source file. CRLF is read as LF, so a
  checkout's line endings cannot change the hash.
- `tests/test_site_data.py` checks that each file is current, that every number equals its
  source, and that the hashes match.
- `rebuild_all.py` ends with the export.
- Regenerate after any change to a source:

  ```bash
  .venv/Scripts/python scripts/export_site_data.py              # all files
  .venv/Scripts/python scripts/export_site_data.py --only methods
  ```

  Commit code first, then export, so the stamp is clean.

## Writing the prose
- **The article:** edit `site/content/<section>.md`.
  - A section is hidden from the production build while its file contains the word `TODO`: its
    navigation entry and its figure go with it. `npm run build` prints the hidden sections.
  - While every section is TODO, `/research/` is not built at all, and no Research link appears.
  - Once a section is published, its landing-page finding links to it instead of the explorer.
- **The landing page:** edit `site/content/landing/`:
  - `headline.md` and `summary.md`, under the title;
  - `finding-loss.md`, `finding-missions.md` and `finding-hibberd.md`, the captions of the three
    findings.

  A slot is left out of the production build while its file contains `TODO`; the page closes up.
- The dev server and test builds (`SITE_SHOW_TODO=1`) show every section and slot, with its TODO
  notes.
- **`SITE_PLACEHOLDERS=1`** (development builds only) fills the unwritten landing slots with
  bracketed placeholder text of their target length, to review the finished layout.
- Numbers in the prose must match a numbers JSON (`scripts/check_numbers.py`). The pre-commit hook
  runs that check for content commits.

## Commands (in `site/`)
```bash
npm ci                                   # once, or after the lockfile changes
npm run dev                              # dev server, http://localhost:5173/
npm test                                 # vitest (unit tests in src/**/*.test.ts)
npm run typecheck
SITE_SHOW_TODO=1 npx vite build --mode development --outDir dist-test --emptyOutDir
BASE_PATH=/oberth-efficiency-atlas/ npx vite build --outDir dist-prod --emptyOutDir
SITE_DIST=dist-test SITE_DIST_PROD=dist-prod SITE_DIST_PH=dist-ph npx playwright test  # every e2e spec (no server needed)
npm run build                            # the production build (TODO sections hidden) -> site/dist
npm run og-image                         # the preview image (the landing hero), from a dist-test build
bash tools/landing-builds.sh             # dist-test, dist-prod, dist-empty (production, base /), dist-ph (placeholders)
npm run lighthouse                       # Lighthouse: see below
```
- **Three Playwright projects:**
  - `site`: every other spec, against the test build.
  - `production`: `e2e/prod.spec.ts` and `e2e/fold.spec.ts`, against the production build served
    under the base path, as on GitHub Pages. It checks:
    - that the Research link and `/research/` exist exactly when a section is published;
    - that every on-site link of the landing page resolves;
    - that there are no console errors;
    - the fold with the slots empty.
  - `placeholders`: `e2e/fold.spec.ts` and `e2e/headline-budget.spec.ts`, against the
    `SITE_PLACEHOLDERS=1` build. It checks the fold with a written headline, and the headline
    budget.

  The last two run only when `SITE_DIST_PROD` and `SITE_DIST_PH` are set; CI sets both. In Git
  Bash, prefix the `BASE_PATH` build with `MSYS_NO_PATHCONV=1`.
- **Explorer fallbacks:** `e2e/landing.spec.ts` opens every finding's fallback explorer state, read
  from `index.html`, and requires no warning.
- **The Copy button:** tested on `http://localhost`, a secure context that the route handler
  serves, with clipboard permissions.
- **Sticky elements** (2026-10-26): the header sticks from 900 px, the article's section bar below 1180 px (below the
  header where both stick), the rail from 1180 px. `src/pages/shell.ts` measures them and sets `--header-h` and
  `--sticky-top`, the base of `scroll-padding-top`. `e2e/sticky.spec.ts` checks at 390, 768, 1024 and 1440 px that
  they never overlap and that Tab, Shift+Tab, section links and citation links land targets below them.
- **Phase 8 specs:**
  - `e2e/notation.spec.ts`: no displayed text, accessible name or tooltip has "_" outside code and URLs, on every
    page at 1440 and 390 px;
  - `e2e/panel-text.spec.ts`: every text inside a figure panel stays inside its padding, and on-plot text does not
    overlap, at 360 and 390 px;
  - `e2e/av-stroke.spec.ts`: the faintest a·v stroke, from rendered pixels, is at least 2:1 against its panel in
    both themes (values in `runs/av_stroke_contrast.json`).
- **Screenshots:** the screenshot specs write to `runs/screens/`. Checkpoint screenshots are kept
  in `docs/screens/` (`docs/screens/README.md`).
- **Without `SITE_DIST`,** Playwright starts the dev server itself.

## Checks
- **`scripts/check_all.py`** (repository root) is the gate before pushing: the type check,
  vitest, `check_numbers` and the full Python suite.
- **The pre-commit hook** (`.githooks/pre-commit`) runs `check_all.py --staged`, only the checks
  the staged files can affect. A changed test file runs itself, a changed script runs its own
  test file, and a changed `site/tools/<name>.py` runs `tests/test_site_<name>.py`. Enable it once per
  clone with `git config core.hooksPath .githooks`.
- **Playwright** is not in `check_all.py`. Run it as above; CI runs it on every push.
- **Hero frame time** (`e2e/hero.spec.ts`, while dragging; simulation plus drawing):

  | where | what happens |
  |---|---|
  | locally | **enforced:** p95 under 16 ms, the target set on the development laptop. `HERO_P95_MS` overrides it. |
  | in CI | **report-only:** the workflow sets `HERO_FRAME_TIME=report`, because shared runners are slower and noisier than that laptop. p50, p95 and the maximum go to the job summary. |

  - In both places the test still fails if too few frames were measured.
  - `runs/hero_frame_times.json` records the numbers, and whether the target was enforced.

## Lighthouse
CI is the record (author, 2026-10-19).
- **Gate:** accessibility, best practices and SEO must each be at least 90 on `/`, `/research/`,
  `/explorer/` and `/references/` (Phase 7 added the first and the last), on mobile and desktop.
- **Performance** is reported, not enforced, because shared runners make it noisy.
- **The run:** `npm run lighthouse` builds the site with every section, serves it with
  `vite preview`, and runs Lighthouse 13.5.0 eight times.
- **Output:**
  - full reports: `runs/lighthouse/<page>-<form>.report.{html,json}`;
  - a summary: `runs/lighthouse/summary.json`, with every score, the versions and the date.
- **It needs local sockets** (a preview server and Chrome's debugging port), so it cannot run inside
  a sandbox that blocks loopback.

**A local run for a stable performance number** (any shell, from the repository root):
```bash
cd site
npm ci
npm run lighthouse
```
Send back `runs/lighthouse/summary.json`. `LH_MIN_PERFORMANCE=0.9 npm run lighthouse` also enforces
performance.

## CI and deployment (`.github/workflows/site.yml`)

**Every push to `main`, and every pull request**, runs three jobs:
1. **check:** the full `check_all.py`, the package-age check, and Playwright against a test build.
   - The hero frame time is reported in the job summary, not enforced (see Checks).
   - Screenshots and frame times are uploaded as the artifact `screenshots`.
2. **lighthouse:** the gated run above. Reports are uploaded as `lighthouse`.
3. **build:** the production build.

**Deployment** runs only by hand (author, 2026-10-19, while sections are TODO), and only after all
three jobs pass.

**Every action is pinned to a full commit SHA**, with its tag in a comment. Each pin is the highest
release published at least 14 days before it was chosen. `tests/test_workflow.py` checks the pinning.

**To deploy:**
1. **Once, in the repository:** Settings → Pages → Build and deployment → Source: GitHub Actions.
   This creates the `github-pages` environment.
2. **Each time:** Actions → Site → Run workflow, on `main`. Or, from a shell:
   ```bash
   gh workflow run site.yml --ref main
   ```
3. The deploy job runs after check, lighthouse and build pass. The address is in the run summary
   and on the `github-pages` environment: `https://<owner>.github.io/<repository>/`.

**What a manual run does:**
- It reads the Pages settings (`actions/configure-pages`).
- It builds with `BASE_PATH` (the site's path) and `SITE_URL` (its full address, used for the
  social tags).
- It publishes `site/dist`.

**While the home sections are TODO,** a deploy publishes the explorer in full, but a home page with
only the shell. To deploy on every push instead, add `push` to the deploy job's condition, which is
now `github.event_name == 'workflow_dispatch'`, and update `tests/test_workflow.py`.

## Reproducibility
- `scripts/rebuild_all.py` regenerates every analysis output and then the site data.
- `scripts/repro_audit.py` compares a rebuild with the committed outputs, including
  `site/public/data`, and ignores provenance stamps.
- `scripts/audit_record.py` records a fresh-clone audit under `docs/audit/<date>_<commit>/`. The
  audit and its results are described in `docs/repro.md`.
- The summary named by `AUDIT` in `scripts/export_site_data.py` is exported to `methods.json` for
  the methods section.
