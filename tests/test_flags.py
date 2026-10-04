"""Each flag fires on a case built to trigger it, and outputs degrade to NaN where defined to."""

import math

import pytest

from oberth_atlas.burn import BurnSpec, Engine
from oberth_atlas.constants import EARTH, JUPITER, SATURN, SUN, VENUS
from oberth_atlas.simulate import Numerics, simulate_flyby
from oberth_atlas.steering import PitchLinear


def _set_flags(res):
    return {k for k, v in res.flags.items() if v}


def test_unsafe_periapsis_coast():
    res = simulate_flyby(EARTH, 3e3, 50e3, safety_margin=100e3)
    assert _set_flags(res) == {"unsafe_periapsis"}
    assert res.altitude_min == pytest.approx(50e3, rel=1e-9)


def test_impact_by_inward_pitch():
    burn = BurnSpec(3000.0, Engine(300.0, 30.0))
    res = simulate_flyby(EARTH, 3e3, 300e3, burn, PitchLinear(alpha0=math.radians(90)))
    assert res.flags["impact"] and res.flags["unsafe_periapsis"]
    assert res.r_min == pytest.approx(EARTH.radius_eq, rel=1e-12)
    assert math.isnan(res.v_inf_out) and math.isnan(res.eta) and math.isnan(res.eta_E)
    assert not res.flags["captured"]


def test_capture_by_retrograde_burn():
    burn = BurnSpec(2000.0, Engine(450.0, 20.0))
    res = simulate_flyby(EARTH, 1e3, 300e3, burn, PitchLinear(alpha0=math.pi))
    assert res.flags["captured"]
    assert math.isnan(res.v_inf_out) and math.isnan(res.eta)
    # η_E is defined for bound outcomes: energy went down, so η_E < 0.
    assert res.eta_E < 0 and res.delta_eps_finite < -0.5 * 1e3**2


def test_outside_soi_for_long_electric_burn_at_earth():
    burn = BurnSpec(1000.0, Engine(1800.0, 2.5e-4))
    res = simulate_flyby(EARTH, 3e3, 300e3, burn)
    assert res.flags["outside_soi"]
    assert res.soi_ratio_burn_start > 1 and res.soi_ratio_burn_end > 1
    assert res.r_soi == pytest.approx(EARTH.soi_radius)


def test_sun_has_no_soi():
    res = simulate_flyby(SUN, 30e3, 3e9, BurnSpec(1000.0, Engine(3000.0, 1e-4)))
    assert not res.flags["outside_soi"] and res.soi_ratio_burn_start == 0.0 and res.r_soi is None


def test_b_imp_small_guard():
    # At v_inf = 5 v_esc, B_imp/Δv ≈ v_p/v_inf − 1 ≈ 0.02, below the threshold set here.
    alt = 300e3
    v = 5.0 * VENUS.escape_speed(VENUS.radius_eq + alt)
    res = simulate_flyby(VENUS, v, alt, BurnSpec(500.0, Engine(465.0, 5.0)), numerics=Numerics(b_imp_min_rel=0.1))
    assert res.flags["b_imp_small"]
    assert math.isnan(res.eta)
    assert res.b_imp > 0 and math.isfinite(res.b_finite) and math.isfinite(res.eta_E)


def test_eta_unreliable_for_negligible_dv():
    # A 1 mm/s burn: B_imp is tiny in absolute terms, so integration noise dominates η.
    res = simulate_flyby(SATURN, 8e3, 10e6, BurnSpec(1e-3, Engine(465.0, 1.0)))
    assert res.flags["eta_unreliable"]
    assert res.eta_err > 1e-6


def test_clean_run_has_no_flags():
    res = simulate_flyby(JUPITER, 6e3, 0.5 * JUPITER.radius_eq, BurnSpec(2000.0, Engine(850.0, 0.5)),
                         safety_margin=1000e3)
    assert _set_flags(res) == set()
