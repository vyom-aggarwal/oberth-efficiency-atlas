# Paper outline (working draft, 2026-10-04)

**Working title:** *How much of the Oberth bonus does a finite burn keep? Scaling laws and an atlas
for powered flybys*

**Status key:**
- ✅ done and verified in the repo
- 🔶 provisional (see the claim register at the end)
- ⏳ planned (Phase 5)

Figure paths are relative to `figures/`. Every figure has a generating script in `scripts/`.

---

## 1. Introduction
- **Topic.** The Oberth effect, and the impulsive approximation used in mission design
  (e.g. Hibberd et al. 2026, whose solar Oberth burn is impulsive).
- **Prior work** (RELATED_WORK.md):
  - finite-burn loss estimate: Robbins 1966;
  - finite-thrust escape and capture charts: Willis 1966;
  - steering-law losses and a test of Robbins: Confraria 2020;
  - continuous thrust during a close approach: Ferreira et al. 2022;
  - solar-electric Oberth at 0.3 au: Maraqten et al. 2026;
  - low-thrust spiral-escape asymptotics: Tsien 1953 and successors.
- **Gap.** No dimensionless account of how much of the impulsive Oberth bonus a finite burn keeps
  during a hyperbolic flyby, across bodies and engines.
- **Contributions:** the contribution statement in RELATED_WORK.md.

## 2. Problem formulation ✅
- **Model:** planet-centred two-body problem with a variable-mass spacecraft; steering laws
  (prograde, inertial, pitch-linear).
- **Metrics:**
  - η = B_finite/B_imp (primary, never clipped);
  - η_W, baseline-subtracted energy efficiency (secondary);
  - η_E (deprecated);
  - the equivalent-Δv penalty for bound arrivals.
- **Burn parameter** Π = t_b/τ, and the four dimensionless groups (v∞/V, Δv/V, c/V, a0 r_p²/μ).
  The scaling follows Willis (1966).
- **Figure:** `trajectory_earth_hydrolox.png` (thrust arc, energy vs time). Optionally
  `trajectory_jupiter_hall.png` as the long-burn contrast.

## 3. Numerical method and validation ✅
- **Integration:** segmented coast/burn/coast DOP853 at rtol = 1e-12, with an energy-balance state
  W giving a per-run η error estimate. The estimate was validated against reruns at 1e-13: never
  optimistic.
- **Validation:** coast energy and turn angle, gravity-free closed form, mass invariance, frame
  invariance, body independence, and the any-apse theory against direct integration.
- **Figure:** `eta_vs_a0.png` (convergence to the impulsive limit, order 2.000).

## 4. Small-Π theory and Robbins' expression ✅ (novelty 🔶)
- **Loss scaling** (ω t_b)²Δv/24 = kΠ²Δv/24. **Attributed to Robbins (1966).**
- **Exact leading-order energy deficit** at an apse of any conic:
  - prograde to all orders in Δv;
  - fixed-direction exactly quadratic in Δv;
  - thrust profile through moments (mass ratio, timing).
- **Fixed-direction thrust:** the equivalent-Δv loss equals Robbins' expression. This is
  probably Robbins' own construction; claim P1.
- **Prograde:** below Robbins by [(1−k)v + (1+k)Δv]/(v + Δv). Novelty claim P3.
- **High-mass-ratio burns centered in time** exceed Robbins by up to ~9%. Claim P2.
- **Confraria's ~125% reproduced and explained,** including the digitized comparison of her
  Fig. 4.34 and the unresolved T/W₀ = 0.5 gap. Claim P5.
- **Figures:** `prefactor_check.png`, `robbins_comparison.png`.
- **Appendix:** the derivation (docs/theory.md §4).

## 5. Linear response and the η–η_W map ✅ (novelty 🔶 P4)
- **η_lin(Π; v∞/v_esc):** one universal curve per v∞/v_esc in the limit Δv → 0.
- **The exact map** η = (√(1 + ξη_W) − 1)/(√(1 + ξ) − 1). It explains the non-monotonic Δv
  dependence at low v∞.
- **Figure:** `eta_vs_pi_all.png`.

