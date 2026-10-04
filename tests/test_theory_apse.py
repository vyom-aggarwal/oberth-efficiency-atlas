"""Small-Π theory at an apse of any conic (circular, elliptic, hyperbolic), and its relation to
Robbins' (1966) finite-burn loss expression kΠ²Δv/24 (as quoted by Confraria 2020)."""

import math

import numpy as np
import pytest
from scipy.integrate import solve_ivp

from oberth_atlas import theory as T
from oberth_atlas.dynamics import coast_rhs, specific_energy, thrust_rhs
from oberth_atlas.steering import InertialFixed, Prograde, SteeringContext

LAW = {"prograde": Prograde(), "inertial": InertialFixed()}


def _deficit_sim(v_apse, dv, c, Pi, law):
    """W_imp − W_fin for a burn centered on an apse (r = 1, speed v_apse), by direct integration."""
    t_b = Pi / v_apse
    a0 = (c / t_b) * -math.expm1(-dv / c)
    y_apse = np.array([1.0, 0.0, 0.0, 0.0, v_apse, 0.0, 1.0, 0.0])
    tol = dict(method="DOP853", rtol=1e-13, atol=1e-13)
    back = solve_ivp(coast_rhs(1.0), (0.0, -0.5 * t_b), y_apse, **tol)
    y0 = back.y[:, -1]
    steer = LAW[law].bind(SteeringContext(-0.5 * t_b, 0.5 * t_b))
    burn = solve_ivp(thrust_rhs(1.0, a0, c, steer), (-0.5 * t_b, 0.5 * t_b), y0, **tol)
    W = float(specific_energy(burn.y[:, -1], 1.0) - specific_energy(y0, 1.0))
    return v_apse * dv + 0.5 * dv**2 - W


def _measured_D2(v_apse, dv, c, law):
    ys = [_deficit_sim(v_apse, dv, c, Pi, law) / Pi**2 for Pi in (0.02, 0.01)]
    return (4 * ys[1] - ys[0]) / 3


@pytest.mark.parametrize("law", ["prograde", "inertial"])
@pytest.mark.parametrize("v_apse", [0.8, 1.0, 1.2, 1.6], ids=["apoapsis", "circular", "elliptic-peri", "hyperbolic-peri"])
@pytest.mark.parametrize("dv_frac, lam", [(0.05, 1e-4), (0.4, 1.2)])
def test_apse_theory_matches_simulation(law, v_apse, dv_frac, lam):
    dv = dv_frac * v_apse
    c = dv / lam
    assert T.small_pi_deficit_apse(v_apse, dv, c, law) == pytest.approx(_measured_D2(v_apse, dv, c, law), rel=2e-4)


def test_apse_generalizes_hyperbolic_form():
    v = 0.7
    v_p = math.sqrt(v * v + 2)
    for law in ("prograde", "inertial"):
        assert T.small_pi_deficit_apse(v_p, 0.3, 2.0, law) == T.small_pi_deficit(v, 0.3, 2.0, law)


@pytest.mark.parametrize("v_apse", [0.8, 1.0, 1.5, 3.0])
@pytest.mark.parametrize("dv_frac", [0.01, 0.3, 1.0])
def test_inertial_equivalent_loss_equals_robbins_expression(v_apse, dv_frac):
    """Fixed-direction, constant-acceleration thrust centered on an apse: the leading-order Δv loss
    is exactly Robbins' kΠ²Δv/24. It is an equality here, not just a bound."""
    dv = dv_frac * v_apse
    assert T.equivalent_dv_loss_per_pi2(v_apse, dv, math.inf, "inertial") == pytest.approx(
        T.robbins_loss_per_pi2(v_apse, dv), rel=1e-12)


@pytest.mark.parametrize("v_apse", [0.8, 1.0, 1.5, 3.0])
@pytest.mark.parametrize("dv_frac", [0.01, 0.3])
def test_prograde_loss_below_robbins_by_closed_form_factor(v_apse, dv_frac):
    dv = dv_frac * v_apse
    k = 1 / v_apse**2
    robbins = T.robbins_loss_per_pi2(v_apse, dv)
    # The closed form is the first-order-in-Δv theory, exactly.
    first_order = T.small_pi_deficit_apse(v_apse, dv, math.inf, "prograde", exact_dv=False) / (v_apse + dv) / robbins
    assert first_order == pytest.approx(((1 - k) * v_apse + (1 + k) * dv) / (v_apse + dv), rel=1e-12)
    # The all-orders theory, which matches simulation, also stays below Robbins.
    assert T.equivalent_dv_loss_per_pi2(v_apse, dv, math.inf, "prograde") / robbins < 1.0
