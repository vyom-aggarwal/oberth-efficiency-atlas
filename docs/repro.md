# Reproducing every result

One command rebuilds every result table, figure, animation, numbers file and the explorer from the
code in this repository, in dependency order:

```bash
.venv/Scripts/python scripts/rebuild_all.py
```

On macOS/Linux, use `.venv/bin/python`.

- It runs the test suite first and stops at the first failing step.
- Per-step wall times go to `runs/rebuild_timings.json`.
- Options:
  - `--from STEP` resumes from a step;
  - `--only STEP ...` runs only the named steps;
  - `--list` prints the steps.
- It sets `SOURCE_DATE_EPOCH`, so PDF creation dates are fixed.
- **Time:** about 43–79 min on the machine below (see Runtimes). The sweep, the Phase 3 campaign
  with its follow-ups, and the animation take most of it.

## Setup from a fresh clone

```bash
git clone <repository> oberth-efficiency-atlas
cd oberth-efficiency-atlas
python -m venv .venv
.venv/Scripts/python -m pip install -e ".[dev,anim]" -c requirements-lock.txt
.venv/Scripts/python scripts/rebuild_all.py
```

- **`requirements-lock.txt`** pins the 24 package versions of the audited environment, among them
  numpy 2.5.3, scipy 1.18.1, matplotlib 3.11.2, pandas 3.0.6 and pyarrow 25.0.1.
  - In the audit, a plain `pip install -e ".[dev,anim]"` from `pyproject.toml` resolved exactly
    these versions.
  - With other versions, results should agree to integration tolerance, but byte identity was
    checked only for this set.
- **The `anim` extra** provides a bundled ffmpeg for the MP4 (`scripts/anim_engines.py`).
- **Node.js (optional):** `tests/test_explorer_js.py` runs the explorer's JavaScript simulator
  under node against Python, and is skipped without node.
- **Not rebuilt:** `figures/confraria_fig434_digitized.csv`. `scripts/digitize_confraria.py` needs an
  image of Fig. 4.34 from Confraria's thesis, which is not in the repository. The CSV is an input
  (digitized literature data), not a result.

## Checking a rebuild against the committed outputs

```bash
.venv/Scripts/python scripts/repro_audit.py REFERENCE_DIR REBUILT_DIR [--json audit.json]
```

`repro_audit.py` compares every file under `figures/` and `results/`, plus the explorer. It
ignores provenance stamps and wall-clock fields:
- **PNG:** decoded pixels. The script path and git commit in the text metadata are ignored.
- **PDF:** bytes, without the creation date, modification date and producer, and without the
  `startxref` offset, which shifts with the length of the date.
- **JSON:** parsed values, without keys containing "runtime".
- **Parquet:** the table, without its key-value metadata (provenance) and the `runtime_s` column.
- **MP4 and GIF:** decoded frames.
- **CSV, HTML and other text:** bytes.

## Audit of v1.0-analysis (2026-10-06)

**Procedure:**
- A fresh clone of commit 8283401 into a temporary directory, with a new venv. A plain
  `pip install -e ".[dev,anim]"` resolved exactly the versions in `requirements-lock.txt`.
- The test suite passed: 508 tests, none skipped.
- `rebuild_all.py` ran all 26 steps, the sweep included.
- `repro_audit.py` then compared the clone with the committed outputs.

**First comparison:** every difference was traced to a cause. None was nondeterminism.

1. **Stale committed outputs.** These were made by older code and not regenerated after a later
   code change.
   - **Phase 1:** `eta_vs_a0.{png,csv}` and the `trajectory_*.png` figures predated the Phase 2
     refactor. They differed in last digits (~1e-14) and by 1–3/255 in pixel values.
   - **Phase 2:** `phase2_numbers.json` predated the valid-samples mission table.
   - **Phase 3:** `results/opt_phase3.parquet` and the Nelder–Mead cross-check predated a change to
     the optimizer's evaluation cache (9abf156), which moved the SLSQP path slightly.
     - The optimal controls moved by ≤ 7e-6.
     - η at the nominal baseline moved by ≤ 2e-12.
     - The piecewise-pitch follow-up starts from these optima. It, `phase3_numbers.json` and three
       Phase 3 figures (antialiasing, ≤ 6/255) differed in turn.
     - The Nelder–Mead agreement range became [−1.2e-15, +4.6e-9], from [+1e-14, +4.7e-9].
   - All were regenerated in the repository from committed code. No number quoted in the paper
     outline changed (`check_numbers.py`: 34 checked, 0 unmatched).
2. **A bug in the animation script.** Frame 0 kept the spacecraft markers of the frame drawn
   before it (the final-frame still).
   - It is fixed, with a regression test (`tests/test_anim.py`).
   - The committed MP4 and GIF had been rendered before the bug was introduced. The fixed code
     reproduces them frame for frame.
3. **Two audit-tool refinements,** both for wall-clock or provenance fields:
   - JSON keys containing "runtime" (the sweep's runtime statistics) are ignored;
   - the PDF `startxref` offset is ignored (it moves with the length of the date stamp).

**Final comparison:** the clone's code was updated to the fixed commit, and the test suite (509
passed) and the animation were rerun there. Result: **56/56 outputs identical**, ignoring
provenance stamps and wall-clock fields. One of the 56, `confraria_fig434_digitized.csv`, is not
regenerated (see above).

## Runtimes and hardware

**Hardware:**
- Laptop, Intel Core Ultra 9 288V (8 cores, 8 threads), 31.6 GB RAM.
- Windows 11 Home 10.0.26200.
- Python 3.13.14; Node.js v24.18.1.
- The parallel steps use up to 8 worker processes.

**Timings:**
- "Audit rebuild" is the wall time of each step in the fresh clone.
- "Rerun" is the same step run later that day, on the same machine, during the fixes.
- Wall times varied by up to 4× between the two runs. The cause was not identified; the laptop's
  power or thermal state is likely. Treat the timings as indicative.

| step | audit rebuild | rerun | what it makes |
|---|---|---|---|
| tests | 2.5 min | 0.9 min | 508 tests in the audit, 509 in the rerun (node present) |
| fig_eta_vs_a0, fig_example_trajectories | 0.1 min each | | Phase 1 figures |
| sweep | ≈ 17 min* | | `results/sweep_nd.parquet`: 135,720 runs |
| missions | 0.6 min | | `results/missions.parquet`: 15,360 samples |
| fig_regimes | 2.4 min | | regime figure and half-efficiency table |
| other Phase 2 figures and numbers (7 steps) | ≤ 0.2 min each | | |
| run_phase3 | 13.7 min | 5.9 min | 450 optimizations and the Nelder–Mead cross-check |
| run_phase3_followups | 33.8 min | 7.7 min | placement rules, 6-knot pitch, mission mapping |
| fig_phase3 | 0.3 min | 0.1 min | |
| run_phase4, fig_phase4 | 0.3 and 0.1 min | | |
| rule_check, fig_hero, literature_numbers, anim_numbers | ≤ 0.2 min each | | |
| anim_engines | 6.8 min | 6.3 min | MP4 (360 frames), GIF, final-frame PNG |
| build_explorer --recompute, j2_sensitivity, fig_loss_vinf | < 0.1 min each | | |
| **total** | **≈ 79 min** | **≈ 43 min** with the rerun times | |

\* **The sweep time is an estimate.** The machine slept during this step: the recorded 561 min
include a 9.1-h gap in the progress log. Excluding the gap, the step took about 17 min.
Independently, the per-run compute times of the committed sweep sum to 17.4 min per worker.