## 6. Large-Π regimes ✅ (novelty 🔶 P4)
- **Three regimes:**
  - I: CΠ²;
  - II: (9/(2Π))^(1/3), the parabolic core;
  - III: ln Π/Π, the hyperbolic tail.
- **Crossover:** Π_T = v_p V²/v∞³.
- **Half-efficiency point** Π½ ≈ 8–40 at every body.
- **Relation to prior work:** these are flyby analogues of the classical spiral-escape law
  Δv ∝ 1 − c·ε^(1/4).
- **Inertial steering at large Π:** an impact band, negative η, and the far-field misalignment
  limit.
- **Figure:** `regimes.png`.

## 7. Collapse and secondary parameters ✅
- **Small-Π collapse:** Π√C collapses 1 − η to 0.001 dex, against 0.2–0.3 dex for Π alone.
- **Full range:** the theory residual is 0.009 RMS in η, against 0.08 for Π alone.
- **Secondary parameter:** v∞/v_esc dominates (73–92% of the remaining scatter); the mass ratio is
  irrelevant at fixed Π.
- **Figures:** `collapse_small_pi.png`, `collapse_secondary.png`.

## 8. Atlas and real missions ✅
- **Dimensionless atlas:** η on (Π, v∞/v_esc), with impact cells masked and impact-boundary
  contours (h = 0.1 R and 1 R). Figure: `atlas_eta.png`.
- **Mission envelopes:** six bodies × five engine classes, with burns starting outside the SOI
  greyed out as "planet-centred model invalid". Figure: `missions_regions.png`; table:
  `mission_table.csv`. The engine presets are representative assumptions (claim A1).

## 9. Burn optimization ✅ (novelty 🔶 P6)
- **Baseline.** Lead with the nominal-r_p impulsive baseline (periapsis fixed by safety). Use the
  achieved-periapsis baseline to split gains into depth and efficiency (user decision,
  2026-10-05).
- **Headline, from realistic missions** (`phase3_missions.png`, `phase3_mission_table.csv`). Over
  the Phase 2 mission sample, the median recoverable gain from optimal placement is:
  - chemical: 7e-6 pp (max 0.08);
  - nuclear thermal: 8e-5 pp (max 4.1);
  - electric: 0.007 pp (max 1.2).

  The centered prograde burn is effectively optimal for realistic engines. The rare larger gains
  all come from starting *later*, which keeps the periapsis from being lifted; for electric
  propulsion they are depth, not efficiency.
- **Mechanism, from the controlled grid** (Π 1–100; Δv/c 0.1, 1, 3; `phase3_recoverable.png`,
  `phase3_fraction.png`). The Δv/c = 3 corner (~95% propellant in one burn) shows the effect
  clearly: up to 22 pp. It is an illustration, not the headline.
- **Timing:**
  - The small-Π optimum puts the Δv-weighted *mean* at periapsis, δ* = ½ − x̄.
  - Closed-form recovered share of the deficit: ≈ λ²/12 for small λ, 7.6% at λ = 1, 40% at 3.
  - The half-Δv (median) rule captures 75–80% of the gain (`phase3_timing.png`).
  - Large-Π departure from the rule tracks periapsis lift, an empirical result
    (`phase3_reversal.png`); its theory is future work.
- **Pitch:**
  - Inward tilt is known (Confraria, Ferreira).
  - Linear and 6-knot piecewise laws add ≤ 0.08 pp once the timing is optimal: "within smooth
    steering laws tested".
  - Figures: `phase3_pitch.png`, `phase3_baselines.png` (appendix).
- **Context, not a finding:** prograde beats inertial everywhere.

## 10. Case study: finite-burn re-analysis of the 3I/ATLAS solar Oberth ✅
- **Inputs:**
  - Hibberd et al. (2026), reference SOM: 3.2 R☉, 8.36 km/s, bound arrival from 5.2 au;
  - CASTOR 30B + STAR 48B (short nozzle), with Northrop Grumman catalog burn times;
  - the equivalent-Δv metric for any arrival conic (`staged.py`).
