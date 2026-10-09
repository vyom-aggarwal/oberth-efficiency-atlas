# Oberth Efficiency Atlas

**How much of the impulsive Oberth bonus does a real engine keep?**

![Finite-burn loss of a solar Oberth burn against Π](figures/hero_loss_vs_pi.png)

*Finite-burn loss of a prograde solar Oberth burn against Π = burn duration / (r_p / v_p). Dots are
simulated flybys with chemical, nuclear thermal and electric engines; the star is the 3I/ATLAS burn
proposed by Hibberd et al. (2026); the diamonds place the solar-electric arc of Maraqten et al.
(2026) on the curve. All thrust profiles fall on one curve.*

Near periapsis a spacecraft moves fastest, so each m/s of Δv gains more than it would in deep space.
That is the Oberth effect, and mission design usually assumes the burn is instantaneous. Real burns
are not: they last minutes (chemical), hours (nuclear thermal) or weeks to months (electric), and
the spacecraft keeps moving, and gravity keeps turning its velocity, while the engine runs.

This project measures how much of the impulsive bonus survives. It does so with a high-precision
finite-burn flyby simulator, a 135,720-run dimensionless sweep, 15,360 mission samples (6 bodies × 5
engine classes), closed-form theory, a burn-optimization campaign and a solar Oberth case study.

## The short version

- **One number sets the penalty: Π = t_b / τ,** the burn duration over τ = r_p / v_p, the time to
  travel one periapsis radius at periapsis speed. A burn shorter than τ is impulsive to about 1%.
  Past Π ≈ 1 the loss climbs fast, and by Π ≈ 10–40 the energy efficiency has fallen to one half.
- **Chemical engines are effectively impulsive everywhere.** Median η is about 0.999 or better at
  all six bodies.
- **Nuclear thermal is borderline at the terrestrial planets** (median η ≈ 0.96–0.97, 10th
  percentile 0.6–0.7) and impulsive at the Sun and the giants.
- **Electric engines are not impulsive.** Where the model applies they keep roughly 8–42% of the
  bonus. At Venus, Earth and Mars most of their burns start outside the sphere of influence, so the
  planet-centred model does not apply at all.
- **Smarter steering and timing cannot win it back.** For realistic engines the median gain from
  optimizing burn timing is below 0.01 percentage points for every engine class.
- **The proposed 3I/ATLAS solar Oberth burn is safely impulsive.** It loses 0.1 m/s of 8.36 km/s.
- **Fixed-direction thrust is a trap.** For long burns it pulls periapsis down, even into the
  planet, and η goes negative.

η = B_finite / B_imp is the **Oberth efficiency**. B = v∞,out − (v∞,in + Δv) is the speed gained over
the same burn in deep space, so η = 1 is an impulsive burn, η = 0 gains nothing over deep space, and
η < 0 is worse. It is never clipped. For bound arrivals, where η is undefined, the project uses the
**equivalent-Δv loss**: the extra Δv needed to match the impulsive result.

## How it works

A planet-centred two-body simulation with point-mass gravity and one constant-thrust, constant-Isp
engine, so mass falls by the rocket equation. The burn is placed relative to the *unperturbed*
periapsis passage, and thrust follows one of four steering laws: `prograde` (along the velocity),
`inertial` (fixed direction), or a linear or piecewise pitch off prograde.

The integrator works in nondimensional units (μ = r_p = 1), so a run is fixed by four groups: the
arrival speed, Δv, exhaust velocity and thrust acceleration, each scaled to the periapsis. That makes
the core simulator **body-free**: one sweep covers every planet, and a real body only adds scale
factors, an impact radius and a sphere-of-influence check. DOP853 integrates coast, burn and coast
at 1e-12 tolerance, and an energy-balance residual on every run flags numerical error.

**Example.** `configs/earth_hydrolox.yaml`: a 1 km/s hydrolox burn (Isp 465 s, a₀ = 2 m/s²) centred
on periapsis at 300 km over Earth, arriving at 3 km/s.

