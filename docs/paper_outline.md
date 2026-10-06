# Paper outline (working draft, 2026-10-05)

**Working title:** *How much of the Oberth bonus does a finite burn keep? Scaling laws and an atlas
for powered flybys*

**Conventions** (author's instructions, 2026-10-05):
- **Style:** captions and this outline use first-person singular and active voice.
- **Citations:** superscript numbers in the text, e.g. <sup>2</sup>, keyed to the numbered
  reference list at the end.
- **Prose:** the author writes the paper text. The "draft captions" below are placeholders for
  the author to rewrite.
- **Numbers:** every number here comes from `figures/*numbers*.json`. Check a draft with
  `.venv/Scripts/python scripts/check_numbers.py draft.md --allow 96,24,12`.

**Status key:** ✅ done and verified in the repo · 🔶 provisional (claim register at the end).

Figure paths are relative to `figures/`. Every figure has a generating script in `scripts/`.

---

## 1. Introduction
- **Topic.** The Oberth effect, and the impulsive approximation used in mission design. For
  example, Hibberd et al.<sup>1</sup> treat their solar Oberth burn as impulsive.
- **Prior work** (RELATED_WORK.md):
  - finite-burn loss estimate<sup>2</sup>;
  - finite-thrust escape and capture charts<sup>3</sup>;
  - steering-law losses and a test of the loss estimate<sup>4</sup>;
  - continuous thrust during a close approach<sup>5</sup>;
  - solar-electric Oberth at 0.3 au<sup>6</sup>;
  - low-thrust spiral-escape asymptotics<sup>7,8</sup>.
- **Gap.** No dimensionless account exists of how much of the impulsive Oberth bonus a finite burn
  keeps during a flyby, across bodies and engines.
- **Optional opening figure:** `hero_loss_vs_pi.png` (see §10).
- **Contributions:** the contribution statement in RELATED_WORK.md.

## 2. Problem formulation ✅
- **Model.** I model a planet-centred two-body problem with a variable-mass spacecraft and
  three steering laws (prograde, fixed direction, pitch).
- **Metrics:**
  - η = B_finite/B_imp is primary and never clipped;
  - η_W, the baseline-subtracted energy efficiency, is secondary;
  - the equivalent-Δv loss is used for any arrival conic, bound ones included.
- **Burn parameter.** I use Π = t_b/τ, with τ = r_p/v_p, and four dimensionless groups, following
  the scaling of Willis<sup>3</sup>.
- **Figure:** `trajectory_earth_hydrolox.png`.
  - *Draft caption:* I simulate a hydrolox burn during an Earth flyby; the thick arc marks the
    thrust, and the lower panel shows the specific energy against time.

## 3. Numerical method and validation ✅
- **Integration.** I integrate coast, burn and coast segments with DOP853 at a 10⁻¹² tolerance.
  An energy-balance state gives a per-run error estimate for η, which I checked against reruns
  at 10⁻¹³.
- **Validation:** coast invariants, the gravity-free closed form, mass and frame invariance,
  body independence, and the any-apse theory against direct integration.
- **Figure:** `eta_vs_a0.png`.
  - *Draft caption:* As I raise the thrust acceleration, η converges to the impulsive limit at
    second order.

## 4. Small-Π theory, Robbins' expression and a practical rule ✅ (novelty 🔶)
- **Loss scaling.** The loss scales as kΠ²Δv/24, which I attribute to Robbins<sup>2</sup>.
- **Exact leading-order deficit** at an apse of any conic:
  - prograde to all orders in Δv;
  - fixed direction exactly quadratic;
  - thrust profiles through their moments.
- **Fixed-direction thrust** reproduces Robbins' expression exactly (claim P1). **Prograde**
  thrust lies below it (P3). **High-mass-ratio burns centred in time** exceed it (P2).
- **Confraria's "~125%"**<sup>4</sup>, reproduced and explained (P5).
- **Practical rule** (R1). For a prograde burn centred on periapsis, loss/Δv is at most about
  Π²/96, i.e. a burn shorter than r_p/v_p is impulsive to within about 1%.
  - **Status:** a *leading-order bound that holds within 1% for Π ≤ 1*, not a strict inequality.
    Sweep runs reach 1.010 of it.
  - **Leading-order form** over the arrival conic: (1 + r)/(96(1 − r)), with r = Δv/v_p, times the
    mass-ratio factor 12m₂.
  - **Framing:** likely close to practitioner heuristics, so not claimed as a discovery.
- **Figures:**
  - `prefactor_check.png`;
  - `robbins_comparison.png`;
  - `rule_check.png` (appendix).
    - *Draft caption:* I plot the measured prograde loss in units of Π²/96 against Π; every
      run with Π ≤ 1 stays within 1% of the leading-order bound for its own Δv/v_p.
- **Appendix:** the derivations (docs/theory.md §4).

## 5. Linear response and the η–η_W map ✅ (novelty 🔶 P4)
- **η_lin(Π; v∞/v_esc)** is one curve per arrival speed in the limit Δv → 0.
- **The exact map** η = (√(1 + ξη_W) − 1)/(√(1 + ξ) − 1).
- **Figure:** `eta_vs_pi_all.png`.

## 6. Large-Π regimes ✅ (novelty 🔶 P4)
- **Three regimes:** CΠ²; (9/(2Π))^(1/3) from the parabolic core; ln Π/Π from the hyperbolic tail.
- **Crossover:** Π_T = v_p V²/v∞³.
- **Half-efficiency point:** Π½ ≈ 8–40 at every body.
- **Relation to prior work:** these are flyby analogues of the classical spiral-escape
  law<sup>7,8</sup>.
- **Figure:** `regimes.png`.

## 7. Collapse and secondary parameters ✅
- **Collapse:** Π√C collapses the small-Π data far better than Π alone.
- **Secondary parameter:** v∞/v_esc explains 73–92% of the remaining scatter.
- **Arrival-speed dependence** (companion to the single-band hero figure). Faster arrivals lose
  less, and the 1% point moves from Π ≈ 0.99 (v∞/v_esc ≤ 0.47) to 1.31 (1.25) and 3.64 (3.28).
  Each curve follows k(1−k)Π²/24 at small Π.
  - **Figure:** `loss_vs_pi_vinf.png`.
    - *Draft caption:* I plot the median finite-burn loss from the sweep against Π for five
      arrival speeds; the dashed lines are the leading-order law for each, and the grey band is
      the near-parabolic curve of the hero figure.
- **Figures:** `collapse_small_pi.png`, `collapse_secondary.png`.

## 8. Atlas and real missions ✅
- **Figures:** `atlas_eta.png`; `missions_regions.png` (burns that start outside the SOI are
  greyed out); `mission_table.csv`. The presets are representative assumptions (A1).

## 9. Burn optimization ✅ (novelty 🔶 P6)
- **Baseline.** I lead with the nominal-r_p impulsive baseline, and use the achieved-periapsis
  baseline to separate depth from efficiency.
- **Headline, from realistic missions.** Across the Phase 2 mission sample, the median recoverable
  gain from optimal placement is:
  - chemical: 7e-6 pp (max 0.083);
  - nuclear thermal: 8e-5 pp (max 4.1);
  - electric: 0.0068 pp (max 1.2).

  Every gain above 0.1 pp comes from starting later.
  - **Figure:** `phase3_missions.png`.
    - *Draft caption:* For each body and engine I optimize the timing of every valid prograde
      burn; the dashed line marks the median at the unrealistic Δv/c = 3 corner for comparison.
- **Mechanism, from the controlled grid.** The Δv/c = 3 corner is an illustration, not the
  headline.
  - **Figures:** `phase3_recoverable.png`, `phase3_fraction.png`.
- **Timing:**
  - The small-Π optimum puts the Δv-weighted mean at periapsis.
  - The recovered share follows in closed form.
  - The half-Δv rule captures 75–80% of the gain.
  - **Figures:** `phase3_timing.png`, `phase3_reversal.png`.
    - *Draft caption (timing):* I compare the optimal burn offset with the centroid rule
      (dashed) and the half-Δv rule (dotted).
- **Pitch** adds ≤ 0.08 pp within the smooth laws tested.
  - **Figures:** `phase3_pitch.png`, `phase3_baselines.png` (appendix).

## 10. Case study: the 3I/ATLAS solar Oberth burn as a finite burn ✅
- **Inputs:**
  - Hibberd et al.'s<sup>1</sup> reference burn: 3.2 R☉, 8.36 km/s, a bound arrival from 5.2 au;
  - CASTOR 30B + STAR 48B, with catalog burn times<sup>9</sup>;
  - the equivalent-Δv metric.
- **Footnote needed** (the author writes it; neutral wording). The 17,754 kg total in their
  Table 2, row m, could not be reconciled with the stage masses plus payload. The results use the
  stage sum, which reproduces their ΔV.
- **Result:**
  - The loss is 0.099 m/s time-centred and 0.090 m/s at the optimal timing.
  - It stays below 0.2 m/s under every sensitivity.
  - **Figure:** `phase4_reference.png`.
    - *Draft caption:* I fly Hibberd et al.'s two-stage burn through perihelion with the
      catalog burn times; the right panel shows the loss for each sensitivity I tested.
- **Where the impulsive model fails.** At 1% of Δv when Π ≈ 1, i.e. thrust ÷ 30.
  - Nuclear thermal crosses it at a0 ≈ 0.85 m/s².
  - **Figure:** `phase4_loss_vs_pi.png`.
- **Hero figure** (main text or poster): `hero_loss_vs_pi.png`.
  - *Draft caption:* I place real burns on one curve: the finite-burn loss of a solar Oberth burn
    depends on Π alone across thrust profiles. Phase 2 solar flybys (dots), Hibberd et
    al.'s<sup>1</sup> burn (star), and Maraqten et al.'s<sup>6</sup> arc, placed with their own
    thrust model (diamonds).
  - **Framing for Maraqten et al.** Their analysis never assumed an impulsive burn; the curve
    places their arc at Π_eff ≈ 4.6–9.2, where it gives about 12–20%.

## 11. Limitations
- **Gravity model.** Point-mass gravity. A J2 check (10 cases at 1.1 R) changes η by at most
  0.0026 (`j2_numbers.json`).
- **Frame.** The planet-centred frame is invalid for burns that start outside the SOI.
- **Arrivals.** The atlas uses hyperbolic arrivals; the case study uses bound ones.
- **Case study.** Planar point-mass Sun; constant thrust per motor (bracketed by two-level
  profiles); unknown staging coast (bracketed); thermal limits not modelled. SEP at 3.2 R☉ in the
  animation is hypothetical.
- **Steering.** Only smooth pitch laws were tested.
- **Presets.** Representative assumptions, not hardware data.

## 12. Conclusions

**Supplementary material:**
- the engine-comparison animation (`anim_engines.mp4`, `.gif`);
- the interactive explorer (`explorer/oberth_explorer.html`), whose JavaScript simulator matches
  the Python one to 2e-10 in η;
- data and code (Parquet results with provenance metadata, scripts, configs).

**Appendices:**
- A: derivations;
- B: numerics and the test inventory;
- C: data and code availability.

---

## Claim register (provisional or assumption-dependent)

| ID | Claim | Depends on | What would settle it |
|---|---|---|---|
| P1 | For fixed-direction thrust, Robbins' expression is the exact leading-order loss | Robbins<sup>2</sup> unread; probably his own construction, labelled **(a) probable** | Read Robbins (author obtaining it) |
| P2 | High-mass-ratio burns centred in time exceed Robbins' bound | Robbins' assumptions on placement and profile | Read Robbins |
| P3 | Prograde loss lies below Robbins by [(1−k)v + (1+k)Δv]/(v + Δv); exact prograde prefactor | Whether Robbins or later work treats tangential steering | Read Robbins; database search |
| P4 | Three large-Π regimes, Π_T, Π½; η_lin and the η–η_W map | Web search only; Bombardelli et al.<sup>8</sup> unread | Database search; read Bombardelli et al. |
| P5 | Confraria's "~125%" explained | Agrees at T/W₀ = 0.1; unresolved gap at 0.5 | Her raw data (not pursued) |
| P6 | The small-Π optimum is the Δv-weighted mean; closed-form recovered fraction and half-Δv capture; depth/efficiency split. The qualitative "centre on Δv" idea is not claimed | Robbins may treat burn placement | Read Robbins; database search |
| R1 | Practical rule: loss/Δv at most about Π²/96, a leading-order bound that holds within 1% for Π ≤ 1, with its conditions | Framed as close to practitioner heuristics (**(a)** qualitatively, **(b)** the exact form) | Practitioner literature search |
| A1 | Mission-atlas η per body and engine | Representative presets; SOI filter | Sensitivity to the preset ranges |
| A2 | All absolute flyby results | Point-mass gravity. J2 checked on 10 cases at 1.1 R (Jupiter, Saturn; Π = 0.1–100): max \|Δη\| = 0.0026, ≤ 4.9% of the deficit 1 − η; absolute v∞,out shifts by 21–28 m/s | Settled for η (`j2_numbers.json`); absolute values stay point-mass |

---

## References

1. A. Hibberd, T. M. Eubanks, A. M. Hein, "Catching 3I/ATLAS Using a Solar Oberth,"
   arXiv:2601.02533 v2 (2026).
2. H. M. Robbins, "An analytical study of the impulsive approximation," *AIAA J.* 4(8):1417–1423
   (1966). doi:10.2514/3.3687.
3. E. A. Willis, Jr., "Finite-thrust escape from and capture into circular and elliptic orbits,"
   NASA TN D-3606 (1966).
4. J. C. F. Confraria, "Finite burn losses in spacecraft maneuvers revisited," MSc thesis,
   Instituto Superior Técnico, Lisbon (2020).
5. A. F. S. Ferreira et al., "Low Thrust Propelled Close Approach Maneuvers," *Symmetry*
   14(9):1786 (2022). doi:10.3390/sym14091786.
6. N. Maraqten, W. van Lynden, C. Gómez de Olea Ballester, A. M. Hein, "High-temperature
   photovoltaics for solar-electric Oberth maneuvers: ton-class payload feasibility for
   interstellar-precursor missions," arXiv:2608.11113 v1 (2026).
7. H. S. Tsien, "Take-off from satellite orbit," *J. Am. Rocket Soc.* (1953).
8. C. Bombardelli, G. Baù, J. Peláez, "Asymptotic solution for the two-body problem with constant
   tangential thrust acceleration," *Celest. Mech. Dyn. Astr.* (2011).
9. Northrop Grumman, *Propulsion Products Catalog*, OSR No. 16-S-1432 (2016).
10. JPL Solar System Dynamics, Astrodynamic Parameters (DE440) and Planetary Physical Parameters;
    IAU 2015 Resolution B3 (nominal solar radius). Constants and sources: `constants.py`.
