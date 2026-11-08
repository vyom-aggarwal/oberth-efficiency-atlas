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

## Phase 8: restyle to the classic explorer (2026-10-23 to 2026-10-25, complete)

**Author decided:**
- Restyle the whole site to the classic explorer's look, keeping everything else.
- The author's preference overrides the Phase 6 design plan.
- **Step 1 review** (2026-10-23):
  - a·v in blue;
  - Greek self-hosted, against the assistant's recommendation (CI's Linux fonts differ, and the layout tests measure
    text);
  - the derivations approved, on condition that the special atlas cells keep their hatching and the red passes the
    colour-vision check;
  - the four contrast fixes.
- **Six fixes from the preview:** annotation weights, a phone-width overflow with wider layout tests, typeset
  subscripts with a no-underscore test, one surface per panel, transparent KaTeX overlays, and the faintest a·v
  stroke measured on screen.
- **Step 2 conduct:** two parts with a stop after each (after a usage cutoff landed mid-pass). Part A added the font
  licences' Reserved Font Name check; Part B the extra review screenshots.
- **The v1.1-figures recolour is dropped,** since the site now matches the paper palette.
- **Step 2 review** (2026-10-24 to 2026-10-25):
  - Part A and Part B approved;
  - the six interpretations below confirmed;
  - asked for the dark-mode label weight to be measured (and fixed only if real), and for one more full Playwright
    run after the last spec change.
- **The author pushes and deploys.**

**Assistant, step 1:**
- the inventory of the classic explorer;
- the role mapping and derivations;
- palette checks, with the minimal fixes;
- the same-colour flags;
- the font coverage check (Windows measured);
- the paper-palette comparison;
- a current-against-proposed preview with a temporary override (`docs/restyle_plan.md`).

**Assistant, step 2, implemented** (three passes, then the Open Graph image, checks and screenshots):
- **Tokens and fonts:**
  - `tools/palette.mjs` reads the classic's tokens from `explorer/app.css` and checks them (contrast, ramps,
    colour-vision distinctness), with a vitest test;
  - the three classic families self-hosted;
  - Greek-and-symbol fallback subsets chosen and cut with fontTools from pinned sources (`site/tools/fonts.py`),
    with a test that every displayed character has a self-hosted glyph;
  - the font licences built from each subset's copyright notice and the pinned OFL text.
- **Components:** panels, pill controls with visible radio dots, readout tiles, eyebrows, critical warnings, accent
  focus rings; tooltips and controls on the surface opposite their panel.
- **Charts:** classic axes, ticks and line styles; the case markers; the atlas textures; canvases on the panel colour.
- **The six fixes.** Notation is typeset centrally (`src/lib/notation.ts`, applied by the DOM helpers). Three new
  Playwright specs:
  - no underscore in displayed text;
  - text inside figure panels at 360 and 390 px;
  - the faintest a·v stroke from rendered pixels.

**Assistant found:**
- **The pale SEP lane** in the preview was a rendering artefact, not a palette problem. The hero's lanes were stroked
  sample by sample, so the short step-1 stretch never reached its colour on screen. Stroking each run as one path
  brings it to its token: 2.23:1 (light) and 2.24:1 (dark).
- **"Everything bold"** in the preview came from the preview's own font import (600 and 700 only).
- **No Reserved Font Name** in any of the four fallback families. Upstream Arimo's licence header has moved to 2026
  while the pinned file says 2020; the committed licence follows the file.
- **The site matches the paper palette** (`v1.1-figures` no longer needed): the residual differences are logged.

**Assistant interpretations, all six confirmed by the author (2026-10-25):**
- **Tooltips** sit on the page colour inside panels, not on the panel colour as the plan said.
- **Readout tiles** wrap long values instead of the classic's ellipsis.
- **The landing headline** is set at 24 px (the plan left it open).
- **On narrow views,** a ring label that would collide is dropped ("10 rₚ" at 390 px).
- **No faux bold:** synthesised bold is turned off site-wide.
- **Every file name in running text** is set as code automatically.

