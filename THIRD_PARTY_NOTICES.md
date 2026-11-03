# Third-party notices

This repository's own code is under the MIT License (`LICENSE`) and its content under `LICENSE-content.md`. This file
lists third-party code and design that the repository copies or adapts, or that the website bundles, with each notice
as its licence requires. Package dependencies not listed here keep their own licences in their packages.

## 1. Suhas Beemineni's portfolio (design and code adapted for the Phase 9 website)

- **Source:** https://github.com/suhaslord/portfolio at commit `c98c5cce8ebd20797b4f1d92eeb878a88090ecdb`; the site is
  https://suhaslord.github.io/portfolio/.
- **What is still adapted** (after the audit of 2026-11-02, `docs/revamp_plan.md` §1.3, which keeps the reference's
  styling and replaces its signature interactions):
  - **Design (layout and proportions):** the header; the menu drawer; the hero's composition; the work rows' layout
    (index, large title, category, hairlines); the round and outline buttons' shapes and sizes; the contact section
    and footer; the type scale and tracking, measured from the reference.
  - **Code:** the menu drawer's open, close and focus handling (the keyboard's instant path, the Tab cycle, Escape,
    focus return); the preloader's once-a-session gate before the first paint; the Lenis settings.

  They are rewritten on this project's dark tokens, without GSAP or Barba.
- **No longer used** (replaced by this project's own interactions): the preloader's curtain with its curved edge and
  its cycling greeting; the pointer-following work preview, its "View" badge and the `spring()` follower; the magnetic
  controls; the liquid button fills; the curved section edges; the round menu button that morphs to ×, and the drawer
  links' rotated stagger; the name marquee's ticker; the links' hover dot.
- **What is not used:** the portrait, the biography and other text, the project images, the résumé and the contact
  details. No asset files are copied.
- **Files containing copied or adapted code**, each marked with a header comment naming the source and what in it is
  adapted:
  - `site/src/styles/shell.css` (the site's header, drawer, buttons, closing section and footer layouts; Phase 9 pass 2)
  - `site/src/pages/shell.ts` (the site's drawer: open, close and focus handling; Phase 9 pass 2)
  - `site/src/styles/landing.css` (the landing page's hero composition and the findings rows' layout; Phase 9 pass 3)
  - `site/index.html` (the landing page's preloader gate, inline before the first paint; Phase 9 pass 3)
  - `site/src/styles/v9/components.css` (the development style page: header, drawer, rows, buttons, closing section and
    footer layouts)
  - `site/src/styles/v9/style9.css` (the hero's composition)
  - `site/src/pages/style9.ts` (the drawer's open, close and focus handling; the Lenis settings)
  - `site/style-9/index.html` (the preloader's inline gate)

The licence, verbatim:

```
MIT License

Copyright (c) 2026 SuahsTheLord

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## 2. Lenis (smooth scrolling, bundled into the website)

- **Source:** the npm package `lenis` 1.3.27, https://github.com/darkroomengineering/lenis.
- **Use:** used unmodified, with its stylesheet.

The licence, verbatim:

```
The MIT License

Copyright (c) 2024 darkroom.engineering

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the “Software”), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

## 3. Fonts (SIL Open Font License 1.1)

- **The website's faces:** DM Sans and IBM Plex Mono, from the pinned `@fontsource` packages. Their licences ship in
  those packages.
- **The fallback subsets** cut by `site/tools/fonts.py`: Commissioner, Fira Mono, Noto Sans Math and Arimo (Roboto
  Condensed and Noto Sans Mono went with the Phase 8 set in Phase 9's pass 1). Each subset's copyright notice and
  licence text are in `site/src/fonts/fallback/LICENSE-*.txt`.
