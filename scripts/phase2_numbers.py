"""Every headline number quoted for Phase 2, computed from the sweep and the mission samples.

Writes figures/phase2_numbers.json and prints a readable summary.
Run:  .venv/Scripts/python scripts/phase2_numbers.py [results/sweep_nd.parquet] [results/missions.parquet]
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

from oberth_atlas.analysis import binned_scatter, explained_fraction, load, reliable

ROOT = Path(__file__).resolve().parents[1]


def q(x, ps=(50, 90, 99, 100)):
    x = np.asarray(x, float)
    x = x[np.isfinite(x)]
    return {f"p{p}": float(np.percentile(x, p)) for p in ps} if x.size else {}


def main(sweep_path: str, missions_path: str) -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    df = load(sweep_path)
    ok = reliable(df)
    out: dict = {"sweep": {}, "theory": {}, "collapse": {}, "regimes": {}, "inertial": {}, "missions": {}}
    s = out["sweep"]
    s["rows"] = int(len(df))
    s["errors"] = int((df["status"] != "ok").sum())
    s["reliable"] = int(ok.sum())
    for flag in ("hit_floor", "captured", "b_imp_small", "eta_unreliable"):
        s[flag] = {law: int(g[flag].sum()) for law, g in df.groupby("steering")}
    s["energy_drift_max_over_vp2"] = q(df["energy_drift_max"])
    s["frac_drift_above_1e-11"] = float((df["energy_drift_max"] > 1e-11).mean())
    s["energy_balance_residual"] = q(df["energy_balance_residual"])
    s["eta_err"] = q(df.loc[ok, "eta_err"])
    s["runtime_s"] = {"mean": float(df["runtime_s"].mean()), "max": float(df["runtime_s"].max()),
                      "total_cpu_h": float(df["runtime_s"].sum() / 3600)}

    # Small-Π prefactor across the whole sweep
    t = out["theory"]
    for law, g in df[ok & (df["Pi"] < 0.01)].groupby("steering"):
        g = g[(1 - g["eta"]) > 1e3 * g["eta_err"]]
        r_th = (1 - g["eta"]) / (g["C_theory"] * g["Pi"] ** 2)
        r_us = (1 - g["eta"]) / (g["C_user"] * g["Pi"] ** 2)
        t[f"{law}_ratio_theory_Pi<0.01"] = {"n": int(len(g)), **q(np.abs(r_th - 1))}
        t[f"{law}_ratio_user_Pi<0.01"] = {"median": float(np.median(r_us)), "min": float(r_us.min()),
                                          "max": float(r_us.max())}
    # Validity range of the leading-order theory in Π: |(1−η)/(CΠ²) − 1| by Π band (prograde)
    pro = df[ok & (df["steering"] == "prograde")]
    for lo, hi in ((0.01, 0.1), (0.1, 0.3), (0.3, 1.0), (1.0, 3.0)):
        g = pro[(pro["Pi"] >= lo) & (pro["Pi"] < hi)]
        t[f"prograde_leading_order_error_Pi_{lo}-{hi}"] = q(np.abs((1 - g["eta"]) / (g["C_theory"] * g["Pi"] ** 2) - 1))
    # Linear-response theory (mapped through ξ) vs data, by Δv/v_p band and Π band (prograde)
    for dlo, dhi in ((0, 0.01), (0.01, 0.1), (0.1, 0.3), (0.3, 10)):
        for plo, phi in ((0, 1), (1, 100), (100, np.inf)):
            g = pro[(pro["dv_over_vp"] >= dlo) & (pro["dv_over_vp"] < dhi) & (pro["Pi"] >= plo) & (pro["Pi"] < phi)]
            t[f"prograde_|eta-eta_lin|_dv/vp_{dlo}-{dhi}_Pi_{plo}-{phi}"] = {"n": int(len(g)), **q(np.abs(g["eta"] - g["eta_lin"]))}

    # Collapse
    c = out["collapse"]
    for law, g in df[ok].groupby("steering"):
        sm = g[(g["Pi"] < 0.5) & ((1 - g["eta"]) > 1e3 * g["eta_err"])]
        y = np.log10(1 - sm["eta"])
        c[f"{law}_smallPi_log(1-eta)_rms_dex"] = {"Pi": binned_scatter(sm["Pi"], y)["rms"],
                                                   "Pi_sqrtC": binned_scatter(sm["Pi_sqrtC"], y)["rms"],
                                                   "Pi_sqrtC_user": binned_scatter(sm["Pi_sqrtC_user"], y)["rms"],
                                                   "n": int(len(sm))}
        res = g["eta"] - g["eta_lin"]
        c[f"{law}_full_eta_rms"] = {"x=Pi": binned_scatter(g["Pi"], g["eta"])["rms"],
                                    "x=Pi_sqrtC": binned_scatter(g["Pi_sqrtC"], g["eta"])["rms"],
                                    "eta-eta_lin, x=Pi": binned_scatter(g["Pi"], res)["rms"]}
        for cand in ("v_inf_over_vesc", "dv_over_vp", "xi", "dv_over_c"):
            for name, sel in (("Pi<1", g["Pi"] < 1), ("1<=Pi<100", (g["Pi"] >= 1) & (g["Pi"] < 100)),
                              ("Pi>=100", g["Pi"] >= 100)):
                gg = g[sel]
                c.setdefault(f"{law}_explained_given_Pi", {}).setdefault(name, {})[cand] = \
                    explained_fraction(gg["Pi"], gg["eta"], gg[cand])

    # Regimes: half-efficiency point and regime-II plateau scatter (prograde, Δv/v_p < 0.03)
    r = out["regimes"]
    hp = pd.read_csv(ROOT / "figures" / "regimes_half_point.csv")
    hp = hp[np.isfinite(hp["Pi_half_data"])]
    r["Pi_half_data"] = q(hp["Pi_half_data"], (0, 10, 50, 90, 100))
    r["Pi_half_rel_diff_vs_theory"] = q(np.abs(hp["Pi_half_data"] / hp["Pi_half_theory"] - 1))
    lin = pro[pro["dv_over_vp"] < 0.03]
    plateau = lin[(lin["Pi"] > 30) & (lin["Pi"] < 0.03 * lin["Pi_T"])]
    r["regimeII_plateau_eta_W_x_(Pi/4.5)^(1/3)"] = {"n": int(len(plateau)),
                                                    **q(plateau["eta_W"] * (plateau["Pi"] / 4.5) ** (1 / 3), (1, 10, 50, 90, 99))}

    # Inertial steering: impacts (reference altitudes) and negative η by Π band
    ine = df[(df["steering"] == "inertial") & (df["status"] == "ok")]
    for R_over_rp, name in ((1 / 1.1, "h=0.1R"), (0.5, "h=1R")):
        imp = ine["hit_floor"] | (ine["r_min"] < R_over_rp)
        out["inertial"][f"impact_fraction_{name}"] = {
            band: float(imp[(ine["Pi"] >= lo) & (ine["Pi"] < hi)].mean())
            for band, lo, hi in (("Pi<1", 0, 1), ("1-10", 1, 10), ("10-1e3", 10, 1e3), ("1e3-1e5", 1e3, 1e5), (">=1e5", 1e5, np.inf))}
    oki = reliable(ine)
    out["inertial"]["frac_eta_negative"] = {band: float((ine.loc[oki & (ine["Pi"] >= lo) & (ine["Pi"] < hi), "eta"] < 0).mean())
                                            for band, lo, hi in (("Pi<10", 0, 10), ("10-1e3", 10, 1e3), (">=1e3", 1e3, np.inf))}
    out["inertial"]["eta_min"] = float(ine.loc[oki, "eta"].min())

    # Missions
    m = pd.read_parquet(missions_path)
    out["missions"]["rows"] = int(len(m))
    out["missions"]["errors"] = int((m["status"] != "ok").sum())
    tab = pd.read_csv(ROOT / "figures" / "mission_table.csv")
    out["missions"]["table"] = tab.to_dict(orient="records")

    (ROOT / "figures" / "phase2_numbers.json").write_text(json.dumps(out, indent=1, default=float), encoding="utf-8")
    print(json.dumps({k: v for k, v in out.items() if k != "missions"}, indent=1, default=float))


if __name__ == "__main__":
    a = sys.argv[1:] + [None, None]
    main(a[0] or str(ROOT / "results" / "sweep_nd.parquet"), a[1] or str(ROOT / "results" / "missions.parquet"))
