"""Figure: η versus initial thrust acceleration a0, and convergence to the impulsive limit.

Writes figures/eta_vs_a0.png (300 dpi) and figures/eta_vs_a0.csv (the plotted data).
Run:  .venv/Scripts/python scripts/fig_eta_vs_a0.py
"""

from __future__ import annotations

import csv
import math
from pathlib import Path

import numpy as np

from oberth_atlas.burn import BurnSpec, Engine
from oberth_atlas.constants import EARTH, JUPITER
from oberth_atlas.plotting import INK_2, MARKERS, MUTED, SERIES, apply_style, plt, save_figure
from oberth_atlas.simulate import simulate_flyby
from oberth_atlas.steering import InertialFixed, Prograde

ROOT = Path(__file__).resolve().parents[1]
OUT_PNG = ROOT / "figures" / "eta_vs_a0.png"
OUT_CSV = ROOT / "figures" / "eta_vs_a0.csv"

CASES = [
    # label, body, v_inf [m/s], altitude [m], Δv [m/s], Isp [s], steering
    ("Earth · hydrolox · prograde", EARTH, 3e3, 300e3, 1e3, 465.0, Prograde()),
    ("Jupiter · NTR · prograde", JUPITER, 6e3, 0.5 * JUPITER.radius_eq, 2e3, 850.0, Prograde()),
    ("Earth · hydrolox · inertial", EARTH, 3e3, 300e3, 1e3, 465.0, InertialFixed()),
]
A0 = np.logspace(-2, 5, 57)   # m/s²


def main() -> None:
    rows = []
    for label, body, v_inf, alt, dv, isp, steering in CASES:
        for a0 in A0:
            r = simulate_flyby(body, v_inf, alt, BurnSpec(dv, Engine(isp, a0)), steering)
            rows.append(dict(case=label, a0_m_s2=a0, Pi=r.Pi, eta=r.eta, eta_err=r.eta_err, eta_E=r.eta_E,
                             impact=r.flags["impact"], captured=r.flags["captured"]))

    OUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    with OUT_CSV.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)

    apply_style()
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(10.5, 4.3), layout="constrained")
    floor = max(r["eta_err"] for r in rows if math.isfinite(r["eta_err"]))
    notes = []
    for i, (label, *_rest) in enumerate(CASES):
        sub = [r for r in rows if r["case"] == label]
        a0 = np.array([r["a0_m_s2"] for r in sub])
        Pi = np.array([r["Pi"] for r in sub])
        eta = np.array([r["eta"] for r in sub])
        err = np.array([r["eta_err"] for r in sub])
        ok = np.isfinite(eta)
        gap = 1.0 - eta
        fit = ok & (Pi < 0.2) & (gap > 1e3 * err)
        slope = np.polyfit(np.log(Pi[fit]), np.log(gap[fit]), 1)[0]
        style = dict(color=SERIES[i], marker=MARKERS[i], markersize=3.6, markeredgecolor="#fcfcfb",
                     markeredgewidth=0.6, linewidth=1.5)
        ax1.plot(a0[ok], eta[ok], label=label, **style)
        ax2.plot(Pi[ok & (gap > 0)], gap[ok & (gap > 0)], label=f"{label}  (fitted order {slope:.3f})", **style)
        bad = ~ok
        if bad.any():
            notes.append(f"{label}:\nimpact for a0 ≤ {a0[bad].max():.3g} m/s² (flagged, not plotted)")

    ax1.set_xscale("log")
    ax1.axhline(1.0, color=MUTED, linewidth=0.8)
    ax1.set_xlabel("initial thrust acceleration a0  [m/s²]")
    ax1.set_ylabel("Oberth efficiency  η = B_finite / B_imp")
    ax1.set_title("η rises to 1 as the burn becomes impulsive")
    ax1.legend(loc="lower right")
    if notes:
        ax1.text(0.45, 0.42, "\n".join(notes), transform=ax1.transAxes, va="top", fontsize=7.5, color=INK_2)

    pi_ref = np.logspace(-6, 0, 50)
    ax2.plot(pi_ref, 0.015 * pi_ref**2, color=MUTED, linewidth=0.9, linestyle=(0, (4, 3)), label="∝ Π²  (reference)")
    ax2.axhspan(1e-14, floor, color=MUTED, alpha=0.15, linewidth=0)
    ax2.text(2e-3, 2e-12, "max per-run numerical error estimate", fontsize=7.5, color=INK_2)
    ax2.set_xscale("log")
    ax2.set_yscale("log")
    ax2.set_ylim(1e-13, 1.5)
    ax2.set_xlabel("burn parameter  Π = t_b / τ")
    ax2.set_ylabel("1 − η")
    ax2.set_title("Convergence: 1 − η = O(Π²) for a centered burn")
    ax2.legend(loc="upper left", fontsize=7.5)

    fig.suptitle("Instantaneous-burn limit (Δv = 1 km/s Earth, 2 km/s Jupiter; burns centered on periapsis)",
                 fontsize=9.5, x=0.01, ha="left")
    save_figure(fig, OUT_PNG, "scripts/fig_eta_vs_a0.py")
    print(f"wrote {OUT_PNG.relative_to(ROOT)} and {OUT_CSV.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
