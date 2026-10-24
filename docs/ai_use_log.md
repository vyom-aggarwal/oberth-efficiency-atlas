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

## Phase 6: project website (2026-10-13 to 2026-10-20; the home-page prose is the author's, still to come)

**Author decided:**
- The brief: a GitHub Pages site, presentation only under the feature freeze.
- The author writes all prose.
- The plan-first gate and the checkpoints.

**Assistant proposed** (`docs/site_plan.md`):
- The information architecture, the data export, the tech stack, and a two-pass design plan.
- These rest on measurements: simulator timing, font coverage, palette validation, and package
  publish dates.

**Author decided** (2026-10-14):
- Approved the plan, with additions:
  - the hero on Hibberd's geometry, with the three engines marked on its Π axis;
  - a Π = 1000 frame-time benchmark;
  - citation-style tooltip provenance.
- Answered the open questions:
  - colour divergence accepted, with a recolour of the paper figures after the site (`v1.1-figures`);
  - engine trajectories imported from the animation;
  - theory curves through the frozen library;
  - unwritten sections hidden in production;
  - Playwright in CI;
  - `/style/` dev only.

**Assistant implemented (checkpoint 1):**
- The palette generator and its checks.
- The package-age check.
- The first part of the data export, with source-pointer tests.
- The build-time KaTeX plugin.
- The `/style/` design reference, with the universal curve from exported data.
- Playwright screenshot and interaction specs.

**Assistant errors, disclosed:**
- **Hand-typed numbers:** a first draft of the export and labels contained them (case
  descriptions, "3.2 R☉", "three thrust profiles", "10th to 90th percentile"). All were replaced by
  sourced values before checkpoint 1.
- **Edit-tool rule broken twice:** the assistant used shell heredocs or inline scripts for
  multi-line edits, once to append this log (2026-10-13) and once in a TypeScript file. Both
  results were checked and found intact.

**Checkpoint 1 review and checkpoints 2–3 (2026-10-15):**
- **Author decided:**
  - Enforce the edit-tool rule with a pre-tool hook, then extend it to block test runs piped
    into tail, head or grep without pipefail.
  - The case labels and the band spread on the universal curve.
  - Keep the font subsets.
  - Plot η_W (labelled as such) in the regimes figure, with the η–η_W divergence exported for the
    author to quote.
  - Re-run the fresh-clone audit at checkpoint 6 and commit its report.
- **Assistant implemented:**
  - The hook (`.claude/hooks/shell-guard.mjs`, 31 tests).
  - The full site-data export: 12 files, with currentness and cross-check tests.
  - The content plugin and site skeleton.
  - The shared simulator module.
  - The live hero.
- **Assistant found:**
  - The band's true maximum spread lies between the sampled values of the numbers JSON.
  - η and η_W differ by up to 0.21 for slow arrivals, which decided the regimes figure.
  - The v1.0 audit report had never been committed.
- **Assistant errors, disclosed:**
  - **A commit with a failing test (6c0938d, 2026-10-15).** The commit command piped `pytest`
    through `tail`, which hid pytest's non-zero exit status, so the `&&` chain went on to commit.
    - The failing test was `test_provenance_hashes_match_sources[presets.json]`: the presets file
      recorded a stale hash of `scripts/build_explorer.py` after that script changed. The data
      itself was correct.
    - It was found at once and fixed in d65d77b.
    - The same kind of slip had happened during the v1.0 audit (533227d). The author then asked
      for the hook's second guard, which now blocks such pipes.
  - **Temporal-dead-zone errors in the first hero draft:** variables were used before their
    declarations. Both were caught by the Playwright console-error check before any commit.
- **Checkpoint 3 verification, assistant implemented:**
  - The hero tests: layout at four widths and seven Π values, the intro (once; skipped under
    reduced motion), dragging, the data-table labels, and frame time.
  - Frame time: p95 9.4–11.7 ms over nine runs, against the author's 16 ms target; single frames
    up to 18–24 ms, once 43 ms.
  - Testing against a built site (`SITE_DIST`), because the sandbox blocks local sockets. A request
    to run outside the sandbox was declined, and the assistant did not try to get around it.
  - Vitest's configuration and its first 8 unit tests.
