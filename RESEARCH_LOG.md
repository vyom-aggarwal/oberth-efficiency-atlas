# Research log

Dated entries: design decisions, assumptions, parameter values with sources, surprising results.
Newest entries go at the bottom.

---

## 2026-10-03: Project setup and Phase 1 plan approved

- **Environment:** Python 3.13.14 (Windows); numpy 2.5.3, scipy 1.18.1, matplotlib 3.11.2,
  plotly 7.1.0, pyyaml 6.0.3, pytest 9.1.1. Installed in `.venv`.
- **Workflow:** work happens on the `phase-1` branch with checkpoint commits, merged to `main` at phase end.
- **Scope decisions, approved by the user:**
  - Phase 1 supports hyperbolic arrivals only (v∞_in > 0).
  - Every run also stores an energy-based efficiency η_E = Δε_finite / Δε_imp. Unlike η, it is
    defined for bound arrivals. It will inform how the Sun is handled before Phase 2 (see Q2 below).
  - Every run stores (radius at burn start) / r_SOI, plus an `outside_soi` flag.
  - The coast energy test is normalized by μ/r_p, not |ε| (see Q4 below).

## 2026-10-03: Physical constants and sources

All values are in `src/oberth_atlas/constants.py`. Sources retrieved 2026-10-03:

| Quantity | Value | Source |
|---|---|---|
| GM_sun | 1.32712440041279419e20 m³/s² | JPL SSD Astrodynamic Parameters (DE440) |
| GM Venus | 324858.592000 km³/s² | DE440 |
| GM Earth | 398600.435507 km³/s² (Earth alone) | DE440 |
| GM Mars | 42828.375816 km³/s² (system) | DE440; Phobos and Deimos contribute ~2e-8 |
| GM Jupiter | 126686531.9 km³/s² (planet only) | JPL SSD Satellite Physical Parameters, JUP365 |
| GM Saturn | 37931206.23 km³/s² (planet only) | JPL SSD Satellite Physical Parameters, SAT441 |
| Equatorial radii | Venus 6051.8, Earth 6378.1366, Mars 3396.19, Jupiter 71492, Saturn 60268 km | JPL SSD Planetary Physical Parameters (Archinal et al. 2018) |
| Solar radius | 695 700 km | IAU 2015 Resolution B3 (nominal) |
| Semi-major axes (for r_SOI) | 0.72333566, 1.00000261 (EM barycenter), 1.52371034, 5.20288700, 9.53667594 au | JPL SSD Approximate Positions of the Planets, Table 1 (Standish & Williams 1992) |
| g0 | 9.80665 m/s² | exact by definition (CGPM 1901) |
| au | 149 597 870 700 m | exact by definition (IAU 2012) |

- **The brief asked for GM cited to the "Planetary Physical Parameters" page, but that page has no
  GM column.** It lists radii, and masses derived as GM/G with CODATA-2018 G. GM is therefore
  taken from the DE440 astrodynamic-parameters table and the satellite-solution page.
- **Planet-only vs system GM.** DE440 tabulates *system* GMs for Mars, Jupiter and Saturn.
  For Jupiter and Saturn, the planet-only values are smaller by 2.07e-4 and 2.47e-4, because
  the system values include the Galilean moons and Titan. Flybys at a few planetary radii pass
  inside those moons' orbits, so the planet-only value is the right central-body parameter there.
- **Collision checks use the equatorial radius,** which is conservative for oblate planets.
- **r_SOI uses the body's dynamical (planet-only) GM.** Using system GMs would change r_SOI by
  <1e-4 for Jupiter and Saturn, and by +0.5% for Earth if the Moon were included.
- The Sun's radius is not on any JPL SSD page, so the IAU nominal value is used.

## 2026-10-03: Model assumption: J2 oblateness neglected

The central body is a point mass. J2 oblateness is neglected. Values from the NASA NSSDC planetary
fact sheets (retrieved 2026-10-03): J2 = 14 736e-6 (Jupiter), 16 298e-6 (Saturn), 1 082.63e-6 (Earth).
The J2 acceleration relative to point-mass gravity at the equator scales as ~(3/2) J2 (R/r)².
At r = R, that is ~2.2% for Jupiter, ~2.4% for Saturn and ~0.16% for Earth. **This is not
negligible for low Jupiter and Saturn flybys**: absolute v∞_out, periapsis speed and timing would
all shift at the percent level.

Justification for neglecting it in this study:
- The study's quantities are *ratios and differences within one model*. η = B_finite/B_imp and
  η_E compare a finite burn against an impulsive burn, and both are computed in the same
  point-mass field. A J2 field would shift both numerator and denominator in the same direction.
- η is therefore much less sensitive to J2 than absolute v∞_out is.

It is **not** exactly J2-invariant. The finite burn samples a range of radii (and latitudes in
3D), while the impulsive burn samples only r_p. So η's J2 sensitivity is a residual second-order
effect. It is worth quantifying in a later phase with a J2 term added to `dynamics.py`.

Separately, Saturn's rings and Jupiter's radiation belts are not modeled. A planar flyby is
implicitly assumed to be inclined enough to avoid the rings.

## 2026-10-03: Nondimensionalization and the parameter count

Internal units: length r_p, velocity V = sqrt(μ/r_p), time sqrt(r_p³/μ), mass m0. So μ = 1 and
m(t0) = 1.

For a fixed steering law and burn timing, every result depends on exactly four dimensionless
inputs: ṽ∞ = v∞/V, Δṽ = Δv/V, c̃ = Isp·g0/V and ã0 = a0 r_p²/μ.
- The body enters *only* through these groups.
- Π = t_b/τ is one combination of them: Π = t̃_b · sqrt(ṽ∞² + 2).
- The Phase 2 collapse question therefore asks how much of the 4-D function η(ṽ∞, Δṽ, c̃, ã0)
  is captured by the single combination Π.

## 2026-10-03: Decision Q4: energy-test normalization

At low v∞, ε = v∞²/2 is tiny compared with μ/r_p. For example, at Jupiter with v∞ = 1 km/s,
ε/(μ/r_p) ≈ 3e-4. A drift measured relative to |ε| is then dominated by this ratio, not by
integrator quality.

- **Test 2 normalizes energy drift by μ/r_p**, with a threshold of ~1e-11. The threshold may be
  adjusted only if the measured floor justifies it, and any adjustment gets logged here.
- The |ε|-relative drift is still reported as a diagnostic.
- rtol will not be pushed below ~1e-13. Ill-conditioned η values are exposed by the per-run
  η error estimate instead.

## 2026-10-03: Notes for later phases

- **Phase 3 (from the user):**
  - Inward pitching can lower the effective periapsis, so the optimizer must enforce a
    minimum-altitude constraint.
  - Results must report η against two references: the fixed-r_p impulsive burn, and an
    impulsive burn at the *achieved* periapsis.
  - η > 1 against the fixed-r_p reference is expected to be possible for exactly this reason.
    η is never clipped.
- **Sun (Q2):** realistic solar Oberth dives arrive on bound orbits (C3 < 0), where
  B = v∞_out − (v∞_in + Δv) is undefined. η_E is stored on every run so the choice of metric
  can be made with data before Phase 2.

## 2026-10-03: Simulator design decisions (checkpoint 3)

- **Energy-balance state.** The integrated state is [r, v, m, W], with dW/dt = (T/m) u·v. In
  exact arithmetic, ε(r, v) − ε0 − W = 0 on *every* segment, including the burn arc, which has
  no other conserved quantity. The residual's maximum up to burnout is the per-run error estimate:
  - δε = max |ε − ε0 − W|
  - δv∞ = δε / v∞_out
  - δη = (δv∞ + rounding) / B_imp
  - δη_E = δε / Δε_imp

  Runs with δη > 1e-6 get the `eta_unreliable` flag.
- **Known blind spot of this estimate:** a pure along-track phase error conserves energy, so the
  residual cannot see it. Its effect on η is ~rtol relative to Δε, so it is negligible here. A
  rerun at tighter tolerance will cross-check the estimate (checkpoint 4).
- **Minimum radius.**
  - Coast arcs use the exact osculating-conic minimum: periapsis radius if a periapsis is passed,
    otherwise the smaller endpoint.
  - The burn arc uses endpoints plus located r·v = 0 events.
  - `r_min_numerical`, the minimum over step points and events, is kept as a cross-check.
- **Final coast** is extended past the post-burn periapsis whenever one is still ahead at burnout.
- **Impact** (r = R_eq) is a terminal event. All outcome metrics are then NaN.
- **Speed:** a full three-segment flyby takes ~4 ms (~600 RHS evaluations) on this machine.
  Numba is not needed for Phase 1. Revisit with profiling in Phase 2.

## 2026-10-03: Measured coast error floor (rtol = atol = 1e-12, DOP853)

Coast-only flybys of all six bodies, at v∞/v_esc(r_p) ∈ {0.02, 0.3, 2}, with coast spans of
±5τ, ±50τ and ±500τ around periapsis:

| v∞/v_esc | span | drift/(μ/r_p) | drift/\|ε\| | v∞_out/v∞_in − 1 | turn-angle error (rad) |
|---|---|---|---|---|---|
| 0.02 | 5τ | 1.6e-12 | 4.1e-9 | −1.1e-9 | 4.4e-11 |
| 0.3 | 5τ | 1.7e-12 | 1.8e-11 | −5.2e-12 | 2.9e-12 |
| 2 | 5τ | 1.8e-12 | 4.4e-13 | −5.0e-14 | −4.3e-13 |
| 2 | 50τ | 5.7e-12 | 1.4e-12 | 4.2e-13 | −2.2e-13 |
| 2 | 500τ | 1.4e-11 | 3.5e-12 | 1.3e-12 | −5.4e-13 |

(The other rows are below these values. Source: a scratch measurement script. The same cases are
asserted in `tests/test_coast.py` for spans of 5τ and 50τ.)

- **Results are bit-for-bit identical across all six bodies** at equal dimensionless inputs.
  This is direct numerical confirmation that the body enters only through the four
  dimensionless groups.
- **The energy threshold of 1e-11·μ/r_p holds for spans ≤ 50τ** (worst case 5.7e-12), so it is
  kept as approved.
- **Observation for the user:** at v∞ ≫ v_esc on very long arcs (500τ), the μ/r_p-normalized
  drift reaches 1.4e-11, while the |ε|-normalized drift is 3.5e-12. When v∞ ≫ v_esc the natural
  energy scale is ε, not μ/r_p. A normalization by v_p²/2 = |ε| + μ/r_p would cover both limits.
  Coast arcs of 500τ do not occur with the default settings, so nothing was changed. This is
  raised as an open question.
- **Test 1's v∞ tolerance is derived from the energy threshold, not set separately.**
  - Since δv∞/v∞ = δε/v∞², the test asserts |v∞_out/v∞_in − 1| < max(1e-10, 1e-11·(μ/r_p)/v∞²).
  - A flat 1e-10 is physically unreachable at v∞ = 0.02 v_esc: the measured error there is 1.1e-9.
  - The turn-angle tolerance stays at 1e-9 rad (worst measured: 4.4e-11).

## 2026-10-03: Burn-arc validation and error-estimate check (checkpoint 4)

- **Test 3 (gravity-free burn)** checks the full closed-form constant-direction rocket solution,
  not just |Δv|:
  - final mass
  - Δv vector (magnitude and direction)
  - displacement r(t_b) − r_i − v_i t_b = û c [t_b + (m_f/ṁ) ln(m_f/m0)]
  - the work integral W = Δ(v²/2)

  It covers prograde, inertial (default and oblique) steering, Isp from 300 to 3000 s and a0 from
  1e-3 to 30 m/s². Everything passes at 1e-10 relative.
