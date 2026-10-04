# Related work

Literature review carried out 2026-10-04, before Phase 3. Each summary below says what was
actually read. Anything not verified from a primary source is marked **[not verified]**, and
inferences of ours are marked **[our inference]**.

## Access summary

| # | Reference | Access | What was read |
|---|---|---|---|
| 1 | H. M. Robbins, "An analytical study of the impulsive approximation," *AIAA J.* 4(8):1417–1423, 1966. [doi:10.2514/3.3687](https://doi.org/10.2514/3.3687) | **Not accessed.** AIAA ARC returned HTTP 403 (paywall). A same-titled 1966 conference paper also exists ([doi:10.2514/6.1966-12](https://arc.aiaa.org/doi/abs/10.2514/6.1966-12)), also inaccessible. | Only the secondary account in Confraria (2020): her eq. 2.17 and its description. |
| 2 | E. A. Willis, Jr., "Finite-thrust escape from and capture into circular and elliptic orbits," NASA TN D-3606, Lewis Research Center, **Sept. 1966** ([NTRS 19660027029](https://ntrs.nasa.gov/citations/19660027029)) | Full text (68 pp. PDF from NTRS). | Summary, introduction, assumptions, equations of motion, concluding remarks. The charts were not digitized. |
| 3 | J. C. F. Confraria, "Finite burn losses in spacecraft maneuvers revisited," MSc thesis, Instituto Superior Técnico, Lisbon, Nov. 2020 ([extended abstract](https://fenix.tecnico.ulisboa.pt/downloadFile/1689244997261336/79157_resumo.pdf), [thesis](https://fenix.tecnico.ulisboa.pt/downloadFile/1689244997261337/79157_tese.pdf)) | Full text. | Extended abstract and thesis text. Figs. 4.33 and 4.34 were inspected visually; values quoted from them are read by eye. |
| 4 | A. F. S. Ferreira, A. Elipe, R. V. de Moraes, A. F. B. A. Prado, O. C. Winter, V. M. Gomes, "Low Thrust Propelled Close Approach Maneuvers," *Symmetry* 14(9):1786, 2022. [doi:10.3390/sym14091786](https://doi.org/10.3390/sym14091786) | Full HTML via a browser. The direct PDF download returned 403. | Introduction, problem statement, parameter choices, conclusions. **[not verified]** spacecraft mass and full parameter tables (not found in the extracted text). |
| 5 | A. Hibberd, T. M. Eubanks, A. M. Hein, "Catching 3I/ATLAS Using a Solar Oberth," [arXiv:2601.02533](https://arxiv.org/abs/2601.02533) v2, Jan. 2026 | Full text (arXiv PDF, v2). | Whole paper. |

**Citation corrections.**
- **Willis, not "Villis".** Ref. 2 is by Edward A. **Willis**, Jr., NASA TN D-3606, dated **September 1966**.
  - The "Villis … 1967" form appears in Confraria's bibliography (her ref. 23).
  - The OCR of the NTRS cover page also reads "Villis".
  - The citation in our brief probably inherited this.
- **Confraria's "~125%" is a relative overestimate.** It means estimate − actual ≈ 1.25 × actual,
  i.e. Robbins ≈ 2.25 × actual. It does not mean "125% of the actual losses". See ref. 3 below.

---

## 1. Robbins (1966): the analytic finite-burn loss estimate [not accessed]

**Only what Confraria (2020, §2.2, eq. 2.17–2.18; extended abstract eq. 8–9) reports:**

> Finite burn losses ≤ (1/24)(ω_s t)² Δv,  with ω_s² = μ/r³

Confraria's gloss of the terms:
- ω_s is the Schuler frequency, "related to a maximum optimal angular rotation of the thrust".
- t is the burn time, computed from the *impulsive* Δv, Isp and T/W₀ (her eq. 11).
- Δv is the impulsive velocity change.

She says the expression was "determined by adding to the instantaneous velocity change … a
position displacement compensation factor obtained from a maneuver done with thrust being applied
at an arbitrary constant angular velocity". Her literature review describes it as an
"intuitive analysis … of constant angular motion … [that] needs numerical experimentation, which
has not been found in the literature."

**In our variables,** with r = r_p, (ω_s t_b)² = (μ/r_p³)·t_b² = kΠ², so the expression is
**L_R = kΠ²Δv/24** (k = μ/(r_p v_p²)). This is the prefactor the user derived by hand. Its
inertial case is Robbins' expression converted to an energy deficit with v_p (see below).

**[not verified]** We could not check:
- Robbins' exact assumptions: constant thrust vs constant acceleration, burn placement, the
  choice of r, and whether he states the result as a strict bound;
- whether he discusses tangential steering or hyperbolic orbits.

## 2. Willis (1966): finite-thrust escape and capture charts

- **Problem.** Planar two-body, patched-conic escape from (or capture into) a circular or elliptic
  parking orbit to a prescribed |V∞| at the sphere of influence. The asymptote direction is left
  free.
- **Propulsion and steering.** Constant thrust and constant jet velocity; a single burn plus coast.
  - Tangential steering, with the thrust-initiation point optimized ("optimum-angle" trajectories).
  - Appendix A shows tangential steering is within 1% of the variational optimum, extending an
    earlier constant-acceleration result to constant thrust, hyperbolic burnout and elliptic
    orbits.
- **Nondimensionalization.** Radius, velocity, acceleration and time are scaled by the radius,
  circular velocity, local gravity and circular radian period at a reference position (the
  power-on point for circular orbits, periapse for elliptic). This is exactly our scaling
  (length r_p, velocity sqrt(μ/r_p), acceleration μ/r_p²).
- **Metric.** The characteristic-velocity ratio f_v = ΔV_ch/ΔV_imp, where ΔV_imp is the minimum
  impulsive Δv (tangent, at periapse) giving the same |V∞|. Also reported: the optimum
  characteristic angle and the optimum initial true anomaly.
- **Results.** Charts of f_v against dimensionless hyperbolic velocity, initial acceleration and
  jet velocity, plus scaling rules and examples for nuclear rockets at Venus, Earth and Mars.
  - In the very-low-thrust limit, f_v is bounded by 3.0 (circular) rising to 10.6 (e = 0.9).
  - For medium/high thrust (dimensionless acceleration ≳ 0.01), elliptic orbits *enhance* the
    finite-thrust saving.
  - For very low thrust (≲ 0.001) they partly offset it.
- **Relation to this project.** Willis is the closest methodological precedent: the same
  dimensionless groups, and a chart-based "atlas" of finite-burn penalties. The differences:
  - his initial orbits are bound (e < 1, up to 0.9 in the charts), while ours are hyperbolic
    flybys;
  - his burn start is optimized, while ours is centered by default (Phase 3 optimizes it);
  - his metric is the Δv penalty, not the Oberth efficiency η;
  - he gives no analytic asymptotics.

## 3. Confraria (2020): finite-burn losses, steering laws, and a test of Robbins' estimate

- **Problem.** Planar two-body, constant thrust and Isp, ODE45 (Dormand–Prince 4(5)), SNOPT
  direct single shooting.
  - Start from a circular orbit at 200 km (also 1000 and 5000 km), Δv = 1–5 km/s,
    T/W₀ = 0.03–0.5, Isp = 250, 300, 400, 600 s.
  - Δv ≤ 3 km/s cases target the apogee; Δv > 3 km/s cases are hyperbolic and target C3.
  - Loss = Δv_finite − Δv_impulsive for the same target.
- **Steering laws:** fixed inertial direction, constant inertial rotation rate, and thrust along
  the velocity ("vnb").
- **Results:**
  - Fixed direction is clearly worst.
  - Rotation and velocity-parallel are within ~1% of the impulsive Δv of each other (~2% near
    T/W₀ = 0.05). The rotation law is slightly better above T/W₀ ≈ 0.1, because its thrust starts
    pointing slightly inside the orbit and the trajectory stays closer to the planet ("better
    advantage of the Oberth effect").
  - At fixed T/W₀, higher Isp gives longer burns and larger losses. Higher Isp still wins on
    delivered mass.
  - The perigee always *rises* for rotation and velocity-parallel steering, and *falls* for fixed
    direction.
  - Multiple apogee-raising burns cut losses. For the Mars departure case the direct tangential
    burn costs 3825 m/s; three extra burns bring it to 3631 m/s.
- **Robbins' estimate,** her eq. 4.2: (estimate − real)/real × 100.
  - For rotation and velocity-parallel steering it is "an upper bound … overestimating the losses
    by 125% for T/W₀ above 0.1" (thesis §4.2).
  - Figs. 4.33 and 4.34, read by eye, show the overestimate falling from ~125–150% at
    T/W₀ ≈ 0.1 to ~20–60% at T/W₀ = 0.5, depending on Δv.
  - It is not a bound for fixed-direction thrust, except for T/W₀ ≈ 0.1–0.25 at high Δv.
  - She concludes it is "not that reliable" as an estimate.
- **Interpretation of "~125%".** It is a relative overestimate, which matches eq. 4.2 and the
  thesis wording. It holds near T/W₀ ≈ 0.1 and is **not constant**.

## 4. Ferreira et al. (2022): continuous thrust during a close approach

- **Problem.** A close approach to Jupiter in the Sun–Jupiter circular restricted three-body
  problem, with v∞ = 6.3 km/s and r_p = 1.05 R_J (r_p also varied).
  - Continuous thrust F = 2ηP/(Isp·g₀), over 1e-5 to 1e-2 N, with ≥ 1 N also considered.
  - The thrust is at a fixed angle α to the velocity.
  - The thrust arc around periapsis is bounded by a radius R_lim (spanning the swing-by) or an
    arc parameter.
  - The approach geometry is set by the angle ψ.
- **Metric.** The change in *heliocentric* (Sun two-body) energy. The "efficiency" is the
  difference Dif = ΔE(swing-by with thrust) − ΔE(swing-by, then the same thrust far away), mapped
  over ψ, α, F and arc length.
- **Results:**
  - Thrust during the close approach pays off for 180° < ψ < 360°, most strongly near 360°.
  - Larger thrust gives larger efficiency.
  - **α < 0** (a thrust component *toward the planet*) maximizes the gains near ψ ≈ 270°.
  - In those regions the thrusted swing-by can beat a powered swing-by with one impulse at
    periapsis.
  - Beyond a thrust–arc-length limit, captures and collisions occur.
  - They provide fitted approximate equations.
- **Relation to this project.** This is the closest prior work on thrusting *during* a flyby. The
  differences from ours:
  - one specific system, with dimensional thrust;
  - a heliocentric-energy metric that mixes the gravity-assist turn with the Oberth effect;
  - no comparison of planetocentric |v∞| against an impulsive periapsis burn as a function of burn
    duration;
  - no dimensionless burn parameter.

## 5. Hibberd, Eubanks & Hein (2026): solar Oberth manoeuvre to catch 3I/ATLAS

- **Method.** OITS:
  - patched conics, with Lambert arcs (universal variables) between encounters;
  - non-linear programming (NOMAD, MIDACO) to minimize the total ΔV;
  - SPICE ephemerides;
  - the sequence Earth → Jupiter (passive gravity assist, ΔV constrained to ≈ 0) → SOM → 3I.
- **The SOM is impulsive.** Quoting §2: "If we further assume that we wish to reap maximum benefit
  from the 'Oberth Effect', then it follows the spacecraft must apply all its ∆V at periapsis
  w.r.t. the body in question." The SOM itself is a massless "Intermediate Point" at a
  user-specified solar distance, with ∆V = |V_D − V_A| applied instantaneously. The text
  discusses no finite-burn duration, thrust profile or gravity loss.
- **Reference mission** (Table 1; 2035 launch, SOM at 3.2 R☉ = 0.015 au):
  - SOM ΔV 8.355 km/s, "heliocentric speed at SOM" 352 km/s;
  - C3 = 130.2 km²/s²;
  - 50-year flight, intercept at 732 au, encounter speed 16 km/s;
  - payload 546 kg on a CASTOR 30B + STAR 48B stack totalling 17,754 kg.

  Table 2 lists two- and three-stage solid combinations, with exhaust velocities of
  2.80–2.96 km/s. A heat shield is needed against ~6 MW/m².
- **[our inference]** The arrival is bound, not hyperbolic. Vis-viva for a fall from a ~5.2 au
  aphelion to 3.2 R☉ gives ≈ 345 km/s before the burn and ≈ 353 km/s after it. So the quoted
  352 km/s matches the *post-burn* speed of a near-parabolic, bound arrival. The paper does not
  state which it is.

---

## Comparison with Robbins' expression

Generated by `scripts/robbins_comparison.py` → `figures/robbins_comparison.png` and `.csv`. Numbers
also appear in RESEARCH_LOG (2026-10-04, literature review).

- **The measured loss.** We use the *energy-equivalent extra Δv*,
  L = (Δε_imp − Δε_fin)/(v_p + Δv): the additional Δv needed, at the marginal speed v_p + Δv, to
  recover the impulsive final energy. It is exact to leading order in Π.
- **Leading-order theory** (`theory.equivalent_dv_loss_per_pi2`, docs/theory.md §4, now valid at
  any apse). For a burn centered on the apse:
  - **Fixed direction, constant acceleration: L = kΠ²Δv/24 exactly.** Robbins' expression is the
    *exact* leading-order loss here, not merely a bound. This is tested at apoapsis, circular,
    elliptic and hyperbolic apses.
  - **Prograde: L/L_R = [(1−k)v + (1+k)Δv]/(v + Δv)** at first order in Δv (all orders in code).
    This is always below 1. For hyperbolic arrivals (k ≤ ½) it is ≥ ½.
  - **Thrust profile:** a rocket burn centered *in time* puts its Δv centroid after the apse.
    With Δv/c > 1 this pushes the loss **above** Robbins' expression, by up to 8.7% (inertial)
    and 4.9% (prograde) in the sweep.
- **Flyby sweep** (reliable rows with loss > 10³ × numerical error), ratio R = L/L_R:

  | Π band | inertial: median (range) | prograde: median (range) |
  |---|---|---|
  | < 0.01 | 1.001 (1.000–1.087) | 0.63 (0.50–1.05) |
  | 0.01–0.1 | 1.000 | 0.58 |
  | 0.1–0.3 | 0.998 | 0.57 |
  | 0.3–1 | 0.98 | 0.57 |
  | 1–3 | 0.82 | 0.48 |
  | 3–10 | 0.35 | 0.24 |

  At Π < 0.01 the measured R matches the leading-order theory to a median of 1e-4 (max 1.1e-3).
  So **Robbins' expression over-predicts prograde flyby losses by a factor 1/R ≈ 1.0–2.0 at
  small Π (median ≈ 1.6), and more at larger Π.**
- **Confraria's own case re-simulated.** Tangential burns from a 200 km circular Earth orbit,
  Isp 300 s, targeting the impulsive C3, with the exact extra Δv found by root-finding:

  | Δv (km/s) | T/W₀ = 0.1 (Π ≈ 2.5–2.9) | T/W₀ = 0.5 | Π → 0 limit (theory) |
  |---|---|---|---|
  | 3.5 | 130% | 78% | 76% |
  | 4.0 | 127% | 66% | 63% |
  | 4.5 | 128% | 56% | 53% |
  | 5.0 | 131% | 49% | 45% |

  Entries are Robbins' relative overestimate, (Robbins − actual)/actual. **This reproduces
  Confraria's ~125% at T/W₀ ≈ 0.1,** and explains it: the overestimate is the k = 1 limit
  (v + Δv)/(2Δv) − 1 plus finite-Π growth. At T/W₀ = 0.5 we get 49–78%, against roughly 40–60%
  read by eye from her Fig. 4.34. That gap is **unresolved**. Possible causes: reading the figure
  by eye, or differences in Earth constants, targeting tolerance or burn-time definition.

---

## Classification of the Phase 2 findings

Labels: **(a)** reproduces known work, **(b)** extends known work to hyperbolic flybys,
**(c)** appears new. Robbins (1966) could not be read, so any (c) that touches the small-Π loss
is provisional. Robbins may already state it.

| # | Phase 2 finding | Label | Basis |
|---|---|---|---|
| 1 | Finite-burn loss scales as (ω t_b)²Δv/24 = kΠ²Δv/24 at small Π | **(a)** | Robbins (1966), via Confraria |
| 2 | The body enters only through four dimensionless groups (v∞/V, Δv/V, c/V, a0 r_p²/μ) | **(a)** | Willis (1966) uses the same scaling and charts |
| 3 | Tangential (prograde) steering is near-optimal and fixed-direction steering is worst | **(a)** | Willis (tangential within 1% of optimal); Confraria (fixed direction worst) |
| 4 | Prograde burns never lower periapsis; fixed-direction burns lower it (impacts) | **(a)** for escape from circular orbits, **(b)** for flybys | Confraria (perigee rises for tangential/rotation, falls for fixed direction); we add impact statistics on hyperbolic flybys |
| 5 | Thrust tilted toward the planet can help (the Phase 3 hypothesis) | **(a)** | Confraria (rotation law starts pointing inward); Ferreira (α < 0 best) |
| 6 | Exact small-Π prefactor for **prograde** steering with finite Δv/v_p (all orders in Δv) and the exact thrust profile; it lies below Robbins by [(1−k)v + (1+k)Δv]/(v + Δv) | **(b)/(c)** | Extends 1 to prograde steering and hyperbolic apses; the closed-form factor appears new |
| 7 | For fixed-direction thrust at an apse, Robbins' expression is the *exact* leading-order loss | **(c)** provisional | Not stated by Confraria; Robbins unread |
| 8 | Centered-in-time burns with Δv/c > 1 exceed Robbins' "bound" by up to ~9% | **(c)** provisional | Not reported by Confraria. Her Δv/c reaches ~2, but she starts from circular orbits, which have no preferred apse, so the centering effect cannot arise there |
| 9 | Confraria's ~125% overestimate explained quantitatively (k = 1 limit plus finite-Π growth) | **(c)** | Re-simulation and theory above |
| 10 | Π√C collapses small-Π η about 200× better than Π | **(b)** | A consequence of 1 + 6 applied to the Oberth efficiency of flybys |
| 11 | Dominant secondary parameter v∞/v_esc (through k); mass ratio irrelevant at fixed Π | **(b)** | Willis tabulates f_v against dimensionless V∞; we quantify its share for η on flybys |
| 12 | Linear-response curve η_lin(Π; v∞/v_esc) and the exact η ↔ η_W map through ξ | **(c)** | No accessible source |
| 13 | Three regimes: CΠ², (9/(2Π))^(1/3) (parabolic core), ln Π/Π (hyperbolic tail), crossover at Π_T = v_p V³/v∞³ | **(c)** | No accessible source. Willis gives only a low-thrust bound on f_v for bound orbits |
| 14 | Half-efficiency point Π½ ≈ 8–40 at every body (rule of thumb) | **(c)** | — |
| 15 | Fixed-direction thrust on flybys: impact band at 10 ≲ Π ≲ 10⁵; η < 0 at large Π; far-field misalignment limit | **(b)/(c)** | Confraria shows fixed direction is worst for escape; the flyby impact band and negative-η structure appear new |
| 16 | Cross-body, cross-engine mission atlas of η, with SOI validity | **(b)/(c)** | Ferreira covers low thrust at Jupiter only (CR3BP, energy maps); the multi-body η atlas appears new |

## Contribution statement

Finite-burn losses for escape and capture from parking orbits were charted by Willis (1966). An
analytic (ωt)²Δv/24 loss estimate is due to Robbins (1966), and Confraria (2020) found that
estimate to be a loose upper bound. This project extends that line of work to **powered
hyperbolic flybys**, measured by the Oberth efficiency η = B_finite/B_imp.

At small burn parameter Π = t_b/τ we derive and verify the exact leading-order loss for both
fixed-direction and prograde steering, at any apse, including finite-Δv and mass-ratio effects:
- Robbins' expression is the exact loss for fixed-direction thrust.
- It over-predicts prograde losses by 1–2×.
- Up to ~9% is lost beyond it when a high-mass-ratio burn is centered in time.
- This quantitatively explains the ~125% overestimate Confraria reported.

The resulting Π√C collapses the small-Π data to 0.1%. Beyond small Π we identify three regimes
(Π², Π^(−1/3) from the parabolic core, and ln Π/Π from the hyperbolic tail). The crossover sits at
Π_T = v_p V³/v∞³, and the half-efficiency point Π ≈ 10–40 holds at every body.

Unlike the single-system continuous-thrust flyby study of Ferreira et al. (2022), we provide
- a body- and engine-independent atlas of η,
- a demonstration that v∞/v_esc is the dominant secondary parameter,
- the impact and sphere-of-influence limits that make fixed-direction and electric-propulsion
  burns at terrestrial planets non-physical in a planet-centered model.

The novelty claims touching the small-Π loss are provisional until Robbins (1966) can be read
in full.