- **Checkpoint 3, assistant found and fixed:**
  - The η annotation was dropped below 640 px.
  - The decade labels collided at 390 px.
  - Threshold labels picked up a dotted line style.
  - The intro's TypeError, and the intro ignoring the keyboard.
  - The hero table titled its rows with engines whose own η it does not show: the η is the single
    equivalent stage at that engine's Π.
  - Universal curve: colliding on-plot labels at 600–1440 px, and arrival-speed curves with no
    labels below 560 px. Placement now searches for a clear position, all or none, with a
    collision test at five widths.
  - The slider, curve and hero measured text before the web fonts loaded and never re-measured;
    they now redraw when fonts load.
- **Checkpoint 3, assistant errors, disclosed:**
  - **`npm test` failed from checkpoint 2 until this checkpoint.** Vitest collected the Playwright
    specs. The checkpoint 2 report did not run it.
  - **The universal curve was never in a home-page screenshot until the final checkpoint-3 run.**
    It mounts lazily, and the full-page captures did not scroll. Its label collisions were found
    only then.
  - **Wrong dates:** the 2026-10-15 decisions were first logged as 2026-10-16 in five places;
    corrected.
  - **An unverified browser version:** the first draft of the frame-time log entry gave a Chrome
    version that had not been checked. It was replaced by the version the tests report
    (154.0.8037.98) before commit.

**Checkpoint 3 review and checkpoints 4–6 (from 2026-10-18):**
- **Author decided:**
  - Approved checkpoint 3, with three fixes:
    - the narrow Π axis split by category, with short names;
    - the legend-only curve accepted, with shape-distinct markers directly under the plot;
    - scroll padding for the sticky bar.
  - Required one check command and a pre-commit hook, after three unnoticed failures.
  - Asked for screenshots to be committed at each checkpoint.
- **Assistant implemented:**
  - The three fixes, each with Playwright tests; the sticky-bar tests were confirmed to fail without
    the fix.
  - `scripts/check_all.py`, and the `.githooks/pre-commit` hook that runs its fast subset.
- **Assistant flagged:** the short narrow-screen "SEP" label drops the "(hypothetical at 3.2 R☉)"
  caveat from the axis. The caveat stays in the hover title, the table and the summary.
- **Assistant errors, disclosed:** while preparing `check_all.py`, the assistant ran a shell loop
  that printed `tail`'s exit status instead of the checker's. The output was read directly, so
  nothing was misreported, but it is the same kind of slip that `check_all.py` now prevents.
- **Checkpoint 4, assistant implemented:**
  - Figures 3–7 (three regimes, the atlas, burn timing, the case study, engines compared) and the
    Limitations facts.
  - The shared figure module, with a Playwright spec per figure.
  - The screenshots under `docs/screens/checkpoint-4/`.
  - The design was logged before building, including the Π axes to 10⁷.
- **Checkpoint 4, assistant found and fixed:**
  - labels lost under the all-or-none rule (timing, case study, atlas), and a label collision in
    regimes;
  - the engines clock widening the page at 390 px;
  - readouts that lines could block;
  - the cause of an intermittent readout test.
- **Checkpoint 4, assistant errors, disclosed:**
  - **A temporal-dead-zone error in the atlas,** the third in Phase 6. It was caught by the
    console-error check before any commit.
  - **A hand-typed "(10 cases)" in the Limitations label,** removed before commit because the count
    is not exported.
  - **A stray `python -` with no input** hung a shell command until it was stopped. Nothing was
    written.
  - **A test command piped into `grep` without pipefail,** blocked by the hook and rerun with
    pipefail.
- **Checkpoint 5, assistant implemented:**
  - The explorer: nondimensional inputs with presets, a zoomable trajectory, readouts, warnings,
    placement on the curve and the theory atlas, and URL state.
  - Shared path code, now used by the hero too.
  - Unit and Playwright tests, and the screenshots.
  - The design was logged before building, including the dropped classic SI mode.
