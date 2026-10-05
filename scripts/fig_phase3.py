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
from oberth_atlas.optimize import BOUNDS, OptCase, eta_against_periapsis, timing_theory_delta
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
                   label="small-Π theory  δ* = ½ − x̄  (Δv centroid at periapsis)")
        ax.axhline(0, color=MUTED, linewidth=0.7)
        ax.set_xscale("log")
        ax.set_xlabel("Π = t_b/τ")
        ax.set_title(f"Δv/c = {lam:g}", fontsize=9.5)
    axes[0].set_ylabel("optimal midpoint offset δ  [t_b]   (δ < 0: start earlier)")
    fig_legend(fig, axes[0])
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
    path = ROOT / "figures" / "phase3_numbers.json"
    path.write_text(json.dumps(out, indent=1, ensure_ascii=False), encoding="utf-8")
    return out


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
    out = numbers(d, full1, full9, tim, lam_vals)
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
