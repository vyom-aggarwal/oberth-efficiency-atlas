# Site prose

One Markdown file per section of the research article (`/research/`); the order is in `sections.json`.

- **Front matter:** `title:` (the section heading; working titles until renamed).
- **Body:** the section's prose. Inline math as `$\Pi = t_b/\tau$`, display math as `$$…$$`, both
  rendered by KaTeX at build time. Citations as superscripts, `<sup>1</sup>`, numbered as in
  `docs/paper_outline.md`; the site links them to the references page (`/references/#ref-n`).
- **Figure position:** a line `<!-- figure -->` places the section's figure; without it, the figure
  follows the prose.
- **Caption:** everything under a `### Figure caption` heading becomes the figure's caption.
- **Hidden until written:** a file that still contains the word `TODO` is left out of the production
  build, with its navigation entry and its figure. `npm run build` prints the hidden sections; the
  dev server shows them with a TODO banner. While every section is TODO, the article (`/research/`)
  is not built and nothing links to it.
- **Numbers:** CI runs `scripts/check_numbers.py` over these files, and over `landing/`.

## The landing page (`landing/`)

| file | where it appears |
|---|---|
| `headline.md` | under the title: one sentence |
| `summary.md` | under the headline: two or three sentences |
| `finding-loss.md` | caption of "Loss against Π, with the 1 % line" |
| `finding-missions.md` | caption of "Where real missions sit" |
| `finding-hibberd.md` | caption of "The Hibberd et al. check" |

- Plain Markdown: no front matter, KaTeX math and `<sup>n</sup>` citations as above.
- A file that still contains `TODO` is left out of the production build; the page closes up without
  it. The dev server shows its notes.
- With `SITE_PLACEHOLDERS=1` (development builds only), unwritten slots show bracketed placeholder
  text of about their target length.
- The figure titles, the hero's figure title and the link labels are interface text, set in
  `site/index.html`; rename them there.