- **Test 5 (mass invariance)** scales (T, m0) by k ∈ {1e-3, 1, 37.5, 1e3, 1e6} through the public
  API. All outputs agree to 1e-12, and m0 and m_final scale by exactly k. As planned, this is
  largely structural, because mass is normalized by m0.
- **Body independence** is now a test: Earth, Jupiter, Sun and Mars with matched
  (ṽ∞, Δṽ, c̃, ã0) give the same η and η_E to 1e-10.
- **Frame-rotation invariance** is a test: two random 3D rotations, all three steering laws.
- **Was the η error estimate honest?** Each case was rerun at rtol = atol = 1e-13, and the change
  in η was compared with the energy-balance estimate δη:

| case | Π | η | δη (estimate) | \|Δη\| on rerun | estimate/actual |
|---|---|---|---|---|---|
| Earth hydrolox, v∞ = 0.3 v_esc | 0.77 | 0.99124 | 1.1e-11 | 1.2e-11 | 1.0 |
| Earth, v∞ = 0.02 v_esc, inertial | 0.17 | 0.99946 | 2.0e-12 | 2.0e-12 | 1.0 |
| Earth, a0 = 1e3 m/s² | 1.5e-3 | 0.99999996 | 1.0e-11 | 9.9e-12 | 1.0 |
| Jupiter NTR | 1.6 | 0.97785 | 1.7e-11 | 1.3e-11 | 1.3 |
| Jupiter Hall, a0 = 3e-4 | 2.4e3 | 0.0863 | 3.4e-11 | 9.3e-12 | 3.6 |
| Earth Hall, a0 = 2.5e-4 (outside SOI) | 6.6e3 | 0.0150 | 1.3e-11 | 2.0e-13 | 63 |
| Mars ion, a0 = 1e-3 | 7.2e2 | 0.0431 | 1.5e-11 | 2.8e-12 | 5.3 |
| Sun, pitch law | 0.54 | 0.98890 | 8.2e-11 | 5.8e-11 | 1.4 |
| Saturn, Δv = 1 m/s | 4.9e-4 | 0.99999996 | 3.5e-8 | 3.2e-8 | 1.1 |
| Venus, v∞ = 5 v_esc | 7.7 | 0.5384 | 2.6e-10 | 2.2e-10 | 1.2 |

  - The estimate was never optimistic, and it is tight (within ~1.3×) for Π ≲ 10.
  - For long burns it is conservative, by up to 63×.
  - `test_eta_error_estimate_is_not_optimistic` asserts |Δη| ≤ 2 δη. The factor 2 allows for
    the rerun's own error.
  - Small Δv (1 m/s) inflates δη, because B_imp is small in absolute terms. At Δv = 1 mm/s it
    exceeds 1e-6, and `eta_unreliable` fires (tested).
- **First physics glimpse** (prograde, centered burns):
  - η stays above 0.97 for Π ≲ 2.
  - η falls to 0.04–0.09 for electric propulsion with Π ~ 10³.
  - At Π = 7.7 with v∞ = 5 v_esc (Venus), η = 0.54. This hints that the secondary parameter
    v∞/v_esc matters at fixed Π, which is what Phase 2 is meant to investigate.
- **Flag semantics fix:** an impact now always sets `unsafe_periapsis`. Previously, a zero safety
  margin left it unset, because the check was a strict r_min < R.

## 2026-10-03: Test 4: impulsive limit and convergence order (checkpoint 5)

Source: `scripts/fig_eta_vs_a0.py` → `figures/eta_vs_a0.png` and `figures/eta_vs_a0.csv`.
Cases: Earth (h = 300 km, v∞ = 3 km/s, Δv = 1 km/s, Isp 465 s), with prograde and with inertial
steering; Jupiter (r_p = 1.5 R_J, v∞ = 6 km/s, Δv = 2 km/s, Isp 850 s), prograde. Burns are
centered on periapsis, and a0 runs from 1e-2 to 1e5 m/s².

- **η → 1 monotonically,** with |1 − η| < 1e-6 by a0 = 1e4 m/s² (Π ~ 1e-4).
- **The convergence order is exactly 2,** as the symmetry argument predicted. Fitted orders are
  2.000 for all three cases, and (1 − η)/Π² is constant to four digits over six decades:
  - Earth, prograde: 0.01489
  - Jupiter, prograde: 0.01014
  - Earth, inertial: 0.02444

  Test 4 asserts an order of 2.00 ± 0.02. The fit uses only points with 1 − η > 1e3 × the
  per-run error estimate and Π < 0.2.
- **Below Π ≈ 5e-5, 1 − η flattens at ~1.5e-11,** matching the per-run error estimate δη ≈ 1e-11.
  This is the numerical floor, and it is drawn on the figure.
- **The coefficient of Π² depends on the case** (0.010 vs 0.015 for prograde at Jupiter vs Earth).
  So Π alone does not fully collapse even the small-Π regime. A secondary parameter (v∞/v_esc,
  Δv/v_p, …) sets the prefactor. This is a direct pointer for Phase 2.
- **Inertial steering costs more than prograde** at the same Π (prefactor 0.024 vs 0.015),
  because thrust and velocity are misaligned by an angle ∝ t.

## 2026-10-03: Surprising result: inertial steering drives long burns into the planet

With inertially fixed thrust along the unperturbed periapsis velocity ŷ, the thrust has a
component *toward the planet* on the incoming leg. On the incoming asymptote, ŷ makes an angle
δ/2 with the velocity (cos(δ/2) = √(e²−1)/e = ŷ·v̂_in), and its normal component points to the planet side.
- Long burns therefore pull periapsis down. At Earth (h = 300 km, v∞ = 3 km/s, Δv = 1 km/s,
  Isp 465 s), every a0 ≤ 0.133 m/s² (Π ≳ 11) **impacts the planet**.
- These runs are flagged `impact`, with NaN metrics, and omitted from the plot with an
  on-figure note.
- Prograde steering does not do this.
- Consequence for Phase 2: inertial-law atlas cells at large Π will be masked by impact, which
  is a real limitation of that law. Phase 3's altitude constraint will matter for any law that
  pitches inward.

## 2026-10-03: CLI, configs and example runs (checkpoint 6)

`oberth run <config>` (YAML or JSON) prints the metrics and writes `runs/<name>/result.json` and
`trajectory.png`. Engine parameters in the example configs are representative assumptions, not
sourced hardware values. Results from `scripts/fig_example_trajectories.py`:

| config | Π | η | η_E | Δv loss (m/s) | flags |
|---|---|---|---|---|---|
| earth_hydrolox (v∞ 3 km/s, h 300 km, Δv 1 km/s, 465 s, a0 2 m/s²) | 0.762 | 0.99170 | 0.99313 | 14.2 | none |
| earth_pitch_example (pitch α = 5° − 20°·s, burn midpoint −0.1 t_b) | 1.96 | 0.94277 | 0.95370 | 124.5 | none |
| jupiter_nuclear_thermal (v∞ 6 km/s, r_p 1.5 R_J, Δv 2 km/s, 850 s, 0.5 m/s²) | 1.62 | 0.97668 | 0.97378 | 171.6 | none |
| jupiter_hall (v∞ 5.5 km/s, h 0.1 R_J, Δv 1 km/s, 1800 s, 3e-4 m/s²) | 2350 | 0.08900 | 0.16227 | 5059.9 | none |

- **Jupiter Hall case.**
  - A 1 km/s electric-propulsion burn spread over ~37 days keeps only 9% of the impulsive Oberth
    bonus. The impulsive burn would give v∞_out = 12.05 km/s; the finite burn gives 6.99 km/s.
  - The burn starts at 0.29 r_SOI, so it stays inside Jupiter's sphere of influence.
  - The long prograde thrust before periapsis **raises** the achieved periapsis, from 7,149 km to
    16,263 km altitude. This further reduces the Oberth benefit. It is the mirror image of the
    inertial-steering impact result above.
- **η and η_E differ, and not in a consistent direction.** η_E > η for the Earth cases, η_E < η
  for Jupiter NTR, and η_E is nearly 2× η for the Hall case. η measures the excess-*speed* bonus,
  while η_E measures the *energy* gain. Because v∞_out = sqrt(v∞_in² + 2Δε), the two weight
  losses differently. Which one the Phase 2 collapse should use (or both) is an open question;
  the data are stored for both.
- **Plotting** samples each adaptive integrator step through the dense output. Uniform time
  sampling under-resolved the periapsis passage for months-long burns. Coast arcs beyond the
  simulated span are display-only extensions, which enter no reported number.

## 2026-10-03: Phase 1 complete: summary and open questions

**Delivered:**
- A three-segment finite-burn flyby simulator (`simulate_flyby`).
- Pluggable steering: prograde, inertial, and a linear pitch law.
- All brief metrics, plus η_E and the r_SOI ratio, each with per-run numerical error estimates
  and flags.
- The `oberth run` CLI, and 296 passing tests (~3 s).
- Figures in `figures/`, regenerated from commit 5560507:
  - `eta_vs_a0.png` and `.csv`
  - `trajectory_*.png` for the four example configs

**Required tests:**
1. Coast-only flyby: v∞ and turn angle hold for all six bodies, three v∞ regimes and two spans.
2. Coast energy drift is below 1e-11 μ/r_p (worst measured: 5.7e-12).
3. Gravity-free burn matches the closed-form rocket solution to 1e-10.
4. η → 1 with empirical order 2.00.
5. Mass invariance holds to 1e-12 over nine decades of scale.

**Open questions for the user before Phase 2:**
1. **Δv is not a sweep dimension in the Phase 2 outline,** but it is one of the four
   dimensionless groups. Should it be fixed (e.g., 1 km/s), set per engine class, or swept?
2. **Should the Π-collapse use η, η_E, or both?** The two differ by up to 2× at large Π (Jupiter
   Hall: 0.089 vs 0.162).
3. **Energy-drift normalization:** consider v_p²/2 = |ε| + μ/r_p in place of μ/r_p, so that the
   v∞ ≫ v_esc regime is covered. This only matters for coast arcs ≫ 50τ.
4. **Inertial steering at large Π** drives the trajectory into the planet. Should impacted atlas
   cells be masked and reported as a separate category (proposed), or should the inertial law be
   restricted to Π ≲ 10?
5. **The prefactor of Π² differs between cases** (0.010 to 0.024). Π alone will not collapse the
   small-Π regime exactly. A secondary parameter is needed, as the brief anticipated.

---

# Phase 2

## 2026-10-04: Phase 2 decisions (user answers to the Phase 1 questions)

- **Q1 (Δv):** swept. The sweep runs directly over the four dimensionless groups
  (v∞/V, Δv/V, Isp·g0/V, a0·r_p²/μ), for both prograde and inertial steering, on log grids
  wide enough to cover every body and engine class. Every run stores r_min/r_p and
  r_burn_start/r_p, so impact and SOI flags can be applied per body afterwards. Bodies and
  engine presets are then overlaid as regions.
- **Q2:** η is the primary collapse metric. η_E has a nonzero floor: a deep-space burn scores
  (v∞Δv + Δv²/2)/(v_pΔv + Δv²/2), which mixes the baseline into the efficiency. η_E stays as a
  secondary output, and a baseline-subtracted version will be defined before the Sun is tackled.
