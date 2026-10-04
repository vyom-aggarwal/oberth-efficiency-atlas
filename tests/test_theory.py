"""Analytic theory (theory.py) against closed forms and against the simulator.

The tolerances come from the measured scalings in RESEARCH_LOG (2026-10-04, theory entries):
- small-Π prefactor (exact in Δv and mass ratio): limited only by the noise of extracting C from
  simulations, which scales like 1/Δv (≤ 3e-5 for Δv/v_p ≥ 0.03);
- linear response η_W ≈ η_lin: first-order in Δv/v_p, with coefficient ≤ 0.25 for prograde.
"""

import math

import pytest
from scipy.integrate import quad

from oberth_atlas import theory as T
from oberth_atlas.simulate import simulate_nd
from oberth_atlas.steering import InertialFixed, Prograde

LAWS = {"prograde": Prograde(), "inertial": InertialFixed()}


def _a0_for_pi(v, dv, c, Pi):
    t_b = Pi / math.sqrt(v * v + 2.0)
    return (c / t_b) * -math.expm1(-dv / c)


def _measured_prefactor(v, dv, c, law):
    """C from simulations at Π = 0.02 and 0.01, Richardson-extrapolated (removes the Π⁴ term)."""
    ys = []
    for Pi in (0.02, 0.01):
        r = simulate_nd(v, dv, c, _a0_for_pi(v, dv, c, Pi), LAWS[law])
        ys.append((1.0 - r.eta) / r.Pi**2)
    return (4.0 * ys[1] - ys[0]) / 3.0


# ------------------------------------------------------------------ profile moments

def test_constant_profile_moments():
    m = T.profile_moments(0.0, 0.5)
    assert (m.m2, m.j, m.m2F, m.e) == pytest.approx((1 / 12, 1 / 24, 1 / 24, -1 / 24), abs=1e-15)


@pytest.mark.parametrize("lam, x_c", [(0.4, 0.5), (1.5, 0.3), (3.0, 0.8)])
def test_profile_moments_match_nested_quadrature(lam, x_c):
    f, F = T._profile(lam)
    m = T.profile_moments(lam, x_c)
    m2 = quad(lambda x: f(x) * (x - x_c) ** 2, 0, 1, epsabs=1e-14)[0]
    j = quad(lambda x: f(x) * quad(lambda y: (x - y) * F(y), 0, x, epsabs=1e-14)[0], 0, 1, epsabs=1e-13)[0]
    m2F = quad(lambda x: f(x) * (x - x_c) ** 2 * F(x), 0, 1, epsabs=1e-14)[0]
    e = quad(lambda x: f(x) * quad(lambda y: (x - y) * f(y) * (y - x_c), 0, x, epsabs=1e-14)[0], 0, 1,
             epsabs=1e-13)[0]
    assert (m.m2, m.j, m.m2F, m.e) == pytest.approx((m2, j, m2F, e), rel=1e-10, abs=1e-13)


# ------------------------------------------------------------------ small-Π prefactor

@pytest.mark.parametrize("v", [0.05, 0.5, 2.0])
@pytest.mark.parametrize("dv_frac", [0.02, 0.5])
def test_closed_forms_for_constant_acceleration(v, dv_frac):
    v_p = math.sqrt(v * v + 2.0)
    k, dv = 1 / v_p**2, dv_frac * v_p
    norm = T.metrics.v_inf_impulsive(1, 1, v, dv) * T.metrics.oberth_bonus_impulsive(1, 1, v, dv)
    pro = (k / 24) * dv * ((1 - k) * v_p + (1 + k) * dv) / norm
    ine = (k / 24) * dv * (v_p + dv) / norm
    assert T.small_pi_prefactor(v, dv, math.inf, "prograde", exact_dv=False) == pytest.approx(pro, rel=1e-13)
    assert T.small_pi_prefactor(v, dv, math.inf, "inertial", exact_dv=False) == pytest.approx(ine, rel=1e-13)
    # The user's formula drops the first-order Δv terms. It agrees only as Δv → 0.
    user = T.small_pi_prefactor_user(v, dv, "prograde")
    assert user == pytest.approx((k / 24) * (1 - k) * v_p * dv / norm, rel=1e-13)