**Assistant errors, disclosed:**
- **A shared global regex's `lastIndex`** made the typesetter skip the first index in each string. The new
  no-underscore test caught it before commit.
- **The fallback-font download cache** was keyed on file names, so the four `OFL.txt` licence files collided. The
  sha256 pin caught it.
- **The first font output was not reproducible:** fontTools stamped the save time into every file. Fixed, and two
  runs now give identical files.
- **Pass 2 at 360 px:** the restyled hero clock overflowed (by 0.8 px, then 7 px into the padding). Both were found
  by the tests and fixed.
- **Part B's first Playwright run** was restarted, because I edited two screenshot specs while it was running.
- **The new tooltip captures focused the wrong target:** a pointer-only readout area instead of a focusable mark. They
  failed in the full run and were fixed and rerun.
- **Blocked pipes, again:** test commands piped into `tail` without pipefail were blocked by the hook and rerun.
- **A check left unreported:** during part B the assistant said it would inspect the computed weight of the dark-mode
  labels, then did not report it. The author asked. The measurement found 400 Regular in both themes, rendered with
  the same face, so the heavier look is light-on-dark appearance.
- **An over-claim:** the part B report said `docs/site.md` also held interpretations to confirm; it held none.

## Phase 9: dark, portfolio-style revamp (2026-11-01 to 2026-11-06; build complete, pull request for the author's review)

**Author decided:**
- **The brief:** a dark interpretation of https://suhaslord.github.io/portfolio/, dark only.
  - Inspiration, not copying; licence and typefaces to be reported.
  - Site-only, under the analysis freeze, every non-visual contract kept.
  - Work on `phase-9-revamp` through a pull request with green CI.
  - A plan with a style page first, then a build in seven passes.

**Assistant, steps 1 and 2:**
- **Studied the reference.** Playwright captures (not committed) and computed measurements. Reported: the MIT licence,
  four OFL typefaces (none commercial), and the libraries used.
- **Wrote the plan** (`docs/revamp_plan.md`):
  - an inventory in its own words, and an adopt, adapt or drop decision for each element;
  - a six-colour dark palette with every check, the data colours re-checked on it, and the faintest a·v stroke
    measured from rendered pixels;
  - typography chosen with fontTools for native Greek: Commissioner and Fira Mono, both OFL;
  - the information architecture, the landing page, a motion table, ASCII wireframes and a pass-2 review.
- **Built the development-only style page** `/style-9/` in isolation, with screenshots.

**Assistant found and changed inside step 2:**
- **The first accent sat too close to the data blues:** ΔE 11.6, and it failed a white label. It moved to electric
  violet `#c27bff`.
- **The style page's floating button covered a header link at 1440 px.** From 900 px it now waits until the header has
  scrolled away.
- **A still marquee cut the title mid-word under reduced motion.** It now wraps at display size.
- **Glyph icons had no self-hosted glyph.** The font test caught it; they are SVG now.

**Assistant interpretations, for the author to confirm** (plan §2.10):
- the accent's move off indigo;
- "the paper-matched blue ramp" on a dark-only site meaning the dark steps already in use;
- Commissioner and Fira Mono over the reference's DM Sans and IBM Plex Mono;
- an About the project page;
- the marquee line;
- the dive's intro compressed to 1.5 s.

**Author decided** (review of steps 1–2, 2026-11-01):
- **Copying:** allowed, with the reference's MIT notice kept and every file marked. No personal content. The result must
  stay distinguishable, and the About page carries the design credit.
- **Libraries:** GSAP allowed; Lenis only under four conditions; no Barba, but View Transitions allowed.
- **Decisions:**
  - the reference's indigo, never in a plot;
  - the existing dark data steps confirmed;
  - DM Sans and IBM Plex Mono with Commissioner's and Fira Mono's Greek;
  - an About page modelled on the reference's;
  - the title alone in the marquee;
  - a preloader of about 2 s at most, and the dive intro at most 3 s.

