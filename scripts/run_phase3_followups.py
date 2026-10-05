"""Phase 3 follow-ups (user review, 2026-10-05).

Parts (default: all):
- rules:    η of the centroid rule (δ* = ½ − x̄) and the half-Δv rule (δ = ½ − x_med) on the 150
            Phase 3 grid cases → results/opt_phase3_rules.parquet.
- pitch:    6-knot piecewise-linear pitch + timing on the 15 hardest cases (Δv/c = 3, Δv/v_p = 0.3,
            Π ≥ 10, r_min ≥ r_p), started from the linear optimum → results/opt_phase3_piecewise.parquet.
- missions: every valid prograde Phase 2 mission sample (no impact, burn starting inside the SOI):
            timing-only optimum, the centroid and half-Δv rules, and the SOI ratio at the optimal
            timing. Pitch + timing on a stratified subsample (≤ 6 per body × engine, spread in Π)
            → results/opt_missions.parquet.
Run:  .venv/Scripts/python scripts/run_phase3_followups.py [--part rules|pitch|missions] [--workers N]
"""

from __future__ import annotations

import argparse
import json
import math
import os
import sys
import time
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from oberth_atlas.constants import get_body  # noqa: E402
from oberth_atlas.optimize import (OptCase, _Evaluator, optimize_case, optimize_piecewise,  # noqa: E402
                                   timing_half_dv_delta, timing_theory_delta)
from oberth_atlas.simulate import Numerics, simulate_nd  # noqa: E402
from oberth_atlas.steering import Prograde  # noqa: E402
from oberth_atlas.sweep import _metadata, _write_parquet  # noqa: E402

N_FULL_PER_COMBO = 6


