"""Analytic two-body layer: Kepler solver, hyperbola state, conic elements, asymptotes."""

import math

import numpy as np
import pytest

from oberth_atlas import kepler as K

EM1_VALUES = [1e-6, 1e-3, 0.5, 9.0, 1e3]


@pytest.mark.parametrize("em1", EM1_VALUES)
@pytest.mark.parametrize("M", [0.0, 1e-12, 1e-6, 0.3, 1.0, 17.0, 1e3, 1e8, -1e-6, -5.0, -1e8])
def test_kepler_residual(M, em1):
    H = K.solve_kepler_hyperbolic(M, em1)
    e = 1.0 + em1
    resid = e * math.sinh(H) - H - M
    # The residual is limited by rounding in e sinh(H) ~ |M| + |H|.
    assert abs(resid) <= 8 * np.finfo(float).eps * (abs(M) + abs(H) + 1e-300) * max(1.0, e)
    assert math.copysign(1.0, H) == math.copysign(1.0, M) or M == 0.0


def test_kepler_rejects_non_hyperbolic():
    with pytest.raises(ValueError):
        K.solve_kepler_hyperbolic(1.0, 0.0)


@pytest.mark.parametrize("v_inf", [0.03, 0.5, 1.0, 3.0])
def test_state_at_periapsis(v_inf):
    r, v = K.hyperbola_state(0.0, 1.0, 1.0, v_inf)
    v_p = math.sqrt(v_inf**2 + 2.0)
    np.testing.assert_allclose(r, [1.0, 0.0, 0.0], atol=1e-15)
    np.testing.assert_allclose(v, [0.0, v_p, 0.0], rtol=1e-15, atol=1e-15)


@pytest.mark.parametrize("v_inf", [0.03, 0.5, 3.0])
@pytest.mark.parametrize("t", [-1e5, -30.0, -1.0, -1e-3, 1e-3, 2.0, 400.0])
def test_state_invariants(v_inf, t):
    """Energy, angular momentum and periapsis of the analytic state match the hyperbola."""
    mu, r_p = 1.0, 1.0
    r, v = K.hyperbola_state(t, mu, r_p, v_inf)
    c = K.conic(r, v, mu)
    em1 = K.hyperbola_em1(mu, r_p, v_inf)
    # Energy = v_inf^2 / 2. Its absolute error is set by rounding in v^2/2 and mu/r (~1).
    assert c.energy == pytest.approx(0.5 * v_inf**2, abs=1e-14 * (1.0 + mu / np.linalg.norm(r)))
    h_expected = math.sqrt(mu * r_p * (2.0 + em1))   # h = r_p v_p
    # Far out, r and v are nearly parallel, so h = r x v cancels: rel. error ~ eps |r||v| / h.
    cond = np.linalg.norm(r) * np.linalg.norm(v) / h_expected
    eps = np.finfo(float).eps
    assert np.linalg.norm(c.h_vec) == pytest.approx(h_expected, rel=16 * eps * cond)
    assert c.h_vec[2] > 0                         # prograde (counterclockwise) in the perifocal frame
    assert c.r_periapsis == pytest.approx(r_p, rel=64 * eps * cond)


@pytest.mark.parametrize("v_inf", [0.1, 2.0])
def test_time_symmetry(v_inf):
    r1, v1 = K.hyperbola_state(-3.7, 1.0, 1.0, v_inf)
    r2, v2 = K.hyperbola_state(3.7, 1.0, 1.0, v_inf)
    np.testing.assert_allclose(r1, r2 * [1, -1, 1], rtol=1e-14)
    np.testing.assert_allclose(v1, v2 * [-1, 1, 1], rtol=1e-14)


def test_state_matches_finite_difference_velocity():
    """The analytic velocity equals d(position)/dt, by central differences."""
    t, dt = 1.3, 1e-5
    rp, _ = K.hyperbola_state(t + dt, 1.0, 1.0, 0.7)
    rm, _ = K.hyperbola_state(t - dt, 1.0, 1.0, 0.7)
    _, v = K.hyperbola_state(t, 1.0, 1.0, 0.7)
    np.testing.assert_allclose((rp - rm) / (2 * dt), v, rtol=1e-9)


@pytest.mark.parametrize("v_inf", [0.02, 0.4, 1.0, 5.0])
def test_asymptotes_and_turn_angle(v_inf):
    r, v = K.hyperbola_state(12.0, 1.0, 1.0, v_inf)
    c = K.conic(r, v, 1.0)
    v_in, v_out = c.asymptotes()
    em1 = K.hyperbola_em1(1.0, 1.0, v_inf)
    np.testing.assert_allclose(v_in, K.incoming_asymptote_perifocal(em1), atol=1e-13)
    assert K.angle_between(v_in, v_out) == pytest.approx(K.turn_angle(1.0 + em1), abs=1e-12)
    # Far out on the outgoing leg, the velocity points along the outgoing asymptote.
    r_far, v_far = K.hyperbola_state(1e9, 1.0, 1.0, v_inf)
    assert K.angle_between(v_far, v_out) < 1e-6


@pytest.mark.parametrize("v_inf", [0.05, 1.5])
@pytest.mark.parametrize("t", [-50.0, -0.2, 0.0, 0.2, 50.0])
def test_time_since_periapsis_hyperbola(v_inf, t):
    r, v = K.hyperbola_state(t, 1.0, 1.0, v_inf)
    assert K.time_since_periapsis(r, v, 1.0) == pytest.approx(t, abs=1e-10 * max(1.0, abs(t)))


def test_time_since_periapsis_ellipse():
    # Circular-ish ellipse: start at periapsis r=1 with v slightly above circular.
    r0, v0 = np.array([1.0, 0.0, 0.0]), np.array([0.0, 1.1, 0.0])
    c = K.conic(r0, v0, 1.0)
    a = -1.0 / (2 * c.energy)
    P = 2 * math.pi * a**1.5
    # Propagate analytically via the eccentric anomaly at t = P/5.
    M = 2 * math.pi / 5
    E = M
    for _ in range(50):
        E -= (E - c.e * math.sin(E) - M) / (1 - c.e * math.cos(E))
    r = np.array([a * (math.cos(E) - c.e), a * math.sqrt(1 - c.e**2) * math.sin(E), 0.0])
    rn = np.linalg.norm(r)
    v = math.sqrt(a) / rn * np.array([-math.sin(E), math.sqrt(1 - c.e**2) * math.cos(E), 0.0])
    assert K.time_since_periapsis(r, v, 1.0) == pytest.approx(P / 5, rel=1e-12)
    assert K.time_to_next_periapsis(r, v, 1.0) == pytest.approx(4 * P / 5, rel=1e-12)


def test_conic_min_radius():
    mu, v_inf = 1.0, 0.8
    ra, va = K.hyperbola_state(-5.0, mu, 1.0, v_inf)
    rb, _ = K.hyperbola_state(4.0, mu, 1.0, v_inf)
    assert K.conic_min_radius(ra, va, rb, 9.0, mu) == pytest.approx(1.0, rel=1e-12)
    rc, _ = K.hyperbola_state(-2.0, mu, 1.0, v_inf)
    assert K.conic_min_radius(ra, va, rc, 3.0, mu) == pytest.approx(np.linalg.norm(rc), rel=1e-15)
