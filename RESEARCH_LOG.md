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
