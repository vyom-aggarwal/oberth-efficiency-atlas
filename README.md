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
- **Phase 3 (burn optimization):** complete.
  - Prograde family (linear pitch law plus burn timing) under a minimum-altitude constraint:
    450 optimizations (`results/opt_phase3.parquet`), with a Nelder–Mead cross-check.
  - `src/oberth_atlas/optimize.py`, figures `figures/phase3_*.png`.

  Headline: for realistic engines the centered prograde burn is already near-optimal. Across the
  mission sample, the median recoverable gain is ≤ 0.007 pp (chemical: max 0.08 pp). The small-Π
  optimum puts the Δv-weighted mean at periapsis; the half-Δv rule captures 75–80% of that gain.
- **Phase 4 (solar Oberth case study):** complete. Staged finite burns about any arrival conic
  (`src/oberth_atlas/staged.py`).
  - The Hibberd et al. (2026) 3I/ATLAS solar Oberth burn loses ≈ 0.1 m/s of its 8.36 km/s, so the
    impulsive model holds.
  - The loss reaches 1% of Δv at Π ≈ 1 (burn duration ≈ r_p/v_p), on a near-universal loss(Π)
    curve.
  - Figures: `figures/phase4_*.png`.
- **Phase 5 (checks and deliverables):** complete.
  - **Practical rule:** for a prograde burn centred on periapsis, loss/Δv is at most about
    Π²/96. This is a leading-order bound that holds within 1% for Π ≤ 1
    (`theory.prograde_loss_bound`, `figures/rule_check.png`).
  - **Hero figure:** `figures/hero_loss_vs_pi.png` and `.pdf`.
  - **Animation:** `figures/anim_engines.mp4` and `.gif`.
  - **Interactive explorer:** `explorer/oberth_explorer.html`, a self-contained page whose
    JavaScript simulator is validated against Python in `tests/test_explorer_js.py`.
  - **Numbers checker** for drafts: `scripts/check_numbers.py`.
