"""Figure: the large-Π structure (prograde). Three regimes and their crossovers.

(a) η_W vs Π for near-linear-response cases (Δv/v_p < 0.03), colored by v∞/v_esc, with the asymptotes:
    I   1 − η_W = C₀ Π²             (small Π)
    II  η_W = (9/(2Π))^(1/3)         (parabolic core; needs v∞ ≪ v_esc)
    III η_W ~ (ln Π − const)/Π       (hyperbolic tail, Π ≫ Π_T = v_p/ṽ∞³)
(b) η_W·(Π/4.5)^(1/3) vs Π/Π_T: the regime II plateau at 1 and the turnover into regime III.
(c) Regime diagram on (Π, v∞/v_esc): boundaries Π = 1 and Π = Π_T, plus the Π where η_W = 0.5,
    from theory and from the sweep data.
Writes figures/regimes.png and figures/regimes_half_point.csv.
Run:  .venv/Scripts/python scripts/fig_regimes.py [results/sweep_nd.parquet]
"""

from __future__ import annotations

import csv
import sys
import warnings
from pathlib import Path

import numpy as np

from oberth_atlas import theory
from oberth_atlas.analysis import eta_half_point, load, reliable
from oberth_atlas.plotting import INK, INK_2, MUTED, SERIES, apply_style, plt, save_figure, sequential_colormap

ROOT = Path(__file__).resolve().parents[1]
warnings.filterwarnings("ignore", message="The occurrence of roundoff error")