- **Q3:** energy drift is normalized by v_p²/2 (see the entry below).
- **Q4:** impact cells are masked as their own category, and the impact boundary is drawn as a
  contour on the atlas.
- **New task:** derive the leading small-Π prefactor analytically, test it, test whether Π·√C
  collapses the small-Π data better than Π, and characterize the large-Π regime separately.

## 2026-10-04: Energy-drift normalization changed to v_p²/2

- **Reasoning:** round-off in ε = v²/2 − μ/r scales with the largest terms in ε, and along a
  flyby the largest is v_p²/2 = |ε| + μ/r_p.
  - For v∞ ≪ v_esc this equals μ/r_p, so nothing changes.
  - For v∞ ≫ v_esc it tracks |ε|. This removes the Phase 1 artifact where a 500τ coast at
    v∞ = 2 v_esc read 1.4e-11 relative to μ/r_p but only 2.8e-12 relative to v_p²/2.
- **What it applies to:** both the coast energy drift and the energy-balance residual. It uses
  the *unperturbed* v_p, which is slightly conservative on post-burn arcs where the speed is
  higher.
- **Threshold and tests:**
  - The 1e-11 threshold is kept.
  - Test 2 now also covers ±500τ spans, and all pass.
  - Test 1's v∞ tolerance becomes max(1e-10, 1e-11·(v_p²/2)/v∞²) in the nondimensional units.
- The η error estimate uses the absolute energy residual, so it is unaffected.

## 2026-10-04: Simulator split into a body-free core

- `simulate_nd(ṽ∞, Δṽ, c̃, ã0, steering, …)` runs entirely in nondimensional units and knows no
  body. Radii come back in units of r_p.
- Without a body, the only terminal radius is a floor at r = 1e-3 r_p, which avoids the r → 0
  singularity. Any trajectory reaching it is inside every body with r_p < 1000 R.
- Trajectories that pass "through" a planet keep going as point-mass orbits, so impact can be
  decided per body afterwards from r_min/r_p < R/r_p. A test confirms this agrees exactly with a
  real-body run that stops at the surface.
- `simulate_flyby` is now a thin SI wrapper. All Phase 1 tests pass unchanged, except for the
  intended normalization update.

## 2026-10-04: Small-Π prefactor: the user's derivation checked independently and corrected

> **Attribution (added 2026-10-04, literature review):** the (ω t_b)²Δv/24 loss scaling, kΠ²Δv/24 here, is Robbins (1966, AIAA J. 4(8):1417). See RELATED_WORK.md and the literature-review entries below.

The full derivation is in `docs/theory.md`; the code is in `theory.py`; tests are in `tests/test_theory.py`.

- **The user's (a) and (b) are both confirmed:** v̈ = −k(1−k)v_p/τ², and the inertial velocity
  direction rotates at k/τ.
- **The resulting C misses the terms that are first order in Δv/v_p,** because it evaluates
  the losses on the unperturbed trajectory:
  - during a prograde burn the speed rises by Δv_acc, which raises the flight-path turn rate by
    (1+k)Δv_acc;
  - the inertial cosine loss feeds back into the later speed, so it is weighted by (v_p + Δv);
  - the inertial sideways thrust reduces the gravity loss.
- **Corrected result for constant acceleration, centered burn:**
  - prograde: C = k Δv [(1−k) v_p + (1+k) Δv] / (24 v∞,imp B_imp)
  - inertial: C = k Δv (v_p + Δv) / (24 v∞,imp B_imp)
- **General form:** the code handles a general thrust profile through exact profile moments. That
  covers the mass ratio and any burn timing (timing enters only via the second moment of the Δv
  distribution about periapsis). For prograde, the speed dependence of the turn rate is kept to
  all orders in Δv. For inertial, the first-order expression is already exact: the equations of
  motion are linear in a fixed thrust vector to O(t_b²).

**Step 1: comparison with the measured Phase 1 prefactors.** C is extracted from simulations at
Π = 0.02 and 0.01 and Richardson-extrapolated.

| case | measured C | user's formula | corrected, constant a | corrected, rocket profile (exact) |
|---|---|---|---|---|
| Earth prograde (Δv/v_p = 0.088, Δv/c = 0.22) | 0.014885 | 0.011983 (−19.5%) | 0.014879 (−0.04%) | ≤ 1e-4 |
| Jupiter prograde (Δv/v_p = 0.041, Δv/c = 0.24) | 0.010137 | 0.009025 (−11.0%) | 0.010109 (−0.28%) | ≤ 1e-4 |
| Earth inertial | 0.024443 | 0.022396 (−8.4%) | 0.024373 (−0.29%) | −5e-6 |

**Step 2: where each version holds and where it breaks.** The scan covered v∞ ∈ {0.05, 0.5, 2}
(in units of V), Δv/v_p from 0.003 to 2, and Δv/c from 0 to 3.
- **User's formula:** the error is first order in Δv/v_p and is never small.
  - Prograde: −2.5% at Δv/v_p = 0.01, −20% at 0.1, −43% at 0.3, −70% at 1.
  - Inertial: −1%, −9%, −23%, −50% at the same points.
- **First-order corrected formula:**
  - Prograde: the residual is +(0.06–0.33)(Δv/v_p)², i.e. +1.5% at 0.3 and +6.5% at 1.
  - Inertial: exact (< 1e-6).
- **All-orders prograde, exact profile:** the residual is < 3e-5 everywhere tested, up to
  Δv/v_p = 2 and Δv/c = 3. That is the noise of extracting C from simulations, which scales as 1/Δv.
- **Mass-ratio effects:** a constant-acceleration theory is off by −0.07% at Δv/c = 0.1, −6% at 1
  and −30% at 3. The exact profile moments remove all of it.
- **Validity in Π:** the theory is leading order in Π and needs Π ≲ 0.5 (1 − η within 2% of
  CΠ²). At Π = 1.5 the true 1 − η is already 13% below CΠ² (Phase 1 Earth data). Beyond that is
  the large-Π theory.

## 2026-10-04: Linear response, the η ↔ η_W map, and three regimes (not two)

- **Energy is the linear quantity.**
  - The exact bookkeeping is ε_out = ε_in + W.
  - What is linear in the thrust is the **baseline-subtracted energy efficiency**
    η_W = (Δε_fin − Δε_deep)/(Δε_imp − Δε_deep), not η itself.
  - η is an exact algebraic function of η_W:
    η = (√(1 + ξη_W) − 1)/(√(1 + ξ) − 1), with ξ = 2Δv(v_p − v∞)/(v∞ + Δv)².
  - At low v∞ with v_pΔv ≳ v∞², ξ ≫ 1 and η ≈ √η_W. This is why η behaves non-monotonically in
    Δv at fixed Π (seen in the prefactor scan at v∞ = 0.05).
  - **Proposal for the user:** η_W is the natural "baseline-subtracted η_E" the user wants before
    the Sun. It is now stored on every run as `eta_W`, labeled as proposed. η stays the primary
    metric.
- **Linear-response curve.**
  - η_lin(Π; v∞/v_esc) = ⟨û·v_u − v∞⟩/(v_p − v∞) is one universal curve per v∞/v_esc.
  - Prograde: η_W(sim) − η_lin = O(Δv/v_p) with coefficient ≤ 0.25, for Π from 0.1 to 1e5.
    This is tested at two Δv values, which confirms first-order scaling.
- **Three prograde regimes, not two:**
  1. **Π ≪ 1:** 1 − η = CΠ².
  2. **1 ≪ Π ≪ Π_T = v_p/ṽ∞³:** the parabolic core, η ≈ (9/(2Π))^(1/3) ≈ 1.65 Π^(−1/3). This
     exists only when v∞ ≪ v_esc. Π_T is the ratio of the hyperbola's crossing time μ/v∞³ to τ.
  3. **Π ≫ Π_T:** the hyperbolic 1/r tail, η ≈ 2v_p[ln(ṽ∞³ t_b/e) − Σ(e)]/(ṽ∞²(v_p − ṽ∞)Π) ~ ln Π/Π.
     It matches η_lin to 0.3% at Π = 1e4 for v∞ = 0.5 V.
- **Inertial at large Π.** η_lin tends to the far-field misalignment limit
  v∞(cos(δ/2) − 1)/(v_p − v∞) < 0 (−0.20 at v∞ = 0.5 V). Beyond linear response the inertial
  law's large-Π behavior is not first order in Δv: errors grow as 0.08–0.33 at Π ≥ 1e4 even for
  Δv/v_p = 1e-3. This is because sideways thrust displaces the whole flyby once Δv·t_b ≳ r_p. It is
  characterized empirically in the sweep, not by theory.

## 2026-10-04: Bug fixes in the hyperbolic Kepler solver (found by the Phase 2 sweep)

1. **Slow convergence near-parabolic.**
   - Newton started at asinh(M/e), which lies left of the root. When e − 1 ≪ 1 (e.g.
     e − 1 = 3e-5, M = 4.5e-3, which occurs in the sweep at v∞ ≈ 0.005 V), the first step
     overshot to H ≈ 112. Newton then needed ~100 one-unit steps to come back, so the solver hit
     its iteration limit and raised an error.
   - Fix: start at the tightest of three rigorous upper bounds on the root
     (M/(e−1), (6M)^(1/3), asinh(M/(e−1))). Newton on the increasing convex f then converges
     monotonically.
   - New test: 14 eccentricities × 89 values of M (22 decades), all converging within 60
     iterations.
2. **Truncated series in sinh(x) − x.**
   - It stopped at x¹¹ and switched to direct evaluation at |x| = 0.5. The first omitted term
     there is ~1e-12 relative; the docstring wrongly claimed 3e-17.
   - Fix: the series now runs through x²¹, with the switch at |x| < 1. Error is ≤ 4.4e-16 relative
     against an exact rational series.
   - The new convergence test caught it: residuals at H ≈ 0.47 were 5× the rounding floor.
3. **Effect on Phase 1 results: none at reportable precision.**
   - The series error entered only the analytic initial state on near-parabolic arcs, at
     ≲ 1e-14 relative.
   - Every Phase 1 test passes unchanged.

## 2026-10-04: Engine presets, mission envelopes, and the sweep grid

**Presets** (`configs/atlas/presets.yaml`) are **representative assumptions**, not sourced hardware data.

| engine | Isp (s) | a0 (m/s²) | notes |
|---|---|---|---|
| hydrolox | 440–465 | 1–15 | upper stage carrying a payload |
| methalox (vac) | 360–380 | 2–30 | |
| nuclear thermal | 800–900 | 0.1–3 | heavy reactor and shielding: low thrust-to-weight |
| Hall | 1500–2000 | 5e-5 – 1e-3 | ~0.1–2 N on 0.5–3 t |
| gridded ion | 3000–4000 | 1e-5 – 5e-4 | ~0.02–0.5 N on 0.5–3 t |

The Isp ranges follow the brief.

Body envelopes:
- Sun: r_p = 3–20 R☉, v∞ 2–20 km/s. These are hyperbolic arrivals only; the bound-arrival
  question is still open.
- Venus and Earth: h = 200–5000 km, v∞ 2–10 and 1–10 km/s.
- Mars: h = 200–3000 km, v∞ 1–8 km/s.
- Jupiter: r_p = 1.05–10 R_J, v∞ 4–12 km/s.
- Saturn: r_p = 1.2–10 R_S, v∞ 4–10 km/s.
- Δv = 0.2–3 km/s for every engine class.

