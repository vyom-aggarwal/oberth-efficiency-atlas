# CLAUDE.md: project conventions

Research-grade simulation of finite-burn powered flybys. The goal is to measure how much of
the impulsive Oberth bonus a real engine keeps (η), and whether Π = t_b/τ collapses the data.

## Working rules
- **Phases are gated.** At the end of each phase, report a summary, test results, figures and
  open questions. Then stop until the user says "proceed".
- **Commit early and often:** after every meaningful step (a module plus its tests, a fix, a
  log/doc update, regenerated figures), not only at checkpoints. Commit directly on `main`
  (no phase branches; the user asked on 2026-10-04). Close each phase with a descriptive
  phase-end commit.
- **Never fabricate or hand-tune results.** Every number and figure must come from code in this
  repo. If a test tolerance changes, log the measured floor that justifies it in RESEARCH_LOG.md.
- **RESEARCH_LOG.md** gets a dated entry for every design decision, assumption, sourced parameter
  and surprising result.
- **Constants** (GM, radii, semi-major axes, g0) live only in `src/oberth_atlas/constants.py`,
  each with a source comment. Never hard-code a physical constant anywhere else.

## Environment (Windows, Python 3.13 venv)
```bash
python -m venv .venv
.venv/Scripts/python -m pip install -e ".[dev]"
.venv/Scripts/python -m pytest              # full suite (~3 s)
```
On macOS/Linux, use `.venv/bin/python`.

## Running
```bash
.venv/Scripts/oberth run configs/earth_hydrolox.yaml          # or: python -m oberth_atlas run ...
.venv/Scripts/oberth run configs/jupiter_hall.yaml --no-plot
.venv/Scripts/python scripts/fig_eta_vs_a0.py                 # -> figures/eta_vs_a0.{png,csv}
.venv/Scripts/python scripts/fig_example_trajectories.py      # -> figures/trajectory_<config>.png
```
`oberth run` prints the metrics and writes `runs/<name>/result.json` (SI units) and
`runs/<name>/trajectory.png`. The config schema is documented in `src/oberth_atlas/config.py`;
unknown keys are rejected.

### Phase 2 (sweep and atlas)
```bash
.venv/Scripts/oberth sweep --out results/sweep_nd.parquet       # ~136k body-free runs, ~25 min on 8 cores
.venv/Scripts/oberth missions --n 256 --out results/missions.parquet
.venv/Scripts/python scripts/fig_regimes.py         # writes figures/regimes_half_point.csv (used below)
.venv/Scripts/python scripts/fig_missions.py        # writes figures/mission_table.csv (used below)
.venv/Scripts/python scripts/fig_prefactor_check.py
.venv/Scripts/python scripts/fig_eta_vs_pi.py
.venv/Scripts/python scripts/fig_collapse.py
.venv/Scripts/python scripts/fig_atlas.py
.venv/Scripts/python scripts/phase2_numbers.py      # every quoted Phase 2 number -> figures/phase2_numbers.json
```
- The grid bounds and the mission envelopes come from `configs/atlas/presets.yaml` (representative
  assumptions).
- Parquet files carry provenance metadata (`sweep.read_metadata`).
- The theory behind `theory.py` is derived in `docs/theory.md`.

### Phase 3 (optimization)
```bash
.venv/Scripts/python scripts/run_phase3.py      # 450 optimizations + Nelder–Mead check, ~25 min on 8 cores
.venv/Scripts/python scripts/fig_phase3.py      # figures/phase3_*.png and figures/phase3_numbers.json
```
- `optimize.optimize_case(case, mode)`: mode 'timing' (δ only) or 'full' (α₀, α₁, δ), with the
  constraint r_min ≥ ρ r_p. The result reports η on both baselines (nominal r_p and achieved
  periapsis).
- `PitchLinear` pitches relative to the *fixed* incoming-plane normal. The instantaneous ĥ is
  singular at h = 0 (RESEARCH_LOG 2026-10-04).

## Units
- **Public API and constants: SI** (m, s, kg, m/s, m^3/s^2). Angles are radians inside the code.
- **Config files** use unit-suffixed keys (`v_inf_in_km_s`, `periapsis_altitude_km`, `a0_m_s2`,
  `isp_s`, `alpha0_deg`). Conversion happens only in `config.py`.
- **Inside the integrator, everything is nondimensional** (`units.Scales`):
  length r_p, velocity V = sqrt(μ/r_p), time sqrt(r_p³/μ), mass m0. So μ = 1 and m(t0) = 1.
  Convert only at the inputs and outputs of `simulate.py`.
- Results (`FlybyResult`) are reported in SI. The CLI prints km and km/s for readability.

## Frame and time
- Planet-centered inertial frame aligned with the *incoming* hyperbola (perifocal):
  x̂ points to the unperturbed periapsis, ẑ along the orbit angular momentum,
  ŷ = ẑ × x̂ is the unperturbed periapsis velocity direction.
- Time t = 0 is the *unperturbed* periapsis passage. The burn midpoint is set relative to it
  (default 0, a centered burn).
- State vectors are 3D. An optional rotation matrix can rotate the whole problem; the scalar
  results are invariant under it, and this is tested.

## Metrics
- **η = B_finite/B_imp** (speed-based Oberth efficiency) is primary. It is never clipped.
- **η_W = (Δε_fin − Δε_deep)/(Δε_imp − Δε_deep)** is the secondary, energy-based metric. It is
  linear in thrust, and η = map(η_W, ξ) exactly.
- **η_E** is deprecated: it has a nonzero deep-space floor. It is stored only for continuity.
- **Bound arrivals:** use the equivalent-Δv penalty instead.

## Numerics
- `scipy.integrate.solve_ivp` with DOP853, default rtol = atol = 1e-12. Do not go below ~1e-13.
- Integration is split into coast / burn / coast segments, so no step crosses a thrust
  discontinuity.
- The state is [r(3), v(3), m, W], where W = ∫ (T/m) u·v dt is the specific work done by thrust.
  The energy-balance residual ε(r,v) − ε0 − W is the numerical-error indicator on every segment.

## Layout
- `src/oberth_atlas/`: library (constants, units, kepler, dynamics, burn, steering, simulate,
  metrics, config, plotting, cli)
- `tests/`: pytest suite; `configs/`: example flyby configs
- `scripts/`: one script per figure; `figures/`: committed 300-dpi PNGs
- `runs/`: CLI outputs (gitignored)

## Figures
Every figure in `figures/` is a 300-dpi PNG made by a script in `scripts/`. It is saved with
`plotting.save_figure`, which embeds the script path and git commit in the PNG metadata.
Commit the code first, then regenerate the figures, so the stamped commit is clean
(not `-dirty`). Plot colors come from the validated palette in `plotting.py`. Text uses ink
tokens, never series colors.
