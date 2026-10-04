"""Figure: η versus Π for every reliable sweep case (brief: "η vs Π for every case on a single figure").

Two panels (prograde, inertial). Each is a 2-D density of all cases, with the Δv → 0
linear-response curves η_W,lin(Π) overlaid for several v∞/v_esc values.
Writes figures/eta_vs_pi_all.png.
Run:  .venv/Scripts/python scripts/fig_eta_vs_pi.py [results/sweep_nd.parquet]
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np

from oberth_atlas import theory
from oberth_atlas.analysis import load, reliable
from oberth_atlas.plotting import INK, INK_2, apply_style, plt, save_figure, sequential_colormap

ROOT = Path(__file__).resolve().parents[1]
REF = [0.01, 0.1, 1.0, 3.0]          # v∞/v_esc for the reference curves


def main(path: str) -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    df = load(path)
    d = df[reliable(df)]
    apply_style()
    fig, axes = plt.subplots(1, 2, figsize=(12.5, 4.8), layout="constrained", sharey=True)
    Pi_grid = np.logspace(-4, 7, 160)
    for ax, law in zip(axes, ("prograde", "inertial")):
        g = d[d["steering"] == law]
        hb = ax.hexbin(np.log10(g["Pi"]), g["eta"].clip(-1.5, 1.05), gridsize=(90, 50), bins="log",
                       cmap=sequential_colormap(), mincnt=1, linewidths=0, extent=(-4, 7, -1.5, 1.05))
        for ratio, ls in zip(REF, ["-", (0, (5, 2)), (0, (2, 2)), (0, (1, 1.5))]):
            v = ratio * np.sqrt(2.0)
            lin = [theory.linear_response_eta(v, P, law) for P in Pi_grid]
            ax.plot(np.log10(Pi_grid), lin, color=INK, linewidth=1.1, linestyle=ls,
                    label=f"Δv→0 theory, v∞/v_esc = {ratio:g}")
        ax.axhline(0, color=INK_2, linewidth=0.6)
        ax.set_xlabel("log₁₀ Π   (Π = t_b / τ)")
        ax.set_title(f"{law.capitalize()} steering: {len(g):,} cases")
        ax.set_xlim(-4, 7)
        ax.set_ylim(-1.5, 1.08)
    axes[0].set_ylabel("Oberth efficiency η")
    axes[0].legend(loc="lower left", fontsize=7.5)
    cb = fig.colorbar(hb, ax=axes, shrink=0.85, pad=0.01)
    cb.set_label("cases per cell")
    n_out = int(((d["eta"] < -1.5)).sum())
    fig.suptitle("η vs Π for every reliable sweep case (all v∞, Δv, Isp, a0 on the dimensionless grid)"
                 + (f"; {n_out} inertial cases with η < −1.5 clipped to the bottom edge" if n_out else ""),
                 fontsize=9.5, x=0.01, ha="left")
    save_figure(fig, ROOT / "figures" / "eta_vs_pi_all.png", "scripts/fig_eta_vs_pi.py")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else str(ROOT / "results" / "sweep_nd.parquet"))
