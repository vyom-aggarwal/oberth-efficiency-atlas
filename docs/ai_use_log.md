# AI-use log

For AI-use disclosure. This file summarizes, phase by phase, what the AI assistant implemented,
derived or found, and what the user (the author) decided or contributed. It is drawn from
RESEARCH_LOG.md (dated entries) and the git history (`git log` on `main`); see those for detail.

- **Assistant:** Claude (Anthropic), model claude-opus-5-5, used through Claude Code in an agentic
  coding session. It wrote and ran code, tests and scripts in this repository, read the cited
  literature through web access, and kept the research log.
- **Author:** set the research question and phase plan, approved or changed every phase plan,
  made the scientific and scope decisions listed below, contributed derivations and checks, and
  writes the paper prose. The assistant drafts no paper text (CLAUDE.md, 2026-10-05).
- **Verification:**
  - Every reported number comes from code in the repository, with tests (509 at v1.0-analysis)
    and per-run numerical error estimates.
  - A fresh-clone rebuild reproduces every committed output (`docs/repro.md`).
  - Figures carry the generating script and git commit in their metadata.
  - Quoted numbers are collected in `figures/*_numbers.json`, and `scripts/check_numbers.py`
    checks drafts against them.

---

## Phase 1: simulator core and validation (2026-10-03)

**Author decided:**
- The project brief: the research question (η = B_finite/B_imp across bodies and engines; does
  Π = t_b/τ collapse it?), the phased workflow, the ground rules (honest results, research log,
  constants with sources, 300-dpi figures), and the Phase 1 test list.
- Plan changes:
  - default GM values with a logged J2 assumption;
  - hyperbolic arrivals only, plus an energy efficiency η_E;
  - an SOI flag plus a continuous r/r_SOI ratio;
  - energy-drift normalization with a ~1e-11 threshold and rtol not below 1e-13;
  - for Phase 3, a minimum-altitude constraint and two impulsive baselines.
- Asked for regular commits.

**Assistant implemented:**
- The package: constants with JPL/IAU sources, nondimensional units, Kepler routines, dynamics
  with an energy-balance state W, steering laws, a segmented DOP853 simulator, metrics with
  per-run error estimates and flags, YAML configs and a CLI.
- 296 tests: coast invariants, energy drift, the gravity-free closed form, the impulsive limit
  with convergence order 2.00, and mass invariance.
- Figures.

**Assistant found:**
- The measured coast error floor.
- That fixed-direction (inertial) steering drives long burns into the planet.
- That the Π² prefactor varies between cases, so Π alone cannot collapse the small-Π data.
- It raised five open questions for the author.

## Phase 2: sweep, theory, collapse and atlas (2026-10-04)

**Author decided:**
- Sweep Δv over all four dimensionless groups, for both steering laws.
- η is the primary metric, with η_E secondary.
- Energy drift is normalized by v_p²/2.
- Impact cells are masked, with a contour.

**Author contributed:**
- A hand derivation of the small-Π prefactor, with the task to test it against data.
- The tasks to test the Π·√C collapse and to characterize large Π.
- Work stays on `main` with no branches.

**Assistant implemented:**
- A body-free simulator core.
- A 135,720-run dimensionless sweep and 15,360 mission samples (Parquet with provenance).
- The analysis module and eight figures.
- `theory.py` with `docs/theory.md`:
  - the exact small-Π deficit, prograde to all orders in Δv, inertial exactly quadratic;
  - profile moments for the rocket mass ratio;
  - linear response η_lin;
  - the η ↔ η_W map;
  - the large-Π asymptotes.

**Assistant derived and found:**
- The hand prefactor needed first-order Δv/v_p corrections; the corrected one matches every
  small-Π point to ≤ 1e-3.
- Π√C collapses the small-Π data about 200× better than Π.
- v∞/v_esc is the dominant secondary parameter.
- Three large-Π regimes, with the crossover Π_T.
- The half-efficiency point Π½ ≈ 8–40.
- Real-mission envelopes.
- Two Kepler-solver bugs, found by the sweep and fixed.