**Assistant, the step-2 revision:**
- **Copying:** read the reference's code and adapted its components (`THIRD_PARTY_NOTICES.md`, with headers in the four
  files). Reported GSAP's licence and dates; recommended not using it.
- **Accent:** computed the nearest passing variant, `#445be8` (ΔE 0.31).
- **Fonts:** extended `fonts.py` with the Phase 9 set, and the font tests to cover both sets.
- **Style page:** rebuilt it with the preloader, the reference's menu, marquee, magnetic and liquid buttons, live
  previews, the closing section, and Lenis.
- **`landingHero`:** gave it an optional `start` promise.
- **Screenshots:** wrote `site/tools/style9-shots.mjs` to capture them and measure the load sequences.

**Assistant found and changed inside the revision:**
- **The preloader's first timings ran over 2 s** as measured (1.999–2.17 s). It is now tied to the page's start, with
  a hard cap and a failsafe, and measured at 1.83 s.
- **The previews were empty:** the mini figures need a `figure` ancestor with an id.
- **Badge:** the accent "View" badge sat over live plots, so it is Ink.
- **The monogram** showed only as a bar, so it is dropped.
- **The square preview cut a figure's key,** so it is portrait.
- **The closing section's content slide hid the title,** so it is dropped.
- **At 390 px the dive pushed the headline below the fold,** so the headline comes first.

**Corrections to my own earlier claims:**
- the dive intro was 2.8 s, not 4.8 s;
- the reference's marquee runs at 55 px/s, not 18 (my step-1 measurement came from throttled headless frames);
- its rows are about 220 px tall, not 110.

**Assistant proposals, for the author to confirm** (plan §2.10):
- not using GSAP;
- the preloader words;
- the departures from the reference: no monogram, portrait previews with an Ink badge, no content slide, a pause
  control;
- "Fly one yourself." as the closing line.

**Author decided** (second review of steps 1–2, 2026-11-02):
- **Scope:** the new styling covers every page, the article's figures and the explorer included; only the classic
  explorer stays byte-identical. The style page gains article, explorer and references samples.
- **Less copying:** the reference's styling may be borrowed, its signature interactions may not. Every adapted element
  to be classified, each signature interaction replaced by one grounded in this project; for the findings, the
  preferred direction is rows that drive the hero dive. The notices and headers to list only what is still adapted.
- **Decisions:** no GSAP; the preloader words Approach, Ignition, Periapsis, Cutoff, Escape, in physical order; the four
  departures approved; the closing line as the author's text in a content slot.

**Assistant, the second revision:**
- **Audit** (plan §1.3): classified every adapted element as styling (kept) or signature interaction (replaced), with
  a reason for each.
- **Designed and built the replacements** on the style page:
  - the findings rows steer the dive, which docks beside them from 1100 × 700; each finding's state is grounded in the
    exported data, and the rows also open in place to their live figures;
  - a flyby preloader: a hyperbola drawn past the Sun, the stages named at their points;
  - the title moved by the dive's clock, through the angle swept around the Sun, in place of the ticker;
  - a text menu pill, plain button states, and the escape leg over a straight-edged closing section.
- **`landingHero`:** gave it `steer()` and an `onFrame` callback, both inert unless a page calls them.
- **Content plugin:** a `<!--#section:id-->` directive with a test, for the article sample; a `closing` slot.
- **New stylesheet** `site/src/styles/v9/pages.css` (no reference code) for the article, figures, explorer and
  references in the new system.
- Updated `THIRD_PARTY_NOTICES.md`, the file headers, the plan and the screenshots.

**Assistant found and changed inside the second revision:**
- **The preloader ran over 2 s** (2.10–2.17 s). Two causes: the explorer and Figure 2 set themselves up during the
  fade, and an animation's delay counts from its first frame, which the module's own set-up held back. Now those two
  mount lazily after the preloader, the fade's start is set in page time, and late runs keep 200 ms in hand. Measured:
  faded by 1.71–1.80 s, removed by 1.72–1.95 s.