**Sweep grid.** The bounds are the extremes of the four dimensionless groups over every
(body, engine) envelope corner, widened ×1.5 on each side. So every envelope lies strictly inside
the grid (tested in `test_grid_covers_every_mission_envelope`).

| group | preset extremes | grid |
|---|---|---|
| ṽ∞ | 7.9e-3 – 3.09 | 15 log points |
| Δṽ | 7.9e-4 – 1.16 | 12 points |
| c̃ | 0.014 – 15.2 | 12 points |
| ã0 | 3.3e-7 – 287 (8.9 decades) | 39 points |

- (Δṽ, c̃) pairs with Δv/c > 2 are skipped as infeasible, since every preset has Δv/c ≤ 0.85.
- **Size:** 135,720 runs (both steering laws) at ~25 ms each, about 25 minutes on 8 workers.
  This was measured on a 300-point random sample, not estimated.
- **Mission samples:** 256 scrambled-Sobol points per (body, engine) envelope, log-uniform in
  (r_p, v∞, Δv, Isp, a0), simulated with the real body for both laws. That is 15,360 runs.

## 2026-10-04: Sweep execution and data quality

Every number below comes from `scripts/phase2_numbers.py` (→ `figures/phase2_numbers.json`) or
the named figure script.

- **Sweep:** 135,720 runs, **0 errors**, 133,969 reliable. The excluded rows are all inertial:
  1,617 captured and 134 that hit the floor.
- **Prograde:** none captured, none hit the floor.
- **Mission samples:** 15,360 runs, 0 errors.
- **Coast energy drift** (normalized by v_p²/2): median 3.5e-13, 99th percentile 1.7e-12.
  - 69 runs (0.05%) exceed 1e-11, up to 1.6e-9.
  - All 69 are inertial and none is reliable: 57 captured, the rest with no finite η. The
    reliability mask already excludes them.
- **Per-run η error estimate** over reliable rows: median 1.6e-10, max 3.8e-7. That is below the
  1e-6 flag everywhere, so `eta_unreliable` never fires.
- **Cost:** 2.3 CPU-hours (mean 62 ms per run). Three neighbouring grid cases logged ~88 s of
  wall-clock each, but rerunning one alone takes 29 ms. Those were OS or contention stalls (a test
  suite ran mid-sweep), not slow integrations. Note that `runtime_s` is wall-clock.
- **Provenance:** the Parquet metadata records git 0500743, the HEAD when the file was written.
  The modules that generate the sweep (simulate, theory, sweep, kepler) are identical between
  88313e5 (launch) and 0500743.
- **Prograde never lowers periapsis.** The minimum r_min/r_p over all 67,860 prograde runs is
  1.0000000000000395, so prograde finite burns never dip below the unperturbed periapsis. All
  prograde impact risk comes from the chosen r_p itself.

## 2026-10-04: Small-Π prefactor validated across the whole sweep (fig_prefactor_check.py)

> **Attribution (added 2026-10-04, literature review):** the (ω t_b)²Δv/24 loss scaling, kΠ²Δv/24 here, is Robbins (1966, AIAA J. 4(8):1417). See RELATED_WORK.md and the literature-review entries below.

**Corrected theory.** For every reliable row with Π < 0.01 and 1 − η > 10³·δη:
- Prograde (n = 3,360): |(1−η)/(CΠ²) − 1| has median 1.2e-4 and max 1.1e-3.
- Inertial (n = 4,160): median 9.7e-5, max 9.9e-4.

The figure shows the expected V shape: noise falls as 1/Π², the next-order term rises as Π², and
the two cross near 1e-5. The 1e-3 ceiling is set by the noise filter.

**User's hand formula.** The ratio (1−η)/(C_user Π²) has median 1.14 and max 4.38 for prograde,
and median 1.05 and max 2.30 for inertial. It grows with Δv/v_p, exactly as derived.

**Validity in Π** (leading order, prograde; the error is |(1−η)/(CΠ²) − 1|):

| Π band | median | max |
|---|---|---|
| 0.01–0.1 | 1.2e-4 | 3.4e-3 |
| 0.1–0.3 | 0.23% | 3.1% |
| 0.3–1 | 2.3% | 22% |
| 1–3 | 18% | 63% |

So the C·Π² regime is reliable to a few percent for Π ≲ 0.3.

## 2026-10-04: Collapse quantified (fig_collapse.py, collapse_metrics.csv)

**Metric note.** The scatter metric is the binned scatter of y, detrended inside each log-x bin.
The first, undetrended version reported 0.072 dex for Π√C. That was exactly the slope artifact
2/(8√12) for a y ∝ x² curve, not physics. Both metrics were fixed before any number below
(commit 14b5f83).

**Small Π (Π < 0.5),** scatter of log₁₀(1 − η):

| collapse variable | prograde (n = 15,375) | inertial (n = 16,193) |
|---|---|---|
| Π | 0.285 dex | 0.194 dex |
| Π·√C_user | 0.140 dex | 0.075 dex |
| **Π·√C (corrected)** | **0.0012 dex** | **0.00095 dex** |

The corrected scaling is about 240× and 200× tighter than Π alone. The remaining 0.1–0.3% is the
next-order Π² term near Π = 0.5. **Π√C collapses the small-Π data essentially exactly; Π alone
does not.**

**Full range, prograde,** RMS scatter of η:
- **0.080 about a single curve in Π.**
- **0.061 about a single curve in Π√C.** That variable was not designed for large Π.
- **0.0086 for the residual η − η_lin.** Here η_lin is the Δv→0 linear-response curve, mapped
  through ξ, for that row's v∞. This is 9× better than Π alone.

The remaining residual grows with Δv/v_p:

| Δv/v_p | Π < 1 | 1 ≤ Π < 100 | Π ≥ 100 |
|---|---|---|---|
| < 0.01 | |η − η_lin| ≤ 3e-4 | ≤ 1.7e-3 | ≤ 8e-4 |
| 0.01–0.1 | max 2.5e-3 | median 2.9e-3, max 0.014 | max 5e-3 |
| 0.1–0.3 | | median 0.018, max 0.047 | |
| 0.3–10 | | median 0.055, max 0.11 | |

**Full range, inertial:** the residual is 0.28 RMS. The Δv→0 theory does not capture the inertial
law beyond Π ~ 10. Its MAD is 0.0015, so the misses are a heavy tail, not general drift.

## 2026-10-04: Secondary parameter (collapse_secondary.png)

The explained fraction is the share of the scatter left after collapsing on Π, after subtracting a
permutation null.

**Prograde:**

| candidate | Π < 1 | 1 ≤ Π < 100 | Π ≥ 100 |
|---|---|---|---|
| v∞/v_esc | 73% | 92% | 91% |
| ξ | 52% | 85% | 92% |
| Δv/v_p | 30% | 12% | 14% |
| Δv·t_b/r_p | 28% | 6% | 7% |
| Δv/c (mass ratio) | 5% | 0.4% | 0.1% |

- **v∞/v_esc, the brief's own guess, is the dominant secondary parameter.** It enters through
  k = μ/(r_p v_p²) in C and through the shape of η_lin(Π).
- At small Π, the remainder is Δv/v_p, as the theory says: C depends on (k, Δv/v_p).
- The mass ratio is irrelevant to the collapse.

**Inertial:**
- At Π < 1: v∞/v_esc 78%, ξ 67%.
- At Π ≥ 100: **no single candidate explains more than 13%,** including the displacement scale.
  The large-Π inertial behavior is geometric (displaced flybys, impacts, the asymptote
  misalignment) and is not a one-parameter family.

## 2026-10-04: Large-Π regimes and crossovers (fig_regimes.py, prograde)

- **Three regimes confirmed in the data** (η_W, Δv/v_p < 0.03):
  - **Regime II plateau:** η_W·(Π/4.5)^(1/3) over 3,767 points with 30 < Π < 0.03 Π_T has
    median 0.983 and 10th–90th percentile 0.92–1.02.
  - **Turnover into regime III** happens at Π ≈ Π_T = v_p V²/v∞³.
  - Regime II exists only for v∞/v_esc ≲ 0.5 (Π_T > 1).
- **Crossover I → II/III, the half-efficiency point.** η_W = 0.5 at Π½ = 8.4–40 across all 1,143
  (v∞, Δv, c) families. The median is 26, and Π½ depends only weakly on v∞/v_esc.
  - The Δv→0 theory predicts Π½ to 0.4% (median), 7.8% at worst.
  - **Rule of thumb: a burn longer than ~10–40 periapsis timescales forfeits half the Oberth
    bonus, at any body.**
- **Refinement of the two-regime expectation.** At small v∞/v_esc the decay is not ln Π/Π right
  away. It is Π^(−1/3) (parabolic core) over the decades up to Π_T, which spans 10² to 10⁶ for
  v∞/v_esc = 0.1 to 0.01. That is why low-v∞ bodies (the Sun, Jupiter, Saturn) keep far more η at
  a given Π.

## 2026-10-04: Inertial steering characterized (sweep)

- **Impacts** at h = 0.1 R (h = 1 R in parentheses), by Π band:

  | Π band | impact fraction |
  |---|---|
  | < 1 | 0% |
  | 1–10 | 2% (0%) |
  | 10–10³ | 33% (13%) |
  | 10³–10⁵ | 39% (19%) |
  | ≥ 10⁵ | 0.6% |

  At very large Π the sideways displacement carries the trajectory clear of the planet again.
  The atlas shows the impact band and its contour.
- **Negative η** (reliable runs):

  | Π band | share with η < 0 |
  |---|---|
  | < 10 | 0% |
  | 10–10³ | 33% |
  | ≥ 10³ | 95% |

  - **Every case with η < −2 dips below R/r_p = 0.91** (all 167), so the extreme values
    (min −24) are impacts for any real flyby.
  - Among non-impacting runs (h = 0.1 R) the minimum is −1.24, and 21% are negative.
- **Conclusion:** below Π = 10, fixed-direction thrust never goes negative and impacts in only
  2% of cases. Beyond Π ~ 10 it impacts or does worse than deep space in a large fraction of
  cases.

## 2026-10-04: Where real missions sit (fig_missions.py, mission_table.csv)

Prograde, real bodies; values are the median η with the 10th–90th percentile in parentheses.

| engine | Sun | Venus | Earth | Mars | Jupiter | Saturn |
|---|---|---|---|---|---|---|
| Hydrolox, methalox | 1.00 | 1.00 (≥ 0.98) | 1.00 (≥ 0.98) | 1.00 (≥ 0.98) | 1.00 | 1.00 |
| Nuclear thermal | 1.00 | 0.96 (0.66–1.00) | 0.97 (0.70–1.00) | 0.96 (0.61–1.00) | 1.00 (0.98–1.00) | 1.00 (0.99–1.00) |
| Hall | **0.42 (0.24–0.69)** | 0.011 | 0.018 | 0.009 | 0.12 (0.04–0.32) | 0.11 (0.03–0.32) |
| Gridded ion | 0.30 (0.14–0.55) | 0.004 | 0.007 | 0.003 | 0.054 | 0.047 |

- **Chemical:** median Π ≈ 0.004–0.2, so η is essentially 1 everywhere.
- **Nuclear thermal:** median Π ≈ 1.4–1.6 at the terrestrial planets, so a few percent is lost on
  median cases and up to ~40% in the low-a0 tail. At the giant planets τ is long, so η ≈ 1.
