"""Measured finite-burn losses against Robbins' (1966) expression, as quoted by Confraria (2020).

Robbins' expression, quoted as an upper bound on the extra Δv: (1/24)(ω_s t_b)² Δv with
ω_s² = μ/r³. In our variables this is k Π² Δv / 24.

(A) Flyby sweep. For every reliable row, the measured loss is the energy-equivalent extra Δv
    L = (Δε_imp − Δε_fin)/(v_p + Δv), the extra Δv that makes up the energy deficit at the
    marginal speed v_p + Δv. This is exact to leading order in Π. The ratio is R = L / (kΠ²Δv/24).
(B) Confraria's own setup, re-run in our code. Tangential (prograde) escape burns from a 200 km
    circular Earth orbit, Isp = 300 s, targeting the impulsive C3, for Δv = 3.5–5 km/s (the
    hyperbolic, C3-targeting cases of her figs. 1/4.34). The exact extra Δv is found by root-finding
    the burn duration. Reported as (Robbins − actual)/actual × 100, her eq. 4.2.
Writes figures/robbins_comparison.png and figures/robbins_comparison.csv, and prints a summary.
Run:  .venv/Scripts/python scripts/robbins_comparison.py [results/sweep_nd.parquet]
"""

from __future__ import annotations

import csv
import math
import sys
from pathlib import Path

import numpy as np
from scipy.integrate import solve_ivp
from scipy.optimize import brentq

from oberth_atlas import theory
from oberth_atlas.analysis import load, reliable
from oberth_atlas.constants import EARTH, G0
from oberth_atlas.dynamics import specific_energy, thrust_rhs
from oberth_atlas.plotting import INK, INK_2, MUTED, SERIES, apply_style, plt, save_figure, sequential_colormap
from oberth_atlas.steering import Prograde, SteeringContext

ROOT = Path(__file__).resolve().parents[1]


def sweep_ratios(path: str):
    df = load(path)
    d = df[reliable(df)].copy()
    d["loss"] = 0.5 * (d["v_inf_imp"] ** 2 - d["v_inf_out"] ** 2) / (d["v_p"] + d["dv"])
    d["robbins"] = d["k"] * d["Pi"] ** 2 * d["dv"] / 24.0
    d["R"] = d["loss"] / d["robbins"]
    d["R_theory0"] = [theory.equivalent_dv_loss_per_pi2(vp, dv, c, law) / theory.robbins_loss_per_pi2(vp, dv)
                      if pi < 0.01 else np.nan
                      for vp, dv, c, law, pi in zip(d["v_p"], d["dv"], d["c"], d["steering"], d["Pi"])]
    # Keep rows whose loss stands well above the numerical error, mapped to Δv units.
    err_loss = d["eta_err"] * d["b_imp"] * d["v_inf_imp"] / (d["v_p"] + d["dv"])
    return d[d["loss"] > 1e3 * err_loss]


def confraria_case(dv_kms: float, tw: float, isp: float = 300.0, alt_km: float = 200.0):
    """Exact finite-burn loss (km/s) and Robbins' estimate for a tangential escape burn from a
    circular orbit targeting the impulsive C3. Nondimensional internally (r = 1, μ = 1)."""
    r = EARTH.radius_eq + alt_km * 1e3
    V = math.sqrt(EARTH.gm / r)
    g_loc = EARTH.gm / r**2
    dv, c, a0 = dv_kms * 1e3 / V, isp * G0 / V, tw * G0 / g_loc
    eps_target = 0.5 * (1.0 + dv) ** 2 - 1.0
    steer = Prograde().bind(SteeringContext(0.0, 1.0))
    rhs = thrust_rhs(1.0, a0, c, steer)
    y0 = np.array([1.0, 0, 0, 0, 1.0, 0, 1.0, 0])

    def eps_after(t):
        sol = solve_ivp(rhs, (0.0, t), y0, method="DOP853", rtol=1e-12, atol=1e-12)
        return float(specific_energy(sol.y[:, -1], 1.0))

    t_imp = (c / a0) * -math.expm1(-dv / c)              # burn time for the impulsive Δv (her eq. 11)
    t_hi = t_imp * 1.05
    while eps_after(t_hi) < eps_target:
        t_hi *= 1.3
    t_star = brentq(lambda t: eps_after(t) - eps_target, t_imp, t_hi, xtol=1e-13 * t_hi, rtol=1e-14)
    loss = -c * math.log1p(-(a0 / c) * t_star) - dv
    robbins = t_imp**2 * dv / 24.0                       # ω_s = 1 in these units; Π = t_imp (v = r = 1)
    lead = theory.equivalent_dv_loss_per_pi2(1.0, dv, c, "prograde") * t_imp**2
    return dict(dv_kms=dv_kms, tw=tw, Pi=t_imp, loss_kms=loss * V / 1e3, robbins_kms=robbins * V / 1e3,
                lead_theory_kms=lead * V / 1e3, overestimate_pct=100 * (robbins - loss) / loss,
                overestimate_vs_leading_pct=100 * (robbins - lead) / lead)