| | Earth, hydrolox | Jupiter, Hall thruster |
|---|---|---|
| burn duration | 449 s | 37.5 days |
| **Π** | **0.762** | **2350** |
| **η** | **0.9917** | **0.089** |
| loss in equivalent Δv | 14.2 m/s | 5.1 km/s |

The same 1 km/s of Δv keeps 99% of the bonus from a hydrolox stage and 9% from a Hall thruster.

![Jupiter flyby with a Hall thruster](figures/trajectory_jupiter_hall.png)

In the Jupiter case the burn spans about 200 planetary radii on each side of periapsis. The energy
rises almost linearly in time with only a small kink at periapsis: the engine does most of its work
far from the planet, where there is little Oberth bonus to collect.

## Results

### The whole picture: η against Π

![η against Π for every sweep case](figures/eta_vs_pi_all.png)

Every reliable sweep case (prograde left, inertial right), with the Δv → 0 theory in black. All cases
sit at η = 1 for Π ≪ 1 and fall as Π passes 1. Prograde η decays smoothly toward 0 and never goes
negative. Inertial η follows it until Π ≈ 10, then diverges: 33% of inertial cases at Π = 10–10³
and 95% at Π ≥ 10³ have η < 0, down to −24. Sideways thrust changes the flyby geometry, so
fixed-direction thrust is a different regime, not just a less efficient one.

### Why Π, and how well it collapses the data

For a burn near periapsis the loss comes from gravity turning the velocity and from the speed falling
away from periapsis during the burn. Both scale with (burn duration × turn rate)², so the loss is
proportional to Π² at small Π. For a prograde burn centred on periapsis, with a small Δv:

> loss / Δv ≈ k(1 − k) Π² / 24, where k = μ / (r_p v_p²) ≤ ½.

The largest value is at k = ½ (near-parabolic arrival), which gives **loss/Δv ≲ Π²/96**. That is the
project's rule of thumb: about 1% at Π = 1. It holds for prograde steering, a burn centred on
periapsis, Π ≲ 1 and small Δv/v_p and Δv/c (to within about 10% for Δv/v_p ≲ 0.03 and Δv/c ≲ 1).
It does not apply to fixed-direction thrust.

![Collapse of 1 − η on Π and on Π√C](figures/collapse_small_pi.png)

Plotting 1 − η against Π alone leaves a spread of 0.285 dex (prograde) because the prefactor depends
on arrival speed, Δv and mass ratio. Rescaling by the closed-form prefactor C collapses all 15,375
prograde points onto a single line, 1 − η = (Π√C)², with 0.001 dex of scatter. The prefactor is
accurate to about 1e-3 at Π < 0.01. A simpler estimate that evaluates the losses along the unperturbed
trajectory underestimates the loss by a median of 14% (prograde) and by up to a factor 4.4 when
Δv ≳ v_p.

Beyond the collapse, **arrival speed is the main secondary parameter**: v∞/v_esc explains 73–92% of the
scatter left within each Π range (prograde). Slow arrivals lose most, because the coefficient
k(1 − k)/24 peaks at k = ½, the near-parabolic arrival. The loss reaches 1% of Δv at Π = 0.99 for
v∞/v_esc = 0.01 but only at Π = 3.6 for v∞/v_esc = 3.3, and at Π = 10 the median loss is 24% against
2.2% (`figures/loss_vs_pi_vinf.png`).

### What happens at large Π

![Three regimes at large Π](figures/regimes.png)

Once the burn outlasts the time spent near the planet, most of the Δv is delivered far away, where
there is no bonus. The sweep shows three regimes:

| regime | range | efficiency (η, or the energy efficiency η_W) |
|---|---|---|
| I, impulsive | Π ≪ 1 | 1 − CΠ² |
| II, parabolic core | 1 ≪ Π ≪ Π_T | (9 / 2Π)^(1/3), about 1.65 Π^(−1/3) |
| III, hyperbolic tail | Π ≫ Π_T | ~ ln Π / Π |

Π_T is the hyperbola's crossing time over τ, so regime II exists only for slow arrivals (v∞ ≪ v_esc).
The half-efficiency point (η_W = ½) sits at Π ≈ 8–40 across the whole sweep, with a median of 26,
and the Δv → 0 theory predicts it to 0.4% median error.