@pytest.mark.parametrize("law", ["prograde", "inertial"])
@pytest.mark.parametrize("v, dv_frac, lam", [(0.05, 0.1, 1e-4), (0.5, 0.3, 1.0), (2.0, 1.0, 0.2), (0.5, 0.03, 3.0)])
def test_prefactor_matches_simulation(law, v, dv_frac, lam):
    v_p = math.sqrt(v * v + 2.0)
    dv = dv_frac * v_p
    c = dv / lam
    measured = _measured_prefactor(v, dv, c, law)
    assert T.small_pi_prefactor(v, dv, c, law) == pytest.approx(measured, rel=1e-4)


def test_user_formula_errors_on_phase1_cases():
    """Records how far the hand formula is from the measured Phase 1 prefactors
    (Earth h=300 km, v∞=3 km/s, Δv=1 km/s, Isp=465 s): −19.5% prograde, −8.4% inertial."""
    v, dv, c = 0.388311291538699, 0.12943709717956632, 0.5902451037110372   # nondimensional groups
    for law, expected in (("prograde", -0.195), ("inertial", -0.084)):
        measured = _measured_prefactor(v, dv, c, law)
        assert T.small_pi_prefactor_user(v, dv, law) / measured - 1 == pytest.approx(expected, abs=0.002)
        assert T.small_pi_prefactor(v, dv, c, law) == pytest.approx(measured, rel=1e-4)


# ------------------------------------------------------------------ linear response and the η map

@pytest.mark.parametrize("v", [0.05, 0.5, 2.0])
@pytest.mark.parametrize("Pi", [0.1, 10.0, 1e3, 1e5])
def test_linear_response_prograde(v, Pi):
    """η_W(sim) → η_lin as Δv → 0, at first order in Δv/v_p (checked at two Δv values)."""
    v_p = math.sqrt(v * v + 2.0)
    lin = T.linear_response_eta(v, Pi, "prograde")
    errs = []
    for frac in (1e-3, 1e-2):
        dv = frac * v_p
        c = 1e4 * dv
        r = simulate_nd(v, dv, c, _a0_for_pi(v, dv, c, Pi), Prograde())
        errs.append(r.eta_W - lin)
        assert abs(r.eta_W - lin) <= 0.25 * frac
        # The exact map from η_W to η.
        assert r.eta == pytest.approx(T.eta_from_eta_W(r.eta_W, v, dv), abs=1e-9)
    if abs(errs[1]) > 1e-6:
        assert errs[1] / errs[0] == pytest.approx(10.0, rel=0.3)        # first-order scaling


def test_linear_response_small_pi_limit_matches_prefactor():
    for v in (0.05, 0.5, 2.0):
        for law in ("prograde", "inertial"):
            lin = T.linear_response_eta(v, 1e-2, law)
            c0 = T.small_pi_prefactor(v, 1e-9, math.inf, law)
            assert (1 - lin) / 1e-4 == pytest.approx(c0, rel=1e-3)


def test_inertial_linear_response_large_pi_limit():
    # Far-field misalignment: η_lin → v∞(cos(δ/2) − 1)/(v_p − v∞), with cos(δ/2) = sqrt(e² − 1)/e.
    v = 0.5
    e = 1 + v * v
    v_p = math.sqrt(v * v + 2)
    limit = v * (math.sqrt(e * e - 1) / e - 1) / (v_p - v)
    assert T.linear_response_eta(v, 1e7, "inertial") == pytest.approx(limit, rel=1e-3)


# ------------------------------------------------------------------ large-Π asymptotes

@pytest.mark.parametrize("v", [0.5, 2.0])
def test_hyperbolic_tail_asymptote(v):
    Pi = 300 * T.tail_crossover_pi(v)
    assert T.large_pi_asymptote(v, Pi) == pytest.approx(T.linear_response_eta(v, Pi), rel=0.01)


def test_parabolic_core_asymptote():
    v = 0.01                                  # Π_T ≈ 1.4e6, so 1e2–1e3 sits deep in the core regime
    for Pi in (1e2, 1e3):
        assert T.parabolic_core_asymptote(Pi) == pytest.approx(T.linear_response_eta(v, Pi), rel=0.04)