- **Electric propulsion, terrestrial planets** (Π ~ 10³–10⁴): the burn starts outside the
  sphere of influence in **95–100%** of samples. The planet-centered result is therefore not
  physical there. These cells call for a heliocentric treatment (Phase 4), not a planetary one.
- **Electric propulsion, Jupiter and Saturn:** 13–50% of samples start outside the SOI.
- **The Sun is the only body where electric propulsion keeps a substantial Oberth bonus.** The
  long τ at a few R☉ and the low v∞/v_esc put it in regime II. In absolute terms, though, the
  median loss there is still ~6.7 km/s against an impulsive burn.
- **Inertial steering for electric propulsion is worse than deep space at every planet:**
  - median η = −0.22 to −0.26 at the terrestrial planets;
  - median η = −0.13 to −0.29 at the giant planets;
  - 4–27% of planetary samples impact.
  - At the Sun the median stays positive (0.16 Hall, 0.06 ion), with 1–5% impacting.

## 2026-10-04: Phase 2 complete: summary and open questions

**Delivered:**
- **Body-free simulator core** (`simulate_nd`). Energy drift is now normalized by v_p²/2.
- **Analytic theory** (`theory.py`, derived in `docs/theory.md`):
  - the exact small-Π prefactor, prograde to all orders in Δv, inertial exactly quadratic;
  - the linear-response curve η_lin(Π; v∞/v_esc);
  - the parabolic-core and hyperbolic-tail asymptotes;
  - the exact η ↔ η_W map.
- **Sweep data:** a dimensionless grid of 135,720 runs (`results/sweep_nd.parquet`) and 15,360
  real-body mission samples (`results/missions.parquet`).
- **Analysis:** reliability masks, per-body impact and SOI handling, and model-free collapse
  metrics.
- **Figures:** eight new ones, plus `phase2_numbers.json`.
- **Two Kepler-solver bug fixes**, found by the sweep.
- **Tests:** 401, all passing.

**Main findings:**
1. **The hand prefactor needed first-order Δv/v_p corrections.** The corrected C matches every
   small-Π sweep point to ≤ 1e-3, and is limited by noise. The hand formula is off by up to 4.4×.
2. **Π√C collapses the small-Π data ~200× better than Π alone** (0.001 dex against 0.2–0.3 dex).
3. **The dominant secondary parameter is v∞/v_esc.** It explains 73–92% of the scatter left after
   collapsing on Π (prograde). The mass ratio is irrelevant.
4. **There are three regimes, not two:** C·Π², then (9/2Π)^(1/3), then ln Π/Π.
   - Regime II exists when v∞ ≪ v_esc and ends at Π_T = v_p V²/v∞³.
   - The half-efficiency point is Π½ = 8–40 for every body: the practical rule of thumb.
5. **The prograde Δv→0 theory (η_lin mapped through ξ) collapses the full-range data to 0.009 RMS
   in η.** The residual is set by Δv/v_p.
6. **Inertial steering:**
   - an impact band at 10 ≲ Π ≲ 10⁵ (33–39% of cases at h = 0.1 R);
   - mostly negative η beyond Π ~ 10³;
   - no one-parameter collapse at large Π.
7. **Real missions:**
   - Chemical: η ≈ 1 everywhere.
   - Nuclear thermal: η ≈ 0.96 at the terrestrial planets, ≈ 1 at the giant planets.
   - Electric propulsion: η ≈ 0.01 at the terrestrial planets (where 95–100% of burns start
     outside the SOI), ≈ 0.05–0.12 at Jupiter and Saturn, and 0.3–0.4 at the Sun.

**Open questions for the user:**
1. **Adopt η_W** = (Δε_fin − Δε_deep)/(Δε_imp − Δε_deep) as the baseline-subtracted η_E?
   - It is the quantity that is linear in thrust, and η follows from it exactly through ξ.
   - Caveat: it still uses W_deep = v∞Δv + Δv²/2, which is undefined for bound solar arrivals. The
     Sun would need a different baseline, for example burning at the aphelion of the incoming
     orbit.
2. **Electric propulsion at terrestrial planets.** These burns almost always start outside the SOI.
   - Should the atlas grey these out, rather than show them hollow as now?
   - Or should the question be deferred to the Phase 4 heliocentric treatment?
3. **Phase 3 scope.**
   - **Steering:** inertial steering is a poor baseline beyond Π ~ 10. Optimize pitch_linear and
     compare against prograde only?
   - **Burn timing:** at leading order the theory predicts the optimal timing puts the
     Δv-centroid at periapsis, i.e. starting earlier than centered by (x̄ − ½)·t_b. The gain is
     only O(μ_r²·Π²) for chemical engines. Is the larger-Π question the more interesting one?
4. **The exhaust-velocity axis** barely matters, explaining < 5% of the scatter. Should future
   sweeps fix it, to spend the budget on Δv and v∞ resolution?
5. **A leftover local `phase-1` branch** exists from Phase 1. Delete it?

---

# Literature review (before Phase 3)

## 2026-10-04: Prior work checked; small-Π prefactor attributed to Robbins (1966)

Full summaries, access status and citations are in `RELATED_WORK.md`.
- **Robbins (1966)** could not be accessed (AIAA paywall). Its loss expression is taken from
  Confraria's (2020) quotation.
- **Willis (1966)**, NASA TN D-3606, is the correct form of the "Villis 1967" citation. Full
  text was read.
- **Confraria (2020):** full thesis read.
- **Ferreira et al. (2022):** read in HTML.
- **Hibberd et al. (2026):** full text read.

**Attribution.** The small-Π loss scaling (ω t_b)²Δv/24 with ω² = μ/r³, which is kΠ²Δv/24 in our
variables, is **Robbins (1966)**. The user's hand prefactor is Robbins' expression converted to an
energy deficit with v_p. The Phase 2 entries on the prefactor ("checked independently and
corrected", "validated across the whole sweep") have been annotated accordingly, and so have
`docs/theory.md`, `theory.py`, and the prefactor, collapse and regimes figures.

**What this project adds to Robbins' result** (labels in RELATED_WORK.md):
- **Fixed-direction thrust:** the leading-order loss at an apse *equals* kΠ²Δv/24. It is exact,
  not just a bound, provided the energy deficit is converted with the post-burn speed v_p + Δv.
  - Converting with v_p instead, as the hand formula did, is exactly the factor v_p/(v_p + Δv).
    For the Earth case that is −8.1%, which accounts for most of the measured −8.4% error.
- **Prograde thrust** comes in below it, by L/L_R = [(1−k)v + (1+k)Δv]/(v + Δv) at first order
  (all orders in code).
- **Mass ratio:** a burn centered in time can exceed it with a large mass ratio.
- **Generalization:** the theory now holds at an apse of *any* conic
  (`theory.small_pi_deficit_apse`). It is tested against direct integration at apoapsis
  (k > 1), on a circular orbit (k = 1), at an elliptic periapsis and at a hyperbolic periapsis,
  to 2e-4.

## 2026-10-04: Robbins' expression compared with measured losses (`scripts/robbins_comparison.py`)

**Measure.** The energy-equivalent extra Δv, L = (Δε_imp − Δε_fin)/(v_p + Δv), compared with
L_R = kΠ²Δv/24.

**Flyby sweep:**
- **Fixed-direction thrust:** median R = L/L_R = 1.000 for Π < 0.3, and 0.98 / 0.82 / 0.35 at
  Π = 0.3–1 / 1–3 / 3–10.
- **Prograde:** median 0.63 (range 0.50–1.05) at Π < 0.01, then 0.57 up to Π = 1, then 0.48 and
  0.24.
- **Agreement with theory:** at Π < 0.01 the measured R matches the leading-order theory to a
  median of 1e-4 (max 1.1e-3).
- **Exceeding the bound:** rows with Δv/c > 1, centered in time, exceed it (max R = 1.087
  inertial, 1.049 prograde).

**Confraria's escape setup, re-simulated** (LEO 200 km, Isp 300 s, tangential, exact extra Δv to
reach the impulsive C3). Robbins' relative overestimate:
- **127–131% at T/W₀ = 0.1** (Π ≈ 2.5–2.9), reproducing her "~125%";
- 49–78% at T/W₀ = 0.5;
- tending to the leading-order limits of 45–76% as T/W₀ → ∞, set by Δv.

So "~125%" is the T/W₀ ≈ 0.1 point of a Π- and Δv-dependent curve, not a constant ratio. It also
means Robbins ≈ 2.25 × actual, not 1.25 × actual.

**Unresolved:** at T/W₀ = 0.5 our 49–78% sits above the ~40–60% read by eye from her Fig. 4.34.

## 2026-10-04: Phase 4 case study replaced, now a finite-burn re-analysis of Hibberd et al. (2026)

- **Check done.** Hibberd, Eubanks & Hein (arXiv:2601.02533) model the solar Oberth manoeuvre
  **impulsively**. They write that the spacecraft "must apply all its ∆V at periapsis w.r.t. the
  body in question", and the SOM is a massless Intermediate Point with ∆V = |V_D − V_A|. There
  is no burn duration, thrust profile or gravity-loss discussion.
- **Revised Phase 4 plan,** replacing the new 3I/ATLAS mission design:
  1. **Inputs.** Reproduce their reference SOM: 3.2 R☉, ΔV = 8.36 km/s, post-burn speed
     ≈ 352 km/s, and the arrival state implied by the E–J–SOM sequence.
     - The arrival is bound and near-parabolic, which is now confirmed rather than inferred
       (see the entry "Hibberd SOM speed is post-burn" below).
     - Their pre-burn state is not given in the paper. Ask the authors or rerun OITS (it is
       open-source on GitHub) to get it.
  2. **Simulator extension** to bound arrivals: an elliptic Kepler initial state, already
     covered by the apse theory. The metric becomes the extra Δv and the v∞,out shortfall
     against the impulsive SOM, both defined for bound arrivals (cf. the open question on
     η_W / the Sun).
  3. **Burn model.** Their solid-stage combinations (Table 2), with thrust and burn times from
     manufacturer data **[to be sourced]**. Model staging as coast gaps, with burn timing
     optimized (Phase 3 tools).
  4. **Outputs:**
     - the extra Δv,
     - the change in deliverable payload (via their stage masses and exhaust velocities),
     - the change in arrival speed / flight time,
     - the thrust-to-weight below which the loss becomes significant.
- **Pre-registered expectation** (estimate, to be tested):
  - τ = r_p/v_p ≈ 2.23e9 m / 3.45e5 m/s ≈ 6,500 s at 3.2 R☉.
  - If the stack's total burn lasts a few minutes (typical for solid stages; **not yet sourced**),
    then Π ≈ 0.02–0.05. The leading-order theory then gives an extra Δv ≈ R·kΠ²Δv/24
    ≈ 0.04–0.25 m/s, with k ≈ ½ and R ≈ 0.52 (for Δv/v ≈ 0.024). That is negligible against 8.36 km/s.
  - If this holds, the case study's value lies elsewhere:
    - in confirming the impulsive model for solid stages;
    - in mapping the thrust level at which it fails (Π ~ 1 means t_b ~ 1.8 h);
    - in quantifying staging-gap and thermal-dwell constraints near perihelion.

## 2026-10-04: Correction: dimensional form of Π_T

The user caught an error. The Phase 2 summary, two research-log lines, RELATED_WORK.md and the
regimes-figure axis label wrote Π_T = v_p V³/v∞³, which is not dimensionless.

