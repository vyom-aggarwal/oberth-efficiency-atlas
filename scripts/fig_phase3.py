"""Phase 3 figures from results/opt_phase3.parquet.

- phase3_recoverable.png: recoverable efficiency Δη = η_opt − η_centered against Π, per
  v∞/v_esc. Solid: pitch + timing; dashed: timing only. Rows: Δv/v_p; columns: Δv/c. ρ = 1.
- phase3_timing.png: optimal burn-midpoint offset δ (units of t_b) against Π, with the small-Π
  theory δ* = ½ − x̄ (Δv centroid at periapsis).
- phase3_baselines.png: η against Π for prograde centered, timing-optimal and fully optimal
  (fixed-r_p baseline and achieved-periapsis baseline), and inertial centered (reference).
- phase3_pitch.png: optimal pitch parameters α₀, α₁ against Π.
Also prints the summary numbers quoted in RESEARCH_LOG.
Run:  .venv/Scripts/python scripts/fig_phase3.py [results/opt_phase3.parquet]
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd

from oberth_atlas.optimize import timing_theory_delta
from oberth_atlas.plotting import INK, INK_2, MUTED, SERIES, apply_style, plt, save_figure

ROOT = Path(__file__).resolve().parents[1]
FIVE = SERIES + ["#eda100", "#4a3aa7"]          # palette slots 1–5 (adjacent-pair validated)
MARK = ["o", "s", "^", "D", "v"]


def load(path):
    d = pd.read_parquet(path)
    d = d[d["status"] == "ok"].copy()
    for col in ("Pi", "v_inf_over_vesc", "dv_over_vp", "dv_over_c"):
        d[col] = d[f"case_{col}"].round(6)
    return d


def main(path: str) -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    d = load(path)
    vr_vals = sorted(d["v_inf_over_vesc"].unique())
    lam_vals = sorted(d["dv_over_c"].unique())
    dvr_vals = sorted(d["dv_over_vp"].unique())
    full = d[(d["mode"] == "full") & (d["rho"] == 1.0)]
    tim = d[d["mode"] == "timing"]
    apply_style()

    # ---- recoverable efficiency
    fig, axes = plt.subplots(len(dvr_vals), len(lam_vals), figsize=(14, 7.6), layout="constrained", sharex=True, sharey="row")
    for r, dvr in enumerate(dvr_vals):
        for c, lam in enumerate(lam_vals):
            ax = axes[r, c]
            for i, vr in enumerate(vr_vals):
                for frame, ls, lab in ((full, "-", ""), (tim, (0, (4, 2)), " (timing only)")):
                    g = frame[(frame["dv_over_vp"] == dvr) & (frame["dv_over_c"] == lam) & (frame["v_inf_over_vesc"] == vr)].sort_values("Pi")
                    ax.plot(g["Pi"], 100 * (g["eta_fixed"] - g["eta_centered"]), color=FIVE[i], linestyle=ls,
                            marker=MARK[i] if ls == "-" else None, markersize=4, markeredgecolor="#fcfcfb", linewidth=1.5,
                            label=f"v∞/v_esc = {vr:g}" if (ls == "-" and r == 0 and c == 0) else None)
            ax.set_xscale("log")
            ax.set_title(f"Δv/v_p = {dvr:g}, Δv/c = {lam:g}", fontsize=9.5)
            if r == len(dvr_vals) - 1:
                ax.set_xlabel("Π")
            if c == 0:
                ax.set_ylabel("recoverable Δη  [percentage points]")
    axes[0, 0].plot([], [], color=INK_2, linestyle=(0, (4, 2)), label="timing only")
    axes[0, 0].legend(fontsize=7.5, loc="upper left")
    fig.suptitle("Recoverable Oberth efficiency: optimal pitch law + timing vs centered prograde burn "
                 "(constraint r_min ≥ r_p; inward tilt known from Confraria 2020, Ferreira et al. 2022)",
                 fontsize=9.5, x=0.01, ha="left")
    save_figure(fig, ROOT / "figures" / "phase3_recoverable.png", "scripts/fig_phase3.py")
    plt.close(fig)

    # ---- optimal timing vs theory
    fig, axes = plt.subplots(1, len(lam_vals), figsize=(14, 4.2), layout="constrained", sharey=True)
    for ax, lam in zip(axes, lam_vals):
        for i, vr in enumerate(vr_vals):
            for dvr, ls in zip(dvr_vals, ("-", (0, (2, 2)))):
                g = tim[(tim["dv_over_c"] == lam) & (tim["v_inf_over_vesc"] == vr) & (tim["dv_over_vp"] == dvr)].sort_values("Pi")
                ax.plot(g["Pi"], g["delta"], color=FIVE[i], linestyle=ls, marker=MARK[i], markersize=4,
                        markeredgecolor="#fcfcfb", linewidth=1.4,
                        label=f"v∞/v_esc = {vr:g}" if (dvr == dvr_vals[0] and lam == lam_vals[0]) else None)
        ax.axhline(timing_theory_delta(lam), color=INK, linewidth=1.0, linestyle=(0, (5, 3)))
        ax.text(1.05, timing_theory_delta(lam) + 0.01, "small-Π theory ½ − x̄", fontsize=7.5, color=INK_2)
        ax.axhline(0, color=MUTED, linewidth=0.7)
        ax.set_xscale("log")
        ax.set_xlabel("Π")
        ax.set_title(f"Δv/c = {lam:g}", fontsize=9.5)
    axes[0].set_ylabel("optimal midpoint offset δ  [units of t_b]  (< 0: earlier)")
    axes[0].legend(fontsize=7.5, loc="lower left")
    fig.suptitle("Timing hypothesis: the optimal prograde burn starts earlier than centered "
                 "(solid Δv/v_p = 0.03, dotted 0.3; timing-only optimization)", fontsize=9.5, x=0.01, ha="left")
    save_figure(fig, ROOT / "figures" / "phase3_timing.png", "scripts/fig_phase3.py")
    plt.close(fig)

    # ---- baselines and reference curve
    show = [v for v in (0.03, 0.3, 3.0) if v in vr_vals]
    fig, axes = plt.subplots(1, len(show), figsize=(14, 4.3), layout="constrained", sharey=True)
    for ax, vr in zip(np.atleast_1d(axes), show):
        sel = lambda f: f[(f["v_inf_over_vesc"] == vr) & (f["dv_over_vp"] == dvr_vals[0]) & (f["dv_over_c"] == 1.0)].sort_values("Pi")
        gf, gt = sel(full), sel(tim)
        ax.plot(gf["Pi"], gf["eta_centered"], color=MUTED, linewidth=1.6, label="prograde, centered")
        ax.plot(gt["Pi"], gt["eta_fixed"], color=SERIES[2], linewidth=1.5, linestyle=(0, (4, 2)), label="timing-optimal")
        ax.plot(gf["Pi"], gf["eta_fixed"], color=SERIES[0], linewidth=1.8, marker="o", markersize=4,
                markeredgecolor="#fcfcfb", label="pitch + timing (fixed-r_p baseline)")
        ax.plot(gf["Pi"], gf["eta_achieved"], color=SERIES[0], linewidth=1.0, linestyle=(0, (1, 1.5)),
                label="pitch + timing (achieved-periapsis baseline)")
        ax.plot(gf["Pi"], gf["eta_inertial"], color=SERIES[1], linewidth=1.3, label="inertial, centered (reference)")
        ax.axhline(0, color=MUTED, linewidth=0.6)
        ax.set_xscale("log")
        ax.set_xlabel("Π")
        ax.set_title(f"v∞/v_esc = {vr:g}  (Δv/v_p = {dvr_vals[0]:g}, Δv/c = 1)", fontsize=9.5)
    np.atleast_1d(axes)[0].set_ylabel("η")
    np.atleast_1d(axes)[0].legend(fontsize=7.5, loc="lower left")
    fig.suptitle("Optimized η against both impulsive baselines, with the inertial reference curve (constraint r_min ≥ r_p)",
                 fontsize=9.5, x=0.01, ha="left")
    save_figure(fig, ROOT / "figures" / "phase3_baselines.png", "scripts/fig_phase3.py")
    plt.close(fig)

    # ---- optimal pitch parameters
    fig, axes = plt.subplots(1, 2, figsize=(11, 4.0), layout="constrained")
    for i, vr in enumerate(vr_vals):
        g = full[(full["v_inf_over_vesc"] == vr) & (full["dv_over_vp"] == dvr_vals[0]) & (full["dv_over_c"] == 1.0)].sort_values("Pi")
        for ax, col in zip(axes, ("alpha0", "alpha1")):
            ax.plot(g["Pi"], np.degrees(g[col]), color=FIVE[i], marker=MARK[i], markersize=4, markeredgecolor="#fcfcfb",
                    linewidth=1.4, label=f"v∞/v_esc = {vr:g}")
    for ax, lab in zip(axes, ("α₀ (mean pitch, + = toward planet)  [deg]", "α₁ (pitch change over burn)  [deg]")):
        ax.set_xscale("log")
        ax.axhline(0, color=MUTED, linewidth=0.6)
        ax.set_xlabel("Π")
        ax.set_ylabel(lab)
    axes[0].legend(fontsize=7.5)
    fig.suptitle("Optimal linear pitch law (Δv/v_p = 0.03, Δv/c = 1, r_min ≥ r_p)", fontsize=9.5, x=0.01, ha="left")
    save_figure(fig, ROOT / "figures" / "phase3_pitch.png", "scripts/fig_phase3.py")
    plt.close(fig)

    # ---- summary numbers
    print(f"rows {len(d)}; feasible full optima: {int(full['feasible'].sum())}/{len(full)}; "
          f"multi-start spread max {full['start_eta_spread'].max():.2e}")
    for name, frame in (("full ρ=1", full), ("timing", tim), ("full ρ=0.9", d[(d['mode'] == 'full') & (d['rho'] == 0.9)])):
        gain = 100 * (frame["eta_fixed"] - frame["eta_centered"])
        frac = (frame["eta_fixed"] - frame["eta_centered"]) / (1 - frame["eta_centered"])
        print(f"{name:11s} Δη [pp]: median {gain.median():.3f}, max {gain.max():.3f} | fraction of deficit recovered: "
              f"median {frac.median():.3f}, max {frac.max():.3f}")
    for Pi in sorted(full["Pi"].unique()):
        g = full[full["Pi"] == Pi]
        t = tim[tim["Pi"] == Pi]
        print(f"  Π={Pi:5g}: full Δη median {100 * (g.eta_fixed - g.eta_centered).median():.3f} pp "
              f"(max {100 * (g.eta_fixed - g.eta_centered).max():.3f}); timing-only share of full gain (median) "
              f"{np.median((t.sort_values(['v_inf_over_vesc','dv_over_vp','dv_over_c']).eta_fixed.values - t.sort_values(['v_inf_over_vesc','dv_over_vp','dv_over_c']).eta_centered.values) / np.maximum(1e-12, g.sort_values(['v_inf_over_vesc','dv_over_vp','dv_over_c']).eta_fixed.values - g.sort_values(['v_inf_over_vesc','dv_over_vp','dv_over_c']).eta_centered.values)):.3f}; "
              f"r_min/r_p of optimum: min {g.r_min.min():.4f}, max {g.r_min.max():.4f}; constraint active (r_min<1+1e-4): "
              f"{int((g.r_min < 1 + 1e-4).sum())}/{len(g)}")
    lam_rows = []
    for lam in lam_vals:
        t = tim[(tim["dv_over_c"] == lam)]
        lam_rows.append((lam, timing_theory_delta(lam), t.groupby("Pi")["delta"].median().to_dict()))
    for lam, th, med in lam_rows:
        print(f"  timing δ_opt (median over v∞, Δv) for Δv/c={lam:g}: theory {th:+.4f}; by Π: "
              + ", ".join(f"{k:g}:{v:+.3f}" for k, v in med.items()))


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else str(ROOT / "results" / "opt_phase3.parquet"))
