# Third-party notices

This repository's own code is under the MIT License (`LICENSE`) and its content under `LICENSE-content.md`. This file
lists third-party code and design that the repository copies or adapts, or that the website bundles, with each notice
as its licence requires. Package dependencies not listed here keep their own licences in their packages.

## 1. Suhas Beemineni's portfolio (design and code adapted for the Phase 9 website)

- **Source:** https://github.com/suhaslord/portfolio at commit `c98c5cce8ebd20797b4f1d92eeb878a88090ecdb`; the site is
  https://suhaslord.github.io/portfolio/.
- **What is adapted:** the structure, proportions, timings, easings and motion logic of these components:
  - the preloader curtain;
  - the floating round menu button and the menu drawer with its curved edge;
  - the name marquee;
  - the magnetic controls, the reference's `spring()` follower included;
  - the liquid round and outline buttons;
  - the work rows with their pointer-following preview;
  - the hero's composition;
  - the contact section and footer.

  They are rewritten on this project's dark tokens, without GSAP or Barba.
- **What is not used:** the portrait, the biography and other text, the project images, the résumé and the contact
  details. No asset files are copied.
- **Files containing copied or adapted code**, each marked with a header comment naming the source:
  - `site/src/styles/v9/components.css`
  - `site/src/styles/v9/style9.css`
  - `site/src/pages/style9.ts`
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
- **The fallback subsets** cut by `site/tools/fonts.py`: Commissioner, Fira Mono, Arimo, Roboto Condensed, Noto Sans Mono
  and Noto Sans Math. Each subset's copyright notice and licence text are in `site/src/fonts/fallback/LICENSE-*.txt`.