The crossing time μ/v∞³ divided by τ = r_p/v_p gives **Π_T = v_p V²/v∞³ = (v_p/V)(V/v∞)³**. In
nondimensional units (V = 1) this is v_p/v∞³, which is what `theory.tail_crossover_pi` computes.
So no number, figure value or test was affected. Only the written formula was wrong, and it is now
corrected in all four places. docs/theory.md and the theory.py docstring now state the dimensional
form explicitly.

## 2026-10-04: Hibberd SOM speed is post-burn, so the arrival is bound (from their Table 1)

Hibberd et al.'s text does not say whether the Table 1 "Heliocentric speed at SOM" is before or
after the burn. Their table settles it:
- **The speed tracks ΔV.** Across all five rows (ΔV = 8.355 to 29.991 km/s) the speed rises
  almost one-for-one with ΔV, and speed − ΔV = 343.6, 343.7, 343.6, 342.9, 342.0 km/s.
- **That pre-burn speed is bound.** Local escape speed at 3.2 R☉ is 345.3 km/s, and a fall from
  Jupiter's distance arrives at 344.8 km/s.

So the column is the **post-burn** speed, and the arrival is **bound and near-parabolic**
(≈ 342–344 km/s before the burn). The user independently reached the same conclusion.
RELATED_WORK.md (Hibberd section) records the reasoning. Phase 4 therefore uses bound-arrival
support and the equivalent-Δv penalty (decision Q1).

## 2026-10-04: Literature follow-ups (user review of the literature summary)

- **Relabelled:** "Robbins is exact for fixed-direction thrust" is now **(a) probable**. Robbins
  may have derived his expression from a fixed-attitude burn. This holds until the user obtains
  the paper.
- **Targeted search for prior large-burn laws** (RELATED_WORK §7):
  - Found the classical low-thrust spiral-escape law Δv_esc ≈ v0[1 − c·ε^(1/4)] (Tsien 1953 and
    MIT 16.522 notes, c ≈ 0.754). It is a near-parabolic fractional-power law, but in a
    different problem.
  - No prescribed-Δv flyby laws (Π^(−1/3), ln Π/Π, Π_T) were found. The three-regime result stays
    **(c) provisional**, framed as a flyby analogue of the classical spiral-escape asymptotics.
- **Added Maraqten et al. (2026)**, arXiv:2608.11113, on SEP solar Oberth at 0.3 au. It uses the
  finite-time work integral (our W), and reports ~3× the energy gain of a 1 au spiral. Our
  electric-propulsion-at-the-Sun result is now classified **(a)** qualitatively and **(b)**
  quantitatively (fraction of the impulsive bonus retained).
- **Confraria Fig. 4.34 digitized** (Δv = 3.5 and 4.0 km/s; RELATED_WORK, Robbins comparison):
  - Her overestimates are 120/123% at T/W₀ = 0.1 and 57/54% at 0.5.
  - Ours are 130/127% and 78/66%.
  - So her implied losses are 4–14% larger than ours. **Unresolved, not pursued in Phase 3**
    (user decision). Causes are listed in RELATED_WORK. The sign is consistent with incompletely
    converged optimization in her direct shooting.

## 2026-10-04: Phase 2 decisions applied (user, before Phase 3)

- **Q1, metrics.**
  - η_W = (Δε_fin − Δε_deep)/(Δε_imp − Δε_deep) is adopted as the energy-based secondary metric.
  - η_E is kept in outputs but marked **deprecated** (deep-space floor) in code comments,
    docs/theory.md §2, CLAUDE.md and the CLI report, which now prints η_W.
  - Bound arrivals (Phase 4) use the equivalent-Δv penalty.
- **Q2, electric propulsion outside the SOI.**
  - Mission samples whose burn starts outside the body's sphere of influence are **greyed out**
    in the mission atlas, labelled "planet-centred model invalid".
  - Their η statistics are reported separately from the valid samples.
  - A heliocentric low-thrust treatment is **out of scope** and recorded as a limitation.
- **Q3, Phase 3 scope.**
  - Optimize the prograde family only (pitch law plus timing), with inertial as a reference
    curve, over 1 ≲ Π ≲ 100.
  - Enforce a minimum-altitude constraint, and report η against both baselines (fixed-r_p
    impulsive, and impulsive at the achieved periapsis).
  - Frame the contribution as quantifying recoverable efficiency against Π and v∞/v_esc. The
    inward tilt itself is known (Confraria, Ferreira).
- **Q4, sweeps.** The exhaust-velocity axis is reduced to three values, Δv/c ≈ 0.1, 1 and 3
  (high mass ratio is where Robbins is exceeded). The freed budget goes to Δv and v∞ resolution.

## 2026-10-04: Mission table restated on valid samples only (Q2)

`analysis.mission_table` and `figures/missions_regions.png` now compute η statistics only over
samples whose burn starts inside the SOI and does not impact. Outside the SOI the planet-centred model is invalid.
This **supersedes the electric-propulsion medians** in the Phase 2 "Where real missions sit"
entry, which pooled invalid samples.

**Prograde electric propulsion,** median η (10th–90th percentile), valid samples only:

| engine | Sun | Jupiter | Saturn | Earth | Mars | Venus |
|---|---|---|---|---|---|---|
| Hall | 0.42 (0.24–0.69) | 0.14 (0.06–0.33) | 0.12 (0.05–0.34) | 0.13 (0.07–0.17), n = 18 | 0.08 (0.07–0.12), n = 13 | no valid samples |
| Gridded ion | 0.30 (0.14–0.55) | 0.11 (0.05–0.25) | 0.08 (0.04–0.24) | no valid samples | no valid samples | no valid samples |

- At the Sun all samples are valid. 17–47% of the Jupiter/Saturn samples were invalid.
- **Interpretation.** The earlier terrestrial-planet medians of ~0.01 were dominated by invalid
  long burns. The few valid terrestrial electric-propulsion cases are short-Π outliers (high a0,
  small Δv).
- **Unchanged:** chemical and nuclear-thermal numbers (0% outside the SOI).
- **Limitation:** a heliocentric low-thrust treatment of the invalid cases is out of scope.

## 2026-10-04: Bug fixed: pitch-law singularity at zero angular momentum (found in Phase 3)

- **Symptom.** The first Phase 3 campaign stalled: after about 17 minutes, fewer than 25 of 450
  optimizations had finished, and the log showed a divide warning in `PitchLinear`.
  A probe of the control-box corners hung on (α₀, α₁, δ) = (−1.2, −3, +1) at Π = 100,
  v∞/v_esc = 0.03, Δv/v_p = 0.3, Δv/c = 3.
- **Cause.** The in-plane normal was built from the *instantaneous* orbit normal ĥ. The sideways
  thrust term changes |h| at the finite rate sin α·(r·v̂)·a, which does not vanish as h → 0. A
  strong pitch therefore drives h to zero, ĥ flips, and the thrust direction chatters across
  h = 0. This is a sliding mode: DOP853 takes ever-smaller steps without ever failing. Phase 1–2
  never reached it because they used only small pitch angles; the optimizer probes the corners.
- **Fix** (commit 9dfa5fd). The pitch is now measured from the fixed normal ẑ₀ of the incoming
  flyby plane. This is identical to ĥ whenever the angular momentum keeps its sense, i.e. for every
  flyby that does not reverse, and it is smooth through h = 0.
- **Tests added:**
  - equivalence with the ĥ-based law (perifocal and rotated frames, to 2e-16);
  - continuity at h = 0;
  - a regression test on the stalled corner.
  All 451 tests pass. The corner probe now runs each evaluation in under 0.1 s.
- **Effect on earlier results: none.** The Phase 1–2 sweeps (`sweep_nd.parquet`,
  `missions.parquet`) used only prograde and inertial steering. Pitch-linear appeared only in tests
  and in `configs/earth_pitch_example.json`, and all of those still pass. The campaign was restarted
  from scratch with the fixed law.

## 2026-10-04: Phase 3 optimization campaign (`scripts/run_phase3.py`)

**Setup.**
- **Grid:** Π ∈ {1, 3, 10, 30, 100} × v∞/v_esc ∈ {0.03, 0.1, 0.3, 1, 3} × Δv/v_p ∈ {0.03, 0.3}
  × Δv/c ∈ {0.1, 1, 3}, i.e. 150 cases.
- **Three runs per case:**
  - timing only (α ≡ 0, δ free; bounded Brent);
  - pitch + timing (α₀, α₁, δ) with r_min ≥ r_p (SLSQP, 5 starts);
  - the same with r_min ≥ 0.9 r_p.
- **Size:** 450 optimizations, 23.4 min on 8 workers.
- **Objective:** maximize η_W (equivalent to maximizing η, ε_out and v∞,out at fixed Δv, Isp, a0).
- **Baselines:** η is reported against the impulsive burn at the nominal r_p ("fixed") and at the
  trajectory's own r_min ("achieved").

**Quality.** All numbers are from `figures/phase3_numbers.json`.
- **Errors and feasibility:** 0 errors; all 450 optima are feasible.
- **Bounds:** no optimum lies on a bound. The ranges are α₀ ∈ [−0.0002, 0.309] rad,
  α₁ ∈ [−0.744, 0.004] rad and δ ∈ [−0.654, 0.329].
- **Multi-start agreement:** in 296 of 300 constrained optimizations all 5 starts reach the same
  optimum (spread ≤ 1e-6). In the other 4 (Π = 100, v∞/v_esc = 3, Δv/v_p = 0.3, Δv/c ∈ {0.1, 1})
  one start, (0.3, 0, −0.3), stalls in an inferior local optimum (η ≈ −0.1); the other 4 starts
  agree.
- **Independent check:** penalty Nelder–Mead on 12 cases agrees with SLSQP. η_NM − η_SLSQP lies
  in [+1e-14, +4.7e-9]; the largest difference comes with a 5e-7 constraint violation by NM.
- **Integration error:** max η error estimate 7.2e-10.

## 2026-10-04: Phase 3 results: recoverable efficiency in the prograde family

1. **Recoverable efficiency** Δη = η_opt − η_centered (r_min ≥ r_p, fixed baseline). The
   median (max) in percentage points:

   | Δv/c | Π = 1 | 3 | 10 | 30 | 100 |
   |---|---|---|---|---|---|
   | 0.1 | 0.00 (0.03) | 0.08 (0.25) | 0.52 (1.42) | 0.68 (2.57) | 0.45 (3.13) |
   | 1 | 0.10 (0.28) | 0.43 (1.57) | 0.84 (3.52) | 1.02 (3.32) | 1.02 (2.16) |
   | 3 | 0.69 (2.02) | 4.00 (10.60) | 11.72 (21.56) | 13.64 (20.62) | 10.97 (15.93) |

   - The **mass ratio controls** what can be recovered. Centered prograde burns are within
     ~3.5 pp of the family optimum for Δv/c ≤ 1, but leave up to 22 pp on the table for Δv/c = 3.
   - As a fraction of the deficit 1 − η_c, the median recovered is:
     - 0.1–1% at Δv/c = 0.1;
     - 1.5–6% at Δv/c = 1;
     - 13–35% at Δv/c = 3.
     It falls with Π.
   - **v∞/v_esc** sets the size at fixed Π. Larger v∞/v_esc gives a larger Δη at Π ≲ 10, and
     the curves cross at larger Π (figure `phase3_recoverable.png`).
