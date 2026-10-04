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
