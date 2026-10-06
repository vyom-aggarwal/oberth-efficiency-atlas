"""Check the practical rule loss/Δv ≲ Π²/96 (prograde flyby burns) against the Phase 2 sweep and Phase 4.

The loss is the equivalent-Δv penalty: hyperbolic sweep runs use Δv_eq = sqrt(v∞,out² + 2) − v_p
(nondimensional), and Phase 4 stores it directly. R = (loss/Δv)/Π² is compared with
- the rule, 1/96;
- the closed-form leading-order bound over the arrival conic, theory.prograde_loss_bound(r, λ),
  with r = Δv/v_p (k ≤ ½ for the hyperbolic sweep, k ≤ 1 for Phase 4's bound arrivals).
Writes figures/rule_numbers.json and figures/rule_check.png.
Run:  .venv/Scripts/python scripts/rule_check.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from matplotlib.collections import PathCollection
from matplotlib.lines import Line2D

from oberth_atlas import theory
from oberth_atlas.plotting import BLUE_RAMP, INK, INK_2, MUTED, SERIES, apply_style, plt, save_figure

ROOT = Path(__file__).resolve().parents[1]
R_BINS = [0.0, 0.01, 0.03, 0.1, 0.3, 1.0, 3.0]
LAM_BINS = [0.0, 0.1, 0.3, 1.0, 3.0]


def sweep_ratios() -> pd.DataFrame:
    d = pd.read_parquet(ROOT / "results" / "sweep_nd.parquet")
    d = d[(d["status"] == "ok") & (d["steering"] == "prograde") & ~d["hit_floor"] & ~d["captured"]].copy()
    dv_eq = np.sqrt(d["v_inf_out"] ** 2 + 2.0) - d["v_p"]
    d["loss_rel"] = 1.0 - dv_eq / d["dv"]
    d["loss_rel_err"] = d["energy_balance_residual"] / ((d["v_p"] + d["dv"]) * d["dv"])
    d["R"] = d["loss_rel"] / d["Pi"] ** 2
    # Keep runs whose loss is resolved to 1% by the per-run energy-balance error estimate.
    d = d[(d["loss_rel"] > 0) & (d["loss_rel_err"] < 1e-2 * d["loss_rel"])].copy()
    bounds = {}
    d["bound"] = [bounds.setdefault((round(r, 12), round(l, 12)), theory.prograde_loss_bound(r, l, k_max=0.5))
                  for r, l in zip(d["dv_over_vp"], d["dv_over_c"])]
    return d


def phase4_ratios() -> pd.DataFrame:
    p = pd.read_parquet(ROOT / "results" / "phase4.parquet")
    p = p[(p["status"] == "ok") & (p["kind"].isin(["sweep", "single", "reference", "ntp"]))
          & (p["placement"] == "time_centred")].copy()
    p["R"] = p["loss_rel"] / p["Pi"] ** 2                          # loss_rel is already dimensionless
    p["r"] = p["dv_rocket_m_s"] / (p["v_p_km_s"] * 1e3)            # Δv/v_p (rocket Δv over arrival speed)
    p["bound"] = [theory.prograde_loss_bound(r, 0.0, k_max=1.0) for r in p["r"]]
    return p


def summarize(d: pd.DataFrame, pi_max: float) -> dict:
    g = d[d["Pi"] <= pi_max]
    out = {"n": int(len(g)), "max_96R": float(96 * g["R"].max()), "max_R_over_bound": float((g["R"] / g["bound"]).max())}
    gb = g.assign(rb=pd.cut(g["dv_over_vp"], R_BINS), lb=pd.cut(g["dv_over_c"], LAM_BINS))
    out["max_96R_by_dv_over_vp"] = {str(k): float(96 * v) for k, v in gb.groupby("rb", observed=True)["R"].max().items()}
    out["bound_96_at_bin_upper_edge_lam0_hyperbolic"] = {
        str(iv): 96 * theory.prograde_loss_bound(iv.right, 0.0, k_max=0.5) for iv in gb["rb"].cat.categories}
    tab = gb.pivot_table(index="rb", columns="lb", values="R", aggfunc="max", observed=True) * 96
    out["max_96R_by_dv_over_vp_and_lam"] = {str(i): {str(j): float(v) for j, v in row.items() if np.isfinite(v)}
                                             for i, row in tab.iterrows()}
    out["max_R_over_bound_by_Pi"] = {f"Pi<={x:g}": float((g[g["Pi"] <= x]["R"] / g[g["Pi"] <= x]["bound"]).max())
                                     for x in (0.1, 0.3, 1.0) if (g["Pi"] <= x).any()}
    return out


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    d = sweep_ratios()
    p = phase4_ratios()
    out = {
        "rule": "loss/Δv at most ≈ Π²/96 (prograde, time-centred): a leading-order bound, holds within 1% for Π ≤ 1",
        "bound_closed_form_lam0": "(1 + r)/(96(1 − r)) for any conic (k ≤ 1); (1 + 3r)/(96(1 + r)) for k ≤ ½; r = Δv/v_p",
        "bound_96_examples": {f"r={r:g}": {"any_conic": 96 * theory.prograde_loss_bound(r),
                                           "hyperbolic": 96 * theory.prograde_loss_bound(r, k_max=0.5),
                                           "any_conic_lam1": 96 * theory.prograde_loss_bound(r, 1.0),
                                           "any_conic_lam3": 96 * theory.prograde_loss_bound(r, 3.0)}
                              for r in (0.0, 0.01, 0.03, 0.1, 0.3)},
        "sweep_prograde_Pi_le_1": summarize(d, 1.0),
        "phase4_time_centred_Pi_le_1": {
            "n": int((p["Pi"] <= 1).sum()),
            "max_96R": float(96 * p[p["Pi"] <= 1]["R"].max()),
            "max_R_over_bound_lam0": float((p[p["Pi"] <= 1]["R"] / p[p["Pi"] <= 1]["bound"]).max()),
            "dv_over_vp_range": [float(p["r"].min()), float(p["r"].max())],
            "by_kind_max_96R": {k: float(96 * g[g["Pi"] <= 1]["R"].max()) for k, g in p.groupby("kind") if (g["Pi"] <= 1).any()},
        },
    }
    (ROOT / "figures" / "rule_numbers.json").write_text(json.dumps(out, indent=1, ensure_ascii=False), encoding="utf-8")
    print(json.dumps(out, indent=1, ensure_ascii=False))

    apply_style()
    fig, axes = plt.subplots(1, 2, figsize=(13, 4.8), layout="constrained")
    ax = axes[0]
    g = d[d["Pi"] <= 3.0]
    cols = BLUE_RAMP[1:]
    for (lo, hi), col in zip(zip(R_BINS[:-1], R_BINS[1:]), cols):
        s = g[(g["dv_over_vp"] > lo) & (g["dv_over_vp"] <= hi)]
        ax.scatter(s["Pi"], 96 * s["R"], s=3, color=col, alpha=0.5, linewidth=0, label=f"{lo:g} < Δv/v_p ≤ {hi:g}")
    q = p.sort_values("Pi")
    for kind, mk, col in (("sweep", "-", SERIES[0]), ("reference", "*", SERIES[0])):
        s = q[q["kind"] == kind]
        if kind == "sweep":
            ax.plot(s["Pi"], 96 * s["R"], color=col, linewidth=1.6, label="Phase 4: Hibberd stack, thrust scaled (bound arrival)")
        else:
            ax.plot(s["Pi"], 96 * s["R"], mk, color=col, markersize=11, markeredgecolor="#fcfcfb", label="Hibberd reference SOM")
    ax.axhline(1.0, color=INK, linewidth=1.1, linestyle=(0, (4, 2)), label="rule: loss/Δv = Π²/96")
    ax.axvline(1.0, color=MUTED, linewidth=0.8)
    ax.set_xscale("log")
    ax.set_xlim(1e-2, 3)
    ax.set_ylim(0, 2.2)
    ax.set_xlabel("Π = t_b/τ")
    ax.set_ylabel("96 · (loss/Δv)/Π²")
    ax.set_title("(a) Prograde loss in units of the rule (Phase 2 sweep, hyperbolic; Phase 4, bound)", fontsize=9.5)
    handles, labels = ax.get_legend_handles_labels()
    proxies = [Line2D([], [], marker="o", linestyle="", color=h.get_facecolor()[0], markersize=5)
               if isinstance(h, PathCollection) else h for h in handles]
    ax.legend(proxies, labels, fontsize=7, loc="upper left", bbox_to_anchor=(0, -0.13), ncol=3, frameon=False)
    ax = axes[1]
    rr = np.linspace(0, 0.9, 200)
    for lam, col, ls in ((0.0, INK, "-"), (1.0, INK_2, (0, (4, 2))), (3.0, MUTED, (0, (1.2, 1.6)))):
        ax.plot(rr, [96 * theory.prograde_loss_bound(r, lam) for r in rr], color=col, linestyle=ls, linewidth=1.4,
                label=f"bound, any conic, Δv/c = {lam:g}")
    ax.plot(rr, [96 * theory.prograde_loss_bound(r, 0.0, k_max=0.5) for r in rr], color=SERIES[1], linewidth=1.2,
            label="bound, hyperbolic/parabolic only, Δv/c = 0")
    gb = d[d["Pi"] <= 1.0]
    ax.scatter(gb["dv_over_vp"], 96 * gb["R"], s=2, color=SERIES[0], alpha=0.25, linewidth=0, label="sweep runs, Π ≤ 1")
    ax.set_xlabel("Δv/v_p")
    ax.set_ylabel("96 · (loss/Δv)/Π²")
    ax.set_xlim(0, 0.9)
    ax.set_ylim(0, 4)
    ax.set_title("(b) Closed-form bound over the arrival conic (leading order in Π)", fontsize=9.5)
    handles, labels = ax.get_legend_handles_labels()
    proxies = [Line2D([], [], marker="o", linestyle="", color=SERIES[0], markersize=5)
               if isinstance(h, PathCollection) else h for h in handles]
    ax.legend(proxies, labels, fontsize=7, loc="upper left", bbox_to_anchor=(0, -0.13), ncol=2, frameon=False)
    fig.suptitle("Practical rule: loss/Δv ≈ Π²/96 at most, a leading-order bound that holds within 1% for Π ≤ 1 "
                 "(attained as Δv/v_p → 0 at near-parabolic arrival; grows as (1 + r)/(1 − r), r = Δv/v_p, and with the "
                 "mass ratio)", fontsize=9.5, x=0.01, ha="left")
    save_figure(fig, ROOT / "figures" / "rule_check.png", "scripts/rule_check.py")
    plt.close(fig)


if __name__ == "__main__":
    main()
