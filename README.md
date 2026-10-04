# Oberth Efficiency Atlas

When a spacecraft burns during a planetary flyby, the textbook instantaneous-burn model predicts
a large Oberth-effect benefit. Real engines burn for minutes to months and keep only part of it.
This project measures how much they keep, η = B_finite / B_imp, across bodies (Sun, Venus, Earth,
Mars, Jupiter, Saturn) and propulsion technologies. It also tests whether the dimensionless burn
parameter Π = t_b / τ collapses the results onto one curve.

See `CLAUDE.md` for conventions (units, frames, how to run) and `RESEARCH_LOG.md` for decisions,
sources and results.

## Quick start
```bash
python -m venv .venv
.venv/Scripts/python -m pip install -e ".[dev]"   # .venv/bin/python on macOS/Linux
.venv/Scripts/python -m pytest
.venv/Scripts/oberth run configs/earth_hydrolox.yaml
```

## Status
- **Phase 1 (simulator core and validation):** complete. There is a three-segment finite-burn
  flyby simulator, a validation suite, a single-flyby CLI, and figures in `figures/`.
- **Phase 2 (sweep and atlas):** complete.
  - A 135,720-run dimensionless sweep and 15,360 mission samples (`results/*.parquet`).
  - Analytic theory (`docs/theory.md`).
  - Collapse analysis and the atlas figures.

  Headline: the half-efficiency point is Π ≈ 10–40 at every body, and Π·√C collapses the
  small-Π data exactly.
