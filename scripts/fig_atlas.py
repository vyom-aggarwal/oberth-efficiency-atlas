"""Figure: the η atlas on the (Π, v∞/v_esc) plane, from the dimensionless sweep.

Rows: three Δv/V slices. Columns: prograde, inertial. The exhaust-velocity slice is c̃ nearest 1
(mass ratio is a small effect: theory section 4).
- Cells where the trajectory dips below R/r_p = 1/1.1 (flyby altitude h = 0.1 R) are masked as
  their own category ("impact"). The impact boundary is drawn as contours for h = 0.1 R (solid)
  and h = 1 R (dashed, R/r_p = 0.5).
- Cells whose η is unreliable (captured, floor hit, or error estimate > 1e-6) are a separate
  hatched category.
- Thin lines mark burn-start radii of 10² and 10³ r_p: roughly where the burn starts at the
  sphere of influence for low flybys of Earth/Venus/Mars (~10²) and Jupiter/Saturn (~10³).
Writes figures/atlas_eta.png.
Run:  .venv/Scripts/python scripts/fig_atlas.py [results/sweep_nd.parquet]
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from matplotlib.patches import Patch

from oberth_atlas.analysis import load, reliable
from oberth_atlas.plotting import (AXIS, INK, INK_2, MUTED, apply_style, eta_colormap, eta_norm, plt,
                                   save_figure)

ROOT = Path(__file__).resolve().parents[1]
DV_TARGETS = (0.003, 0.03, 0.3)
C_TARGET = 1.0
R_OVER_RP_MASK = 1 / 1.1
R_OVER_RP_ALT = 0.5
IMPACT_GRAY = "#6f6e69"


def _edges(vals: np.ndarray) -> np.ndarray:
    lv = np.log(vals)
    mid = 0.5 * (lv[1:] + lv[:-1])
    return np.exp(np.concatenate([[lv[0] - (mid[0] - lv[0])], mid, [lv[-1] + (lv[-1] - mid[-1])]]))


def main(path: str) -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    df = load(path)
    df["ok"] = reliable(df)
    v_axis = np.sort(df["v_inf"].unique())
    a_axis = np.sort(df["a0"].unique())
    dv_vals = np.sort(df["dv"].unique())
    c_vals = np.sort(df["c"].unique())
    c_sel = c_vals[np.argmin(np.abs(np.log(c_vals / C_TARGET)))]

    apply_style()
    fig, axes = plt.subplots(len(DV_TARGETS), 2, figsize=(12.0, 12.5), layout="constrained", sharex=True, sharey=True)
    cmap, norm = eta_colormap(), eta_norm(-0.5)
    for r, target in enumerate(DV_TARGETS):
        dv = dv_vals[np.argmin(np.abs(np.log(dv_vals / target)))]
        for col, law in enumerate(("prograde", "inertial")):
            ax = axes[r, col]
            g = df[(df["steering"] == law) & (df["dv"] == dv) & (df["c"] == c_sel)]
            grid = g.pivot_table(index="v_inf", columns="a0", values=["eta", "r_min", "r_burn_start", "Pi"],
                                 aggfunc="first").reindex(index=v_axis)
            okg = g.pivot_table(index="v_inf", columns="a0", values="ok", aggfunc="first").reindex(index=v_axis)
            eta = grid["eta"].reindex(columns=a_axis).to_numpy()
            rmin = grid["r_min"].reindex(columns=a_axis).to_numpy()
            rbs = grid["r_burn_start"].reindex(columns=a_axis).to_numpy()
            Pi = grid["Pi"].reindex(columns=a_axis).to_numpy()
            ok = okg.reindex(columns=a_axis).to_numpy().astype(bool)

            # Cell edges: Π = t_b(a0) · v_p(v∞), with t_b ∝ 1/a0 at fixed (Δv, c).
            vp_e = np.sqrt(_edges(v_axis) ** 2 + 2.0)
            tb_e = (c_sel / _edges(a_axis)) * -np.expm1(-dv / c_sel)
            X = tb_e[None, :] * vp_e[:, None]
            Y = np.broadcast_to((_edges(v_axis) / np.sqrt(2.0))[:, None], X.shape)
            impact = rmin < R_OVER_RP_MASK
            shown = np.where(ok & ~impact, eta, np.nan)
            pc = ax.pcolormesh(X, Y, np.ma.masked_invalid(shown), cmap=cmap, norm=norm, shading="flat",
                               rasterized=True)
            ax.pcolormesh(X, Y, np.ma.masked_where(~impact, np.ones_like(eta)), cmap=_solid(IMPACT_GRAY),
                          shading="flat", rasterized=True)
            unrel = ~ok & ~impact
            if unrel.any():
                hp = ax.pcolor(X, Y, np.ma.masked_where(~unrel, np.ones_like(eta)), hatch="////",
                               edgecolor=MUTED, linewidth=0.0)
                hp.set_facecolor("none")
            Yc = np.broadcast_to((v_axis / np.sqrt(2.0))[:, None], Pi.shape)
            for level, ls in ((R_OVER_RP_MASK, "-"), (R_OVER_RP_ALT, (0, (4, 2)))):
                if np.nanmin(rmin) < level < np.nanmax(rmin):
                    ax.contour(Pi, Yc, rmin, levels=[level], colors=INK, linewidths=1.1, linestyles=[ls])
            for level in (1e2, 1e3):
                if np.nanmin(rbs) < level < np.nanmax(rbs):
                    cs = ax.contour(Pi, Yc, rbs, levels=[level], colors=AXIS, linewidths=0.8)
                    ax.clabel(cs, fmt={level: f"{level:.0e} r_p"}, fontsize=6.5, inline=True)
            ax.set_xscale("log")
            ax.set_yscale("log")
            ax.set_title(f"{law}, Δv/V = {dv:.3g}, c/V = {c_sel:.3g}", fontsize=9.5)
            if r == len(DV_TARGETS) - 1:
                ax.set_xlabel("Π = t_b / τ")
            if col == 0:
                ax.set_ylabel("v∞ / v_esc(r_p)")
    cb = fig.colorbar(pc, ax=axes, shrink=0.5, pad=0.01, extend="min")
    cb.set_label("Oberth efficiency η")
    handles = [Patch(facecolor=IMPACT_GRAY, label="impact at h = 0.1 R (r_min < R/r_p = 0.91)"),
               plt.Line2D([], [], color=INK, linewidth=1.1, label="impact boundary, h = 0.1 R"),
               plt.Line2D([], [], color=INK, linewidth=1.1, linestyle=(0, (4, 2)), label="impact boundary, h = 1 R"),
               Patch(facecolor="none", edgecolor=MUTED, hatch="////", label="η unreliable / captured"),
               plt.Line2D([], [], color=AXIS, linewidth=0.8, label="burn-start radius 10² / 10³ r_p")]
    fig.legend(handles=handles, loc="outside lower center", ncol=5, fontsize=8, frameon=False)
    fig.suptitle("Oberth-efficiency atlas on the dimensionless grid (cells: the sweep's a0 × v∞ points)",
                 fontsize=10, x=0.01, ha="left")
    save_figure(fig, ROOT / "figures" / "atlas_eta.png", "scripts/fig_atlas.py")


def _solid(color):
    from matplotlib.colors import ListedColormap
    return ListedColormap([color])


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else str(ROOT / "results" / "sweep_nd.parquet"))
