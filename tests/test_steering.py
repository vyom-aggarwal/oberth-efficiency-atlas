"""Steering laws: unit norm, geometry, config parsing."""

import math

import numpy as np
import pytest

from oberth_atlas.steering import InertialFixed, PitchLinear, Prograde, SteeringContext, make_steering

CTX = SteeringContext(t_start=-0.5, t_end=0.5)
R = np.array([1.3, -0.2, 0.0])
V = np.array([0.4, 1.1, 0.0])


def test_prograde_is_velocity_direction():
    u = Prograde().bind(CTX)(0.0, R, V, 1.0)
    np.testing.assert_allclose(u, V / np.linalg.norm(V), rtol=1e-15)


def test_inertial_default_is_periapsis_velocity_direction():
    u = InertialFixed().bind(CTX)(0.3, R, V, 0.9)
    np.testing.assert_allclose(u, [0.0, 1.0, 0.0])


def test_inertial_custom_direction_is_normalized_and_rotated():
    rot = np.array([[0.0, -1.0, 0.0], [1.0, 0.0, 0.0], [0.0, 0.0, 1.0]])   # 90° about z
    ctx = SteeringContext(t_start=0.0, t_end=1.0, rotation=rot)
    u = InertialFixed(direction=(2.0, 0.0, 0.0)).bind(ctx)(0.0, R, V, 1.0)
    np.testing.assert_allclose(u, [0.0, 1.0, 0.0], atol=1e-16)


@pytest.mark.parametrize("alpha0, alpha1, t", [(0.3, 0.0, 0.0), (0.0, 1.0, 0.25), (-1.2, 0.4, -0.5)])
def test_pitch_linear_angle_and_plane(alpha0, alpha1, t):
    u = PitchLinear(alpha0, alpha1).bind(CTX)(t, R, V, 1.0)
    alpha = alpha0 + alpha1 * t / (CTX.t_end - CTX.t_start)
    assert np.linalg.norm(u) == pytest.approx(1.0, rel=1e-15)
    assert u[2] == pytest.approx(0.0, abs=1e-16)                       # stays in the orbit plane
    vhat = V / np.linalg.norm(V)
    assert math.atan2(np.cross(vhat, u)[2], vhat @ u) == pytest.approx(alpha, abs=1e-14)


def test_pitch_positive_alpha_tilts_toward_planet():
    # At periapsis (r = x̂, v = ŷ), a positive pitch must have a component toward the origin (−x̂).
    u = PitchLinear(alpha0=0.5).bind(CTX)(0.0, np.array([1.0, 0, 0]), np.array([0, 1.0, 0]), 1.0)
    assert u[0] < 0


_C, _S = math.cos(0.5), math.sin(0.5)
ROT = np.array([[1.0, 0, 0], [0, _C, -_S], [0, _S, _C]]) @ np.array([[_C, -_S, 0], [_S, _C, 0], [0, 0, 1.0]])


@pytest.mark.parametrize("rot", [np.eye(3), ROT], ids=["perifocal", "rotated"])
def test_pitch_fixed_normal_equals_orbit_normal_while_h_keeps_sense(rot):
    """ẑ₀ × v̂ equals ĥ × v̂ whenever h points along ẑ₀ (every flyby that does not reverse)."""
    ctx = SteeringContext(t_start=-0.5, t_end=0.5, rotation=rot)
    r, v = rot @ R, rot @ V
    h = np.cross(r, v)
    hhat, vhat = h / np.linalg.norm(h), v / np.linalg.norm(v)
    for alpha0 in (0.3, -1.2, 2.5):
        u = PitchLinear(alpha0).bind(ctx)(0.0, r, v, 1.0)
        np.testing.assert_allclose(u, math.cos(alpha0) * vhat + math.sin(alpha0) * np.cross(hhat, vhat), atol=2e-16)


def test_pitch_is_smooth_through_zero_angular_momentum():
    """At h = 0 (radial motion) the law stays finite, unit and continuous: no flip with ĥ."""
    law = PitchLinear(0.7).bind(CTX)
    r = np.array([2.0, 0.0, 0.0])
    us = [law(0.0, r, np.array([-1.0, s, 0.0]), 1.0) for s in (1e-9, 0.0, -1e-9)]   # h_z = 2s
    for u in us:
        assert np.all(np.isfinite(u)) and np.linalg.norm(u) == pytest.approx(1.0, rel=1e-15)
    np.testing.assert_allclose(us[0], us[2], atol=1e-8)


def test_pitch_zero_equals_prograde():
    u1 = PitchLinear().bind(CTX)(0.1, R, V, 1.0)
    u2 = Prograde().bind(CTX)(0.1, R, V, 1.0)
    np.testing.assert_allclose(u1, u2, rtol=0, atol=1e-16)


def test_make_steering_from_config():
    assert isinstance(make_steering(None), Prograde)
    law = make_steering({"law": "pitch_linear", "alpha0_deg": 10, "alpha1_deg": -20})
    assert law.alpha0 == pytest.approx(math.radians(10))
    assert law.to_dict() == {"law": "pitch_linear", "alpha0_deg": pytest.approx(10), "alpha1_deg": pytest.approx(-20)}
    assert make_steering({"law": "inertial", "direction": [1, 0, 0]}).direction == (1.0, 0.0, 0.0)
    with pytest.raises(ValueError):
        make_steering({"law": "retro"})
    with pytest.raises(ValueError):
        make_steering({"law": "prograde", "alpha0_deg": 3})
