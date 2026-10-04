"""Figure: small-Π prefactor, the corrected theory vs the hand formula, over the whole sweep.

The (ω t_b)² Δv / 24 loss scaling, with ω² = μ/r³ (= kΠ² here), is Robbins (1966, AIAA J.
4(8):1417), as quoted by Confraria (2020). The hand formula C_user is Robbins' expression
converted to an energy deficit with v_p. The corrected C extends it to prograde steering, finite
Δv/v_p, the thrust profile, and hyperbolic flybys (docs/theory.md; RELATED_WORK.md).

For every reliable sweep row with Π < 0.1, plots (1 − η)/(C Π²) for the corrected theory C and
for C_user. Exact leading-order theory → 1 as Π → 0, with an O(Π²) correction.
Writes figures/prefactor_check.png and prints summary statistics.
Run:  .venv/Scripts/python scripts/fig_prefactor_check.py [results/sweep_nd.parquet]
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np

from oberth_atlas.analysis import load, reliable
from oberth_atlas.plotting import INK_2, MUTED, SERIES, apply_style, plt, save_figure, sequential_colormap

ROOT = Path(__file__).resolve().parents[1]


def main(path: str) -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    df = load(path)
    d = df[reliable(df) & (df["Pi"] < 0.1)].copy()
    d["r_th"] = (1 - d["eta"]) / (d["C_theory"] * d["Pi"] ** 2)
    d["r_user"] = (1 - d["eta"]) / (d["C_user"] * d["Pi"] ** 2)
    # Only rows where 1 − η stands far above the numerical error estimate.
    d = d[(1 - d["eta"]) > 1e3 * d["eta_err"]]

    apply_style()
    fig, axes = plt.subplots(1, 3, figsize=(13.5, 4.3), layout="constrained")
    cmap = sequential_colormap()
    for ax, law in zip(axes[:2], ("prograde", "inertial")):
        g = d[d["steering"] == law]
        dev = np.abs(g["r_th"] - 1)
        sc = ax.scatter(g["Pi"], dev.clip(lower=1e-8), c=np.log10(g["dv_over_vp"]), cmap=cmap, s=4, linewidths=0,
                        vmin=-3.5, vmax=0.5, rasterized=True)
        pp = np.logspace(-2, -1, 20)
        ax.plot(pp, 0.3 * pp**2, color=INK_2, linewidth=0.9, linestyle=(0, (4, 2)), label="∝ Π² (next order)")
        ax.axhline(1e-3, color=MUTED, linewidth=0.8)
        ax.text(6e-4, 1.3e-3, "noise ceiling set by the filter 1−η > 10³·δη", fontsize=7, color=INK_2)
        ax.set_xscale("log")
        ax.set_yscale("log")
        ax.set_ylim(1e-8, 1e-1)
        ax.set_xlabel("Π")
        ax.set_ylabel("|(1 − η) / (C_theory Π²) − 1|")
        ax.set_title(f"Corrected theory, {law}")
        ax.legend(loc="upper left", fontsize=7.5)
    cb = fig.colorbar(sc, ax=axes[:2], shrink=0.85, pad=0.01)
    cb.set_label("log₁₀(Δv / v_p)")

    ax = axes[2]
    small = d[d["Pi"] < 0.01]
    for i, law in enumerate(("prograde", "inertial")):
        g = small[small["steering"] == law]
        ax.scatter(g["dv_over_vp"], g["r_user"], s=4, color=SERIES[i], linewidths=0,
                   label=f"hand formula (Robbins-type), {law}", rasterized=True)
        ax.scatter(g["dv_over_vp"], g["r_th"], s=4, color=MUTED, linewidths=0, rasterized=True,
                   label="corrected theory (both)" if i == 0 else None)
    ax.set_xscale("log")
    ax.set_xlabel("Δv / v_p")
    ax.set_ylabel("(1 − η) / (C Π²)   at Π < 0.01")
    ax.set_title("Hand formula underestimates by O(Δv/v_p)")
    ax.legend(loc="upper left", fontsize=7.5, markerscale=3)
    fig.suptitle("Small-Π prefactor, measured 1 − η against C Π² for every sweep point with Π < 0.1.\n"
                 "Loss scaling (ωt)²Δv/24 after Robbins (1966); C extends it to prograde steering, "
                 "finite Δv and hyperbolic flybys",
                 fontsize=9.5, x=0.01, ha="left")
    save_figure(fig, ROOT / "figures" / "prefactor_check.png", "scripts/fig_prefactor_check.py")

    for law in ("prograde", "inertial"):
        g = small[small["steering"] == law]
        print(f"{law:9s} Π<0.01 (n={len(g)}): theory ratio median {np.median(g.r_th):.6f} "
              f"[min {g.r_th.min():.6f}, max {g.r_th.max():.6f}];  hand-formula ratio median "
              f"{np.median(g.r_user):.4f} [min {g.r_user.min():.4f}, max {g.r_user.max():.4f}]")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else str(ROOT / "results" / "sweep_nd.parquet"))
