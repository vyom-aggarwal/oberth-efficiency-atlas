"""Phase 3 figures and quoted numbers from results/opt_phase3.parquet (+ opt_phase3_crosscheck.csv).

- phase3_recoverable.png: recoverable efficiency Δη = η_opt − η_centered (percentage points)
  against Π, per v∞/v_esc. Solid: pitch + timing; dashed: timing only. Rows: Δv/v_p; columns:
  Δv/c. Constraint r_min ≥ r_p.
- phase3_fraction.png: fraction of the centered deficit 1 − η that is recovered, against Π, with
  the small-Π theory (x̄ − ½)²/⟨(x − ½)²⟩_f (Δv → 0).
- phase3_timing.png: optimal burn-midpoint offset δ (units of t_b) against Π, timing-only
  optimization, with the small-Π theory δ* = ½ − x̄.
- phase3_baselines.png: Δv/c = 3, Δv/v_p = 0.3 (where pitch and the constraint matter). Top: η of
  centered prograde, timing-optimal, fully optimal, and inertial centered (reference). Bottom:
  Δη against the centered burn, on both impulsive baselines (nominal r_p, and the burn's own
  achieved periapsis), for r_min ≥ r_p and r_min ≥ 0.9 r_p.
- phase3_pitch.png: optimal α₀, α₁ against Π for a typical and a pitch-relevant case.
- phase3_reversal.png: departure of the timing optimum from the centroid rule against the centered
  burn's periapsis lift (grid), and the mission-sample gain against the same lift.
- phase3_missions.png (+ phase3_mission_table.csv): recoverable gain for realistic body × engine
  combinations (Phase 2 mission sample), from scripts/run_phase3_followups.py.
- phase3_numbers.json: every number quoted in RESEARCH_LOG / the phase report.
Run:  .venv/Scripts/python scripts/fig_phase3.py
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import numpy as np
import pandas as pd

from oberth_atlas import theory
from oberth_atlas.optimize import (BOUNDS, OptCase, eta_against_periapsis, timing_half_dv_delta, timing_rule_capture,
                                   timing_theory_delta, x_median)
from oberth_atlas.plotting import BLUE_RAMP, INK, INK_2, MUTED, SERIES, apply_style, plt, save_figure

ROOT = Path(__file__).resolve().parents[1]
KEY = ["Pi", "v_inf_over_vesc", "dv_over_vp", "dv_over_c"]
VR_COLORS = BLUE_RAMP[2:]                       # ordered magnitude → one sequential hue, light → dark
MARK = ["o", "s", "^", "D", "v"]                # secondary encoding
DOTTED = (0, (1.2, 1.6))
DASHED = (0, (4, 2))
MK = dict(markersize=4, markeredgecolor="#fcfcfb", markeredgewidth=0.6)


def load():
    d = pd.read_parquet(ROOT / "results" / "opt_phase3.parquet")
    assert (d["status"] == "ok").all(), "campaign has error rows"
    for col in KEY:
        d[col] = d[f"case_{col}"].round(6)

    def centered_achieved(r):
        case = OptCase(r.case_v_inf, r.case_dv, r.case_c, r.case_a0, r.case_rho)
        return eta_against_periapsis(case, r.eta_centered, r.r_min_centered)

    d["eta_centered_achieved"] = d.apply(centered_achieved, axis=1)
    full1 = d[(d["mode"] == "full") & (d["rho"] == 1.0)].set_index(KEY).sort_index()
    full9 = d[(d["mode"] == "full") & (d["rho"] == 0.9)].set_index(KEY).sort_index()
    tim = d[d["mode"] == "timing"].set_index(KEY).sort_index()
    return d, full1, full9, tim


def sel(frame, **kw):
    out = frame
    for k, v in kw.items():
        out = out.xs(v, level=k, drop_level=False)
    return out.reset_index().sort_values("Pi")


def fig_legend(fig, ax, ncol: int = 8) -> None:
    """One legend below the panels (it never covers data)."""
    handles, labels = ax.get_legend_handles_labels()
    fig.legend(handles, labels, loc="outside lower center", ncol=min(ncol, len(labels)), fontsize=8, frameon=False)


def small_dv_fraction(lam: float) -> float:
    """Δv → 0 limit of the small-Π recoverable fraction: (x̄ − ½)²/⟨(x − ½)²⟩_f."""
    return timing_theory_delta(lam) ** 2 / theory.profile_moments(lam).m2


def fig_recoverable(full1, tim, vr_vals, dvr_vals, lam_vals):
    fig, axes = plt.subplots(len(dvr_vals), len(lam_vals), figsize=(14, 7.6), layout="constrained", sharex=True)
    for r, dvr in enumerate(dvr_vals):
        for c, lam in enumerate(lam_vals):
            ax = axes[r, c]
            for i, vr in enumerate(vr_vals):
                gf = sel(full1, dv_over_vp=dvr, dv_over_c=lam, v_inf_over_vesc=vr)
                gt = sel(tim, dv_over_vp=dvr, dv_over_c=lam, v_inf_over_vesc=vr)
                ax.plot(gf["Pi"], 100 * (gf["eta_fixed"] - gf["eta_centered"]), color=VR_COLORS[i], marker=MARK[i],
                        linewidth=1.5, label=f"v∞/v_esc = {vr:g}", **MK)
                ax.plot(gt["Pi"], 100 * (gt["eta_fixed"] - gt["eta_centered"]), color=VR_COLORS[i], linestyle=DASHED,
                        linewidth=1.1)
            ax.set_xscale("log")
            ax.axhline(0, color=MUTED, linewidth=0.6)
            ax.set_title(f"Δv/v_p = {dvr:g},  Δv/c = {lam:g}", fontsize=9.5)
            if r == len(dvr_vals) - 1:
                ax.set_xlabel("Π = t_b/τ")
            if c == 0:
                ax.set_ylabel("recoverable Δη = η_opt − η_centered  [pp]")
    axes[0, 0].plot([], [], color=INK_2, linewidth=1.5, label="pitch + timing")
    axes[0, 0].plot([], [], color=INK_2, linewidth=1.1, linestyle=DASHED, label="timing only")
    fig_legend(fig, axes[0, 0])
    fig.suptitle("Recoverable Oberth efficiency within the prograde family (linear pitch law + burn timing, "
                 "r_min ≥ r_p), relative to the centered prograde burn. Note the per-panel y-scales.",
                 fontsize=9.5, x=0.01, ha="left")
    save_figure(fig, ROOT / "figures" / "phase3_recoverable.png", "scripts/fig_phase3.py")
    plt.close(fig)


def fig_fraction(full1, vr_vals, dvr_vals, lam_vals):
    fig, axes = plt.subplots(1, len(lam_vals), figsize=(14, 4.3), layout="constrained")
    for ax, lam in zip(axes, lam_vals):
        for i, vr in enumerate(vr_vals):
            for dvr, ls in zip(dvr_vals, ("-", DOTTED)):
                g = sel(full1, dv_over_vp=dvr, dv_over_c=lam, v_inf_over_vesc=vr)
                frac = (g["eta_fixed"] - g["eta_centered"]) / (1.0 - g["eta_centered"])
                ax.plot(g["Pi"], 100 * frac, color=VR_COLORS[i], marker=MARK[i], linestyle=ls, linewidth=1.4,
                        label=f"v∞/v_esc = {vr:g}" if dvr == dvr_vals[0] else None, **MK)
        ax.axhline(100 * small_dv_fraction(lam), color=INK, linewidth=1.0, linestyle=DASHED,
                   label="small-Π theory, Δv → 0:  (x̄ − ½)²/⟨(x − ½)²⟩")
        ax.set_xscale("log")
        ax.set_ylim(bottom=0)
        ax.set_xlabel("Π = t_b/τ")
        ax.set_title(f"Δv/c = {lam:g}", fontsize=9.5)
    axes[0].set_ylabel("deficit recovered  (η_opt − η_c)/(1 − η_c)  [%]")
    fig_legend(fig, axes[0])
    fig.suptitle("Fraction of the finite-burn deficit recovered by optimal pitch + timing (r_min ≥ r_p). "
                 "Solid Δv/v_p = 0.03, dotted 0.3. Note the per-panel y-scales.", fontsize=9.5, x=0.01, ha="left")
    save_figure(fig, ROOT / "figures" / "phase3_fraction.png", "scripts/fig_phase3.py")
    plt.close(fig)


def fig_timing(tim, vr_vals, dvr_vals, lam_vals):
    fig, axes = plt.subplots(1, len(lam_vals), figsize=(14, 4.3), layout="constrained", sharey=True)
    for ax, lam in zip(axes, lam_vals):
        for i, vr in enumerate(vr_vals):
            for dvr, ls in zip(dvr_vals, ("-", DOTTED)):
                g = sel(tim, dv_over_c=lam, v_inf_over_vesc=vr, dv_over_vp=dvr)
                ax.plot(g["Pi"], g["delta"], color=VR_COLORS[i], linestyle=ls, marker=MARK[i], linewidth=1.4,
                        label=f"v∞/v_esc = {vr:g}" if dvr == dvr_vals[0] else None, **MK)
        ax.axhline(timing_theory_delta(lam), color=INK, linewidth=1.0, linestyle=DASHED,
                   label="small-Π optimum  δ* = ½ − x̄  (Δv-weighted mean at periapsis)")
        ax.axhline(timing_half_dv_delta(lam), color=INK_2, linewidth=1.0, linestyle=DOTTED,
                   label="half-Δv rule  ½ − x_med  (captures 75–80% of the small-Π gain)")
        ax.axhline(0, color=MUTED, linewidth=0.7)
        ax.set_xscale("log")
        ax.set_xlabel("Π = t_b/τ")
        ax.set_title(f"Δv/c = {lam:g}", fontsize=9.5)
    axes[0].set_ylabel("optimal midpoint offset δ  [t_b]   (δ < 0: start earlier)")
    fig_legend(fig, axes[0], ncol=4)
    fig.suptitle("Timing hypothesis: optimal prograde-burn timing (timing-only optimization). "
                 "Solid Δv/v_p = 0.03, dotted 0.3.", fontsize=9.5, x=0.01, ha="left")
    save_figure(fig, ROOT / "figures" / "phase3_timing.png", "scripts/fig_phase3.py")
    plt.close(fig)


def fig_baselines(full1, full9, tim, show_vr, lam=3.0, dvr=0.3):
    fig, axes = plt.subplots(2, len(show_vr), figsize=(14, 7.4), layout="constrained", sharex=True, sharey="row")
    for c, vr in enumerate(show_vr):
        f1, f9, t = (sel(x, v_inf_over_vesc=vr, dv_over_vp=dvr, dv_over_c=lam) for x in (full1, full9, tim))
        ax = axes[0, c]
        ax.plot(f1["Pi"], f1["eta_centered"], color=MUTED, linewidth=1.6, label="prograde, centered")
        ax.plot(t["Pi"], t["eta_fixed"], color=SERIES[2], linewidth=1.4, linestyle=DASHED, label="prograde, timing-optimal")
        ax.plot(f1["Pi"], f1["eta_fixed"], color=SERIES[0], linewidth=1.8, marker="o", label="pitch + timing optimal", **MK)
        ax.plot(f1["Pi"], f1["eta_inertial"], color=SERIES[1], linewidth=1.4, marker="s",
                label="inertial, centered (reference)", **MK)
        ax.axhline(0, color=MUTED, linewidth=0.6)
        ax.set_title(f"v∞/v_esc = {vr:g}   (Δv/c = {lam:g}, Δv/v_p = {dvr:g})", fontsize=9.5)
        ax = axes[1, c]
        ax.plot(t["Pi"], 100 * (t["eta_fixed"] - t["eta_centered"]), color=SERIES[2], linewidth=1.4, linestyle=DASHED,
                label="timing only (nominal-r_p baseline)")
        for f, col, mk, tag in ((f1, SERIES[0], "o", "r_min ≥ r_p"), (f9, INK_2, "s", "r_min ≥ 0.9 r_p")):
            ax.plot(f["Pi"], 100 * (f["eta_fixed"] - f["eta_centered"]), color=col, linewidth=1.6, marker=mk,
                    label=f"pitch + timing, {tag}: nominal-r_p baseline", **MK)
            ax.plot(f["Pi"], 100 * (f["eta_achieved"] - f["eta_centered_achieved"]), color=col, linewidth=1.2,
                    linestyle=DOTTED, label=f"pitch + timing, {tag}: achieved-periapsis baseline")
        ax.axhline(0, color=MUTED, linewidth=0.6)
        ax.set_xscale("log")
        ax.set_xlabel("Π = t_b/τ")
    axes[0, 0].set_ylabel("η")
    axes[1, 0].set_ylabel("Δη vs centered prograde  [pp]")
    axes[0, 0].legend(fontsize=7.5, loc="lower left")
    axes[1, 0].legend(fontsize=7, loc="upper left")
    fig.suptitle("Optimized η on both impulsive baselines, with inertial steering as the reference curve "
                 "(achieved-periapsis baseline: impulsive burn of the same Δv at the trajectory's own r_min)",
                 fontsize=9.5, x=0.01, ha="left")
    save_figure(fig, ROOT / "figures" / "phase3_baselines.png", "scripts/fig_phase3.py")
    plt.close(fig)


def fig_pitch(full1, vr_vals, cases=((1.0, 0.03), (3.0, 0.3))):
    fig, axes = plt.subplots(2, len(cases), figsize=(11, 6.6), layout="constrained", sharex=True)
    for c, (lam, dvr) in enumerate(cases):
        for i, vr in enumerate(vr_vals):
            g = sel(full1, v_inf_over_vesc=vr, dv_over_vp=dvr, dv_over_c=lam)
            for r, col in enumerate(("alpha0", "alpha1")):
                axes[r, c].plot(g["Pi"], np.degrees(g[col]), color=VR_COLORS[i], marker=MARK[i], linewidth=1.4,
                                label=f"v∞/v_esc = {vr:g}", **MK)
        axes[0, c].set_title(f"Δv/c = {lam:g}, Δv/v_p = {dvr:g}", fontsize=9.5)
        axes[1, c].set_xlabel("Π = t_b/τ")
    for ax in axes.flat:
        ax.set_xscale("log")
        ax.axhline(0, color=MUTED, linewidth=0.6)
    axes[0, 0].set_ylabel("α₀, mean pitch (+ toward planet)  [deg]")
    axes[1, 0].set_ylabel("α₁, pitch change over the burn  [deg]")
    axes[0, 1].legend(fontsize=7.5)
    fig.suptitle("Optimal linear pitch law α(s) = α₀ + α₁ s, s ∈ [−½, ½]  (r_min ≥ r_p)", fontsize=9.5, x=0.01, ha="left")
    save_figure(fig, ROOT / "figures" / "phase3_pitch.png", "scripts/fig_phase3.py")
    plt.close(fig)


ENGINE_GROUP = {"hydrolox": "chemical", "methalox_vac": "chemical", "nuclear_thermal": "nuclear thermal",
                "hall": "electric", "gridded_ion": "electric"}
GROUP_COLOR = {"chemical": SERIES[0], "nuclear thermal": SERIES[1], "electric": SERIES[2]}
GAIN_FLOOR = 1e-6                                   # pp; smaller gains are drawn at the floor on log axes


def load_followups():
    """Rules on the grid, the piecewise check and the mission mapping (absent files → None)."""
    def rd(name):
        p = ROOT / "results" / name
        return pd.read_parquet(p) if p.exists() else None

    rules, pw, mis = rd("opt_phase3_rules.parquet"), rd("opt_phase3_piecewise.parquet"), rd("opt_missions.parquet")
    if mis is not None:
        m2 = pd.read_parquet(ROOT / "results" / "missions.parquet", columns=["body", "engine", "sample", "steering",
                                                                           "r_min_over_rp"])
        mis = mis.merge(m2[m2["steering"] == "prograde"].drop(columns="steering"), on=["body", "engine", "sample"],
                        how="left")
        assert (mis["status"] == "ok").all(), "mission follow-up has error rows"

        def achieved(r):
            case = OptCase.from_targets(r.v_inf_over_vesc, r.dv_over_vp, r.dv_over_c, r.Pi)
            return (eta_against_periapsis(case, r.eta_timing, r.r_min_timing),
                    eta_against_periapsis(case, r.eta_centered, r.r_min_over_rp))

        ach = np.array([achieved(r) for r in mis.itertuples()])
        mis["eta_timing_achieved"], mis["eta_centered_achieved"] = ach[:, 0], ach[:, 1]
        mis["gain_pp"] = 100 * (mis["eta_timing"] - mis["eta_centered"])
        mis["gain_achieved_pp"] = 100 * (mis["eta_timing_achieved"] - mis["eta_centered_achieved"])
        mis["lift"] = mis["r_min_over_rp"] - 1.0
        mis["group"] = mis["engine"].map(ENGINE_GROUP)
    return rules, pw, mis


def fig_reversal(tim, mis, lam_vals, dvr_vals):
    fig, axes = plt.subplots(1, 2, figsize=(13, 4.8), layout="constrained")
    ax = axes[0]
    t = tim.reset_index()
    lam_col = {lam: BLUE_RAMP[2 + 2 * i] for i, lam in enumerate(lam_vals)}     # steps 2, 4, 6: light → dark
    for lam in lam_vals:
        for p, g in t[t["dv_over_c"] == lam].groupby("Pi"):          # one thin line per (Δv/c, Π) group
            g = g.sort_values("r_min_centered")
            ax.plot(g["r_min_centered"] - 1.0, g["delta"] - timing_theory_delta(lam), color=lam_col[lam],
                    linewidth=0.6, alpha=0.6)
        for dvr, mk in zip(dvr_vals, ("o", "^")):
            g = t[(t["dv_over_c"] == lam) & (t["dv_over_vp"] == dvr)]
            ax.scatter(g["r_min_centered"] - 1.0, g["delta"] - timing_theory_delta(lam), s=22, marker=mk,
                       color=lam_col[lam], edgecolor="#fcfcfb", linewidth=0.5, label=f"Δv/c = {lam:g}, Δv/v_p = {dvr:g}")
    ax.set_xscale("log")
    ax.axhline(0, color=MUTED, linewidth=0.7)
    ax.set_xlabel("periapsis lift of the centered burn, r_min/r_p − 1")
    ax.set_ylabel("δ_opt − δ*  (departure from the centroid rule)  [t_b]")
    ax.set_title("(a) Phase 3 grid, timing-only optima (lines join cases at fixed Δv/c and Π)", fontsize=9.5)
    ax.legend(fontsize=7, loc="lower left")
    ax = axes[1]
    if mis is not None:
        for grp, col in GROUP_COLOR.items():
            g = mis[mis["group"] == grp]
            ax.scatter(np.maximum(g["lift"], 1e-7), np.maximum(g["gain_pp"], GAIN_FLOOR), s=5, color=col, alpha=0.55,
                       linewidth=0, label=grp)
        ax.set_xscale("log")
        ax.set_yscale("log")
        ax.set_xlabel("periapsis lift of the centered burn, r_min/r_p − 1  (floor 1e-7)")
        ax.set_ylabel(f"recoverable Δη by timing  [pp]  (floor {GAIN_FLOOR:g})")
        ax.set_title("(b) Phase 2 mission samples (valid, prograde)", fontsize=9.5)
        ax.legend(fontsize=7.5, loc="upper left", markerscale=2.5)
    fig.suptitle("At fixed Δv/c and Π the timing optimum moves later as the centered burn lifts its periapsis more "
                 "(except Δv/c = 3 at Π ≥ 30, where the centroid effect dominates); mission gains track the same lift",
                 fontsize=9.5, x=0.01, ha="left")
    save_figure(fig, ROOT / "figures" / "phase3_reversal.png", "scripts/fig_phase3.py")
    plt.close(fig)


def mission_table(mis, pw_mis=None) -> pd.DataFrame:
    rows = []
    for (grp, eng, body), g in mis.groupby(["group", "engine", "body"], sort=True):
        frac = (g["eta_timing"] - g["eta_centered"]) / (1.0 - g["eta_centered"])
        full = g.dropna(subset=["eta_full"])
        rows.append(dict(
            group=grp, engine=eng, body=body, n=len(g), Pi_median=g["Pi"].median(), dv_over_c_median=g["dv_over_c"].median(),
            eta_centered_median=g["eta_centered"].median(),
            gain_pp_p10=g["gain_pp"].quantile(0.1), gain_pp_median=g["gain_pp"].median(),
            gain_pp_p90=g["gain_pp"].quantile(0.9), gain_pp_max=g["gain_pp"].max(),
            gain_achieved_pp_median=g["gain_achieved_pp"].median(), frac_recovered_median=frac.median(),
            delta_median=g["delta_timing"].median(),
            centroid_rule_gain_pp_median=100 * (g["eta_centroid"] - g["eta_centered"]).median(),
            half_dv_rule_gain_pp_median=100 * (g["eta_half_dv"] - g["eta_centered"]).median(),
            n_full=len(full), pitch_extra_pp_max=(100 * (full["eta_full"] - full["eta_timing"])).max() if len(full) else np.nan))
    return pd.DataFrame(rows)


def fig_missions(mis, grid_ref_pp: float):
    tab = mission_table(mis)
    tab.to_csv(ROOT / "figures" / "phase3_mission_table.csv", index=False, float_format="%.6g")
    order = [g for g in GROUP_COLOR if g in set(tab["group"])]
    tab["gi"] = tab["group"].map({g: i for i, g in enumerate(order)})
    tab = tab.sort_values(["gi", "engine", "body"]).reset_index(drop=True)
    fig, ax = plt.subplots(figsize=(10, 9.5), layout="constrained")
    y = np.arange(len(tab))[::-1]
    for yi, r in zip(y, tab.itertuples()):
        col = GROUP_COLOR[r.group]
        lo, md, hi = (max(v, GAIN_FLOOR) for v in (r.gain_pp_p10, r.gain_pp_median, r.gain_pp_p90))
        ax.plot([lo, hi], [yi, yi], color=col, linewidth=2.0, solid_capstyle="round")
        ax.plot(md, yi, "o", color=col, markersize=6, markeredgecolor="#fcfcfb")
        ax.plot(max(r.gain_pp_max, GAIN_FLOOR), yi, "x", color=INK_2, markersize=5)
    ax.set_yticks(y, [f"{r.engine} · {r.body}  (n={r.n})" for r in tab.itertuples()], fontsize=7.5)
    ax.set_xscale("log")
    ax.axvline(grid_ref_pp, color=INK, linewidth=1.0, linestyle=DASHED)
    ax.annotate(f"Δv/c = 3 grid corner\n(median at Π = 10: {grid_ref_pp:.1f} pp)", (grid_ref_pp, y.max()),
                xytext=(-4, 0), textcoords="offset points", ha="right", va="top", fontsize=7.5, color=INK_2)
    ax.set_xlabel(f"recoverable Δη by optimal timing, nominal-r_p baseline  [pp]   "
                  f"(bar p10–p90, dot median, × max; floor {GAIN_FLOOR:g})")
    for g in order:
        ax.plot([], [], color=GROUP_COLOR[g], linewidth=2.0, marker="o", label=g)
    ax.legend(fontsize=8, loc="lower right")
    fig.suptitle("Recoverable efficiency for realistic engine/body combinations (Phase 2 mission sample, valid "
                 "prograde burns)", fontsize=9.5, x=0.01, ha="left")
    save_figure(fig, ROOT / "figures" / "phase3_missions.png", "scripts/fig_phase3.py")
    plt.close(fig)
    return tab


def followup_numbers(tim, rules, pw, mis, lam_vals):
    def stats(s):
        s = pd.Series(s).dropna()
        return {"min": float(s.min()), "median": float(s.median()), "max": float(s.max())} if len(s) else None

    out = {"half_dv_rule_closed_form": {
        f"lam={lam:g}": {"x_centroid": 0.5 - timing_theory_delta(lam), "x_median": x_median(lam),
                         "capture": timing_rule_capture(lam, x_median(lam)),
                         # extra deficit over the optimum as Δv → 0: (x̄ − x_med)²/σ², σ² = m₂(½) − (x̄ − ½)²
                         "extra_loss_dv0": (0.5 - timing_theory_delta(lam) - x_median(lam)) ** 2
                         / (theory.profile_moments(lam).m2 - timing_theory_delta(lam) ** 2)}
        for lam in lam_vals}}
    t = tim.reset_index()
    dep = t["delta"] - t["dv_over_c"].map(timing_theory_delta)
    lift = t["r_min_centered"] - 1.0
    out["reversal_grid"] = {
        "spearman_departure_vs_lift": float(dep.corr(lift, method="spearman")),
        "pearson_departure_vs_log_lift": float(dep.corr(np.log10(lift))),
        "by_lam_spearman": {f"lam={lam:g}": float(dep[t["dv_over_c"] == lam].corr(lift[t["dv_over_c"] == lam], method="spearman"))
                            for lam in lam_vals},
    }
    # Controlled check: within fixed (Δv/c, Π) the centroid effect is fixed, so only the lift varies.
    tt = t.assign(dep=dep, lift=lift)
    within = {(lam, p): float(g["dep"].corr(g["lift"], method="spearman")) for (lam, p), g in tt.groupby(["dv_over_c", "Pi"])}
    x = tt.pivot_table(index=["dv_over_c", "Pi", "v_inf_over_vesc"], columns="dv_over_vp", values=["dep", "lift"])
    lo, hi = min(x["dep"].columns), max(x["dep"].columns)
    later = (x["dep"][hi] - x["dep"][lo]) > 0
    out["reversal_grid"].update({
        "within_lam_Pi_spearman": {f"lam={lam:g},Pi={p:g}": v for (lam, p), v in within.items()},
        "within_lam_Pi_spearman_median": float(np.median(list(within.values()))),
        "within_lam_Pi_share_positive": float(np.mean([v > 0 for v in within.values()])),
        "paired_dvr_lift_increases": f"{int(((x['lift'][hi] - x['lift'][lo]) > 0).sum())}/{len(x)}",
        "paired_dvr_optimum_later_share_by_lam": {f"lam={k:g}": float(v) for k, v in later.groupby(level="dv_over_c").mean().items()},
    })
    if rules is not None:
        r = t.merge(rules, on=KEY, how="left")
        gain = r["eta_fixed"] - r["eta_centered"]
        ok = gain > 1e-7
        for name in ("centroid", "half_dv"):
            cap = ((r[f"eta_{name}"] - r["eta_centered"]) / gain).where(ok)
            out[f"{name}_rule_capture_sim_by_lam_Pi"] = {
                f"lam={lam:g}": {f"Pi={p:g}": stats(cap[(r["dv_over_c"] == lam) & (r["Pi"] == p)])
                                 for p in sorted(r["Pi"].unique())} for lam in lam_vals}
    if pw is not None:
        out["piecewise_6_knots"] = {"n": len(pw), "gain_pp_over_linear": stats(pw["gain_pp"]),
                                    "max_eta_err": float(pw["eta_err"].max()),
                                    "gain_achieved_pp_over_linear": stats(100 * (pw["eta_achieved_piecewise"]
                                                                                 - pw["eta_achieved_linear"]))}
    if mis is not None:
        out["missions"] = {
            "n_valid": len(mis),
            "soi_ratio_start_timing_gt_1": int((mis["soi_ratio_start_timing"] > 1).sum()),
            "eta_centered_vs_phase2_max_abs_diff": float((mis["eta_centered"] - mis["eta_phase2"]).abs().max()),
            "gain_pp_by_group": {g: {"p10": float(x["gain_pp"].quantile(0.1)), "median": float(x["gain_pp"].median()),
                                     "p90": float(x["gain_pp"].quantile(0.9)), "max": float(x["gain_pp"].max()),
                                     "dv_over_c_median": float(x["dv_over_c"].median()),
                                     "frac_recovered_median": float(((x["eta_timing"] - x["eta_centered"])
                                                                     / (1 - x["eta_centered"])).median()),
                                     "gain_achieved_pp_median": float(x["gain_achieved_pp"].median()),
                                     "share_gain_achieved_le_0": float((x["gain_achieved_pp"] <= 1e-9).mean())}
                                 for g, x in mis.groupby("group")},
            "n_gain_gt_0p1pp": int((mis["gain_pp"] > 0.1).sum()),
            "n_gain_gt_0p1pp_with_delta_gt_0": int(((mis["gain_pp"] > 0.1) & (mis["delta_timing"] > 0)).sum()),
            "spearman_gain_vs_lift": float(mis["gain_pp"].corr(mis["lift"], method="spearman")),
            "pitch_extra_pp_subsample": stats(100 * (mis["eta_full"] - mis["eta_timing"])),
            "n_full_subsample": int(mis["eta_full"].notna().sum()),
        }
    return out


def numbers(d, full1, full9, tim, lam_vals):
    def stats(s):
        return {"min": float(s.min()), "median": float(s.median()), "max": float(s.max())}

    gain_full = full1["eta_fixed"] - full1["eta_centered"]
    gain_tim = tim["eta_fixed"] - tim["eta_centered"]
    frac = gain_full / (1.0 - full1["eta_centered"])
    share = (gain_tim / gain_full).where(gain_full > 1e-6)
    active = full9["r_min"] < 1.0 - 1e-6           # relaxing to 0.9 r_p lets the optimum go below r_p
    gain_ach = full1["eta_achieved"] - full1["eta_centered_achieved"]
    ratio = (gain_ach / gain_full).where(gain_full > 1e-4).dropna()   # how much survives the achieved baseline
    xc = pd.read_csv(ROOT / "results" / "opt_phase3_crosscheck.csv")
    out = {
        "n_rows": len(d), "n_errors": int((d["status"] != "ok").sum()),
        "feasible": {f"{m}_rho{r:g}": int(g["feasible"].sum()) for (m, r), g in d.groupby(["mode", "rho"])},
        "multistart": {
            "cases_with_spread_gt_1e-6": int((d[d["mode"] == "full"]["start_eta_spread"] > 1e-6).sum()),
            "max_spread": float(d["start_eta_spread"].max()),
        },
        "nelder_mead_crosscheck": {"n": len(xc), "max_diff": float(xc["diff"].max()), "min_diff": float(xc["diff"].min())},
        "gain_pp_full_rho1_by_lam_Pi": {f"lam={lam:g}": {f"Pi={p:g}": stats(100 * g) for p, g in gain_full.xs(lam, level="dv_over_c").groupby(level="Pi")} for lam in lam_vals},
        "fraction_recovered_full_rho1_by_lam_Pi": {f"lam={lam:g}": {f"Pi={p:g}": stats(g) for p, g in frac.xs(lam, level="dv_over_c").groupby(level="Pi")} for lam in lam_vals},
        "small_pi_fraction_limit_dv0": {f"lam={lam:g}": small_dv_fraction(lam) for lam in lam_vals},
        "timing_share_of_full_gain_by_lam": {f"lam={lam:g}": stats(share.xs(lam, level="dv_over_c").dropna()) for lam in lam_vals},
        "timing_share_of_full_gain_by_Pi": {f"Pi={p:g}": stats(g.dropna()) for p, g in share.groupby(level="Pi")},
        "delta_timing_by_lam_Pi": {f"lam={lam:g}": {"theory": timing_theory_delta(lam), **{f"Pi={p:g}": stats(g) for p, g in tim["delta"].xs(lam, level="dv_over_c").groupby(level="Pi")}} for lam in lam_vals},
        "delta_timing_positive_cases": int((tim["delta"] > 0).sum()),
        "alpha_deg_full_rho1": {"alpha0": stats(np.degrees(full1["alpha0"])), "alpha1": stats(np.degrees(full1["alpha1"]))},
        "constraint_rho1_active_cases": int(active.sum()),
        "constraint_rho1_active_by_lam": {f"lam={k:g}": int(v) for k, v in active.groupby(level="dv_over_c").sum().items()},
        "rho09_extra_gain_pp_fixed_baseline": stats(100 * (full9["eta_fixed"] - full1["eta_fixed"])),
        "rho09_extra_gain_pp_achieved_baseline": stats(100 * (full9["eta_achieved"] - full1["eta_achieved"])),
        "rho1_achieved_minus_fixed": stats(full1["eta_achieved"] - full1["eta_fixed"]),
        "eta_inertial_by_Pi": {f"Pi={p:g}": stats(g) for p, g in full1["eta_inertial"].groupby(level="Pi")},
        "eta_centered_by_Pi": {f"Pi={p:g}": stats(g) for p, g in full1["eta_centered"].groupby(level="Pi")},
        "full_minus_inertial_by_Pi": {f"Pi={p:g}": stats(g) for p, g in (full1["eta_fixed"] - full1["eta_inertial"]).groupby(level="Pi")},
        "timing_delta_minus_theory_abs_by_Pi": {f"Pi={p:g}": stats(g) for p, g in (tim["delta"] - tim.index.get_level_values("dv_over_c").map(timing_theory_delta).to_numpy()).abs().groupby(level="Pi")},
        "max_eta_err": float(d["eta_err"].max()),
        "optima_at_a_bound": {k: int(((d[k] - lo).abs() < 1e-6).sum() + ((d[k] - hi).abs() < 1e-6).sum())
                              for k, (lo, hi) in BOUNDS.items()},
        "control_ranges": {k: [float(d[k].min()), float(d[k].max())] for k in BOUNDS},
        "achieved_over_nominal_gain_ratio_full_rho1": {
            **{f"lam={lam:g}": float(ratio.xs(lam, level="dv_over_c").median()) for lam in lam_vals},
            **{f"dvr={v:g}": float(g.median()) for v, g in ratio.groupby(level="dv_over_vp")},
        },
        "r_min_centered_by_dvr_Pi_median": {f"dvr={v:g}": {f"Pi={p:g}": float(x) for p, x in g.groupby(level="Pi").median().items()}
                                            for v, g in full1["r_min_centered"].groupby(level="dv_over_vp")},
    }
    return out


def write_numbers(out: dict) -> None:
    path = ROOT / "figures" / "phase3_numbers.json"
    path.write_text(json.dumps(out, indent=1, ensure_ascii=False), encoding="utf-8")


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    d, full1, full9, tim = load()
    vr_vals = sorted(d["v_inf_over_vesc"].unique())
    lam_vals = sorted(d["dv_over_c"].unique())
    dvr_vals = sorted(d["dv_over_vp"].unique())
    apply_style()
    fig_recoverable(full1, tim, vr_vals, dvr_vals, lam_vals)
    fig_fraction(full1, vr_vals, dvr_vals, lam_vals)
    fig_timing(tim, vr_vals, dvr_vals, lam_vals)
    fig_baselines(full1, full9, tim, [v for v in (0.03, 0.3, 3.0) if v in vr_vals])
    fig_pitch(full1, vr_vals)
    rules, pw, mis = load_followups()
    fig_reversal(tim, mis, lam_vals, dvr_vals)
    if mis is not None:
        ref = float((100 * (full1["eta_fixed"] - full1["eta_centered"])).xs((3.0, 10.0), level=["dv_over_c", "Pi"]).median())
        fig_missions(mis, ref)
    out = numbers(d, full1, full9, tim, lam_vals)
    out["followups"] = followup_numbers(tim, rules, pw, mis, lam_vals)
    write_numbers(out)
    print(json.dumps(out["followups"], indent=1, ensure_ascii=False)[:6000])
    print(json.dumps({k: out[k] for k in ("n_rows", "n_errors", "feasible", "multistart", "nelder_mead_crosscheck",
                                          "small_pi_fraction_limit_dv0", "timing_share_of_full_gain_by_lam",
                                          "constraint_rho1_active_cases", "constraint_rho1_active_by_lam",
                                          "rho09_extra_gain_pp_fixed_baseline", "rho09_extra_gain_pp_achieved_baseline",
                                          "delta_timing_positive_cases", "max_eta_err", "optima_at_a_bound",
                                          "achieved_over_nominal_gain_ratio_full_rho1")}, indent=1, ensure_ascii=False))
    if not math.isfinite(out["max_eta_err"]):
        raise SystemExit("non-finite η error estimate")


if __name__ == "__main__":
    main()
