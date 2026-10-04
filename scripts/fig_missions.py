"""Figure: where real missions sit. Mission-envelope samples on the (Π, v∞/v_esc) plane.

One panel per engine class. Background: Δv→0 theory contours of η_W,lin and the regime boundaries
(Π = 1, Π = Π_T). Points: Sobol samples of each (body, engine) envelope from configs/atlas/presets.yaml,
simulated with the real body (prograde). Each point is colored by its own simulated η. Hollow
markers mean the burn starts outside the body's sphere of influence (r_burn_start > r_SOI), where
the planet-centered model is not physical. Labels: body name and the median η of its samples.
Also writes figures/mission_table.csv (both steering laws), which is printed too.
Run:  .venv/Scripts/python scripts/fig_missions.py [results/missions.parquet]
"""

from __future__ import annotations

import sys
import warnings
from pathlib import Path

import numpy as np
import pandas as pd

from oberth_atlas import theory
from oberth_atlas.analysis import mission_table
from oberth_atlas.plotting import AXIS, INK, INK_2, SERIES, apply_style, eta_colormap, eta_norm, plt, save_figure
from oberth_atlas.presets import load_presets

ROOT = Path(__file__).resolve().parents[1]
warnings.filterwarnings("ignore", message="The occurrence of roundoff error")


def _theory_background(ax, xlim, ylim):
    Pi = np.logspace(np.log10(xlim[0]), np.log10(xlim[1]), 70)
    ratio = np.logspace(np.log10(ylim[0]), np.log10(ylim[1]), 36)
    Z = np.array([[theory.linear_response_eta(r * np.sqrt(2), p) for p in Pi] for r in ratio])
    cs = ax.contour(Pi, ratio, Z, levels=[0.01, 0.1, 0.5, 0.9, 0.99], colors=AXIS, linewidths=0.8)
    ax.clabel(cs, fmt=lambda v: f"η_W={v:g}", fontsize=6.5, inline=True)
    PiT = [theory.tail_crossover_pi(r * np.sqrt(2)) for r in ratio]
    ax.plot(PiT, ratio, color=SERIES[1], linewidth=1.0, alpha=0.7)
    ax.axvline(1.0, color=INK_2, linewidth=0.7, alpha=0.7)


def main(path: str) -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    pd.set_option("display.width", 200)
    m = pd.read_parquet(path)
    presets = load_presets()
    pro = m[(m["steering"] == "prograde") & (m["status"] == "ok")]
    xlim = (10 ** np.floor(np.log10(pro["Pi"].min())), 10 ** np.ceil(np.log10(pro["Pi"].max())))
    ylim = (10 ** np.floor(np.log10(pro["v_inf_over_vesc"].min())), 10 ** np.ceil(np.log10(pro["v_inf_over_vesc"].max())))

    apply_style()
    fig, axes = plt.subplots(2, 3, figsize=(15.5, 9.5), layout="constrained", sharex=True, sharey=True)
    cmap, norm = eta_colormap(), eta_norm(-0.5)
    for ax, (ekey, eng) in zip(axes.flat, presets.engines.items()):
        _theory_background(ax, xlim, ylim)
        g = pro[pro["engine"] == ekey]
        inside = g["soi_ratio_burn_start"] <= 1.0
        ax.scatter(g.loc[inside, "Pi"], g.loc[inside, "v_inf_over_vesc"], c=g.loc[inside, "eta"], cmap=cmap,
                   norm=norm, s=9, linewidths=0, rasterized=True)
        ax.scatter(g.loc[~inside, "Pi"], g.loc[~inside, "v_inf_over_vesc"], facecolors="none",
                   edgecolors=cmap(norm(g.loc[~inside, "eta"].to_numpy())), s=9, linewidths=0.6, rasterized=True)
        for bkey, gb in g.groupby("body"):
            x, y = np.median(gb["Pi"]), np.median(gb["v_inf_over_vesc"])
            ax.annotate(f"{bkey.capitalize()} {np.nanmedian(gb['eta']):.2f}", (x, y), fontsize=7.5, color=INK,
                        ha="center", va="center",
                        bbox=dict(boxstyle="round,pad=0.15", facecolor="#fcfcfbcc", edgecolor="none"))
        ax.set_xscale("log")
        ax.set_yscale("log")
        ax.set_xlim(*xlim)
        ax.set_ylim(*ylim)
        ax.set_title(f"{eng.label}: Isp {eng.isp[0]:.0f}–{eng.isp[1]:.0f} s, a0 {eng.a0[0]:.0e}–{eng.a0[1]:.0e} m/s²",
                     fontsize=9)
    for ax in axes[-1, :]:
        ax.set_xlabel("Π = t_b / τ")
    for ax in axes[:, 0]:
        ax.set_ylabel("v∞ / v_esc(r_p)")
    key = axes.flat[-1]
    key.axis("off")
    key.text(0.02, 0.95, "\n".join([
        "How to read",
        "• Point color: simulated η (prograde, real body).",
        "• Hollow point: burn starts outside the body's",
        "  sphere of influence (model not physical there).",
        "• Label: body and median η of its samples.",
        "• Gray contours: Δv→0 theory η_W,lin.",
        "• Orange line: Π = Π_T (hyperbolic-tail regime",
        "  to its right). Gray line: Π = 1.",
        "",
        f"Envelopes: configs/atlas/presets.yaml (representative",
        f"assumptions); Δv {presets.delta_v[0] / 1e3:g}–{presets.delta_v[1] / 1e3:g} km/s; "
        f"{int(len(pro) / len(presets.engines) / len(presets.bodies))} Sobol samples per body × engine.",
    ]), va="top", fontsize=8.5, color=INK_2, transform=key.transAxes)
    sm = plt.cm.ScalarMappable(norm=norm, cmap=cmap)
    cb = fig.colorbar(sm, ax=axes, shrink=0.5, pad=0.01, extend="min")
    cb.set_label("simulated η")
    fig.suptitle("Where real missions sit: body × engine envelopes on the dimensionless plane", fontsize=10,
                 x=0.01, ha="left")
    save_figure(fig, ROOT / "figures" / "missions_regions.png", "scripts/fig_missions.py")

    tables = [mission_table(m, law).assign(steering=law) for law in ("prograde", "inertial")]
    table = pd.concat(tables, ignore_index=True)
    table.to_csv(ROOT / "figures" / "mission_table.csv", index=False, float_format="%.6g")
    print(table.to_string(index=False, float_format=lambda v: f"{v:.3g}"))


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else str(ROOT / "results" / "missions.parquet"))