### Where real engines sit

![Mission samples on the (Π, v∞/v_esc) plane](figures/missions_regions.png)

Each panel is one engine class: 256 Sobol samples per body, coloured by simulated η. Grey points are
burns that start outside the body's sphere of influence, where the planet-centred model is invalid.
The engine and body envelopes in `configs/atlas/presets.yaml` are **representative assumptions**, not
hardware specifications.

Median η (10th–90th percentile) over valid prograde samples; where some samples are invalid the
valid count is shown. Full table: `figures/mission_table.csv`.

| body | Hydrolox | Methalox | Nuclear thermal | Hall | Gridded ion |
|---|---|---|---|---|---|
| Sun | 1.0000 (1.000–1.000) | 1.0000 (1.000–1.000) | 1.0000 (0.999–1.000) | 0.4198 (0.239–0.685) | 0.2995 (0.136–0.550) |
| Venus | 0.9990 (0.984–1.000) | 0.9998 (0.996–1.000) | 0.9592 (0.663–0.998) | n/a (0/256 valid) | n/a (0/256 valid) |
| Earth | 0.9992 (0.987–1.000) | 0.9998 (0.997–1.000) | 0.9677 (0.700–0.999) | 0.1322 (0.069–0.167) [18/256 valid] | n/a (0/256 valid) |
| Mars | 0.9990 (0.980–1.000) | 0.9997 (0.995–1.000) | 0.9553 (0.615–0.998) | 0.0784 (0.069–0.117) [13/256 valid] | n/a (0/256 valid) |
| Jupiter | 1.0000 (1.000–1.000) | 1.0000 (1.000–1.000) | 0.9995 (0.978–1.000) | 0.1387 (0.058–0.329) [213/256 valid] | 0.1062 (0.051–0.251) [135/256 valid] |
| Saturn | 1.0000 (1.000–1.000) | 1.0000 (1.000–1.000) | 0.9997 (0.989–1.000) | 0.1178 (0.046–0.336) [233/256 valid] | 0.0848 (0.039–0.235) [156/256 valid] |

The pattern is set by Π. Chemical burns sit at Π ≲ 1 and are impulsive. Nuclear thermal burns reach
Π ~ 1 at the terrestrial planets, where τ is short (about 10 minutes at Earth), and lose a few
percent there. Electric burns sit at Π ~ 10²–10⁴ and keep a few to a few tens of percent. Their flybys at
Venus, Earth and Mars are mostly outside the model's range: the burn is so long it starts beyond
the sphere of influence.

### Can a smarter burn win it back?

![Recoverable gain for realistic missions](figures/phase3_missions.png)

An optimizer searched, under a minimum-altitude constraint, for the best prograde-family burn:
timing only, or a linear pitch law plus timing (450 optimizations, cross-checked against
Nelder–Mead). Applied to the mission samples, the **median** gain in η from optimal timing is:

| engine class | median gain | maximum |
|---|---|---|
| chemical | 7e-6 pp | 0.083 pp |
| nuclear thermal | 8e-5 pp | 4.1 pp |
| electric | 0.0068 pp | 1.2 pp |

(pp = percentage points of η.) A richer pitch law adds at most 0.07 pp. For comparison, the
unrealistic corner of the controlled grid (Δv/c = 3, i.e. propellant fraction ≈ 95%) gains a median
11.7 pp at Π = 10.

The mechanism is simple. The small-Π loss depends on burn placement only through the spread of the
Δv distribution, so the optimum puts the **centroid of Δv**, not the time midpoint, at periapsis.
A rocket's acceleration rises as it burns off mass, so the centroid sits after the midpoint and the
best burn starts slightly early. The recovered share of the deficit has a closed form: 0.08%, 7.6% and
39.7% at Δv/c = 0.1, 1 and 3. A simple "half the Δv before periapsis" rule captures 75–80% of that
gain. Only 322 of 5,895 valid mission samples gain more than 0.1 pp, and all of them do so by
starting *later*. The gain tracks how far the centred burn lifts periapsis (Spearman 0.91).

For realistic engines the lesson is practical: centre the burn in time and do not expect steering to
recover the loss.

