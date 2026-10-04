"""Sanity checks on the constants module: transcription errors, units, lookups."""

import math

import pytest

from oberth_atlas import constants as C


def test_all_six_bodies_present():
    assert set(C.BODIES) == {"sun", "venus", "earth", "mars", "jupiter", "saturn"}


@pytest.mark.parametrize("name", list(C.BODIES))
def test_values_positive_and_si(name):
    b = C.get_body(name)
    assert b.gm > 0
    # The smallest body here (Mars) has R ~ 3.4e6 m and the largest (Sun) ~ 7e8 m.
    assert 1e6 < b.radius_eq < 1e9


@pytest.mark.parametrize(
    "name, v_esc_km_s",
    # Textbook surface escape speeds (rounded) catch unit or digit slips in GM/R.
    [("earth", 11.19), ("venus", 10.36), ("mars", 5.03), ("jupiter", 59.5), ("saturn", 35.5), ("sun", 617.7)],
)
def test_surface_escape_speed_order_of_magnitude(name, v_esc_km_s):
    b = C.get_body(name)
    assert b.escape_speed(b.radius_eq) / 1e3 == pytest.approx(v_esc_km_s, rel=0.01)


def test_planet_only_gm_below_system_gm():
    # The satellite contribution is ~2e-4 for Jupiter and Saturn (Galilean moons / Titan).
    for name in ("jupiter", "saturn"):
        rel = 1.0 - C.get_body(name).gm / C.GM_SYSTEM_DE440[name]
        assert 1e-4 < rel < 3e-4


def test_laplace_soi_radii():
    # The commonly quoted values are ~0.925e6 km (Earth) and ~48.2e6 km (Jupiter).
    assert C.EARTH.soi_radius / 1e9 == pytest.approx(0.925, rel=0.01)
    assert C.JUPITER.soi_radius / 1e9 == pytest.approx(48.2, rel=0.01)
    assert math.isinf(C.SUN.soi_radius)


def test_get_body_case_insensitive_and_unknown():
    assert C.get_body("  Jupiter ") is C.JUPITER
    with pytest.raises(KeyError):
        C.get_body("pluto")
