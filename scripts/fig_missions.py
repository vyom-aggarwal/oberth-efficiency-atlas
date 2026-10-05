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

INVALID_GREY = "#b9b8b2"   # neutral: carries no η value
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
    ylim = (10 ** (np.floor(2 * np.log10(pro["v_inf_over_vesc"].min())) / 2),
            10 ** (np.ceil(2 * np.log10(pro["v_inf_over_vesc"].max())) / 2))

    apply_style()
    fig, axes = plt.subplots(2, 3, figsize=(15.5, 9.5), layout="constrained", sharex=True, sharey=True)
    cmap, norm = eta_colormap(), eta_norm(-0.5)
    for ax, (ekey, eng) in zip(axes.flat, presets.engines.items()):
        _theory_background(ax, xlim, ylim)
        g = pro[pro["engine"] == ekey]
        inside = g["soi_ratio_burn_start"] <= 1.0
        ax.scatter(g.loc[inside, "Pi"], g.loc[inside, "v_inf_over_vesc"], c=g.loc[inside, "eta"], cmap=cmap,
                   norm=norm, s=9, linewidths=0, rasterized=True)
        # Burns that start outside the sphere of influence: planet-centred model invalid, so greyed out.
        ax.scatter(g.loc[~inside, "Pi"], g.loc[~inside, "v_inf_over_vesc"], color=INVALID_GREY, s=7,
                   linewidths=0, rasterized=True, zorder=1)
        lines = []
        for bkey, gb in g.groupby("body", sort=False):
            valid = gb[gb["soi_ratio_burn_start"] <= 1.0]
            share_out = 100 * (1 - len(valid) / len(gb))
            if len(valid) >= 5:
                p10, p50, p90 = np.nanpercentile(valid["eta"].to_numpy(), [10, 50, 90])
                stats = f"{p50:5.2f}  ({p10:.2f}–{p90:.2f})"
            else:
                stats = "  n/a  (model invalid)"
            lines.append(f"{bkey.capitalize():8s} {stats:22s} {share_out:3.0f}%")
        # Put the summary in whichever corner holds fewer samples.
        lx, ly = np.log10(g["Pi"]), np.log10(g["v_inf_over_vesc"])
        midx, midy = np.log10(np.sqrt(xlim[0] * xlim[1])), np.log10(np.sqrt(ylim[0] * ylim[1]))
        upper_left = ((lx < midx) & (ly > midy)).sum() <= ((lx > midx) & (ly < midy)).sum()
        ax.text(0.02 if upper_left else 0.98, 0.98 if upper_left else 0.02,
                "body     valid-sample η (p10–p90) outside SOI\n" + "\n".join(lines),
                transform=ax.transAxes, ha="left" if upper_left else "right", va="top" if upper_left else "bottom",
                fontsize=7, family="monospace", color=INK, multialignment="left",
                bbox=dict(boxstyle="round,pad=0.3", facecolor="#fcfcfbe6", edgecolor="#e1e0d9"))
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
        "• Grey point: burn starts outside the body's sphere",
        "  of influence: planet-centred model invalid.",
        "  (Heliocentric low-thrust treatment: out of scope.)",
        "• Box: per body, median η (10th–90th percentile) over",
        "  valid samples only, and the share greyed out.",
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
    fig.suptitle("Where real missions sit: body × engine envelopes on the dimensionless plane "
                 "(grey: burn starts outside the SOI, planet-centred model invalid)", fontsize=10,
                 x=0.01, ha="left")
    save_figure(fig, ROOT / "figures" / "missions_regions.png", "scripts/fig_missions.py")

    tables = [mission_table(m, law).assign(steering=law) for law in ("prograde", "inertial")]
    table = pd.concat(tables, ignore_index=True)
    table.to_csv(ROOT / "figures" / "mission_table.csv", index=False, float_format="%.6g")
    print(table.to_string(index=False, float_format=lambda v: f"{v:.3g}"))


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else str(ROOT / "results" / "missions.parquet"))
