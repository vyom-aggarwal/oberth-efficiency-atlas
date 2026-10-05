"""Poster-ready hero figure: the universal finite-burn loss curve with real cases placed on it.

- Band: loss/Δv against Π for a near-parabolic solar Oberth burn (3.2 R☉, Δv = 8.36 km/s), spread
  across thrust profiles (Hibberd's two-stage solid stack with thrust scaled; one constant-thrust
  stage at Isp 850 s and at 6000 s); results/phase4.parquet. Below Π = 0.01 each profile is
  continued at its constant (loss/Δv)/Π², which is exact at leading order (figures/rule_numbers.json).
- Rule: loss/Δv = Π²/96.
- Real cases: the Phase 2 solar mission samples (3–20 R☉, all five engine classes, prograde, centred;
  results/missions.parquet), Hibberd et al. (2026) reference SOM, and Maraqten et al. (2026) perihelion
  arc placed on the curve with their own F ∝ r^−1.5 thrust (at Π_eff). Samples whose loss is below
  1e-8 of Δv (the numerical floor) are not drawn.
Writes figures/hero_loss_vs_pi.png (300 dpi) and .pdf, and figures/hero_numbers.json.
Run:  .venv/Scripts/python scripts/fig_hero.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

from oberth_atlas.constants import GM_SUN
from oberth_atlas.plotting import INK, INK_2, MUTED, SERIES, apply_style, plt, save_figure

ROOT = Path(__file__).resolve().parents[1]
GROUPS = {"chemical": (("hydrolox", "methalox_vac"), SERIES[0]),
          "nuclear thermal": (("nuclear_thermal",), SERIES[1]),
          "electric (Hall, ion)": (("hall", "gridded_ion"), SERIES[2])}
LOSS_FLOOR = 1e-8


def profile_curves(p: pd.DataFrame) -> dict:
    sw = p[(p["kind"] == "sweep") & (p["placement"] == "time_centred")]
    single = p[(p["kind"] == "single") & (p["placement"] == "time_centred")]
    curves = {"two-stage solid stack": sw.sort_values("Pi")}
    for isp in (850.0, 6000.0):
        curves[f"one stage, Isp {isp:g} s"] = single[single["isp_s"] == isp].sort_values("Pi")
    return {k: (g["Pi"].to_numpy(), g["loss_rel"].to_numpy()) for k, g in curves.items()}


def on_grid(curve, x):
    """Loss/Δv on grid x: log-interpolated, continued at constant (loss/Δv)/Π² below the first point."""
    Pi, L = curve
    y = np.exp(np.interp(np.log(x), np.log(Pi), np.log(L)))
    lo = x < Pi[0]
    y[lo] = L[0] / Pi[0] ** 2 * x[lo] ** 2
    y[x > Pi[-1]] = np.nan
    return y


def solar_samples() -> pd.DataFrame:
    m = pd.read_parquet(ROOT / "results" / "missions.parquet")
    m = m[(m["body"] == "sun") & (m["steering"] == "prograde") & (m["status"] == "ok") & ~m["flag_impact"]
          & np.isfinite(m["v_inf_out"])].copy()
    vesc2 = 2.0 * GM_SUN / m["r_p"]
    vp = np.sqrt(m["v_inf_in"] ** 2 + vesc2)
    m["loss_rel"] = 1.0 - (np.sqrt(m["v_inf_out"] ** 2 + vesc2) - vp) / m["delta_v"]
    return m


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    p = pd.read_parquet(ROOT / "results" / "phase4.parquet")
    curves = profile_curves(p)
    x = np.logspace(-3, np.log10(3000), 400)
    Y = np.vstack([on_grid(c, x) for c in curves.values()])
    lo, hi = np.nanmin(Y, axis=0), np.nanmax(Y, axis=0)
    sun = solar_samples()
    ref = p[(p["kind"] == "reference") & (p["label"] == "Hibberd CASTOR 30B + STAR 48B")
            & (p["placement"] == "time_centred")].iloc[0]
    mar = p[(p["kind"] == "sep_power") & (p["placement"] == "time_centred")]

    apply_style()
    plt.rcParams.update({"font.size": 15, "axes.labelsize": 17, "axes.titlesize": 17, "xtick.labelsize": 14,
                         "ytick.labelsize": 14, "legend.fontsize": 13})
    fig, ax = plt.subplots(figsize=(13, 8.2), layout="constrained")
    ax.axvspan(1e-3, 1.0, color="#eef3f9", zorder=0)
    ax.text(0.0016, 30, "impulsive to within ~1%\n(burn shorter than r_p/v_p)", fontsize=14, color=INK_2, va="top")
    ax.fill_between(x, 100 * lo, 100 * hi, color=MUTED, alpha=0.45, linewidth=0, zorder=2,
                    label="finite-burn loss, any thrust profile (solid stack, nuclear thermal, SEP)")
    for edge in (lo, hi):
        ax.plot(x, 100 * edge, color=MUTED, linewidth=0.8, zorder=2)
    ax.plot(x, 100 * np.sqrt(lo * hi), color=INK_2, linewidth=1.4, zorder=3)
    xr = x[x <= 3]
    ax.plot(xr, 100 * xr**2 / 96, color=INK, linewidth=2.0, linestyle=(0, (5, 3)), zorder=4,
            label="rule of thumb: loss/Δv = Π²/96")
    ax.axhline(1.0, color=INK_2, linewidth=1.0, linestyle=(0, (1, 2)), zorder=1)
    ax.text(2400, 1.15, "1% of Δv", fontsize=13, color=INK_2, ha="right", va="bottom")
    for name, (engines, col) in GROUPS.items():
        g = sun[sun["engine"].isin(engines) & (sun["loss_rel"] > LOSS_FLOOR)]
        ax.scatter(g["Pi"], 100 * g["loss_rel"], s=22, color=col, alpha=0.5, linewidth=0, zorder=5)
        ax.scatter([], [], s=60, color=col, label=f"{name}: Phase 2 solar flybys, 3–20 R☉")
    ax.plot(ref["Pi"], 100 * ref["loss_rel"], "*", color=SERIES[0], markersize=26, markeredgecolor=INK,
            markeredgewidth=1.2, zorder=7)
    ax.annotate("Hibberd et al. 2026\n3I/ATLAS solar Oberth\n(CASTOR 30B + STAR 48B)", (ref["Pi"], 100 * ref["loss_rel"]),
                xytext=(-12, 30), textcoords="offset points", ha="right", fontsize=13, color=INK,
                arrowprops=dict(arrowstyle="-", color=INK_2, linewidth=0.8))
    pe, pl = mar["Pi_eff"].to_numpy(), 100 * mar["loss_rel"].to_numpy()
    ax.plot(pe, pl, "D", color=SERIES[2], markersize=13, markeredgecolor=INK, markeredgewidth=1.2, zorder=7)
    ax.annotate("Maraqten et al. 2026\nSEP perihelion arc at 0.3 au\n(placed on this curve)", (pe.min(), pl.min()),
                xytext=(-16, 14), textcoords="offset points", ha="right", fontsize=13, color=INK,
                arrowprops=dict(arrowstyle="-", color=INK_2, linewidth=0.8))
    ax.set_xscale("log")
    ax.set_yscale("log")
    ax.set_xlim(1e-3, 3000)
    ax.set_ylim(1e-6, 150)
    ax.set_xlabel("Π = burn duration / (r_p / v_p)")
    ax.set_ylabel("finite-burn loss  [% of Δv]")
    ax.set_title("One number sets the finite-burn penalty of a solar Oberth burn", loc="left", pad=30)
    ax.text(0.0, 1.015, "near-parabolic arrival, prograde burn centred on perihelion; loss as equivalent Δv",
            transform=ax.transAxes, fontsize=13, color=INK_2, va="bottom")
    ax.legend(loc="lower right", frameon=False)
    save_figure(fig, ROOT / "figures" / "hero_loss_vs_pi.png", "scripts/fig_hero.py")
    fig.savefig(ROOT / "figures" / "hero_loss_vs_pi.pdf", metadata={"Creator": "scripts/fig_hero.py"})
    plt.close(fig)

    out = {
        "band_max_over_min": {f"Pi={v:g}": float(np.exp(np.interp(np.log(v), np.log(x), np.log(hi / lo))))
                              for v in (0.01, 0.1, 1.0, 10.0, 100.0, 1000.0)},
        "solar_samples": {name: {"n": int(sun["engine"].isin(eng).sum()),
                                 "n_above_floor": int((sun["engine"].isin(eng) & (sun["loss_rel"] > LOSS_FLOOR)).sum()),
                                 "Pi_p10_med_p90": [float(sun[sun["engine"].isin(eng)]["Pi"].quantile(q)) for q in (0.1, 0.5, 0.9)],
                                 "loss_rel_p10_med_p90": [float(sun[sun["engine"].isin(eng)]["loss_rel"].quantile(q))
                                                          for q in (0.1, 0.5, 0.9)]}
                          for name, (eng, _) in GROUPS.items()},
        "solar_samples_relative_to_band_centre": {
            name: [float(q) for q in (sun[sun["engine"].isin(eng) & (sun["loss_rel"] > LOSS_FLOOR)].pipe(
                lambda g: g["loss_rel"] / np.exp(np.interp(np.log(g["Pi"]), np.log(x), np.log(np.sqrt(lo * hi)))))
                .quantile([0.05, 0.5, 0.95]) - 1.0)]
            for name, (eng, _) in GROUPS.items()},
        "hibberd": {"Pi": float(ref["Pi"]), "loss_rel": float(ref["loss_rel"])},
        "maraqten_Pi_eff_range": [float(pe.min()), float(pe.max())],
        "maraqten_loss_rel_range": [float(mar["loss_rel"].min()), float(mar["loss_rel"].max())],
    }
    (ROOT / "figures" / "hero_numbers.json").write_text(json.dumps(out, indent=1, ensure_ascii=False), encoding="utf-8")
    print(json.dumps(out, indent=1, ensure_ascii=False))


if __name__ == "__main__":
    main()