def main(path: str) -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    d = sweep_ratios(path)
    rows = []
    print("(A) Flyby sweep: measured loss / Robbins (kΠ²Δv/24)")
    for law in ("prograde", "inertial"):
        g = d[d["steering"] == law]
        for lo, hi in ((0, 0.01), (0.01, 0.1), (0.1, 0.3), (0.3, 1), (1, 3), (3, 10)):
            gg = g[(g["Pi"] >= lo) & (g["Pi"] < hi)]
            if len(gg) == 0:
                continue
            q = np.percentile(gg["R"], [0, 10, 50, 90, 100])
            rows.append(dict(part="A", law=law, band=f"{lo}-{hi}", n=len(gg), R_min=q[0], R_p10=q[1], R_med=q[2],
                             R_p90=q[3], R_max=q[4]))
            print(f"  {law:9s} Π {lo:>5}–{hi:<5} n={len(gg):6d}  R: min {q[0]:.3f}  p10 {q[1]:.3f}  "
                  f"median {q[2]:.3f}  p90 {q[3]:.3f}  max {q[4]:.3f}")
        small = g[g["Pi"] < 0.01]
        dev = np.abs(small["R"] / small["R_theory0"] - 1)
        print(f"  {law:9s} Π<0.01: measured R vs leading-order theory R: median |rel diff| {np.median(dev):.1e}, max {dev.max():.1e}")
        big = small[small["dv_over_c"] > 1]
        if len(big):
            print(f"  {law:9s} Π<0.01 with Δv/c > 1: R from {big['R'].min():.3f} to {big['R'].max():.3f} "
                  f"(centered-in-time burns, Δv delivered late)")

    print("(B) Confraria's setup: 200 km circular Earth orbit, Isp 300 s, tangential, C3 target")
    conf = []
    for dv_kms in (3.5, 4.0, 4.5, 5.0):
        for tw in (0.1, 0.15, 0.2, 0.3, 0.4, 0.5, 1.0, 2.0):
            r = confraria_case(dv_kms, tw)
            conf.append(r)
            rows.append(dict(part="B", law="prograde", band=f"dv={dv_kms} T/W={tw}", n=1, R_min=np.nan, R_p10=np.nan,
                             R_med=r["loss_kms"] / r["robbins_kms"], R_p90=np.nan, R_max=np.nan))
            print(f"  Δv {dv_kms:.1f} km/s  T/W {tw:4.2f}  Π {r['Pi']:.3f}  loss {1e3 * r['loss_kms']:8.2f} m/s  "
                  f"Robbins {1e3 * r['robbins_kms']:8.2f} m/s  overestimate {r['overestimate_pct']:6.1f}%  "
                  f"(leading-order theory: {r['overestimate_vs_leading_pct']:6.1f}%)")

    with (ROOT / "figures" / "robbins_comparison.csv").open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(conf[0]))
        w.writeheader()
        w.writerows(conf)

    # ---- figure
    apply_style()
    fig, axes = plt.subplots(1, 3, figsize=(15.5, 4.6), layout="constrained")
    cmap = sequential_colormap()
    for ax, law in zip(axes[:2], ("prograde", "inertial")):
        g = d[d["steering"] == law]
        sc = ax.scatter(g["Pi"], g["R"], c=g["k"], cmap=cmap, s=3, linewidths=0, vmin=0, vmax=0.5, rasterized=True)
        ax.axhline(1.0, color=INK, linewidth=1.0)
        ax.axvspan(0.4, 8, color=MUTED, alpha=0.12, linewidth=0)
        ax.text(0.45, 1.75, "Π range of\nConfraria (2020)", fontsize=7, color=INK_2)
        ax.set_xscale("log")
        ax.set_xlim(1e-4, 1e2)
        ax.set_ylim(0, 2.0)
        ax.set_xlabel("Π")
        ax.set_ylabel("measured Δv loss / Robbins (kΠ²Δv/24)")
        ax.set_title(f"Flyby sweep, {law}")
    cb = fig.colorbar(sc, ax=axes[:2], shrink=0.85, pad=0.01)
    cb.set_label("k = μ/(r_p v_p²)")
    ax = axes[2]
    for i, dv_kms in enumerate((3.5, 4.0, 4.5, 5.0)):
        rr = [r for r in conf if r["dv_kms"] == dv_kms]
        ax.plot([r["tw"] for r in rr], [r["overestimate_pct"] for r in rr], marker="os^D"[i], markersize=4,
                color=(SERIES + [INK_2])[i], label=f"Δv = {dv_kms} km/s (our simulation)")
        ax.axhline(rr[0]["overestimate_vs_leading_pct"], color=(SERIES + [INK_2])[i], linewidth=0.8, linestyle=(0, (3, 2)))
    ax.set_xscale("log")
    ax.set_xlabel("T/W₀")
    ax.set_ylabel("(Robbins − actual) / actual  [%]")
    ax.set_title("Confraria's escape case (LEO 200 km, Isp 300 s)")
    ax.text(0.98, 0.97, "dashed: leading-order theory (Π → 0)\nConfraria fig. 4.34 shows ~40–150%\nover T/W₀ = 0.5–0.1 (read by eye)",
            transform=ax.transAxes, ha="right", va="top", fontsize=7, color=INK_2)
    ax.legend(loc="center right", fontsize=7)
    fig.suptitle("Robbins (1966) finite-burn loss expression vs measured losses (expression as quoted by Confraria 2020)",
                 fontsize=9.5, x=0.01, ha="left")
    save_figure(fig, ROOT / "figures" / "robbins_comparison.png", "scripts/robbins_comparison.py")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else str(ROOT / "results" / "sweep_nd.parquet"))
