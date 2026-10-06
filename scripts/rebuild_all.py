"""Rebuild every result, figure and numbers file from scratch, in dependency order (one command).

Steps run in order and stop at the first failure. Per-step wall times go to runs/rebuild_timings.json.
Long steps (≳ 10 min on 8 cores): the Phase 2 sweep, the Phase 3 campaign and follow-ups, the animation.
Not rebuilt: figures/confraria_fig434_digitized.csv (scripts/digitize_confraria.py needs an image of
Fig. 4.34 from Confraria's thesis, which is not in the repository).
Run:  .venv/Scripts/python scripts/rebuild_all.py [--from STEP] [--only STEP ...] [--list]
"""

from __future__ import annotations

import argparse
import json
import os
import platform
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PY = sys.executable

STEPS = [
    ("tests", [PY, "-m", "pytest", "-q"]),
    # Phase 1
    ("fig_eta_vs_a0", [PY, "scripts/fig_eta_vs_a0.py"]),
    ("fig_example_trajectories", [PY, "scripts/fig_example_trajectories.py"]),
    # Phase 2
    ("sweep", [PY, "-m", "oberth_atlas", "sweep", "--out", "results/sweep_nd.parquet"]),
    ("missions", [PY, "-m", "oberth_atlas", "missions", "--n", "256", "--out", "results/missions.parquet"]),
    ("fig_regimes", [PY, "scripts/fig_regimes.py"]),
    ("fig_missions", [PY, "scripts/fig_missions.py"]),
    ("fig_prefactor_check", [PY, "scripts/fig_prefactor_check.py"]),
    ("fig_eta_vs_pi", [PY, "scripts/fig_eta_vs_pi.py"]),
    ("fig_collapse", [PY, "scripts/fig_collapse.py"]),
    ("fig_atlas", [PY, "scripts/fig_atlas.py"]),
    ("robbins_comparison", [PY, "scripts/robbins_comparison.py"]),
    ("phase2_numbers", [PY, "scripts/phase2_numbers.py"]),
    # Phase 3
    ("run_phase3", [PY, "scripts/run_phase3.py"]),
    ("run_phase3_followups", [PY, "scripts/run_phase3_followups.py"]),
    ("fig_phase3", [PY, "scripts/fig_phase3.py"]),
    # Phase 4
    ("run_phase4", [PY, "scripts/run_phase4.py"]),
    ("fig_phase4", [PY, "scripts/fig_phase4.py"]),
    # Phase 5 and wrap-up
    ("rule_check", [PY, "scripts/rule_check.py"]),
    ("fig_hero", [PY, "scripts/fig_hero.py"]),
    ("literature_numbers", [PY, "scripts/literature_numbers.py"]),
    ("anim_numbers", [PY, "scripts/anim_numbers.py"]),
    ("anim_engines", [PY, "scripts/anim_engines.py"]),
    ("build_explorer", [PY, "scripts/build_explorer.py", "--recompute"]),
    ("j2_sensitivity", [PY, "scripts/j2_sensitivity.py"]),
    ("fig_loss_vinf", [PY, "scripts/fig_loss_vinf.py"]),
]


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("--from", dest="start", help="start at this step")
    ap.add_argument("--only", nargs="*", help="run only these steps")
    ap.add_argument("--list", action="store_true")
    a = ap.parse_args()
    names = [n for n, _ in STEPS]
    if a.list:
        print("\n".join(names))
        return
    steps = STEPS[names.index(a.start):] if a.start else STEPS
    if a.only:
        steps = [s for s in STEPS if s[0] in a.only]
    log = ROOT / "runs" / "rebuild_timings.json"
    log.parent.mkdir(exist_ok=True)
    record = {"python": sys.version.split()[0], "platform": platform.platform(), "processor": platform.processor(),
              "cpu_count": os.cpu_count(), "steps": {}}
    env = {**os.environ, "PYTHONIOENCODING": "utf-8", "SOURCE_DATE_EPOCH": "1791158400"}   # fixed PDF/PNG dates
    t_all = time.perf_counter()
    for name, cmd in steps:
        t0 = time.perf_counter()
        print(f"[rebuild] {name} ...", flush=True)
        r = subprocess.run(cmd, cwd=ROOT, env=env)
        dt = time.perf_counter() - t0
        record["steps"][name] = {"seconds": round(dt, 1), "returncode": r.returncode}
        log.write_text(json.dumps(record, indent=1), encoding="utf-8")
        print(f"[rebuild] {name}: {'ok' if r.returncode == 0 else 'FAILED'} in {dt / 60:.1f} min", flush=True)
        if r.returncode != 0:
            sys.exit(r.returncode)
    record["total_minutes"] = round((time.perf_counter() - t_all) / 60, 1)
    log.write_text(json.dumps(record, indent=1), encoding="utf-8")
    print(f"[rebuild] all steps ok in {record['total_minutes']} min", flush=True)


if __name__ == "__main__":
    main()