**Literature review (assistant, at the author's request):**
- Read Willis (1966), Confraria (2020), Ferreira et al. (2022), Hibberd et al. (2026) and later
  Maraqten et al. (2026). Robbins (1966) was paywalled; the author is obtaining it.
- Attributed the small-Π loss scaling to Robbins (1966).
- Reproduced Confraria's "~125%" as a relative overestimate.
- Digitized Confraria's Fig. 4.34.
- Classified each finding as (a) known, (b) extension or (c) apparently new, in RELATED_WORK.md.

**Author contributed in review:**
- Caught a dimensional error in the written Π_T formula (corrected; no numbers affected).
- Independently concluded that Hibberd's 352 km/s is the post-burn speed (bound arrival).
- Relabelled the "Robbins exact for fixed direction" claim as (a) probable.
- Requested the targeted search for large-burn laws.

**Author decided:**
- Adopt η_W as the secondary metric (η_E deprecated); bound arrivals use the equivalent-Δv metric.
- Grey out electric-propulsion burns that start outside the SOI; heliocentric treatment out of
  scope.
- The Phase 3 scope: the prograde family, 1 ≲ Π ≲ 100, a minimum-altitude constraint, two
  baselines, and the framing as recoverable efficiency.
- Reduce the exhaust-velocity axis to three values.
- Replace the Phase 4 case study with a finite-burn re-analysis of Hibberd et al.

## Phase 3: burn optimization (2026-10-04, follow-ups 2026-10-05)

**Assistant implemented:**
- `optimize.py`: timing-only and pitch-plus-timing optimization by SLSQP with multiple starts,
  the r_min ≥ ρ r_p constraint and both baselines.
- 450 optimizations with a Nelder–Mead cross-check.
- Figures and `phase3_numbers.json`.

**Assistant derived:**
- The small-Π optimal timing δ* = ½ − x̄: the Δv-weighted mean at periapsis.
- A closed-form recovered fraction, (x̄ − ½)²/⟨(x − ½)²⟩ as Δv → 0.
- Both verified against simulation to 5e-4.

**Assistant found:**
- A pitch-law singularity at h = 0 (a sliding mode that stalled the integrator); fixed and tested.
- Timing gives most of the recoverable gain.
- The large-Π timing reversal for near-constant-mass burns.
- The constraint costs depth, not efficiency.

**Assistant error, disclosed:**
- The optimization grid was changed from the approved Π ∈ {2, 5, 20, 100} to {1, 3, 10, 30, 100}
  without announcing or logging it. This was recorded afterwards (2026-10-05).
- That led to the author's rule that deviations are logged with their reason at the time.

**Author contributed:**
- Independently verified x̄ = 1/f − c/Δv, the timing offsets and the 7.6% recovered fraction.
- Pointed out that Δv/c = 3 is unrealistic and asked for the headline to come from realistic
  missions.
- Proposed comparing against the half-Δv rule, with estimates of ~80% capture and ~13% extra loss
  at Δv/c = 3, both confirmed.
- Asked that the qualitative "start earlier" idea not be claimed as new.
- Decided:
  - a 6-knot pitch check, with the claim worded "within smooth steering laws tested";
  - the reversal reported empirically, with one quantitative check;
  - the nominal-r_p baseline as the headline.

**Assistant implemented (follow-ups):**
- The mission-sample mapping (5,895 samples).
- The half-Δv closed form and its simulation check.
- The piecewise pitch law and optimizer (gain ≤ 0.077 pp).
- The reversal correlation (Spearman median 0.83 within fixed Δv/c and Π).

## Phase 4: finite-burn re-analysis of Hibberd et al.'s solar Oberth (2026-10-05)

**Author decided:**
- Confirm the reference burn.
- Sweep thrust downward to the 1% loss point.
- Place nuclear thermal and SEP (Maraqten et al.) on the curve.
- Model staged motors if the source specifies them.

**Assistant implemented:**
- `staged.py`:
  - arrival on any conic, by backward integration from periapsis;
  - staged constant-thrust burns;
  - the equivalent-Δv metric;
  - a leading-order loss for staged profiles.
- Motor data from Hibberd's Table 2 and the Northrop Grumman catalog (burn times). Identified
  Hibberd's "STAR 48" as the STAR 48B short nozzle.
- Sensitivity runs.

**Assistant found:**
- Reference loss 0.099 m/s time-centred and 0.090 m/s optimal (~1e-5 of Δv), inside the
  pre-registered 0.04–0.25 m/s.
- 1% loss at Π ≈ 1 (thrust ÷ 30).
- A near-universal loss(Π) curve across profiles.
- An unreconciled 1,100.4 kg mass discrepancy in the source's Table 2.

**Assistant error, disclosed:**
- A threshold quoted for nuclear thermal was first stated with the solid stack's value
  (0.61 m/s²). It was corrected to 0.83–0.88 m/s² before the phase-end commit.

## Phase 5: checks and deliverables (2026-10-05)

**Author contributed:**
- The candidate practical rule loss/Δv ≲ Π²/96 (from k(1−k) ≤ ¼), with the instruction to frame it
  as a clean flyby statement close to practitioner heuristics, not a discovery.
- The SEP framing: Maraqten et al. never assumed an impulsive burn.
- New working rules (deviation logging, file-edit tools, this log).
- The Phase 5 scope:
  - the animation;
  - the interactive explorer with a JS–Python validation test;
  - the hero figure;
  - a power-law SEP thrust stage;
  - a footnote for the Hibberd discrepancy.
- The writing conventions; the author writes the prose.

**Assistant derived:**
- The exact form of the rule: the leading-order bound over the arrival conic is
  (1 + r)/(96(1 − r)), with r = Δv/v_p, times the mass-ratio factor 12m₂(λ).
- Verified that every Phase 2 sweep run with Π ≤ 1 satisfies it to 1%.

**Assistant implemented:**
- The power-law (F ∝ r^−1.5, Maraqten et al.'s own model) thrust stage, with Π_eff for placement.
- The hero figure, the engine-comparison animation, and the self-contained explorer. Its JS
  simulator matches Python to 2e-10 in η.
- `check_numbers.py`, with sourced literature and input numbers.

**Assistant errors, disclosed:**
- The power-law timing optimizer first minimized the absolute loss, which slid the SEP arc off
  perihelion. It now maximizes the final energy, with a regression test.
- The first number checker was too permissive (unit scales let unrelated values match). It was
  made unit-aware, with one-significant-figure numbers reported as unverified.
- A second checker bug, numbers at the start of a line being skipped, was found by a test and
  fixed.
- A hero-figure comparison briefly showed an interpolation artifact (a curve clamped below its
  range). It was caught before any figure was committed.

**Published:** the explorer, as a private Claude artifact for viewing; the repository copy is
`explorer/oberth_explorer.html`.

## Wrap-up: precision fixes, J2, reproducibility (2026-10-06)

**Author decided:**
- Word the Π²/96 rule as a leading-order bound that holds within 1% for Π ≤ 1.
- Label the explorer atlas as linear-response theory.
- Add an independent cross-check of the animation numbers.
- A feature freeze after: a J2 sensitivity check of about 10 cases; no practitioner-literature
  search; Robbins on arrival.
- The explorer keeps hyperbolic arrivals only, with a labelled Hibberd approximation.
- Source names stay inside figures, with numbered citations in captions.
- A single-band hero figure, plus a separate arrival-speed figure.
- A reproducibility audit (fresh clone, fresh venv, full rebuild) before tagging `v1.0-analysis`.
  The author pushes.

**Assistant implemented:**
- The wording changes, with the factual note that the 1.010 maximum is reached already at
  Π ≤ 0.1.
- The animation cross-check (`anim_numbers.json`). The SEP case's Π is 368, not the ≈ 377 in the
  request.
- The J2 module and its 10 cases: max |Δη| = 0.0026.
- The arrival-speed figure.
- The labelled explorer preset. The assistant found that the single equivalent stage loses
  0.137 m/s against the staged 0.099 m/s, and said so on the page.
- `rebuild_all.py`, `repro_audit.py`, `requirements-lock.txt` and `docs/repro.md`, and the audit
  itself.

**Assistant found** (with the checker): two outline numbers that existed only as JSON keys, now
added to the numbers file as values.

**Reproducibility audit (assistant ran it; details in `docs/repro.md`):**
- Fresh clone, fresh venv and full rebuild: 508 tests passed and all 26 steps ran.
- After fixes, 56/56 outputs are identical to the committed ones, ignoring provenance and
  wall-clock fields.
- One input is not regenerable: the Confraria digitization, which needs an external image.

**Assistant errors, disclosed (found by the audit):**
- **Stale committed outputs.** Some outputs were not regenerated after later code changes:
  - Phase 1 figures, after the Phase 2 refactor;
  - `phase2_numbers.json`, after the valid-samples mission table;
  - the Phase 3 campaign and its dependants, after the optimizer's cache change in the
    follow-ups.

  The differences were at the 1e-6 level or below in optimal controls and 1e-12 in η, and no
  quoted number changed. All were regenerated from committed code.
- **An animation bug.** It was introduced when the script was reordered to draw the still first:
  frame 0 kept the markers from the still. It is fixed, with a regression test. The committed
  video predates the bug and was already correct.
- **A process slip.** One refresh commit (533227d) was made by a command chain that did not check
  the comparison it printed (False). The remaining difference turned out to be wall-clock
  statistics only, which the audit now ignores.
- **Audit wall times are indicative.** The machine slept during the clone's sweep, and step times
  varied by up to 4× between runs.