- **The stage names sat on the path** far out, where it runs almost radially; they now sit off it along its normal.
- **The dive's clock overflowed its panel** once the shared controls stylesheet made that row a non-wrapping flex
  row; it now wraps under the scrub.
- **Reference entries split apart:** each italic journal name became its own grid cell. The rows are no longer grids.
- **η wrapped onto two lines** in the explorer's results column; its size is capped.

**Assistant proposals, for the author to confirm** (plan §2.10, items 11–13):
- the findings design: docked steering plus rows that open in place;
- row 02's state (the weakest link), or leaving the dive as it is for that row;
- the other replacements.

**Author decided** (approval of the plan, 2026-11-02):
- **Findings:** both steering and opening in place.
- **Row 02:** does not steer the dive; its perihelion state is removed.
- **The other replacements:** approved.
- **Preloader:** an assertion that its stage labels sit at physically correct points, Ignition before Periapsis.
- **Preloader cap:** a test against the production build, enforced locally and report-only in CI.
- **Review point:** after pass 3, the landing page, with named screenshots.
- **Proceed** with pass 1.

**Assistant, applying the approval:**
- **Row 02:** implemented "leaves the dive in its current state" as pointing at nothing. The dive keeps a focused or
  open row's state, else the reader's clock. Removed `landingHero`'s `imp` option, which only row 02 used.
- **Preloader:** moved its geometry and timing to `site/src/lib/flyby.ts`, with seven unit tests of the physical
  placement of the stages. The drawn path now passes exactly through every stage.
- **Plan:** corrected my pass numbering to the author's brief: the landing page is pass 3, the article pass 4.

**Assistant, pass 1 (tokens, fonts and base layout):**
- **Palette:** folded the Phase 9 palette and its checks into `tools/palette.mjs`, which now writes a dark-only
  `palette.css`.
- **Fonts:** made the Phase 9 set the only one in `fonts.py` and its tests, and removed the Barlow packages.
- **Base layout:** moved the Phase 9 scale and roles into `base.css`.
- **Theme:** removed the light theme, the theme switch and its scripts. The e2e specs run dark only, with a new
  dark-only test.
- **Classic explorer:** pinned its hash in the site-data tests, and added byte-for-byte e2e checks of the served file
  on the test and production builds.

**Assistant found inside pass 1:**
- **Line endings:** the classic explorer is CRLF in a Windows checkout, so the pinned hash is taken over its LF text.
- **Background motion:** Phase 8's background glow drifted for 48 s without end, which the Phase 9 motion rule
  forbids. It is removed.

**Author decided** (2026-11-02, after pass 1): pass 1 approved; the row-02 reading confirmed; Lenis and the View
Transitions deferred to an optional pass 8, to protect the weekly usage; pass 2 limited to the header, drawer and
footer.

**Assistant, pass 2 (header, menu drawer and footer):**
- **Shell:** moved the approved design into the shared header and footer partials, with a new `shell.css`.
- **Drawer:** the reference's focus handling, plus closing it before a link navigates.
- **Closing section** on every page, with the escape leg.
- **Sticky elements:** extended the measurements and their tests to the menu pill; added tests of the drawer's
  keyboard handling and of the closing section.

**Assistant, pass 3 (the landing page):**
- **Landing page:** rebuilt it from the approved style page, with the preloader, the hero band, the title moved by
  the clock, the docked dive with rows that steer it and open in place, the intro with the scope facts, and four key
  results from the site data with source links.
- **Preloader tests:** wrote the spec the author asked for. It checks that the stage marks lie on the drawn path and
  switch on in physical order, the once-a-session rules, and the 2.0 s cap on the production build (enforced
  locally, report-only in CI). A fixture option keeps every other spec clear of the preloader.
- **Fold and budget:** re-specified the fold check and the headline budget for a hero without the entry-link row,
  following the brief, and re-measured both.
