"""Oberth-effect metrics. These are unit-agnostic: any consistent units work.

Definitions (from the project brief):
  v_p      = sqrt(v_inf² + 2μ/r_p)                 periapsis speed
  τ        = r_p / v_p                             periapsis timescale
  Π        = t_b / τ                               dimensionless burn parameter
  v_inf_imp= sqrt((v_p + Δv)² − 2μ/r_p)            impulsive burn at periapsis
  B        = v_inf_out − (v_inf_in + Δv)           Oberth bonus vs the same burn in deep space
  η        = B_finite / B_imp                      Oberth efficiency (not clipped)
  η_E      = Δε_finite / Δε_imp                    energy-based efficiency (also defined for bound arrivals)
  loss     = v_inf_imp − v_inf_out                 equivalent Δv loss

The formulas are rearranged to avoid cancellation:
  v_inf_imp² = v_inf² + Δv (2 v_p + Δv)
  B_imp      = 2 Δv (v_p − v_inf) / (v_inf_imp + v_inf + Δv),   v_p − v_inf = (2μ/r_p) / (v_p + v_inf)
"""

from __future__ import annotations

import math


def periapsis_speed(mu: float, r_p: float, v_inf: float) -> float:
    return math.sqrt(v_inf**2 + 2.0 * mu / r_p)


def periapsis_timescale(mu: float, r_p: float, v_inf: float) -> float:
    """τ = r_p / v_p."""
    return r_p / periapsis_speed(mu, r_p, v_inf)


def v_inf_impulsive(mu: float, r_p: float, v_inf: float, dv: float) -> float:
    """Outgoing excess speed after an impulsive Δv along the periapsis velocity."""
    v_p = periapsis_speed(mu, r_p, v_inf)
    return math.sqrt(v_inf**2 + dv * (2.0 * v_p + dv))


def energy_gain_impulsive(mu: float, r_p: float, v_inf: float, dv: float) -> float:
    """Δε_imp = v_p Δv + Δv²/2."""
    return dv * (periapsis_speed(mu, r_p, v_inf) + 0.5 * dv)


def oberth_bonus_impulsive(mu: float, r_p: float, v_inf: float, dv: float) -> float:
    """B_imp, computed without cancellation (it is > 0 for any Δv > 0 and μ > 0)."""
    v_p = periapsis_speed(mu, r_p, v_inf)
    vp_minus_vinf = (2.0 * mu / r_p) / (v_p + v_inf)
    return 2.0 * dv * vp_minus_vinf / (v_inf_impulsive(mu, r_p, v_inf, dv) + v_inf + dv)


def oberth_bonus(v_inf_out: float, v_inf_in: float, dv: float) -> float:
    """B = v_inf_out − (v_inf_in + Δv)."""
    return v_inf_out - (v_inf_in + dv)


def oberth_efficiency(b_finite: float, b_imp: float, dv: float, min_rel: float) -> tuple[float, bool]:
    """η = B_finite / B_imp, and whether B_imp is too small for η to be meaningful.

    When B_imp < min_rel · Δv (the Oberth effect itself is negligible, e.g. v_inf >> v_esc),
    η is returned as NaN with the flag set. B_imp and B_finite should still be reported.
    η is never clipped: values < 0 and > 1 are real results.
    """
    if not b_imp >= min_rel * dv:
        return math.nan, True
    return b_finite / b_imp, False
