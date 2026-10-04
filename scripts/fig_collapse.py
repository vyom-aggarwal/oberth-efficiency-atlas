"""Collapse analysis: how well does Π (or Π√C, or the theory) collapse η, and what explains the rest?

Outputs:
- figures/collapse_small_pi.png: 1 − η vs Π and vs Π√C (small-Π cases), prograde and inertial.
- figures/collapse_secondary.png: fraction of the remaining scatter explained by each candidate
  secondary parameter, after collapsing on Π.
- figures/collapse_metrics.csv: every number quoted (also printed).
Run:  .venv/Scripts/python scripts/fig_collapse.py [results/sweep_nd.parquet]
"""

from __future__ import annotations

import csv
import sys
from pathlib import Path

import numpy as np

from oberth_atlas.analysis import binned_scatter, explained_fraction, load, reliable
from oberth_atlas.plotting import INK_2, MUTED, SERIES, apply_style, plt, save_figure, sequential_colormap

ROOT = Path(__file__).resolve().parents[1]
CANDIDATES = {                       # column → label
    "v_inf_over_vesc": "v∞ / v_esc",
    "dv_over_vp": "Δv / v_p",
    "xi": "ξ\n(η_W → η map)",
    "dv_over_c": "Δv / c\n(mass ratio)",
    "dv_tb": "Δv·t_b / r_p\n(displacement)",
}


def main(path: str) -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    df = load(path)
    d = df[reliable(df)].copy()
    d["one_minus_eta"] = 1 - d["eta"]
    rows = []

    # ---- small-Π collapse: Π vs Π√C, on y = log10(1 − η), for cases far above the noise floor
    apply_style()
    fig, axes = plt.subplots(2, 2, figsize=(11.5, 8.0), layout="constrained")
    for r, law in enumerate(("prograde", "inertial")):
        g = d[(d["steering"] == law) & (d["Pi"] < 0.5) & (d["one_minus_eta"] > 1e3 * d["eta_err"])]
        y = np.log10(g["one_minus_eta"])
        for c, (xcol, xlabel) in enumerate((("Pi", "Π"), ("Pi_sqrtC", "Π √C"))):
            ax = axes[r, c]
            sc = ax.scatter(g[xcol], g["one_minus_eta"], c=np.log10(g["v_inf_over_vesc"]), s=3, linewidths=0,
                            cmap=sequential_colormap(), rasterized=True, vmin=-2.5, vmax=0.6)
            m = binned_scatter(g[xcol], y, per_decade=8)
            rows.append(dict(analysis="small-Pi collapse (Pi<0.5)", law=law, x=xcol, y="log10(1-eta)", **m))
            if xcol == "Pi_sqrtC":
                xx = np.logspace(np.log10(g[xcol].min()), np.log10(g[xcol].max()), 50)
                ax.plot(xx, xx**2, color=INK_2, linewidth=1.0, label="1 − η = (Π√C)²")
                ax.legend(loc="upper left", fontsize=7.5)
            ax.set_xscale("log")
            ax.set_yscale("log")
            ax.set_xlabel(xlabel)
            ax.set_ylabel("1 − η")
            ax.set_title(f"{law}: binned RMS scatter of log₁₀(1−η) = {m['rms']:.3f} dex")
    cb = fig.colorbar(sc, ax=axes, shrink=0.6, pad=0.01)
    cb.set_label("log₁₀(v∞ / v_esc)")
    fig.suptitle("Small-Π collapse (Π < 0.5): Π alone vs the theory-scaled Π√C", fontsize=9.5, x=0.01, ha="left")
    save_figure(fig, ROOT / "figures" / "collapse_small_pi.png", "scripts/fig_collapse.py")
    plt.close(fig)

    # ---- full-range collapse on η, and the model residual
    for law in ("prograde", "inertial"):
        g = d[d["steering"] == law]
        rows.append(dict(analysis="full range", law=law, x="Pi", y="eta", **binned_scatter(g["Pi"], g["eta"])))
        res = g["eta"] - g["eta_lin"]
        ok = np.isfinite(res)
        rows.append(dict(analysis="full range", law=law, x="Pi", y="eta - eta_lin(theory)",
                         **binned_scatter(g.loc[ok, "Pi"], res[ok])))

    # ---- secondary parameters: explained fraction of scatter left after collapsing on Π
    fig, axes = plt.subplots(1, 2, figsize=(11.5, 3.8), layout="constrained", sharey=True)
    for ax, law in zip(axes, ("prograde", "inertial")):
        g = d[d["steering"] == law]
        regimes = {"Π < 1": g["Pi"] < 1, "1 ≤ Π < 100": (g["Pi"] >= 1) & (g["Pi"] < 100), "Π ≥ 100": g["Pi"] >= 100}
        width = 0.8 / len(regimes)
        for i, (rname, sel) in enumerate(regimes.items()):
            gg = g[sel]
            fr = [explained_fraction(gg["Pi"], gg["eta"], gg[col]) for col in CANDIDATES]
            for col, f in zip(CANDIDATES, fr):
                rows.append(dict(analysis="explained fraction given Pi", law=law, x=f"Pi [{rname}]", y=col,
                                 rms=f, mad=np.nan, p95=np.nan, n=len(gg)))
            ax.bar(np.arange(len(CANDIDATES)) + (i - 1) * width, fr, width=width * 0.9, color=SERIES[i], label=rname)
        ax.set_xticks(np.arange(len(CANDIDATES)), list(CANDIDATES.values()), fontsize=8)
        ax.set_ylim(0, 1)
        ax.axhline(0, color=MUTED, linewidth=0.6)
        ax.set_title(f"{law}: share of within-Π scatter explained")
    axes[0].set_ylabel("explained fraction")
    axes[0].legend(fontsize=7.5)
    fig.suptitle("Which secondary parameter explains the scatter left after collapsing η on Π?",
                 fontsize=9.5, x=0.01, ha="left")
    save_figure(fig, ROOT / "figures" / "collapse_secondary.png", "scripts/fig_collapse.py")

    out = ROOT / "figures" / "collapse_metrics.csv"
    with out.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)
    for r in rows:
        print(f"{r['analysis']:32s} {r['law']:9s} x={r['x']:22s} y={r['y']:24s} "
              f"rms={r['rms']:.4g} mad={r['mad']:.3g} p95={r['p95']:.3g} n={r['n']}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else str(ROOT / "results" / "sweep_nd.parquet"))