2. **Timing does most of the work.** Timing alone gives a median 93–99% of the full gain at every
   Π. By Δv/c the median share is 0.74, 0.99 and 0.99. Inward pitch matters only for Δv/c = 3
   with Δv/v_p = 0.3: there α₀ reaches 16° and α₁ −39° (pitching back toward prograde during the
   burn). Elsewhere it is ≲ 1°.
3. **Small-Π theory of the recoverable fraction** (new, `optimize.timing_theory_fraction`).
   - **The mechanism:** only the m₂ term of the small-Π deficit depends on timing; the
     finite-Δv term j is translation-invariant. Moving the Δv centroid to periapsis therefore
     recovers [C(½) − C(x̄)]/C(½) of the deficit.
   - **Δv → 0 limit:** (x̄ − ½)²/⟨(x − ½)²⟩_f = 0.083%, 7.58% and 39.7% for Δv/c = 0.1, 1 and 3.
   - **Agreement:** to ≤ 2e-4 at Π = 0.1 for all v∞/v_esc and Δv/v_p tested. It still holds
     within ~1 percentage point of the fraction at Π = 1 for Δv/v_p = 0.03. Tests in
     `tests/test_optimize.py`.
4. **Timing hypothesis.** "Start earlier than centered" is **confirmed at small Π** for every
   case: δ_opt equals ½ − x̄ to 2e-3 at Π ≤ 0.2. At Π = 1 the deviation is median 0.011 and
   max 0.025.
   - **Δv/c ≥ 1:** at larger Π the optimum moves *further* earlier. The median δ at
     Π = 1, 3, 10, 30, 100 is:
     - Δv/c = 3: −0.23, −0.29, −0.39, −0.45, −0.49 (theory −0.22);
     - Δv/c = 1: −0.086, −0.106, −0.162, −0.219, −0.269 (theory −0.082).
   - **Reversal:** for near-constant-mass burns with a large Δv the optimum moves *later*. 38 of
     150 timing optima have δ > 0, all at Δv/c ≤ 1; e.g. Δv/c = 0.1, Δv/v_p = 0.3: δ = +0.06,
     +0.17, +0.26 and +0.32 at Π = 3, 10, 30 and 100.
   - **Mechanism, read off the data:** prograde thrust before periapsis lifts the actual
     periapsis. The centered burn has r_min = 1.03, 1.14, 1.35 and 1.70 r_p at Π = 3–100
     (v∞/v_esc = 0.03, Δv/c = 0.1, Δv/v_p = 0.3), and the later optimum keeps it at 1.02–1.16.
     For high mass ratio the centroid effect dominates despite the lift (the early optimum
     reaches r_min = 2.11 at Π = 100, Δv/c = 3).
5. **Altitude constraint and the two baselines.**
   - With r_min ≥ r_p the constraint is binding (relaxing it moves the optimum below r_p) in 20 of
     150 cases: 17 at Δv/c = 3, 3 at Δv/c = 1, none at 0.1.
   - Relaxing to 0.9 r_p gains at most 0.91 pp on the fixed baseline, but **≤ 7e-6 pp, and down to
     −2.2 pp, on the achieved baseline.** Going deeper buys only what an impulsive burn at that
     depth would buy: the constraint costs depth, not efficiency.
   - With r_min ≥ r_p, η_achieved − η_fixed lies in [0, 0.040] (median 0.0018).
   - Comparing both burns on their own achieved periapsis, the median ratio (achieved-baseline
     gain)/(fixed-baseline gain) is −0.73 at Δv/c = 0.1 and 1.05 and 1.01 at Δv/c = 1 and 3. For
     near-constant-mass burns the "recoverable efficiency" is therefore entirely depth: the
     centered burn wastes it by lifting its periapsis. For high-mass-ratio burns it is a genuine
     efficiency gain.
6. **Inertial reference.** Inertial centered η has median 0.97, 0.84, 0.50, 0.18 and −0.05 at
   Π = 1, 3, 10, 30 and 100 (min −1.36). The optimized prograde family beats it in all 150 cases.
   The margin η_opt − η_inertial has median 0.008, 0.047, 0.155, 0.278 and 0.321 at those Π
   (min 0.0013, max 1.60).

**Figures:**
- `phase3_recoverable.png`
- `phase3_fraction.png`
- `phase3_timing.png`
- `phase3_baselines.png`
- `phase3_pitch.png`

All are generated by `scripts/fig_phase3.py`, which also writes `figures/phase3_numbers.json`.

## 2026-10-04: Phase 3 complete: summary and open questions

**Delivered:**
- `optimize.py`: timing-only and pitch + timing optimization under r_min ≥ ρ r_p, with η on
  both baselines, plus `timing_theory_delta` and `timing_theory_fraction`.
- `results/opt_phase3.parquet`: 450 optima, 0 errors, all feasible, Nelder–Mead-confirmed.
- Five figures plus `figures/phase3_numbers.json`.
- `docs/theory.md`: section on optimal burn placement.
- RELATED_WORK rows 19–25 and paper outline §9 (claim P6).
- **Tests:** 455 pass.
- **Bug fixed along the way:** the pitch-law singularity at h = 0.

**Answer to the Phase 3 question.** How much efficiency can be recovered within the prograde
family?
- **Δv/c ≤ 1:** little. At most 3.5 pp, i.e. < 8% of the deficit.
- **Δv/c = 3:** a lot. Up to 21.6 pp, a median of 13–35% of the deficit.
- **Source:** almost entirely burn timing (Δv centroid at periapsis, closed form at small Π),
  not pitch.
- **Altitude constraint:** costs depth, not efficiency.

**Open questions for the user:**
1. **Richer pitch laws.** The "pitch adds little" result is for a *linear* pitch law. Should a
   quadratic or piecewise law, or a few optimal-control (costate) solutions, be checked at the
   Δv/c = 3, Δv/v_p = 0.3 cases where pitch matters most? Recommendation: a small check (about
   10 cases) before the claim goes in the paper.
2. **Large-Π reversal.** The later-is-better timing for near-constant-mass burns is measured and
   explained qualitatively (periapsis lifting), with no asymptotic theory. Pursue one, or report
   it as an empirical result?
3. **Headline baseline.** Lead the paper with the nominal-r_p baseline (the mission-design framing:
   periapsis set by safety) and use the achieved-periapsis baseline as the depth/efficiency
   decomposition? Recommended.
4. **Phase 4.** Proceed to the Hibberd finite-burn re-analysis: bound-arrival support plus the
   equivalent-Δv metric, as already agreed.

## 2026-10-05: Record of the Phase 3 grid change (user review)

- **What changed.** The posted Phase 3 plan specified 120 cases: Π ∈ {2, 5, 20, 100} ×
  v∞/v_esc ∈ {0.03, 0.1, 0.3, 1, 3} × Δv/v_p ∈ {0.03, 0.3} × Δv/c ∈ {0.1, 1, 3}. The campaign
  ran 150 cases with Π ∈ {1, 3, 10, 30, 100}; the other axes were unchanged.
- **When.** The grid was changed when `scripts/run_phase3.py` was written (commit b24e945). It was
  neither announced nor logged at the time; it should have been.
- **Why.** No rationale was recorded, so none is claimed here.
- **Consequences** (stated as properties of the new grid, not as the reason):
  - half-decade log spacing that includes both ends of the requested 1 ≲ Π ≲ 100;
  - Π = 10 lies inside the Phase 2 half-efficiency range Π½ ≈ 8–40;
  - Π = 1 is the point closest to the small-Π theory;
  - cost: 30 more cases, i.e. 450 instead of 360 optimizations.
- **Effect on conclusions.** None identified: the results vary smoothly in Π (figures
  `phase3_*.png`), and the planned Π values lie between grid points.

## 2026-10-05: Half-Δv rule versus the Δv-weighted mean (user review)

The **half-Δv rule** puts periapsis where half the Δv has been delivered, i.e. at the median of the
Δv distribution, x_med = (1 − e^(−λ/2))/μ_r. The small-Π optimum is the **mean**,
x̄ = 1/μ_r − 1/λ (λ = Δv/c, μ_r = 1 − e^(−λ)).

**Closed form** (`optimize.timing_rule_capture`, `timing_rule_extra_loss`). Because
m₂(x_c) = σ² + (x̄ − x_c)², the share of the optimal retiming gain that a rule captures is
1 − (x̄ − x_rule)²/(x̄ − ½)², for any Δv/v_p and v∞:

| Δv/c | x̄ | x_med | half-Δv rule captures | extra loss over optimum (Δv → 0) |
|---|---|---|---|---|
| 0.1 | 0.5083 | 0.5125 | 75.0% | 0.02% |
| 1 | 0.5820 | 0.6225 | 75.6% | 2.0% |
| 3 | 0.7191 | 0.8176 | 79.8% | 13.3% |

- **Small-Δv/c limit:** the capture tends to 75%, because x_med − ½ ≈ λ/8 against x̄ − ½ ≈ λ/12.
- **User's estimates confirmed:** ≈ 80% and 13% at Δv/c = 3, ≈ 76% at 1.
- **Simulation at Π = 0.1** (Δv/c = 1 and 3) agrees to ≤ 2e-3 in both the capture and the extra
  loss. At finite Δv/v_p the extra loss is diluted by the j term: 12.3% (Δv/v_p = 0.03) and 10.0%
  (0.3) at Δv/c = 3. Tests in `tests/test_optimize.py`.
- **On the Phase 3 grid** (`results/opt_phase3_rules.parquet`; median share of the timing-only
  gain at Π = 1, 3, 10, 30, 100):
  - centroid rule: 1.00, 0.90, 0.59, 0.42, 0.32 (Δv/c = 1) and 1.00, 0.93, 0.68, 0.49, 0.37
    (Δv/c = 3);
  - half-Δv rule: 0.81, 0.96, 0.75, 0.59, 0.39 and 0.86, 0.99, 0.93, 0.75, 0.57.
  - Beyond Π ≈ 3 the half-Δv rule does *better* than the centroid rule. The large-Π optimum moves
    further earlier, past the centroid and toward the median.
  - At Δv/c = 0.1 both rules have the wrong sign (the optimum is later; see the reversal entry).
- **Added to** `phase3_timing.png` (dotted line) and to `phase3_numbers.json` (`followups`).

## 2026-10-05: Recoverable efficiency for realistic missions (headline replaces the Δv/c = 3 corner)

- **Method.** Every valid prograde Phase 2 mission sample (5,895: no impact, burn starting inside
  the SOI) was timing-optimized, with the centroid and half-Δv rules evaluated
  (`scripts/run_phase3_followups.py`, `results/opt_missions.parquet`). A stratified subsample of
  156 (≤ 6 per body × engine, spread in Π) was also pitch + timing optimized.
- **Checks.**
  - The centered η reproduces Phase 2 exactly (max difference 0).
  - No optimal timing moves the burn start outside the SOI.
  - All 5,895 runs are ok.
- **Results:** recoverable Δη by timing, nominal-r_p baseline, in percentage points
  (`figures/phase3_missions.png`, `phase3_mission_table.csv`):

  | engine group | median Δv/c | p10 | median | p90 | max | median share of deficit recovered | achieved-baseline gain ≤ 0 |
  |---|---|---|---|---|---|---|---|
  | chemical (hydrolox, methalox) | 0.19 | 1e-8 | 7e-6 | 0.0025 | 0.083 | 0.26% | 3% |
  | nuclear thermal | 0.094 | 2e-7 | 8e-5 | 0.059 | 4.1 | 0.04% | 22% |
  | electric (Hall, ion) | 0.029 | 5e-5 | 0.0068 | 0.17 | 1.2 | 0.009% | 71% |