def main(path: str) -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    df = load(path)
    d = df[reliable(df) & (df["steering"] == "prograde") & (df["dv_over_vp"] < 0.03)].copy()
    apply_style()
    fig, axes = plt.subplots(1, 3, figsize=(15.0, 4.6), layout="constrained")
    cmap = sequential_colormap()

    ax = axes[0]
    sc = ax.scatter(d["Pi"], d["eta_W"], c=np.log10(d["v_inf_over_vesc"]), cmap=cmap, s=3, linewidths=0,
                    vmin=-2.5, vmax=0.6, rasterized=True)
    P = np.logspace(-3, 7, 300)
    ax.plot(P[P > 3], theory.parabolic_core_asymptote(P[P > 3]), color=INK, linewidth=1.2,
            label="II: (9/2Π)^⅓ (parabolic core)")
    for ratio, ls in ((0.01, (0, (1, 1.5))), (0.1, (0, (4, 2))), (1.0, "-")):
        v = ratio * np.sqrt(2)
        c0 = theory.small_pi_prefactor(v, 1e-9, np.inf)
        small = P[P < 1.0]
        ax.plot(small, 1 - c0 * small**2, color=INK_2, linewidth=0.9, linestyle=ls)
        big = P[P > 30 * theory.tail_crossover_pi(v)]
        ax.plot(big, [theory.large_pi_asymptote(v, x) for x in big], color=SERIES[1], linewidth=1.2, linestyle=ls,
                label=f"III: tail, v∞/v_esc = {ratio:g}")
    ax.plot([], [], color=INK_2, linewidth=0.9, label="I: 1 − C₀Π²")
    ax.set_xscale("log")
    ax.set_yscale("log")
    ax.set_ylim(1e-5, 1.5)
    ax.set_xlabel("Π")
    ax.set_ylabel("η_W (energy efficiency, baseline-subtracted)")
    ax.set_title("Three regimes (Δv/v_p < 0.03)")
    ax.legend(loc="lower left", fontsize=7)

    ax = axes[1]
    x = d["Pi"] / d["Pi_T"]
    y = d["eta_W"] * (d["Pi"] / 4.5) ** (1 / 3)
    sel = d["Pi"] > 3
    ax.scatter(x[sel], y[sel], c=np.log10(d.loc[sel, "v_inf_over_vesc"]), cmap=cmap, s=3, linewidths=0,
               vmin=-2.5, vmax=0.6, rasterized=True)
    ax.axhline(1.0, color=INK, linewidth=1.0)
    ax.axvline(1.0, color=MUTED, linewidth=0.8)
    ax.set_xscale("log")
    ax.set_yscale("log")
    ax.set_ylim(1e-2, 3)
    ax.set_xlabel("Π / Π_T     (Π_T = v_p V³/v∞³: hyperbola crossing time / τ)")
    ax.set_ylabel("η_W · (Π/4.5)^⅓")
    ax.set_title("Regime II plateau, turnover into III at Π ≈ Π_T  (Π > 3)")
    cb = fig.colorbar(sc, ax=axes[:2], shrink=0.85, pad=0.01)
    cb.set_label("log₁₀(v∞ / v_esc)")

    # (c) regime diagram with the η_W = 0.5 point from theory and data
    ax = axes[2]
    ratios = np.logspace(-2.5, 0.6, 60)
    v = ratios * np.sqrt(2)
    PiT = np.array([theory.tail_crossover_pi(x) for x in v])
    ax.plot(PiT, ratios, color=SERIES[1], linewidth=1.5, label="Π = Π_T (II → III)")
    ax.axvline(1.0, color=INK_2, linewidth=1.0, label="Π = 1 (I → II/III)")
    half_th = []
    for x in v:
        grid = np.logspace(-1, 7, 120)
        half_th.append(eta_half_point(grid, np.array([theory.linear_response_eta(x, g) for g in grid])))
    ax.plot(half_th, ratios, color=INK, linewidth=1.5, label="η_W = 0.5, Δv→0 theory")
    rows = []
    for rv, g in d.groupby("v_inf_over_vesc"):
        for (dv, c), gg in g.groupby(["dv", "c"]):
            if len(gg) >= 8:
                rows.append(dict(v_inf_over_vesc=rv, dv=dv, c=c, dv_over_vp=float(gg["dv_over_vp"].iloc[0]),
                                 Pi_half_data=eta_half_point(gg["Pi"].to_numpy(), gg["eta_W"].to_numpy()),
                                 Pi_half_theory=eta_half_point(np.logspace(-1, 7, 200), np.array(
                                     [theory.linear_response_eta(rv * np.sqrt(2), p) for p in np.logspace(-1, 7, 200)]))))
    hp = [r for r in rows if np.isfinite(r["Pi_half_data"])]
    ax.scatter([r["Pi_half_data"] for r in hp], [r["v_inf_over_vesc"] for r in hp], s=10, color=SERIES[0],
               linewidths=0, label="η_W = 0.5, sweep data", zorder=3)
    ax.fill_betweenx(ratios, 1.0, np.maximum(PiT, 1.0), where=PiT > 1, color=SERIES[2], alpha=0.12, linewidth=0)
    ax.text(150, 0.006, "II: parabolic core", fontsize=8, color=INK_2)
    ax.text(3e4, 0.4, "III: hyperbolic tail", fontsize=8, color=INK_2)
    ax.text(0.03, 0.05, "I: impulsive", fontsize=8, color=INK_2, rotation=90)
    ax.set_xscale("log")
    ax.set_yscale("log")
    ax.set_xlim(1e-2, 1e8)
    ax.set_xlabel("Π")
    ax.set_ylabel("v∞ / v_esc")
    ax.set_title("Regime diagram (prograde)")
    ax.legend(loc="lower right", fontsize=7)
    fig.suptitle("Large-Π structure of the finite-burn Oberth efficiency", fontsize=9.5, x=0.01, ha="left")
    save_figure(fig, ROOT / "figures" / "regimes.png", "scripts/fig_regimes.py")

    out = ROOT / "figures" / "regimes_half_point.csv"
    with out.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)
    rel = [r["Pi_half_data"] / r["Pi_half_theory"] - 1 for r in hp if np.isfinite(r["Pi_half_theory"])]
    print(f"η_W=0.5 point, data vs Δv→0 theory over {len(rel)} families: median rel. diff {np.median(rel):+.3%}, "
          f"max |rel diff| {np.max(np.abs(rel)):.3%}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else str(ROOT / "results" / "sweep_nd.parquet"))