def _pmap(func, jobs, workers, label):
    rows, t0 = [], time.perf_counter()
    with ProcessPoolExecutor(max_workers=workers) as ex:
        for i, row in enumerate(ex.map(func, jobs, chunksize=1), 1):
            rows.append(row)
            if i % max(1, len(jobs) // 20) == 0 or i == len(jobs):
                print(f"  {label}: {i}/{len(jobs)} ({time.perf_counter() - t0:.0f} s)", flush=True)
    return rows


# ---------------------------------------------------------------- rules on the Phase 3 grid

def rules_one(key) -> dict:
    Pi, vr, dvr, lam = key
    case = OptCase.from_targets(vr, dvr, lam, Pi)
    ev = _Evaluator(case, Numerics())
    out = dict(Pi=Pi, v_inf_over_vesc=vr, dv_over_vp=dvr, dv_over_c=lam)
    for name, d in (("centroid", timing_theory_delta(lam)), ("half_dv", timing_half_dv_delta(lam))):
        e = ev(0.0, 0.0, d)
        out.update({f"delta_{name}": d, f"eta_{name}": e.eta, f"r_min_{name}": e.r_min, f"eta_err_{name}": e.eta_err})
    return out


def part_rules(workers):
    grid = pd.read_parquet(ROOT / "results" / "opt_phase3.parquet")
    keys = sorted({(r.case_Pi, r.case_v_inf_over_vesc, r.case_dv_over_vp, r.case_dv_over_c)
                   for r in grid.itertuples()})
    keys = [tuple(round(float(v), 6) for v in k) for k in keys]
    rows = _pmap(rules_one, keys, workers, "rules")
    _write_parquet(rows, ROOT / "results" / "opt_phase3_rules.parquet",
                   _metadata("phase3_rules", {"cases": "Phase 3 grid", "rules": ["centroid", "half_dv"]}))


# ---------------------------------------------------------------- piecewise pitch check

def pitch_one(row) -> dict:
    case = OptCase(row["case_v_inf"], row["case_dv"], row["case_c"], row["case_a0"], 1.0)
    t0 = time.perf_counter()
    pw = optimize_piecewise(case, n_knots=6, linear=(row["alpha0"], row["alpha1"], row["delta"]))
    return dict(Pi=round(row["case_Pi"], 6), v_inf_over_vesc=round(row["case_v_inf_over_vesc"], 6),
                dv_over_vp=round(row["case_dv_over_vp"], 6), dv_over_c=round(row["case_dv_over_c"], 6),
                eta_linear=row["eta_fixed"], eta_piecewise=pw.eta_fixed, gain_pp=100 * (pw.eta_fixed - row["eta_fixed"]),
                eta_achieved_linear=row["eta_achieved"], eta_achieved_piecewise=pw.eta_achieved,
                r_min_linear=row["r_min"], r_min_piecewise=pw.r_min, delta_linear=row["delta"], delta_piecewise=pw.delta,
                knots_deg=json.dumps([math.degrees(k) for k in pw.knots]), eta_err=pw.eta_err, n_sims=pw.n_sims,
                starts=json.dumps(pw.starts), runtime_s=time.perf_counter() - t0)


def part_pitch(workers):
    d = pd.read_parquet(ROOT / "results" / "opt_phase3.parquet")
    sel = d[(d["mode"] == "full") & (d["rho"] == 1.0) & (d["case_dv_over_c"].round(6) == 3.0)
            & (d["case_dv_over_vp"].round(6) == 0.3) & (d["case_Pi"].round(6) >= 10.0)]
    jobs = [r._asdict() for r in sel.itertuples(index=False)]
    jobs.sort(key=lambda r: -r["case_Pi"])
    rows = _pmap(pitch_one, jobs, workers, "piecewise")
    _write_parquet(rows, ROOT / "results" / "opt_phase3_piecewise.parquet",
                   _metadata("phase3_piecewise", {"n_knots": 6, "cases": "dv/c=3, dv/vp=0.3, Pi>=10, rho=1"}))


# ---------------------------------------------------------------- mission mapping

def mission_one(row) -> dict:
    case = OptCase(row["nd_v_inf"], row["nd_dv"], row["nd_c"], row["nd_a0"], 1.0)
    lam = row["nd_dv"] / row["nd_c"]
    out = {k: row[k] for k in ("body", "engine", "sample", "Pi", "v_inf_over_vesc", "dv_over_vp", "dv_over_c",
                                "eta", "r_p")}
    out["eta_phase2"] = out.pop("eta")
    t0 = time.perf_counter()
    try:
        t = optimize_case(case, "timing", reference_inertial=False)
        ev = _Evaluator(case, Numerics())
        e_c, e_h = ev(0.0, 0.0, timing_theory_delta(lam)), ev(0.0, 0.0, timing_half_dv_delta(lam))
        body = get_body(row["body_name"])
        r_soi = body.soi_radius
        res = simulate_nd(case.v_inf, case.dv, case.c, case.a0, Prograde(), midpoint_offset=t.delta * case.t_b)
        out.update(status="ok", error="", eta_centered=t.eta_centered, eta_timing=t.eta_fixed, delta_timing=t.delta,
                   r_min_timing=t.r_min, feasible_timing=t.feasible, eta_err=t.eta_err,
                   eta_centroid=e_c.eta, eta_half_dv=e_h.eta,
                   soi_ratio_start_timing=res.r_burn_start * row["r_p"] / r_soi if math.isfinite(r_soi) else 0.0)
        if row["full"]:
            f = optimize_case(case, "full", reference_inertial=False)
            out.update(eta_full=f.eta_fixed, eta_full_achieved=f.eta_achieved, alpha0=f.alpha0, alpha1=f.alpha1,
                       delta_full=f.delta, r_min_full=f.r_min, feasible_full=f.feasible)
    except Exception as exc:  # noqa: BLE001 (recorded, never dropped)
        out.update(status="error", error=f"{type(exc).__name__}: {exc}")
    out["runtime_s"] = time.perf_counter() - t0
    return out


def part_missions(workers):
    m = pd.read_parquet(ROOT / "results" / "missions.parquet")
    m = m[(m["steering"] == "prograde") & (m["status"] == "ok")]
    valid = m[np.isfinite(m["eta"]) & ~m["flag_impact"] & (m["soi_ratio_burn_start"] <= 1.0)].copy()
    valid["body_name"] = valid["body"]               # preset keys are the body names (get_body is case-insensitive)
    valid["full"] = False
    for _, g in valid.groupby(["body", "engine"]):
        if len(g) < 5:
            continue
        order = g.sort_values("Pi").index
        pick = order[np.unique(np.linspace(0, len(order) - 1, N_FULL_PER_COMBO).round().astype(int))]
        valid.loc[pick, "full"] = True
    jobs = [r._asdict() for r in valid.itertuples(index=False)]
    jobs.sort(key=lambda r: (not r["full"], -r["Pi"]))            # long jobs first
    print(f"missions: {len(jobs)} valid samples, {int(valid['full'].sum())} with pitch + timing", flush=True)
    rows = _pmap(mission_one, jobs, workers, "missions")
    _write_parquet(rows, ROOT / "results" / "opt_missions.parquet",
                   _metadata("phase3_missions", {"source": "results/missions.parquet (prograde, valid)",
                                                 "full_per_combo": N_FULL_PER_COMBO, "rho": 1.0}))


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("--part", choices=("rules", "pitch", "missions", "all"), default="all")
    ap.add_argument("--workers", type=int, default=os.cpu_count())
    a = ap.parse_args()
    for name, fn in (("rules", part_rules), ("pitch", part_pitch), ("missions", part_missions)):
        if a.part in (name, "all"):
            t0 = time.perf_counter()
            fn(a.workers)
            print(f"{name}: done in {time.perf_counter() - t0:.0f} s", flush=True)


if __name__ == "__main__":
    main()