- **Checkpoint 5, assistant found and fixed:** the missing post-burn segment on impact, the
  impact labels, the URL meaning of a preset without inputs (and inputs without a preset), the
  slider labels beyond 1000, and a default that contradicted its own note.
- **Checkpoint 5, assistant errors, disclosed:**
  - **An overclaim in the research log,** corrected the same day once the presets were measured. It
    said every electric preset beyond Π = 10³ starts its burn outside the sphere of influence; at
    Jupiter and Saturn they start inside.
  - **Interpretive interface text** ("faster arrivals lose less at large Π") was drafted and removed
    before commit, as prose that belongs to the author.
  - **A scratch `sed` edit** corrupted a temporary test file. It was discarded and never committed.
- **Checkpoint 6, author decided** (2026-10-19):
  - Lighthouse in CI is the record: a ≥ 90 gate for accessibility, best practices and SEO;
    performance reported only.
  - Deploy only by hand while the sections are TODO.
  - On narrow screens: one engines panel at a time with a switch, and "SEP*" with a visible note.
  - A grouped, state-dependent atlas legend.
  - A staged-file pre-commit.
  - A tooltip fix at the source.
  - Open Graph metadata.
  - Actions pinned to commit SHAs.
  - The audit rerun after all of these.
- **Checkpoint 6, assistant implemented:**
  - The eight changes, each with tests.
  - The CI workflow, with SHA pins resolved from GitHub and checked against each action's inputs.
  - `docs/site.md`.
  - `scripts/audit_record.py`, and the audit itself.
- **Checkpoint 6, assistant found and fixed:**
  - **Checkout-dependent provenance hashes** in the site export, found by the first fresh-clone
    attempt.
  - **A cp1252 crash** in the new hook's summary line, found by its own end-to-end test before the
    hook was ever used.
  - **A version-selection error:** picking actions "newest by date" chose actions/checkout v2.8.0,
    a maintenance release. The selection now goes by version number.
  - **Seven site-data files reported as different** by the audit of 6cd1e6e, traced to stamps:
    - the hashes of rebuilt parquet files, which the comparison still checked;
    - the clone's origin URL;
    - the commit in some source links.
    The comparison rule and the audit procedure were corrected, each logged before the change.
  - **Broken source links in a rebuilt checkout:** the exporter linked files changed in the working
    tree to a `<sha>-dirty` ref, which does not exist. It now compares committed files and links only
    to real refs, with a test.
  - **A race in the hero's data-table test,** seen once in the final full run: it read the table
    before the first simulation filled one cell. It now waits for that cell.
- **Checkpoint 6, results:** the audit of the final code (f185234) reproduced 69 of 69 outputs. In
  the final checks, `check_all.py` passed (pytest 601) and Playwright passed 101.
- **Checkpoint 6, assistant errors, disclosed:**
  - **Pre-commit staging.** The first attempt at the hash fix could not be committed code-first: the
    hook rejected code that no longer matched the data. Code and data were committed together, with
    a `-dirty` stamp, then re-exported with a clean stamp.
  - **Four blocked pipes:** test commands piped into `tail` or `grep` without pipefail were blocked
    by the hook and rerun with pipefail.
  - **The audit comparison's site-data rule** was the assistant's own design (2026-10-15). It kept
    the source hashes for every source, including files the rebuild regenerates. The audit of
    6cd1e6e exposed this.
- **Checkpoint 6 review, author decided** (2026-10-20):
  - Approved the checkpoint and the audit comparison rule, and closed Phase 6.
  - Pre-commit: a changed test file runs itself, and a changed script runs its own test file.
  - The engines switch uses the hero's short names, and the SEP panel keeps its caveat.
  - Deploys stay manual.
  - Before the first push: the hero frame time is report-only in CI and enforced locally.
- **Checkpoint 6 review, assistant implemented:**
  - the `own-tests` pre-commit check, with tests that include a real run;
  - a shared engine-label helper, unit-tested against the exported titles, now used by the hero and
    the engines figure;
  - full names for assistive technology on the short switch labels;
  - the report-only frame-time mode with a job-summary table, verified in both modes;
  - the documentation of all of these.
