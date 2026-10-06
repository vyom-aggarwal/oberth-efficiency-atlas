"""J2 sensitivity module: the J2 field, energy conservation, and the point-mass limit."""

import math

import numpy as np
import pytest

from oberth_atlas.j2 import j2_accel, simulate_j2, total_energy
from oberth_atlas.optimize import OptCase
from oberth_atlas.simulate import simulate_nd

J2RHO2 = 0.0147 / 1.1**2                       # Jupiter J2 at r_p = 1.1 R


def U_j2(x, pole):
    rn = np.linalg.norm(x)
    s = x @ pole / rn
    return 0.5 * J2RHO2 * (3 * s * s - 1) / rn**3


def test_acceleration_is_minus_gradient_of_potential():
    rng = np.random.default_rng(1)
    pole = np.array([0.3, -0.2, 0.93]); pole /= np.linalg.norm(pole)
    for _ in range(5):
        r = rng.normal(size=3) * 2.0 + np.array([2.0, 0, 0])
        # The energy's J2 term is the potential U_J2 ...
        y = np.concatenate([r, [0, 0, 0, 1, 0]])
        assert total_energy(y, J2RHO2, pole) + 1 / np.linalg.norm(r) == pytest.approx(U_j2(r, pole), abs=1e-14)
        # ... and the acceleration is its negative gradient (central differences on U_J2 itself).
        h = 1e-4
        grad = np.array([(U_j2(r + h * e, pole) - U_j2(r - h * e, pole)) / (2 * h) for e in np.eye(3)])
        np.testing.assert_allclose(j2_accel(r, J2RHO2, pole), -grad, rtol=1e-6, atol=1e-13)


def test_point_mass_limit_reproduces_simulate_nd():
    case = OptCase.from_targets(0.1, 0.03, 0.3, Pi=3.0)
    ref = simulate_nd(case.v_inf, case.dv, case.c, case.a0)
    r = simulate_j2(case.v_inf, case.dv, case.c, case.a0, 0.0)
    assert r.t_periapsis == pytest.approx(0.0, abs=1e-9)
    assert r.eta == pytest.approx(ref.eta, abs=1e-8)


def test_energy_balance_with_j2_and_a_polar_pole():
    case = OptCase.from_targets(0.1, 0.03, 0.3, Pi=10.0)
    r = simulate_j2(case.v_inf, case.dv, case.c, case.a0, J2RHO2, pole=(0.0, 1.0, 0.0))
    assert r.energy_balance < 1e-10
    assert 0.0 < r.eta < 1.0


def test_equatorial_j2_pulls_periapsis_in_and_changes_eta_little():
    case = OptCase.from_targets(0.1, 0.03, 0.3, Pi=1.0)
    pm = simulate_j2(case.v_inf, case.dv, case.c, case.a0, 0.0)
    eq = simulate_j2(case.v_inf, case.dv, case.c, case.a0, J2RHO2)
    assert eq.r_periapsis < pm.r_periapsis                # extra equatorial attraction
    assert abs(eq.eta - pm.eta) < 1e-2
