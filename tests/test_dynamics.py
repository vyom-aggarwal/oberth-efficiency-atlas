"""Equations of motion: the right-hand sides match the brief's EOM term by term."""

import numpy as np
import pytest

from oberth_atlas.burn import BurnSpec, Engine
from oberth_atlas.constants import G0
from oberth_atlas.dynamics import coast_rhs, specific_energy, thrust_rhs
from oberth_atlas.steering import Prograde, SteeringContext

Y = np.array([1.2, -0.5, 0.3, 0.2, 1.1, -0.1, 0.8, 0.05])


def test_coast_rhs():
    d = coast_rhs(1.0)(0.0, Y)
    r = Y[:3]
    np.testing.assert_allclose(d[:3], Y[3:6])
    np.testing.assert_allclose(d[3:6], -r / np.linalg.norm(r) ** 3, rtol=1e-15)
    assert d[6] == 0.0 and d[7] == 0.0


def test_thrust_rhs():
    a0, c = 0.3, 2.5
    u = Prograde().bind(SteeringContext(0.0, 1.0))
    d = thrust_rhs(1.0, a0, c, u)(0.0, Y)
    r, v, m = Y[:3], Y[3:6], Y[6]
    uhat = v / np.linalg.norm(v)
    np.testing.assert_allclose(d[3:6], -r / np.linalg.norm(r) ** 3 + (a0 / m) * uhat, rtol=1e-15)
    assert d[6] == pytest.approx(-a0 / c, rel=1e-15)                   # dm/dt = −T/(Isp g0), normalized
    assert d[7] == pytest.approx((a0 / m) * uhat @ v, rel=1e-15)       # dW/dt = (T/m) u·v


def test_gravity_switch_off():
    d = coast_rhs(0.0)(0.0, Y)
    np.testing.assert_array_equal(d[3:6], 0.0)
    assert specific_energy(Y, 0.0) == pytest.approx(0.5 * Y[3:6] @ Y[3:6])


def test_burn_duration_and_mass_ratio():
    eng = Engine(isp=450.0, a0=3.0)
    b = BurnSpec(delta_v=2000.0, engine=eng)
    c = 450.0 * G0
    assert b.mass_ratio == pytest.approx(np.exp(-2000.0 / c), rel=1e-15)
    assert b.duration == pytest.approx((c / 3.0) * (1 - np.exp(-2000.0 / c)), rel=1e-14)
    # Constant mass flow T/c, sustained for t_b, reaches m_f exactly.
    assert 1.0 - (3.0 / c) * b.duration == pytest.approx(b.mass_ratio, rel=1e-14)
    assert b.t_start == pytest.approx(-0.5 * b.duration) and b.t_end == pytest.approx(0.5 * b.duration)
    assert Engine.from_thrust(450.0, 30e3, 10e3).a0 == pytest.approx(3.0)
