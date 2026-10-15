# Site prose

One Markdown file per home-page section; the order is in `sections.json`.

- **Front matter:** `title:` (the section heading; working titles until renamed).
- **Body:** the section's prose. Inline math as `$\Pi = t_b/\tau$`, display math as `$$…$$`, both
  rendered by KaTeX at build time. Citations as superscripts, `<sup>1</sup>`, numbered as in
  `docs/paper_outline.md`; the site links them to the reference list.
- **Figure position:** a line `<!-- figure -->` places the section's figure; without it, the figure
  follows the prose.
- **Caption:** everything under a `### Figure caption` heading becomes the figure's caption.
- **Hidden until written:** a file that still contains the word `TODO` is left out of the production
  build, with its navigation entry and its figure. `npm run build` prints the hidden sections; the
  dev server shows them with a TODO banner.
- **Numbers:** CI runs `scripts/check_numbers.py` over these files.
