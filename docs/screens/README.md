# Review screenshots, per checkpoint

The author asked on 2026-10-18 for screenshots to be committed at each checkpoint. Each
`checkpoint-N/` folder holds crops of the figures that checkpoint added or changed, at 1440 and
390 px wide, in the light and dark themes: `<figure>-<width>-<theme>.png`.

**How they are made.**
- `site/e2e/screens.spec.ts` captures every page and crops every home-page figure from a full-page
  capture. The page is not scrolled during the capture, so the sticky section bar does not cover the
  crop. Output goes to `runs/screens/`.
- Build and capture, in `site/`:
  ```bash
  SITE_SHOW_TODO=1 npx vite build --mode development --outDir dist-test --emptyOutDir
  SITE_DIST=dist-test npx playwright test e2e/screens.spec.ts
  ```
- The build keeps the TODO sections, so the author's caption notes show under each figure. A
  production build hides those sections.
- The full-page captures (1.5–2 MB each) stay in `runs/screens/`, which is not committed.

**Checkpoints:**
- `phase-8/` (Phase 8, step 2, the restyle to the classic explorer), for the author's review, at 1440 and 390 px
  in both themes:
  - **Every page, full length:** `research`, `explorer`, `references` and `404`, from the placeholder build
    (`dist-ph`, which shows the article and its TODO notes). The landing page twice: `landing-…-filled` (that
    build, every slot filled with placeholder text) and `landing-…-empty` (the production build, `dist-empty`, as
    deployed today).
  - **`figures/`:** every article figure, cropped (`e2e/screens.spec.ts`).
  - **States the default views do not show** (author, 2026-10-24):
    - `atlas-inertial-…`: the atlas under inertial steering, with the three textures (η < 0 in Critical, impact
      in Ink 2, no reliable η in Muted dots);
    - `curve-tooltip-1440-…`: the universal curve with a tooltip open;
    - `explorer-impact-390-…` and `explorer-soi-390-…`: the explorer's two warnings (`e2e/screens-states.spec.ts`,
      `e2e/screens-explorer.spec.ts`, from the test build).
  - **`og-image.png`:** the regenerated Open Graph image.
- `phase-8-proposal/` (Phase 8, step 1): current against proposed, side by side.
  - Covers the landing hero, Figure 2 (the universal curve) and Figure 4 (the atlas), at 1440 and
    390 px in both themes.
  - The proposed side is the test build with a temporary token override (`docs/restyle_plan.md`
    §9). It is not the final restyle.
- `phase-7/`: the landing page and the references page (Phase 7, for the author's review), as full
  pages at 1440 and 390 px in both themes.
  - `landing-<width>-<theme>-empty.png`: the production build (`dist-empty`), every prose slot
    hidden, as deployed today.
  - `landing-<width>-<theme>-filled.png`: a development build with `SITE_PLACEHOLDERS=1`
    (`dist-ph`), every slot filled with bracketed placeholder text, and the article shown.
  - `references-<width>-<theme>.png`: the references page (production build).
  - `og-image.png`: the new Open Graph image, from the landing hero.
  - Made with `bash site/tools/landing-builds.sh`, then `e2e/screens.spec.ts` with `SCREEN_TAG`.
- `checkpoint-6/`: the author's checkpoint-6 changes, from the final build.
  - Default crops of the hero, the atlas, engines compared and the methods facts, at 1440 and
    390 px in both themes:
    - the hero at 390 px shows "SEP*" and its note;
    - engines at 390 px shows the engine switch;
    - the methods facts show the fresh-clone audit row.
  - Two states in the light theme, from `site/e2e/screens-states.spec.ts`:
    - `atlas-states`: the atlas legend with inertial steering, Venus and the mission samples on
      (all four groups);
    - `engines-nuclear-390`: the narrow engines figure with the second engine chosen.
  - `og-image.png`: the Open Graph preview image (`site/public/og-image.png`, 1200 × 630).
  - `after-review/` (2026-10-20): engines compared at 390 px after the author's review, with the
    switch's short names (Solid, Nuclear, SEP*):
    - the default panel, in both themes;
    - the Nuclear panel, and the SEP panel with "* hypothetical at 3.2 R☉" (light theme).
- `checkpoint-5/`: the explorer, as full pages.
  - Its default state (Hibberd et al.'s preset) at 1440 and 390 px in both themes.
  - Two warning states in the light theme, from `site/e2e/screens-explorer.spec.ts`:
    - `soi`: Earth with a Hall thruster, whose burn starts outside the sphere of influence;
    - `impact`: Jupiter with gridded ion under inertial steering.
- `checkpoint-4/` (commit 9b1f4ae):
  - Figures 3–7: three regimes, the atlas, burn timing, the case study, engines compared;
  - the Limitations facts;
  - the hero, with the narrow-screen Π axis split by category (checkpoint-3 review).