### Case study: the 3I/ATLAS solar Oberth burn

Hibberd et al. (2026) propose a solar Oberth manoeuvre at 3.2 R☉ to catch the interstellar object
3I/ATLAS, with Δv = 8.36 km/s from a CASTOR 30B + STAR 48B stack on a bound arrival from 5.2 au, and
treat the burn as impulsive. `staged.py` flies the real two-stage burn through perihelion.

![The Hibberd burn as a finite burn](figures/phase4_reference.png)

The burn lasts 210.8 s, so Π = 0.0326. It loses **0.099 m/s** of its 8.36 km/s (1.2e-5 of Δv), or
0.090 m/s with optimal timing, and stays under 0.2 m/s across every sensitivity tested (the largest is
a 60-s coast between stages). The impulsive assumption is safe.

![Loss against Π for the Hibberd stack and other engines](figures/phase4_loss_vs_pi.png)

Scaling the thrust shows how much margin there is. The loss reaches 1% of Δv at Π ≈ 0.98, which for
this stack means about **30 times less thrust**. A single nuclear-thermal stage reaches 1% at
a₀ ≈ 0.83–0.88 m/s². The curve is nearly universal: a two-stage solid stack, a constant-thrust
nuclear stage and a solar-electric stage lie within 8% of each other from Π = 0.1 to 100. Maraqten et
al.'s solar-electric arc never assumed an impulsive burn, but on this curve it sits at Π ≈ 4.6–9.2,
where the loss is about 12–20%.

![Three engines on the same solar dive](figures/anim_engines.gif)

The animation flies the same dive with a solid stack (Π = 0.03, loss 0.001%), a nuclear-thermal
engine (Π = 1.7, loss 2.8%) and a hypothetical solar-electric engine (Π = 368, loss 76%).
([MP4](figures/anim_engines.mp4))

### Fixed-direction thrust, and prior work

For fixed-direction thrust, the leading-order loss matches the scaling attributed to Robbins (1966),
(ω t_b)²Δv/24, as quoted by Confraria (2020). The measured prograde loss is 0.5–1.05 times that
expression, falling with k (`figures/robbins_comparison.png`). The project reproduces Confraria's large
overestimate of the Robbins expression at low thrust-to-weight (130% at T/W₀ = 0.1) but not the
exact size at higher thrust. Robbins' original paper could not be accessed, so the claims that extend
beyond his scaling are provisional. The register of claims is in `docs/paper_outline.md`.

## Limitations

- **Point-mass gravity.** A J2 check on 10 cases (Jupiter and Saturn, Π = 0.1–100) changes η by at
  most 0.0026.
- **Planet-centred frame.** Burns that start outside the sphere of influence are masked, not
  assigned a number.
- **Representative presets.** Engine and body envelopes are assumptions, so the mission statistics
  depend on them.
- **Case study.** Planar point-mass Sun, constant thrust per motor, an unknown staging coast
  (bracketed at 10–60 s) and no thermal limits. The solar-electric engine at 3.2 R☉ in the
  animation is hypothetical.
- **Steering.** Only smooth pitch laws and one piecewise law were tested, so the optima hold within
  those families.

## Using the project

```bash
python -m venv .venv
.venv/Scripts/python -m pip install -e ".[dev]"     # .venv/bin/python on macOS/Linux
.venv/Scripts/python -m pytest

.venv/Scripts/oberth run configs/earth_hydrolox.yaml
```

`oberth run` prints the metrics and writes `runs/<name>/result.json` and `trajectory.png`. Configs
use unit-suffixed keys (`v_inf_in_km_s`, `isp_s`, `a0_m_s2`); the schema is in
`src/oberth_atlas/config.py`. From Python:

```python
from oberth_atlas.burn import BurnSpec, Engine
from oberth_atlas.constants import get_body
from oberth_atlas.simulate import simulate_flyby

res = simulate_flyby(get_body("earth"), v_inf_in=3_000.0, periapsis_altitude=300_000.0,
                     burn=BurnSpec(delta_v=1_000.0, engine=Engine(isp=465.0, a0=2.0)))
print(res.Pi, res.eta, res.delta_v_loss)
```

