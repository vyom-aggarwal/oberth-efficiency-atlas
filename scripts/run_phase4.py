"""Phase 4: finite-burn re-analysis of the Hibberd et al. (2026) solar Oberth manoeuvre → results/phase4.parquet.

Runs (all prograde; equivalent-Δv metric of `staged.py`):
- reference: the two-stage CASTOR 30B + STAR 48B burn at 3.2 R☉ (configs/phase4/hibberd_som.yaml),
  placed time-centred, with its Δv centroid at perihelion, and at the optimal timing. Also rerun at
  rtol = atol = 1e-13 as a convergence check.
- sensitivity: staging coast (10, 60 s); arrival orbit (aphelion 1 au, 30 au, parabolic, v∞ = 5 km/s);
  two-level thrust profiles per motor (regressive/progressive: catalog maximum thrust for half the
  burn, the complement for the other half, same burn time and impulse).
- sweep: both motors' thrust scaled by f (burn times × 1/f) from 1 down to 1e-4 → where the loss
  passes 0.1% and 1% of Δv.
- single: one constant-thrust stage with the same Δv at the same geometry, for nuclear thermal
  (Isp 850 s) and SEP (Isp 6000 s) exhaust velocities, over Π.
- ntp: nuclear-thermal corners (Isp 800/900 s × a0 0.1/3 m/s²) at the SOM geometry.
- sep: Maraqten et al. (2026) perihelion arc at its own geometry (0.308 au, 75.0 km/s): constant
  thrust 49.8 N for the bracketing start masses, and the 0.25-yr arc duration.
Run:  .venv/Scripts/python scripts/run_phase4.py [--workers N]
"""

from __future__ import annotations

import argparse
import math
import os
import sys
import time
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import numpy as np
import yaml

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from oberth_atlas.constants import AU, G0, GM_SUN, JUPITER, KM, LBF, SUN  # noqa: E402
from oberth_atlas.simulate import Numerics  # noqa: E402
from oberth_atlas.staged import (StageND, StageSI, centroid_offset, optimal_offset, schedule,  # noqa: E402
                                 simulate_staged_nd, stack_mass, stages_to_nd)
from oberth_atlas.sweep import _metadata, _write_parquet  # noqa: E402
from oberth_atlas.units import Scales  # noqa: E402

CFG = yaml.safe_load((ROOT / "configs" / "phase4" / "hibberd_som.yaml").read_text(encoding="utf-8"))
YEAR = 365.25 * 86400.0          # Julian year, s
R_P = CFG["som"]["r_p_over_R_sun"] * SUN.radius_eq


def v_p_bound(r_a: float, r_p: float = R_P, mu: float = GM_SUN) -> float:
    """Perihelion speed (m/s) of the ellipse with aphelion r_a and perihelion r_p (vis-viva)."""
    return math.sqrt(2.0 * mu * r_a / (r_p * (r_a + r_p)))


def stages_si(coast_s: float = CFG["staging_coast_s"]) -> list[StageSI]:
    st = CFG["stages"]
    return [StageSI(s["name"], s["total_kg"], s["dry_kg"], s["exhaust_velocity_km_s"] * KM, s["burn_time_s"],
                    coast_after=coast_s if i < len(st) - 1 else 0.0) for i, s in enumerate(st)]


def two_level(nd: list[StageND], regressive: bool) -> list[StageND]:
    """Split each motor into two equal-duration halves at T_max and 2T̄ − T_max (same impulse and burn time)."""
    out = []
    for s, raw in zip(nd, CFG["stages"]):
        ratio = raw["max_thrust_lbf"] / raw["avg_thrust_lbf"]
        hi, lo = ratio * s.thrust, (2.0 - ratio) * s.thrust
        t1, t2 = (hi, lo) if regressive else (lo, hi)
        half = 0.5 * s.burn_time
        out.append(StageND(thrust=t1, c=s.c, m_prop=t1 * half / s.c))
        out.append(StageND(thrust=t2, c=s.c, m_prop=s.m_prop - t1 * half / s.c, m_drop=s.m_drop,
                           coast_after=s.coast_after))
    return out


def scaled(nd: list[StageND], f: float) -> list[StageND]:
    return [StageND(thrust=s.thrust * f, c=s.c, m_prop=s.m_prop, m_drop=s.m_drop, coast_after=s.coast_after) for s in nd]