- **Tests and tools:** rewrote the landing spec for the rows, docking and steering, and wrote
  `tools/landing-shots.mjs` for the review screenshots.

**Assistant found inside pass 3:**
- **Clipped label:** in the dive's window at 1440 px the view is 266 px wide and the SEP label's star was clipped
  (the approved style page had the same fault, unnoticed). A narrow view now keeps 28 px on the right.
- **Title position:** a later rule overrode the title line's position, so it sat at the top of the hero; fixed.

**Author decided** (2026-11-04): pass 3 approved, with two fixes: fold checks at 1366 × 650 and 1280 × 720, and key
results in plain language, Hibberd et al.'s thrust margin in place of the Π²/96 ratio.

**Assistant, the fixes and pass 4 (the article and its figures):**
- **Fixes:** added the laptop fold and budget checks (the hero fits as it is) and rewrote the key results' labels from
  the data. `check_numbers` matches every rendered number once the audit summary is given via `--json`.
- **Article:** applied the approved article sample to `/research/`, in a new `article.css`. Restyled the shared
  controls to the approved pills and Ink thumbs.
- **Accent rule:** wrote the test that no chart module or chart stylesheet reads the accent.
- **Found the causes of the two failures assigned to pass 4:**
  - the slider's end label crossed its track by 0.8 px because a fractional track width (from Phase 9's 3 vw padding)
    was rounded up; it is now rounded down;
  - a full-page capture resizes the viewport, the figure redraws, and its tooltip is briefly closed; under load the
    capture caught that gap. That screenshot now crops inside the viewport.

**Author decided** (2026-11-04): pass 4 approved; pass 7 next if the budget allows; passes 5 and 6 after the weekly
reset.

**Assistant, pass 7:** regenerated the Open Graph image from the finished hero: the dive on Void, captured where the
dive stays in the hero band.

**Assistant, pass 5 (the explorer):** applied the approved explorer sample in a new `explorer.css`; made the reader's
case an Ink dot (the case marks moved to `chart.css`, and the accent test now covers the explorer); found the cause of
the two "Trajectory" failures (the heading line height on a 13 px title) and of a slider-label collision in the case
column, and fixed both.

**Assistant, pass 6 (references, About, 404):**
- **References and 404:** restyled both.
- **About page:** built it to the approved plan: the design credit in the author's words, the portfolio's MIT notice
  quoted at build time from `THIRD_PARTY_NOTICES.md`, the citation as a reference line and BibTeX, the audit facts, and
  three author slots left as TODO notes.
- **Navigation:** added About to the header and the drawer.
- **Tests:** wrote the About and 404 tests.

**Author decided** (2026-11-06, final review): approved pending CI. No auto-fix: a CI failure is reported with its log
and a proposed fix, and waits for the author's OK. Retire `/style/` once its test coverage is on the real pages, and
keep `/style-9/`. Defer pass 8. Add `/about/` to the Lighthouse gate.

**Assistant, the final-review items:** moved the style page's interaction test onto the article's figures and removed
`/style/`; recorded pass 8 as deferred; added `/about/` to the Lighthouse script.

**Assistant slip, found by CI:** both CI runs on the pull request failed the 14-day package rule. On 2026-11-01 I
added Lenis and DM Sans to the lockfile, but left its recorded dates (`config.npmLockedOn`, `config.npmBefore` in
`site/package.json`) at the scaffold's 2026-10-14 and 2026-09-30. Lenis itself met the rule, but not those stale dates.
The pre-commit hook did not run the age check, so the slip reached CI, and it stopped that job before Playwright ran.

**Author decided** (2026-11-06): correct the dates (locked on 2026-11-01, cutoff 2026-10-18) and keep Lenis; make the
pre-commit hook run the age check whenever either package file is staged, with a test.

**Assistant, the fix:** added the `package-age` check to `check_all.py` and its selection, with tests; confirmed it
fails on the stale dates as CI did and passes on the corrected ones; documented it in `CLAUDE.md` and `docs/site.md`.