- **Chemical engines.** The centered prograde burn is effectively optimal. The share recovered,
  0.26%, matches the small-Π closed form λ²/12 ≈ 0.3% at λ ≈ 0.19.
- **Large gains are rare, and they come from starting *later*.** 322 of 5,895 samples gain
  > 0.1 pp, and **all 322 have δ > 0**. They are long, large-Δv burns: nuclear thermal at Mars,
  Earth and Venus (up to 4.1 pp), and electric propulsion at the giant planets (up to 1.2 pp). The
  gain correlates with the centered burn's periapsis lift (Spearman 0.91).
- **Electric propulsion gains are depth, not efficiency.** On the achieved-periapsis baseline the
  gain is ≤ 0 in 71% of samples.
- **Pitch.** It adds a median of 5e-5 pp and at most 0.069 pp on the subsample.
- **Headline for the paper.** For realistic engine/body combinations, optimal burn placement
  recovers a negligible fraction of the finite-burn loss. A chemical burn centered on periapsis is
  within ~0.1 pp of the prograde-family optimum. The large recoverable gains of the Δv/c = 3 corner
  need a ~95% propellant fraction in one burn, which no realistic single flyby burn has.

## 2026-10-05: Quantitative check of the large-Π timing reversal (user decision 2: empirical)

The departure of the timing optimum from the centroid rule, δ_opt − δ*, was correlated with the
centered burn's periapsis lift, r_min/r_p − 1 (`phase3_reversal.png`, `phase3_numbers.json`):
- **Pooled over the grid:** Spearman 0.27. By Δv/c: 0.83 (Δv/c = 0.1), 0.42 (1) and −0.59 (3).
- **Within fixed (Δv/c, Π)**, where the centroid effect is fixed and only the lift varies:
  positive in 14 of 15 groups, median 0.83. The exception is Δv/c = 3 at Π = 100 (−0.35).
- **Paired test** (Δv/v_p 0.03 → 0.3 at fixed Π, v∞, Δv/c): the lift always increases (75/75).
  The optimum moves later in 100% of cases at Δv/c = 0.1 and 1, and in 32% at Δv/c = 3.
- **Mission sample:** gain against lift, Spearman 0.91; every gain > 0.1 pp has δ > 0.
- **Conclusion (empirical).** Periapsis lifting by pre-periapsis thrust pushes the optimum later.
  The centroid effect pushes it earlier, and dominates at high mass ratio. A large-Π asymptotic
  theory of the competition is listed as future work.

## 2026-10-05: Richer pitch law check: 6-knot piecewise-linear pitch (user decision 1)

- **Setup.** `steering.PitchPiecewise` with 6 equally spaced knots in normalized burn time, plus
  timing δ, i.e. 7 controls (`optimize.optimize_piecewise`). SLSQP with r_min ≥ r_p and three
  starts: the linear optimum mapped onto the knots, zero pitch, and a perturbed copy.
- **Cases.** The 15 hardest: Δv/c = 3, Δv/v_p = 0.3, Π ∈ {10, 30, 100}, all five v∞/v_esc
  (`results/opt_phase3_piecewise.parquet`, 1,266 s).
- **Results:**
  - Gain over the linear-pitch optimum: **median 0.0032 pp, max 0.077 pp** (Π = 10,
    v∞/v_esc = 0.1). It is below the 0.1 pp bar in all 15 cases.
  - The same gain on the achieved-periapsis baseline: the constraint is active in all 15, so
    r_min = r_p.
  - All three starts agree in every case. Max η error estimate 3.7e-11 (the kinks at the knots
    do not degrade accuracy).
- **Shape of the optimum.** It is close to linear but slightly concave: e.g. 40°, 29°, 18°, 8°, 2°
  and −0° toward the planet at Π = 10, v∞/v_esc = 0.1.
- **Claim wording** (per the user). "Pitch adds little once the timing is optimal" holds *within
  the smooth steering laws tested* (linear, and 6-knot piecewise-linear). It is not a statement of
  global optimality; no optimal-control (costate) solution was computed.

## 2026-10-05: Phase 4: finite-burn re-analysis of the Hibberd et al. (2026) solar Oberth manoeuvre

**Model** (`src/oberth_atlas/staged.py`, 11 tests):
- The arrival conic can have any eccentricity. It is set by the periapsis speed, and the initial
  state comes from integrating the coast backward from periapsis, so bound near-parabolic arrivals
  need no special Kepler solver.
- Stages fire in sequence, each with constant thrust, its own exhaust velocity, propellant and
  inert mass (dropped at burnout), and an optional coast.
- Metric: the equivalent-Δv penalty, Δv_rocket − [sqrt(2(ε_out + μ/r_p)) − v_p], i.e. the
  impulsive Δv at perihelion that gives the same final energy.
- Verification:
  - single-stage hyperbolic runs equal `simulate_nd` to 1e-11 in ε_out;
  - small-Π loss for bound, parabolic and hyperbolic arrivals equals `theory.equivalent_dv_loss_per_pi2`
    to 2e-3;
  - Π² scaling;
  - two identical stages equal one stage;
  - mass bookkeeping;
  - the SI → nondimensional stack conversion.

**Inputs** (`configs/phase4/hibberd_som.yaml`):
- **Hibberd Table 2, row m.** CASTOR 30B (13,970.6 kg, 1,000 kg dry, c = 2.9649 km/s) plus
  "STAR 48" (2,137 kg, 124 kg dry, 2.8028 km/s), with a 546 kg payload.
- **Burn times** from the Northrop Grumman Propulsion Products Catalog (OSR 16-S-1432, 5 April
  2016): CASTOR 30B 126.7 s; STAR 48B short nozzle 84.1 s.
- **"STAR 48" identified as the STAR 48B short nozzle (TE-M-711-17).** Its 4,705.4 lbm loaded,
  274.2 lbm inert and Isp 286.0 s match Hibberd's 2,137 kg, 124 kg and 2.8028 km/s; Table 1 of the
  paper says "STAR 48B".
- **Constant-thrust model** (m_prop·c/t_b) versus the catalog burn-time-average thrust: +1.3%
  (CASTOR 30B; Hibberd's c is 0.6% above the catalog Isp of 300.6 s) and −0.1% (STAR 48B).
- **ΔV check.** The rocket equation gives 8,362.4 m/s, against Hibberd's 8,355 (Table 1) and 8.36
  km/s (Table 2).
- **Mass discrepancy in the source.** The Table 2 totals equal the stage masses plus payload in the
  rows checked (n, o), but row m lists 17,754 kg against a sum of 16,653.6 kg (+1,100.4 kg).
  - We use the stage sum, which reproduces their ΔV.
  - Carrying the extra mass as inert through both burns would give only ≈ 6.0 km/s, inconsistent
    with their ΔV.
- **Arrival.** Bound, aphelion at Jupiter's semi-major axis (5.2029 au; the SOM follows a Jupiter
  gravity assist), giving v_p = 344.798 km/s at 3.2 R☉ and τ = r_p/v_p = 6,457 s.
- **Steering.** Prograde.

**Reference result.** Burn duration 210.8 s, Π = 0.0326.

| placement | equivalent-Δv loss | fraction of Δv | v∞,out shortfall (of 74.14 km/s) |
|---|---|---|---|
| time-centred | 0.0991 m/s | 1.19e-5 | 0.47 m/s |
| Δv centroid at perihelion (19.56 s earlier) | 0.0897 m/s | 1.07e-5 | 0.43 m/s |
| optimal timing (19.56 s earlier) | 0.0897 m/s | 1.07e-5 | 0.43 m/s |

- **Pre-registered expectation** (2026-10-04): 0.04–0.25 m/s. **Confirmed.**
- **Accuracy:**
  - rerun at rtol = atol = 1e-13: differences ≤ 1.5e-9 m/s;
  - energy-balance error estimate 1.4e-7 m/s.
- **Independent leading-order estimate.** The Π² second moment of the staged profile
  (`staged.leading_order_loss`) gives 0.093 and 0.084 m/s, 6–7% below the simulation; that gap is
  the expected size of the neglected finite-Δv j term.
- **Optimal timing** coincides with the Δv-centroid rule (Phase 3) to 0.002 s.

**Sensitivities** (time-centred / optimal, m/s):
- staging coast 10 s: 0.112 / 0.103;
- staging coast 60 s: 0.199 / 0.191;
- arrival orbit (aphelion 1 au, 30 au, parabolic, hyperbolic v∞ = 5 km/s): 0.098–0.0994 / 0.0888–0.0900;
- two-level thrust per motor (catalog maximum thrust for half the burn, the complement for the
  other half): regressive 0.105 / 0.101, progressive 0.094 / 0.079.

The loss stays below 2.4e-5 of Δv in every case. **The impulsive model is accurate for this SOM.**

**Where the impulsive model fails** (`phase4_loss_vs_pi.png`). Both motors' thrust was scaled by f
at fixed propellant:

| threshold | Π | thrust | initial a0 | burn duration |
|---|---|---|---|---|
| loss 0.1% of Δv | 0.30 | ÷ 9.2 | 1.98 m/s² | 1,942 s |
| loss 1% of Δv | 0.98 | ÷ 30 | 0.61 m/s² | 6,300 s ≈ τ |

With optimal timing the thresholds shift slightly, to Π = 0.32 and 1.03.

**Placements on the curve:**
- **Nuclear thermal** (Phase 2 presets, Isp 800–900 s), at the SOM geometry:
  - a0 = 3 m/s²: Π = 0.27–0.28, loss 0.08–0.09% (6.8–7.4 m/s);
  - a0 = 0.1 m/s²: Π = 8.0–8.4, loss 21.6–22.3% (1.80–1.86 km/s).
  - The 1% threshold falls at a0 ≈ 0.6 m/s², inside the preset range.
- **SEP, Maraqten et al. (2026)**, at their own geometry (0.308 au, v_p = 75.0 km/s, Isp
  6,000 s, about 10 km/s in the perihelion arc):
  - constant 49.8 N, with the start mass bracketed at 11,036–15,189 kg: Π = 3.3–4.6, loss
    8.5–12.5% of the arc Δv;
  - their 0.25-yr arc duration: Π = 12.8, loss 29%.
  - Their thrust falls as r⁻² away from perihelion, which concentrates it near perihelion, so the
    actual loss should lie inside this bracket (assumption; the r⁻² variation is not modelled).
  - Their reference is a 1 au spiral, not an impulsive burn, so these numbers complement rather
    than contradict their "threefold" result.

**Universality.** For a near-parabolic arrival, the loss as a fraction of Δv is close to a
single function of Π:
- **Across profiles:** the two-stage solid stack, one stage at Isp 850 s and one at 6,000 s agree
  within 8% for 0.1 ≤ Π ≤ 100. At Π = 0.03 the staged stack is 20% higher, a profile-shape effect
  through m₂.
- **Across geometry:** the SEP points at 0.308 au lie within 0.1–9% of the curve computed at
  3.2 R☉.
- **Rule of thumb:** loss ≈ 1% of Δv at Π ≈ 1 and 0.1% at Π ≈ 0.3, i.e. the burn should be
  shorter than about τ = r_p/v_p.

**Assumptions and limits:**
- planar point-mass Sun; prograde steering;
- constant thrust per motor (with the two-level sensitivity);
- unknown staging coast (bracketed);
- no thermal, attitude or spin-up constraints;
- SEP r⁻² thrust variation not modelled.