def single_stage(dv: float, c: float, Pi: float, v_p: float) -> list[StageND]:
    m_prop = -math.expm1(-dv / c)
    return [StageND(thrust=m_prop * c * v_p / Pi, c=c, m_prop=m_prop)]


def run(job) -> list[dict]:
    """job = (kind, label, params, v_p_nd, stages, scales_dict, placements, numerics)."""
    kind, label, params, v_p, stages, sc, placements, num = job
    scales = Scales(**sc)
    rows = []
    for placement in placements:
        t0 = time.perf_counter()
        try:
            if placement == "optimal":
                off, r = optimal_offset(v_p, stages, numerics=num)
            else:
                off = 0.0 if placement == "time_centred" else centroid_offset(stages)
                r = simulate_staged_nd(v_p, stages, midpoint_offset=off, numerics=num)
            V = scales.velocity
            v_inf_out = math.sqrt(2.0 * r.eps_out) * V if r.eps_out > 0 else math.nan
            e_imp = 0.5 * (v_p + r.dv_rocket) ** 2 - 1.0
            rows.append(dict(kind=kind, label=label, placement=placement, status="ok", error="", **params,
                             v_p_km_s=v_p * V / KM, r_p_m=scales.r_p, Pi=r.Pi, duration_s=r.duration * scales.time,
                             offset_s=off * scales.time, centroid_time_s=r.centroid_time * scales.time,
                             dv_rocket_m_s=r.dv_rocket * V, dv_loss_m_s=r.dv_loss * V, loss_rel=r.dv_loss_rel,
                             dv_loss_err_m_s=r.dv_loss_err * V, r_min_over_rp=r.r_min, impacted=r.impacted,
                             v_inf_out_km_s=v_inf_out / KM,
                             v_inf_out_imp_km_s=math.sqrt(2.0 * e_imp) * V / KM if e_imp > 0 else math.nan,
                             eps0=r.eps0, energy_balance=r.energy_balance, runtime_s=time.perf_counter() - t0))
        except Exception as exc:  # noqa: BLE001 (recorded, never dropped)
            rows.append(dict(kind=kind, label=label, placement=placement, status="error",
                             error=f"{type(exc).__name__}: {exc}", **params))
    return rows


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("--workers", type=int, default=os.cpu_count())
    a = ap.parse_args()
    PL3 = ("time_centred", "centroid", "optimal")
    num = Numerics()
    si = stages_si()
    m0 = stack_mass(si, CFG["payload_kg"])
    sc = dict(mu=GM_SUN, r_p=R_P, m0=m0)
    S = Scales(**sc)
    vp_ref = v_p_bound(JUPITER.sma) / S.velocity
    nd = stages_to_nd(si, CFG["payload_kg"], GM_SUN, R_P)
    jobs = [("reference", "Hibberd CASTOR 30B + STAR 48B", {}, vp_ref, nd, sc, PL3, num),
            ("reference", "Hibberd, rtol 1e-13", {"rtol": 1e-13}, vp_ref, nd, sc, PL3,
             Numerics(rtol=1e-13, atol=1e-13))]
    for coast in (10.0, 60.0):
        jobs.append(("sensitivity", f"staging coast {coast:g} s", {"coast_s": coast}, vp_ref,
                     stages_to_nd(stages_si(coast), CFG["payload_kg"], GM_SUN, R_P), sc, PL3, num))
    for name, vp in (("aphelion 1 au", v_p_bound(AU)), ("aphelion 30 au", v_p_bound(30 * AU)),
                     ("parabolic arrival", math.sqrt(2 * GM_SUN / R_P)),
                     ("hyperbolic v∞ = 5 km/s", math.sqrt((5 * KM) ** 2 + 2 * GM_SUN / R_P))):
        jobs.append(("sensitivity", name, {}, vp / S.velocity, nd, sc, PL3, num))
    for reg in (True, False):
        jobs.append(("sensitivity", f"two-level thrust, {'regressive' if reg else 'progressive'}", {}, vp_ref,
                     two_level(nd, reg), sc, PL3, num))
    for f in np.logspace(0.0, -4.0, 41):
        jobs.append(("sweep", f"f = {f:.4g}", {"f": float(f)}, vp_ref, scaled(nd, float(f)), sc, PL3, num))
    dv_nd = sum(st.dv for st in schedule(nd)[0])
    for tag, isp in (("single, nuclear thermal Isp 850 s", 850.0), ("single, SEP Isp 6000 s", 6000.0)):
        c = isp * G0 / S.velocity
        for Pi in np.logspace(-2, 2.5, 28):
            jobs.append(("single", tag, {"isp_s": isp, "Pi_target": float(Pi)}, vp_ref,
                         single_stage(dv_nd, c, float(Pi), vp_ref), sc, ("time_centred", "optimal"), num))
    ntp = CFG["nuclear_thermal"]
    for isp in ntp["isp_s"]:
        for a0 in ntp["a0_m_s2"]:
            c = isp * G0 / S.velocity
            lam = dv_nd / c
            t_b = (isp * G0 / a0) * -math.expm1(-lam)              # s
            Pi = t_b / S.time * vp_ref
            jobs.append(("ntp", f"NTP Isp {isp:g} s, a0 {a0:g} m/s²", {"isp_s": isp, "a0_m_s2": a0}, vp_ref,
                         single_stage(dv_nd, c, Pi, vp_ref), sc, ("time_centred", "optimal"), num))
    sep = CFG["sep_maraqten2026"]
    r_sep = sep["r_p_au"] * AU
    S_sep = Scales(GM_SUN, r_sep, 1.0)
    vp_sep = sep["v_p_km_s"] * KM / S_sep.velocity
    c_sep = sep["isp_s"] * G0
    dv_sep = sep["delta_v_arc_km_s"] * KM
    frac = -math.expm1(-dv_sep / c_sep)
    m_hi = sep["launch_mass_kg"]                                   # nothing spent before the arc
    m_lo = (sep["launch_mass_kg"] - sep["propellant_kg"]) / (1.0 - frac)   # everything else spent before
    for tag, t_b in ((f"SEP constant 49.8 N, start mass {m_hi:.0f} kg", m_hi * frac * c_sep / sep["thrust_N"]),
                     (f"SEP constant 49.8 N, start mass {m_lo:.0f} kg", m_lo * frac * c_sep / sep["thrust_N"]),
                     ("SEP arc duration 0.25 yr", sep["arc_duration_yr"] * YEAR)):
        Pi = t_b / S_sep.time * vp_sep
        jobs.append(("sep", tag, {"t_b_s": t_b}, vp_sep, single_stage(dv_sep / S_sep.velocity, c_sep / S_sep.velocity,
                                                                   Pi, vp_sep),
                     dict(mu=GM_SUN, r_p=r_sep, m0=1.0), ("time_centred", "optimal"), num))
    jobs.sort(key=lambda j: j[0] != "sweep")                       # long sweep jobs first
    print(f"phase 4: {len(jobs)} jobs on {a.workers} workers; stack m0 = {m0:.1f} kg, "
          f"ΔV = {dv_nd * S.velocity:.2f} m/s, v_p = {vp_ref * S.velocity / KM:.3f} km/s", flush=True)
    for s, raw in zip(si, CFG["stages"]):                         # constant thrust vs the catalog average
        print(f"  {s.name}: m_prop·c/t_b = {s.thrust / 1e3:.2f} kN, catalog average "
              f"{raw['avg_thrust_lbf'] * LBF / 1e3:.2f} kN ({s.thrust / (raw['avg_thrust_lbf'] * LBF) - 1:+.2%})", flush=True)
    rows, t0 = [], time.perf_counter()
    with ProcessPoolExecutor(max_workers=a.workers) as ex:
        for i, r in enumerate(ex.map(run, jobs, chunksize=1), 1):
            rows.extend(r)
            if i % 10 == 0 or i == len(jobs):
                print(f"  {i}/{len(jobs)} ({time.perf_counter() - t0:.0f} s)", flush=True)
    spec = {"config": "configs/phase4/hibberd_som.yaml", "m0_kg": m0, "r_p_m": R_P}
    df = _write_parquet(rows, ROOT / "results" / "phase4.parquet", _metadata("phase4_hibberd", spec))
    print(f"wrote results/phase4.parquet: {len(df)} rows, {int((df['status'] != 'ok').sum())} errors", flush=True)


if __name__ == "__main__":
    main()
