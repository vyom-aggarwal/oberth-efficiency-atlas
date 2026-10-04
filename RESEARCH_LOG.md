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