- **Result:**
  - Loss 0.099 m/s time-centred, 0.090 m/s with the Δv centroid at perihelion (= optimal):
    ~1e-5 of Δv. The pre-registered 0.04–0.25 m/s is confirmed.
  - Robust to the staging coast (≤ 0.20 m/s at 60 s), the arrival orbit and the thrust-profile
    shape.
  - The impulsive model holds. Figure: `phase4_reference.png`.
- **Where it fails** (`phase4_loss_vs_pi.png`):
  - Loss is 0.1% at Π ≈ 0.3 and 1% at Π ≈ 1, i.e. burn duration ≈ τ.
  - The loss(Π) curve is nearly universal across profiles: staged solids, nuclear thermal and
    SEP agree within 8%.
  - Nuclear thermal crosses 1% at a0 ≈ 0.85 m/s².
  - Maraqten et al.'s SEP perihelion arc (Π ≈ 3–13) would lose 8–29% of its Δv against an
    impulsive burn.

## 11. Limitations
- **Gravity model:** point-mass gravity; J2 neglected (RESEARCH_LOG). Neither Saturn's rings nor
  Jupiter's radiation is modelled.
- **Planet-centred frame:** electric-propulsion burns starting outside the SOI are invalid, and a
  heliocentric low-thrust treatment is out of scope.
- **Arrivals:** the atlas uses hyperbolic arrivals. Bound and parabolic arrivals are supported by the staged
  simulator (Phase 4).
- **Phase 4:** planar point-mass Sun; constant thrust per motor (two-level sensitivity ±6%); unknown staging
  coast (bracketed); SEP r⁻² thrust variation and thermal constraints not modelled.
- **Steering optimality:** only smooth pitch laws were tested (no costate solution).
- **Presets:** representative assumptions, not hardware data.

## 12. Conclusions

**Appendices:**
- A: derivations (docs/theory.md);
- B: numerics and the test inventory;
- C: data and code availability (Parquet results with provenance metadata, scripts, configs).

---

## Claim register (provisional or assumption-dependent)

| ID | Claim | Depends on | What would settle it |
|---|---|---|---|
| P1 | For fixed-direction thrust, Robbins' expression is the exact leading-order loss | Robbins (1966) unread; probably his own fixed-attitude construction, so labelled **(a) probable** | Read Robbins (user obtaining it) |
| P2 | High-mass-ratio burns centered in time exceed Robbins' bound (up to ~9%) | Robbins' assumptions on burn placement and thrust profile | Read Robbins |
| P3 | Prograde loss lies below Robbins by [(1−k)v + (1+k)Δv]/(v + Δv); exact all-orders prograde prefactor | Derivation verified numerically. Novelty depends on whether Robbins or later work treats tangential steering | Read Robbins; database search |
| P4 | Three large-Π regimes, Π_T, Π½ ≈ 8–40; linear-response η_lin and the η–η_W map | Web search only; Bombardelli, Baù & Peláez (2011) unread | Database search (AIAA/Springer); read Bombardelli et al. |
| P5 | Confraria's ~125% explained by k = 1 plus finite-Π growth | Agrees at T/W₀ = 0.1. At 0.5 her digitized losses are 4–14% larger than ours (unresolved) | Her raw data or code; not pursued (user decision) |
| P6 | Optimum is the Δv-weighted *mean* (not the median) at small Π; closed-form recovered fraction and half-Δv capture; two-baseline depth/efficiency split. (The qualitative "centre on Δv, not clock time" idea is likely known and is not claimed.) | Robbins (1966) may treat burn placement; derivation and simulation agree to 5e-4 at Π = 0.1 | Read Robbins; database search for finite-burn timing/centering rules |
| A1 | Mission-atlas η per body × engine | Representative presets (configs/atlas/presets.yaml); SOI validity filter | Sensitivity to the preset ranges |
| A2 | All absolute flyby results | Point-mass gravity (J2 neglected); η argued to be less sensitive | Optional J2 run (future work) |

**Verified and not provisional:**
- all numerical results (test suite, error estimates);
- agreement between theory and simulation (prefactor ≤ 1e-3; any-apse theory ≤ 2e-4; η_lin to
  O(Δv/v_p));
- the Π√C collapse numbers;
- the Hibberd SOM being impulsive with a bound arrival (deduced from their Table 1).
