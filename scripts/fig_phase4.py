"""Phase 4 figures and quoted numbers from results/phase4.parquet.

- phase4_reference.png: (a) thrust-acceleration profile of the Hibberd CASTOR 30B + STAR 48B burn
  about perihelion, time-centred and with its Δv centroid at perihelion; (b) equivalent-Δv loss of
  the reference burn and its sensitivities.
- phase4_loss_vs_pi.png: loss as a fraction of Δv against Π, for the Hibberd stack with its thrust
  scaled down (time-centred and optimal timing), single-stage nuclear-thermal and SEP exhaust
  velocities, the leading-order (Π²) theory, and the nuclear-thermal and SEP (Maraqten et al. 2026)
  placements; thresholds 0.1% and 1%.
- phase4_numbers.json: every number quoted in RESEARCH_LOG / the phase report.
Run:  .venv/Scripts/python scripts/fig_phase4.py
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import run_phase4 as P  # noqa: E402  (configuration and stage construction shared with the run)
from oberth_atlas.constants import GM_SUN, JUPITER, KM, LBF  # noqa: E402
from oberth_atlas.plotting import INK, INK_2, MUTED, SERIES, apply_style, plt, save_figure  # noqa: E402
from oberth_atlas.staged import (centroid_offset, leading_order_loss, schedule, simulate_staged_nd,  # noqa: E402
                                 stack_mass, stages_to_nd)
from oberth_atlas.units import Scales  # noqa: E402

DASHED = (0, (4, 2))
DOTTED = (0, (1.2, 1.6))
MK = dict(markeredgecolor="#fcfcfb", markeredgewidth=0.6)


def crossing(x: np.ndarray, y: np.ndarray, level: float) -> float:
    """x where y first rises through `level` (log–log interpolation; x, y sorted by x ascending)."""
    lx, ly = np.log(x), np.log(y)
    for i in range(len(x) - 1):
        if (y[i] - level) * (y[i + 1] - level) <= 0 and y[i + 1] != y[i]:
            return float(np.exp(lx[i] + (np.log(level) - ly[i]) * (lx[i + 1] - lx[i]) / (ly[i + 1] - ly[i])))
    return math.nan


def setup():
    si = P.stages_si()
    m0 = stack_mass(si, P.CFG["payload_kg"])
    S = Scales(GM_SUN, P.R_P, m0)
    vp = P.v_p_bound(JUPITER.sma) / S.velocity
    nd = stages_to_nd(si, P.CFG["payload_kg"], GM_SUN, P.R_P)
    return si, m0, S, vp, nd


def fig_reference(d, si, S, vp, nd):
    fig, axes = plt.subplots(1, 2, figsize=(14, 4.6), layout="constrained", gridspec_kw={"width_ratios": [1.1, 1]})
    ax = axes[0]
    sched, duration = schedule(nd)
    acc = S.acceleration
    for off, col, ls, lab in ((0.0, MUTED, "-", "time-centred"),
                              (centroid_offset(nd), SERIES[0], "-", "Δv centroid at perihelion (= optimal)")):
        t_ign = off - 0.5 * duration
        for k, (s, st) in enumerate(zip(nd, sched)):
            tt = np.linspace(0.0, s.burn_time, 200)
            a = s.thrust / (st.m_ignition - s.thrust / s.c * tt) * acc
            ax.plot((t_ign + st.t_ignition + tt) * S.time, a, color=col, linestyle=ls, linewidth=1.8,
                    label=lab if k == 0 else None)
        cen = (t_ign + (0.5 * duration - centroid_offset(nd))) * S.time
        ax.axvline(cen, color=col, linewidth=0.8, linestyle=DOTTED)
    ax.axvline(0.0, color=INK, linewidth=1.0)
    ax.annotate("perihelion (3.2 R☉)", (0.0, ax.get_ylim()[1]), xytext=(4, -12), textcoords="offset points",
                fontsize=7.5, color=INK_2)
    ax.annotate(f"{si[0].name}", (-90, 25), fontsize=8, color=INK_2)
    ax.annotate(f"{si[1].name}", (60, 25), fontsize=8, color=INK_2)
    ax.set_xlabel("time from unperturbed perihelion  [s]")
    ax.set_ylabel("thrust acceleration  [m/s²]")
    ax.set_title(f"(a) Reference burn: Δv = {d['ref_dv']:.1f} m/s in {duration * S.time:.1f} s, Π = {d['ref_Pi']:.4f}"
                 " (dotted: Δv centroids)", fontsize=9.5)
    ax.legend(fontsize=7.5, loc="upper left")
    ax = axes[1]
    rows = d["bars"]
    y = np.arange(len(rows))[::-1]
    for yi, (lab, tc, opt) in zip(y, rows):
        ax.plot([opt, tc], [yi, yi], color=MUTED, linewidth=1.2)
        ax.plot(tc, yi, "o", color=MUTED, markersize=6, **MK)
        ax.plot(opt, yi, "o", color=SERIES[0], markersize=6, **MK)
    ax.plot([], [], "o", color=MUTED, label="time-centred")
    ax.plot([], [], "o", color=SERIES[0], label="optimal timing")
    ax.set_yticks(y, [r[0] for r in rows], fontsize=7.5)
    ax.set_xlabel("equivalent-Δv loss  [m/s]")
    ax.set_xlim(left=0)
    ax.set_title("(b) Finite-burn loss of the reference SOM and its sensitivities", fontsize=9.5)
    ax.legend(fontsize=7.5, loc="lower right")
    fig.suptitle("Hibberd et al. (2026) solar Oberth manoeuvre as a finite, staged burn (prograde): the impulsive "
                 "model is accurate to ~1e-5 of Δv", fontsize=9.5, x=0.01, ha="left")
    save_figure(fig, ROOT / "figures" / "phase4_reference.png", "scripts/fig_phase4.py")
    plt.close(fig)


def fig_loss_vs_pi(df, theory_curve, thr):
    fig, ax = plt.subplots(figsize=(10.5, 6.2), layout="constrained")
    sw = df[df["kind"] == "sweep"]
    for pl, ls, lab in (("time_centred", "-", "Hibberd stack, thrust scaled, time-centred"),
                        ("optimal", DASHED, "Hibberd stack, thrust scaled, optimal timing")):
        g = sw[sw["placement"] == pl].sort_values("Pi")
        ax.plot(g["Pi"], 100 * g["loss_rel"], color=SERIES[0], linestyle=ls, linewidth=1.8, label=lab)
    ax.plot(theory_curve[0], 100 * theory_curve[1], color=INK, linestyle=DOTTED, linewidth=1.2,
            label="leading-order theory (Π², second moment of the staged profile)")
    single = df[(df["kind"] == "single") & (df["placement"] == "time_centred")]
    for isp, col, name in ((850.0, SERIES[1], "nuclear thermal (Isp 850 s)"), (6000.0, SERIES[2], "SEP (Isp 6000 s)")):
        g = single[single["isp_s"] == isp].sort_values("Pi")             # colour follows the propulsion type
        ax.plot(g["Pi"], 100 * g["loss_rel"], color=col, linewidth=1.1, alpha=0.8,
                label=f"one constant-thrust stage, {name}, time-centred")
    for lvl in (1.0, 0.1):
        ax.axhline(lvl, color=MUTED, linewidth=0.8, linestyle=DASHED)
        ax.annotate(f"{lvl:g}% of Δv", (ax.get_xlim()[0] if False else 0.012, lvl), xytext=(0, 3),
                    textcoords="offset points", fontsize=7.5, color=INK_2)
    ref = df[(df["kind"] == "reference") & (df["label"] == "Hibberd CASTOR 30B + STAR 48B")
             & (df["placement"] == "time_centred")].iloc[0]
    ax.plot(ref["Pi"], 100 * ref["loss_rel"], "*", color=SERIES[0], markersize=14, **MK, label="Hibberd reference SOM")
    ntp = df[(df["kind"] == "ntp") & (df["placement"] == "time_centred")]
    ax.plot(ntp["Pi"], 100 * ntp["loss_rel"], "s", color=SERIES[1], markersize=7, **MK,
            label="nuclear thermal at the SOM: Isp 800/900 s × a0 3 and 0.1 m/s²")
    for a0, g in ntp.groupby("a0_m_s2"):
        r = g.sort_values("Pi").iloc[-1]
        ax.annotate(f"NTP a0 = {a0:g} m/s²", (r["Pi"], 100 * r["loss_rel"]), xytext=(8, -10),
                    textcoords="offset points", fontsize=7.5, color=INK_2)
    sep = df[(df["kind"] == "sep") & (df["placement"] == "time_centred")].sort_values("Pi")
    ax.plot(sep["Pi"], 100 * sep["loss_rel"], "D", color=SERIES[2], markersize=7, **MK,
            label="SEP, Maraqten et al. (2026) perihelion arc (own geometry, 0.308 au)")
    for _, r in sep.iterrows():
        short = "0.25-yr arc" if "duration" in r["label"] else f"49.8 N, {r['label'].split('start mass ')[1]}"
        ax.annotate(f"SEP {short}", (r["Pi"], 100 * r["loss_rel"]), xytext=(-8, 8), textcoords="offset points",
                    fontsize=7.5, color=INK_2, ha="right")
    ax.axvline(thr["optimal"]["1%"]["Pi"], color=SERIES[0], linewidth=0.6, linestyle=DOTTED)
    ax.annotate(f"1% at Π ≈ {thr['time_centred']['1%']['Pi']:.2f}: thrust ÷ {1 / thr['time_centred']['1%']['f']:.0f},\n"
                f"a0 ≈ {thr['time_centred']['1%']['a0_m_s2']:.2f} m/s²",
                (thr["time_centred"]["1%"]["Pi"], 1.0), xytext=(6, -26), textcoords="offset points", fontsize=7.5,
                color=INK_2)
    ax.set_xscale("log")
    ax.set_yscale("log")
    ax.set_xlim(0.01, 400)
    ax.set_xlabel("Π = burn duration / τ   (τ = r_p/v_p)")
    ax.set_ylabel("equivalent-Δv loss  [% of Δv]")
    ax.legend(fontsize=7.5, loc="lower right")
    fig.suptitle("Where the impulsive model fails for a solar Oberth burn (bound, near-parabolic arrival at 3.2 R☉, "
                 "Δv = 8.36 km/s, prograde)", fontsize=9.5, x=0.01, ha="left")
    save_figure(fig, ROOT / "figures" / "phase4_loss_vs_pi.png", "scripts/fig_phase4.py")
    plt.close(fig)


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    df = pd.read_parquet(ROOT / "results" / "phase4.parquet")
    assert (df["status"] == "ok").all(), "phase 4 results have error rows"
    si, m0, S, vp, nd = setup()
    V = S.velocity

    def row(kind, label, placement):
        return df[(df["kind"] == kind) & (df["label"] == label) & (df["placement"] == placement)].iloc[0]

    REF = "Hibberd CASTOR 30B + STAR 48B"
    ref = {pl: row("reference", REF, pl) for pl in ("time_centred", "centroid", "optimal")}
    conv = {pl: row("reference", "Hibberd, rtol 1e-13", pl) for pl in ("time_centred", "centroid", "optimal")}
    lead_tc = leading_order_loss(vp, nd) * V
    lead_c = leading_order_loss(vp, nd, centroid_offset(nd)) * V
    # Thresholds from the thrust sweep.
    sw = df[df["kind"] == "sweep"]
    thr = {}
    for pl in ("time_centred", "optimal"):
        g = sw[sw["placement"] == pl].sort_values("f", ascending=False)
        f, Pi, L = g["f"].to_numpy(), g["Pi"].to_numpy(), g["loss_rel"].to_numpy()
        thr[pl] = {}
        for lvl, name in ((1e-3, "0.1%"), (1e-2, "1%")):
            Pi_c = crossing(Pi, L, lvl)
            f_c = float(ref["time_centred"]["Pi"] / Pi_c)                 # Π ∝ 1/f
            thr[pl][name] = {"Pi": Pi_c, "f": f_c, "thrust_scale_divisor": 1.0 / f_c,
                             "a0_m_s2": si[0].thrust * f_c / m0,
                             "burn_duration_s": float(ref["time_centred"]["duration_s"] / f_c),
                             "castor_thrust_kN": si[0].thrust * f_c / 1e3, "star48_thrust_kN": si[1].thrust * f_c / 1e3}
    # Thresholds for one nuclear-thermal stage (single-stage curve, Isp 850 s), converted to the
    # initial thrust acceleration for the preset Isp range: t_b = (c/a0)(1 − e^(−Δv/c)) = Π τ.
    sn = df[(df["kind"] == "single") & (df["isp_s"] == 850.0) & (df["placement"] == "time_centred")].sort_values("Pi")
    dv_si = float(ref["time_centred"]["dv_rocket_m_s"])
    tau_s = S.time / vp
    ntp_thr = {}
    for lvl, name in ((1e-3, "0.1%"), (1e-2, "1%")):
        Pi_c = crossing(sn["Pi"].to_numpy(), sn["loss_rel"].to_numpy(), lvl)
        ntp_thr[name] = {"Pi": Pi_c, **{f"a0_m_s2_isp{isp:g}": (isp * P.G0) * -math.expm1(-dv_si / (isp * P.G0))
                                         / (Pi_c * tau_s) for isp in P.CFG["nuclear_thermal"]["isp_s"]}}
    # Universality of loss(Π) across thrust profiles (stack, one stage at Isp 850 s and 6000 s), and the
    # SEP points (own geometry) against the one-stage SEP curve at the SOM geometry.
    def curve(sel):
        g = sel.sort_values("Pi")
        return g["Pi"].to_numpy(), g["loss_rel"].to_numpy()

    def at(c, x):
        return float(np.exp(np.interp(np.log(x), np.log(c[0]), np.log(c[1]))))

    c_stack = curve(sw[sw["placement"] == "time_centred"])
    c_ntp = curve(sn)
    c_sep = curve(df[(df["kind"] == "single") & (df["isp_s"] == 6000.0) & (df["placement"] == "time_centred")])
    universality = {f"Pi={x:g}": {"stack": at(c_stack, x), "one_stage_isp850": at(c_ntp, x),
                                  "one_stage_isp6000": at(c_sep, x),
                                  "max_over_min": max(at(c, x) for c in (c_stack, c_ntp, c_sep))
                                  / min(at(c, x) for c in (c_stack, c_ntp, c_sep))}
                    for x in (0.03, 0.1, 0.3, 1.0, 3.0, 10.0, 30.0, 100.0)}
    sep_rows = df[(df["kind"] == "sep") & (df["placement"] == "time_centred")]
    sep_vs_curve = {r["label"]: float(r["loss_rel"] / at(c_sep, r["Pi"]) - 1.0) for _, r in sep_rows.iterrows()}
    # Leading-order theory curve for the scaled stack (Π²).
    fs = np.logspace(0, -2, 30)
    th_Pi = np.array([ref["time_centred"]["Pi"] / f for f in fs])
    th_L = np.array([leading_order_loss(vp, P.scaled(nd, f)) / sum(st.dv for st in schedule(nd)[0]) for f in fs])
    sens_labels = ["staging coast 10 s", "staging coast 60 s", "aphelion 1 au", "aphelion 30 au", "parabolic arrival",
                   "hyperbolic v∞ = 5 km/s", "two-level thrust, regressive", "two-level thrust, progressive"]
    bars = [("reference (aphelion 5.2 au, no staging coast)", ref["time_centred"]["dv_loss_m_s"], ref["optimal"]["dv_loss_m_s"])]
    bars += [(lab, row("sensitivity", lab, "time_centred")["dv_loss_m_s"], row("sensitivity", lab, "optimal")["dv_loss_m_s"])
             for lab in sens_labels]
    apply_style()
    fig_reference({"ref_dv": ref["time_centred"]["dv_rocket_m_s"], "ref_Pi": ref["time_centred"]["Pi"], "bars": bars},
                  si, S, vp, nd)
    fig_loss_vs_pi(df, (th_Pi, th_L), thr)

    out = {
        "stack": {"m0_kg": m0, "hibberd_listed_total_kg": 17754.0, "listed_minus_sum_kg": 17754.0 - m0,
                  "dv_rocket_m_s": float(ref["time_centred"]["dv_rocket_m_s"]), "hibberd_dv_m_s": 8355.0,
                  "v_p_km_s": float(ref["time_centred"]["v_p_km_s"]), "tau_s": S.time / vp,
                  "duration_s": float(ref["time_centred"]["duration_s"]), "Pi": float(ref["time_centred"]["Pi"]),
                  "constant_thrust_vs_catalog": {s.name: s.thrust / (raw["avg_thrust_lbf"] * LBF) - 1
                                                 for s, raw in zip(si, P.CFG["stages"])}},
        "reference": {pl: {"dv_loss_m_s": float(r["dv_loss_m_s"]), "loss_rel": float(r["loss_rel"]),
                           "offset_s": float(r["offset_s"]), "dv_loss_err_m_s": float(r["dv_loss_err_m_s"]),
                           "v_inf_out_km_s": float(r["v_inf_out_km_s"]),
                           "v_inf_out_shortfall_m_s": float((r["v_inf_out_imp_km_s"] - r["v_inf_out_km_s"]) * KM)}
                      for pl, r in ref.items()},
        "convergence_rtol_1e-13_diff_m_s": {pl: float(conv[pl]["dv_loss_m_s"] - ref[pl]["dv_loss_m_s"]) for pl in ref},
        "leading_order_m_s": {"time_centred": lead_tc, "centroid": lead_c},
        "sensitivity_m_s": {lab: {"time_centred": float(tc), "optimal": float(op)} for lab, tc, op in bars},
        "thresholds": thr,
        "thresholds_ntp_single_stage": ntp_thr,
        "universality": universality,
        "sep_relative_to_som_curve": sep_vs_curve,
        "ntp": [{k: (float(r[k]) if isinstance(r[k], (float, np.floating)) else r[k])
                 for k in ("label", "placement", "Pi", "loss_rel", "dv_loss_m_s", "offset_s")}
                for _, r in df[df["kind"] == "ntp"].iterrows()],
        "sep": [{k: (float(r[k]) if isinstance(r[k], (float, np.floating)) else r[k])
                 for k in ("label", "placement", "Pi", "loss_rel", "dv_loss_m_s", "offset_s", "v_p_km_s")}
                for _, r in df[df["kind"] == "sep"].iterrows()],
    }
    (ROOT / "figures" / "phase4_numbers.json").write_text(json.dumps(out, indent=1, ensure_ascii=False), encoding="utf-8")
    print(json.dumps({k: out[k] for k in ("stack", "reference", "convergence_rtol_1e-13_diff_m_s", "leading_order_m_s",
                                          "thresholds")}, indent=1, ensure_ascii=False))


if __name__ == "__main__":
    main()
