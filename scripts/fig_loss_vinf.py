"""Paper figure: how the finite-burn loss depends on arrival speed → figures/loss_vs_pi_vinf.png.

Companion to the single-band hero figure (user decision, 2026-10-06). From the Phase 2 prograde sweep
(hyperbolic arrivals, centred burns), restricted to small Δv/v_p (≤ 0.03) and Δv/c (≤ 0.3) so that
arrival speed is the only parameter: median equivalent-Δv loss/Δv in log-Π bins for five v∞/v_esc
values, with the leading-order law k(1−k)Π²/24 (k = 1/v_p² in units of μ/r_p) for each, and the
near-parabolic band of the hero figure for reference.
Also writes figures/loss_vinf_numbers.json.
Run:  .venv/Scripts/python scripts/fig_loss_vinf.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

from oberth_atlas.plotting import BLUE_RAMP, INK, INK_2, MUTED, apply_style, plt, save_figure

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
VR = (0.0098, 0.1107, 0.473, 1.2455, 3.2791)          # sweep grid values of v∞/v_esc
MARK = ["o", "s", "^", "D", "v"]
BINS = np.logspace(-3, 3, 31)


def data() -> pd.DataFrame:
    d = pd.read_parquet(ROOT / "results" / "sweep_nd.parquet")
    d = d[(d["status"] == "ok") & (d["steering"] == "prograde") & ~d["hit_floor"] & ~d["captured"]].copy()
    d["loss_rel"] = 1.0 - (np.sqrt(d["v_inf_out"] ** 2 + 2.0) - d["v_p"]) / d["dv"]
    err = d["energy_balance_residual"] / ((d["v_p"] + d["dv"]) * d["dv"])
    d = d[(d["dv_over_vp"] <= 0.03) & (d["dv_over_c"] <= 0.3) & (d["loss_rel"] > 0) & (err < 1e-2 * d["loss_rel"])]
    d["vr"] = d["v_inf_over_vesc"].round(4)
    return d[d["vr"].isin(VR)]


def binned(g: pd.DataFrame):
    idx = np.digitize(g["Pi"], BINS)
    rows = [(np.exp(np.log(s["Pi"]).mean()), s["loss_rel"].median(), len(s)) for _, s in g.groupby(idx) if len(s) >= 3]
    return np.array(rows).T if rows else np.empty((3, 0))


def crossing(x, y, level):
    for i in range(len(x) - 1):
        if (y[i] - level) * (y[i + 1] - level) <= 0 and y[i] != y[i + 1]:
            lx, ly = np.log(x[i:i + 2]), np.log(y[i:i + 2])
            return float(np.exp(lx[0] + (np.log(level) - ly[0]) * (lx[1] - lx[0]) / (ly[1] - ly[0])))
    return float("nan")


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    d = data()
    import fig_hero as H
    p = pd.read_parquet(ROOT / "results" / "phase4.parquet")
    curves = H.profile_curves(p)
    xb = np.logspace(-3, 3, 200)
    Y = np.vstack([H.on_grid(c, xb) for c in curves.values()])
    lo, hi = np.nanmin(Y, axis=0), np.nanmax(Y, axis=0)
    apply_style()
    fig, ax = plt.subplots(figsize=(10.5, 6.2), layout="constrained")
    ax.fill_between(xb, 100 * lo, 100 * hi, color=MUTED, alpha=0.35, linewidth=0,
                    label="near-parabolic solar Oberth band (hero figure)")
    out = {"selection": {"dv_over_vp_max": 0.03, "dv_over_c_max": 0.3, "n_runs": int(len(d)), "v_over_vesc": list(VR)},
           "by_v_over_vesc": {}}
    cols = BLUE_RAMP[2:]
    for i, vr in enumerate(VR):
        g = d[d["vr"] == vr]
        x, y, n = binned(g)
        v = vr * np.sqrt(2.0)
        k = 1.0 / (v * v + 2.0)
        ax.plot(x, 100 * y, color=cols[i], marker=MARK[i], markersize=4, markeredgecolor="#fcfcfb", linewidth=1.6,
                label=f"v∞/v_esc = {vr:.2g}  (sweep median)")
        xs = np.logspace(-3, 0.5, 50)
        ax.plot(xs, 100 * k * (1 - k) * xs**2 / 24, color=cols[i], linewidth=0.9, linestyle=(0, (3, 2)))
        out["by_v_over_vesc"][f"{vr:g}"] = {
            "k": k, "leading_order_coeff_k(1-k)/24": k * (1 - k) / 24, "n_runs": int(len(g)),
            "Pi_at_1pct": crossing(x, y, 1e-2), "Pi_at_0.1pct": crossing(x, y, 1e-3),
            "loss_rel_at_Pi_10": float(np.exp(np.interp(np.log(10.0), np.log(x), np.log(y)))) if len(x) else None}
    ax.plot([], [], color=INK_2, linewidth=0.9, linestyle=(0, (3, 2)), label="leading order k(1−k)Π²/24 for each")
    ax.axhline(1.0, color=INK, linewidth=0.8, linestyle=(0, (1, 2)))
    ax.text(1.2e-3, 1.15, "1% of Δv", fontsize=8, color=INK_2)
    ax.set_xscale("log")
    ax.set_yscale("log")
    ax.set_xlim(1e-3, 1e3)
    ax.set_ylim(1e-6, 120)
    ax.set_xlabel("Π = t_b/τ")
    ax.set_ylabel("finite-burn loss  [% of Δv]  (equivalent Δv)")
    ax.legend(fontsize=7.5, loc="lower right")
    fig.suptitle("Faster arrivals lose less: the loss-vs-Π curve shifts down as v∞/v_esc grows "
                 "(prograde, centred, Δv/v_p ≤ 0.03, Δv/c ≤ 0.3; Phase 2 sweep)", fontsize=9.5, x=0.01, ha="left")
    save_figure(fig, ROOT / "figures" / "loss_vs_pi_vinf.png", "scripts/fig_loss_vinf.py")
    plt.close(fig)
    (ROOT / "figures" / "loss_vinf_numbers.json").write_text(json.dumps(out, indent=1, ensure_ascii=False), encoding="utf-8")
    print(json.dumps(out, indent=1, ensure_ascii=False))


if __name__ == "__main__":
    main()
