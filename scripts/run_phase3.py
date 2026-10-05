"""Phase 3 optimization campaign → results/opt_phase3.parquet (+ results/opt_phase3_crosscheck.csv).

Grid (user scope: prograde family, 1 ≲ Π ≲ 100):
    Π ∈ {1, 3, 10, 30, 100} × v∞/v_esc ∈ {0.03, 0.1, 0.3, 1, 3} × Δv/v_p ∈ {0.03, 0.3} × Δv/c ∈ {0.1, 1, 3}
Modes per case:
    'timing' (α ≡ 0, δ free) and 'full' (α₀, α₁, δ) with the constraint r_min ≥ ρ·r_p, ρ ∈ {1.0, 0.9}.
Cross-check: penalty Nelder–Mead from two starts on a fixed subset, compared with the SLSQP optima.
Run:  .venv/Scripts/python scripts/run_phase3.py [--workers N]
"""

from __future__ import annotations

import argparse
import csv
import itertools
import json
import math
import os
import sys
import time
from concurrent.futures import ProcessPoolExecutor
from dataclasses import asdict
from pathlib import Path

import numpy as np
from scipy.optimize import minimize

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from oberth_atlas.optimize import OptCase, _Evaluator, optimize_case  # noqa: E402
from oberth_atlas.simulate import Numerics  # noqa: E402
from oberth_atlas.sweep import _metadata, _write_parquet  # noqa: E402

GRID = dict(Pi=(1.0, 3.0, 10.0, 30.0, 100.0), v_over_vesc=(0.03, 0.1, 0.3, 1.0, 3.0),
            dv_over_vp=(0.03, 0.3), dv_over_c=(0.1, 1.0, 3.0))
RUNS = (("timing", 1.0), ("full", 1.0), ("full", 0.9))


def run_one(args) -> dict:
    Pi, vr, dvr, lam, mode, rho = args
    case = OptCase.from_targets(vr, dvr, lam, Pi, rho)
    t0 = time.perf_counter()
    try:
        r = optimize_case(case, mode)
        row = dict(status="ok", error="", **{f"case_{k}": v for k, v in r.case.items()},
                   mode=mode, rho=rho, alpha0=r.alpha0, alpha1=r.alpha1, delta=r.delta,
                   eta_fixed=r.eta_fixed, eta_achieved=r.eta_achieved, eta_W=r.eta_W, r_min=r.r_min,
                   eta_err=r.eta_err, feasible=r.feasible, eta_centered=r.eta_centered,
                   eta_inertial=r.eta_inertial, r_min_centered=r.r_min_centered, n_sims=r.n_sims,
                   n_starts_feasible=sum(s["feasible"] for s in r.starts),
                   start_eta_spread=float(np.ptp([s["eta"] for s in r.starts if s["feasible"]] or [np.nan])),
                   starts=json.dumps([{k: (list(v) if isinstance(v, tuple) else (str(v) if k == "message" else v))
                                       for k, v in s.items()} for s in r.starts]))
    except Exception as exc:  # noqa: BLE001 (recorded, never dropped)
        row = dict(status="error", error=f"{type(exc).__name__}: {exc}", case_Pi=Pi, case_v_inf_over_vesc=vr,
                   case_dv_over_vp=dvr, case_dv_over_c=lam, mode=mode, rho=rho)
    row["runtime_s"] = time.perf_counter() - t0
    return row


def nelder_mead_check(args) -> dict:
    """Penalty Nelder–Mead from the centered burn and from a perturbed start (independent of SLSQP)."""
    Pi, vr, dvr, lam, rho = args
    case = OptCase.from_targets(vr, dvr, lam, Pi, rho)
    ev = _Evaluator(case, Numerics())

    def f(z):
        e = ev(*z)
        if e.impacted or not math.isfinite(e.eta_W):
            return 1e3
        return -e.eta_W + 1e4 * max(0.0, rho - e.r_min) ** 2

    best = None
    for x0 in ((0.0, 0.0, 0.0), (0.1, -0.2, -0.2)):
        r = minimize(f, np.array(x0), method="Nelder-Mead",
                     options={"xatol": 1e-6, "fatol": 1e-12, "maxiter": 2000, "maxfev": 3000})
        e = ev(*r.x)
        if best is None or e.eta_W > best[1].eta_W:
            best = (r.x, e)
    slsqp = optimize_case(case, "full")
    return dict(Pi=Pi, v_over_vesc=vr, dv_over_vp=dvr, dv_over_c=lam, rho=rho,
                eta_nm=best[1].eta, r_min_nm=best[1].r_min, x_nm=list(map(float, best[0])),
                eta_slsqp=slsqp.eta_fixed, x_slsqp=[slsqp.alpha0, slsqp.alpha1, slsqp.delta],
                diff=best[1].eta - slsqp.eta_fixed)


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("--workers", type=int, default=os.cpu_count())
    a = ap.parse_args()
    jobs = [(Pi, vr, dvr, lam, mode, rho) for (Pi, vr, dvr, lam) in itertools.product(*GRID.values())
            for mode, rho in RUNS]
    jobs.sort(key=lambda j: (j[4] != "full", -j[0]))        # long jobs first, for load balance
    print(f"phase 3: {len(jobs)} optimizations on {a.workers} workers", flush=True)
    rows, t0 = [], time.perf_counter()
    with ProcessPoolExecutor(max_workers=a.workers) as ex:
        for i, row in enumerate(ex.map(run_one, jobs, chunksize=1), 1):
            rows.append(row)
            if i % 25 == 0 or i == len(jobs):
                print(f"  {i}/{len(jobs)} ({time.perf_counter() - t0:.0f} s)", flush=True)
    spec = {"grid": GRID, "runs": RUNS, "bounds": "see optimize.BOUNDS", "optimizer": "SLSQP multi-start (5) / bounded Brent"}
    df = _write_parquet(rows, ROOT / "results" / "opt_phase3.parquet", _metadata("phase3_optimization", spec))
    print(f"wrote results/opt_phase3.parquet: {len(df)} rows, {int((df['status'] != 'ok').sum())} errors", flush=True)

    sub = [(Pi, vr, dvr, lam, 1.0) for Pi in (3.0, 30.0) for vr in (0.03, 0.3, 3.0) for dvr in (0.03, 0.3) for lam in (1.0,)]
    with ProcessPoolExecutor(max_workers=a.workers) as ex:
        checks = list(ex.map(nelder_mead_check, sub))
    with (ROOT / "results" / "opt_phase3_crosscheck.csv").open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(checks[0]))
        w.writeheader()
        w.writerows(checks)
    d = np.array([c["diff"] for c in checks])
    print(f"Nelder–Mead cross-check ({len(checks)} cases): max(η_NM − η_SLSQP) = {d.max():+.2e}, min = {d.min():+.2e}")


if __name__ == "__main__":
    main()
