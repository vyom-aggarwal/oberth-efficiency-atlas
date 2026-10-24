# Licences

This repository uses two licences.

- **Code: MIT** ([`LICENSE`](LICENSE)). This covers the Python package (`src/`), the scripts
  (`scripts/`), the tests (`tests/`), the configuration files (`configs/`), the website's code
  (`site/`, except its prose and data), the workflows (`.github/`) and the hooks (`.claude/`,
  `.githooks/`).
- **Text, figures and data: CC BY 4.0**
  ([Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/),
  [legal code](https://creativecommons.org/licenses/by/4.0/legalcode)), © 2026 Vyom Aggarwal. This
  covers:
  - the documentation and prose: the Markdown files, including `docs/` and `site/content/`;
  - the figures and animations in `figures/`, and `site/public/og-image.png`;
  - the generated data: `results/`, the numbers JSON and CSV files in `figures/`, and
    `site/public/data/`.

  Attribute it as given in [`CITATION.cff`](CITATION.cff).

## Third-party material keeps its original terms

These files hold material from other authors. Neither licence above applies to that material, which
stays under its original terms:

| file | material |
|---|---|
| `figures/confraria_fig434_digitized.csv` | values digitized from Fig. 4.34 of J. C. F. Confraria, *Finite burn losses in spacecraft maneuvers revisited*, MSc thesis, Instituto Superior Técnico (2020) |
| `configs/phase4/hibberd_som.yaml` | motor specifications from the Northrop Grumman Propulsion Products Catalog (OSR No. 16-S-1432, 2016: CASTOR 30B, STAR 48B), and mission inputs from Hibberd, Eubanks and Hein (2026) |
| `RELATED_WORK.md`, `scripts/literature_numbers.py`, `figures/literature_numbers.json` | values quoted from the cited papers |
| `site/src/fonts/fallback/*.woff` | subsets of Arimo, Roboto Condensed, Noto Sans Mono and Noto Sans Math, under the SIL Open Font License 1.1 (the licence texts are beside them) |
| the website's fonts (installed from `@fontsource`, not committed) | Barlow, Barlow Semi Condensed and IBM Plex Mono, under the SIL Open Font License 1.1; KaTeX's fonts, under the MIT licence |

The same applies to values quoted from the cited papers anywhere else in the repository; the
reference list is in `docs/paper_outline.md`. The repository's own code and results around this
material are covered by the licences above.
