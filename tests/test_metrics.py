"""Metric formulas: algebraic identities, limits and guards (independent of the integrator)."""

import math

import pytest

from oberth_atlas import metrics as M
from oberth_atlas.constants import EARTH

CASES = [(1.0, 1.0, 0.03, 0.01), (1.0, 1.0, 0.4, 0.2), (1.0, 1.0, 3.0, 1.5), (EARTH.gm, 6.678e6, 3e3, 1e3)]


@pytest.mark.parametrize("mu, r_p, v_inf, dv", CASES)
def test_impulsive_formulas_match_naive_forms(mu, r_p, v_inf, dv):
    v_p = math.sqrt(v_inf**2 + 2 * mu / r_p)
    naive_vimp = math.sqrt((v_p + dv) ** 2 - 2 * mu / r_p)
    assert M.v_inf_impulsive(mu, r_p, v_inf, dv) == pytest.approx(naive_vimp, rel=1e-12)
    assert M.oberth_bonus_impulsive(mu, r_p, v_inf, dv) == pytest.approx(naive_vimp - v_inf - dv, rel=1e-9)
    # Energy identity: v_inf_imp² = v_inf² + 2 Δε_imp.
    deps = M.energy_gain_impulsive(mu, r_p, v_inf, dv)
    assert M.v_inf_impulsive(mu, r_p, v_inf, dv) ** 2 == pytest.approx(v_inf**2 + 2 * deps, rel=1e-13)
    assert M.periapsis_timescale(mu, r_p, v_inf) == pytest.approx(r_p / v_p, rel=1e-15)


def test_b_imp_limits():
    # Small Δv: B_imp/Δv → v_p/v_inf − 1.
    v_inf, dv = 0.5, 1e-7
    v_p = math.sqrt(v_inf**2 + 2)
    assert M.oberth_bonus_impulsive(1, 1, v_inf, dv) / dv == pytest.approx(v_p / v_inf - 1, rel=1e-6)
    # B_imp > 0 always, and → 0 as v_inf → ∞, stably (the naive form loses every digit here).
    b = M.oberth_bonus_impulsive(1, 1, 1e6, 1.0)
    assert 0 < b < 1e-11
    assert b == pytest.approx(2 * 1.0 * (2 / (2 * 1e6)) / (2e6 + 2.0), rel=1e-6)


def test_efficiency_not_clipped_and_guarded():
    assert M.oberth_efficiency(-0.3, 1.0, 1.0, 1e-6) == (-0.3, False)
    assert M.oberth_efficiency(1.2, 1.0, 1.0, 1e-6) == (1.2, False)
    eta, small = M.oberth_efficiency(0.5, 1e-9, 1.0, 1e-6)
    assert math.isnan(eta) and small


def test_earth_reference_numbers():
    # Earth, h = 300 km, v_inf = 3 km/s, Δv = 1 km/s. Hand check: v_p = sqrt(9 + 2·398600.4/6678.14) km/s.
    r_p = EARTH.radius_eq + 300e3
    v_p = M.periapsis_speed(EARTH.gm, r_p, 3e3)
    assert v_p / 1e3 == pytest.approx(math.sqrt(9 + 2 * 398600.435507 / 6678.1366), rel=1e-12)
    assert M.v_inf_impulsive(EARTH.gm, r_p, 3e3, 1e3) / 1e3 == pytest.approx(5.715, abs=1e-3)