- **Checkpoint 6 review, assistant errors, disclosed:**
  - **A fifth blocked pipe:** vitest piped into `tail`, rerun with pipefail.
  - **A commit blocked by the pre-commit hook,** working as intended. New tests changed the test
    count that `methods.json` records. It was re-exported and committed with them.
- **Phase 6 results:**
  - **Website:** the site, the explorer, CI with SHA-pinned actions, and deployment by hand.
  - **Audit:** the final code reproduced 69 of 69 outputs.
  - **Final checks before the push:** listed in the phase-end commit.
- **After Phase 6, first CI runs and deploy** (2026-10-21):
  - The assistant found and fixed two CI-only failures, both its own:
    - exact cross-platform comparisons in the site-data tests, now within a measured tolerance;
    - a Lighthouse runner that blocked its own preview server.
  - It pushed the fixes with the author's OK and deployed by hand.

## Phase 7: landing page and references page (2026-10-21, in review)

**Author decided:**
- The brief: a landing page at `/`, the article moved to `/research/`, the references on their own
  page.
- Prose slots that stay hidden until written.
- The plan's approval, with two changes:
  - the title and entry links above the fold;
  - three findings, with "energy kept" folded into the hero.
- Answers A–G: no empty `/research/`; only the `#ref-n` redirect; replay once per session; the
  name "Vyom Aggarwal" in `CITATION.cff`; MIT for code and CC BY 4.0 for text and figures, with
  third-party material listed.

**Assistant proposed and implemented:**
- The plan (`docs/landing_plan.md`), with wireframes and a pass-2 check against the generic
  defaults.
- The route move:
  - conditional Research links;
  - the references page with stable anchors and cross-page citations;
  - a production-build Playwright project under the base path.
- The shared dive view, the landing hero and its sequence, the three findings, the prose slots with
  the placeholder mode, the footer citation and licences, and the Open Graph image.
- Tests at four widths, plus above-the-fold checks.

**Assistant interpretations, for the author to confirm:**
- `CITATION.cff` takes its version and date from the analysis tag.
- CC BY 4.0 also covers the generated data.

**Assistant errors, disclosed:**
- **Another temporal-dead-zone error,** caught by the console-error check before commit.
- **The SEP lane label clipped at 390 px.** Found in a screenshot; now tested by the hero's own
  clipping count.
- **A CSS specificity slip** showed one legend item twice at narrow widths; now tested.
- **Two blocked pipes:** test commands piped into `tail` or `grep` without pipefail were blocked by
  the hook and rerun with pipefail.
- **Phase 7 review, author decided** (2026-10-21):
  - Approved the phase, the citation interpretation and the data licence.
  - Asked for:
    - the fold to hold with prose written (reorder, a placeholder-build test, a headline budget);
    - a valid explorer fallback for the missions finding, with a test;
    - a Copy-button test on a secure origin.
- **Phase 7 review, assistant implemented:**
  - The reorder and a measured compaction of the narrow hero.
  - The fold tests on two builds, and the headline-budget probe and build warning.
  - The `jupiter.hall` fallback, a test of every fallback with a control case, and the localhost
    clipboard test.
- **Phase 7 review, assistant found:**
  - **A race in its own fold test:** it could measure before the hero's first draw. The tests now
    wait for the drawn hero.
  - **An over-claim it did not make:** the empty-slot fold check passing said nothing about the
    written state. The author caught that, not the assistant.
- **After Phase 7, deployment** (2026-10-22): the author reported a failed manual Pages run. The
  assistant found that no manual run had reached GitHub, so nothing needed fixing. It made no commit
  and told the author what to re-run.

## Phase 8: restyle to the classic explorer (2026-10-23, step 1 awaiting approval)

**Author decided:**
- Restyle the whole site to the classic explorer's look, keeping everything else.
- The author's preference overrides the Phase 6 design plan.

**Assistant, step 1:**
- the inventory of the classic explorer;
- the role mapping and derivations;
- palette checks, with the minimal fixes;
- the same-colour flags;
- the font coverage check (Windows measured);
- the paper-palette comparison;
- a current-against-proposed preview with a temporary override (`docs/restyle_plan.md`).