**Interactive explorer.** Download `explorer/oberth_explorer.html` and open it in a browser. It runs
the simulation live for any body, periapsis, arrival speed, Δv and engine, and shows η, the loss, the
trajectory, and where the case sits on the loss curve and the η atlas. Its JavaScript simulator is
tested against Python.

**Data.** Everything is committed in `results/` (Parquet; the sweep, the missions, the optimizations
and the case study) and `figures/`. Each phase's figures come with a `figures/*_numbers.json` holding
the numbers quoted from them. Parquet files carry provenance (grid, numerics, git revision) in
their metadata, and `oberth_atlas.analysis.reliable` gives the mask of trustworthy sweep rows.

**Reproducibility.** `scripts/rebuild_all.py` rebuilds every result, figure and the explorer from
code in dependency order (43–79 minutes on the audit machine, 8 cores). A fresh-clone rebuild at the
`v1.0-analysis` tag reproduced all 56 committed outputs, and `requirements-lock.txt` pins the audited
environment. Details are in `docs/repro.md`.

<details>
<summary>More figures</summary>

| figure | what it shows |
|---|---|
| `eta_vs_a0.png` | η converges to 1 as thrust rises, at second order in Π (fitted order 2.000) |
| `prefactor_check.png` | the small-Π prefactor against every sweep point with Π < 0.1 |
| `collapse_secondary.png` | which secondary parameter explains the scatter left after collapsing on Π |
| `atlas_eta.png` | η on the (Π, v∞/v_esc) plane for three Δv values, prograde and inertial |
| `robbins_comparison.png` | measured loss against the Robbins expression, and Confraria's escape case |
| `phase3_timing.png`, `phase3_recoverable.png` | optimal burn offset and recoverable gain on the controlled grid |
| `phase3_fraction.png`, `phase3_pitch.png` | recovered fraction of the deficit and the optimal pitch law |
| `phase3_baselines.png`, `phase3_reversal.png` | both impulsive baselines, and the large-Π timing reversal |
| `rule_check.png` | the Π²/96 rule against the sweep and the closed-form bound over any arrival conic |
| `trajectory_*.png` | the four example configs in `configs/` |

</details>

<details>
<summary>Repository layout</summary>

```
src/oberth_atlas/   the library: constants, simulate (simulate_nd, simulate_flyby), steering, metrics,
                    theory, sweep, optimize, staged, j2, config, cli
tests/              pytest suite
configs/            single-flyby examples, atlas presets (presets.yaml), Phase 4 motor data
scripts/            one script per figure, plus run_*, rebuild_all, repro_audit, check_numbers
figures/            committed 300-dpi PNGs, CSVs and *_numbers.json
results/            committed Parquet and CSV result tables
explorer/           the interactive page (edit the template, css and js, not the built HTML)
docs/               theory.md, paper_outline.md, repro.md, ai_use_log.md
```

Constants (GM, radii, semi-major axes, g₀) live only in `src/oberth_atlas/constants.py`, each with a
source comment. Decisions, assumptions and surprising results are logged in `RESEARCH_LOG.md`; the
derivations are in `docs/theory.md`; the literature review is in `RELATED_WORK.md`.

</details>

## Sources

- A. Hibberd, T. M. Eubanks, A. M. Hein, "Catching 3I/ATLAS Using a Solar Oberth," arXiv:2601.02533
  (2026).
- N. Maraqten et al., "High-temperature photovoltaics for solar-electric Oberth maneuvers,"
  arXiv:2608.11113 (2026).
- H. M. Robbins, "An analytical study of the impulsive approximation," *AIAA J.* 4(8) (1966).
- E. A. Willis, Jr., "Finite-thrust escape from and capture into circular and elliptic orbits," NASA
  TN D-3606 (1966), whose nondimensionalization this project follows.
- J. C. F. Confraria, "Finite burn losses in spacecraft maneuvers revisited," MSc thesis, Instituto
  Superior Técnico (2020).
- JPL Solar System Dynamics (DE440) for planetary constants.

The full list is in `docs/paper_outline.md`.
