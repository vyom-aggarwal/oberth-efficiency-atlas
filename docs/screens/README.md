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
- `checkpoint-5/`: the explorer, as full pages.
  - Its default state (Hibberd et al.'s preset) at 1440 and 390 px in both themes.
  - Two warning states in the light theme, from `site/e2e/screens-explorer.spec.ts`:
    - `soi`: Earth with a Hall thruster, whose burn starts outside the sphere of influence;
    - `impact`: Jupiter with gridded ion under inertial steering.
- `checkpoint-4/` (commit 9b1f4ae):
  - Figures 3–7: three regimes, the atlas, burn timing, the case study, engines compared;
  - the Limitations facts;
  - the hero, with the narrow-screen Π axis split by category (checkpoint-3 review).
