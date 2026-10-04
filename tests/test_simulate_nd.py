"""The body-free nondimensional core used by the Phase 2 sweep."""

import math

import pytest

from oberth_atlas.burn import BurnSpec, Engine
from oberth_atlas.constants import EARTH, G0
from oberth_atlas.simulate import R_FLOOR, simulate_flyby, simulate_nd
from oberth_atlas.steering import InertialFixed, PitchLinear, Prograde
from oberth_atlas.units import Scales


def _nd_groups(body, alt, v_inf, dv, isp, a0):
    s = Scales(body.gm, body.radius_eq + alt)
    return v_inf / s.velocity, dv / s.velocity, isp * G0 / s.velocity, a0 / s.acceleration


@pytest.mark.parametrize("steering", [Prograde(), InertialFixed(), PitchLinear(0.1, -0.2)])
def test_nd_core_matches_si_wrapper(steering):
    args = (EARTH, 400e3, 3e3, 1.2e3, 380.0, 3.0)
    res = simulate_flyby(EARTH, 3e3, 400e3, BurnSpec(1.2e3, Engine(380.0, 3.0)), steering)
    nd = simulate_nd(*_nd_groups(*args), steering, impact_radius=EARTH.radius_eq / res.r_p)
    assert nd.eta == pytest.approx(res.eta, abs=1e-13)
    assert nd.Pi == pytest.approx(res.Pi, rel=1e-13)
    assert nd.r_min * res.r_p == pytest.approx(res.r_min, rel=1e-13)
    assert nd.k == pytest.approx(1.0 / nd.v_p**2)


def test_body_free_run_records_sub_surface_radius_without_terminating():
    """Inertial steering at Π ≈ 15 dips inside Earth. The body-free run keeps going and reports
    r_min/r_p; the Earth run stops at the surface and flags an impact."""
    groups = _nd_groups(EARTH, 300e3, 3e3, 1e3, 465.0, 0.1)
    R_over_rp = EARTH.radius_eq / (EARTH.radius_eq + 300e3)
    nd = simulate_nd(*groups, InertialFixed())
    assert not nd.impacted and R_FLOOR < nd.r_min < R_over_rp
    assert math.isfinite(nd.eta)
    earth = simulate_flyby(EARTH, 3e3, 300e3, BurnSpec(1e3, Engine(465.0, 0.1)), InertialFixed())
    assert earth.flags["impact"]
    # Same trajectory up to the surface crossing, so r_min/r_p decides the impact afterwards.
    assert (nd.r_min < R_over_rp) == earth.flags["impact"]


def test_impact_radius_terminates():
    # The same sub-surface dive, with the terminal radius set to Earth's R/r_p: it stops there.
    groups = _nd_groups(EARTH, 300e3, 3e3, 1e3, 465.0, 0.1)
    R_over_rp = EARTH.radius_eq / (EARTH.radius_eq + 300e3)
    nd = simulate_nd(*groups, InertialFixed(), impact_radius=R_over_rp)
    assert nd.impacted and nd.r_min == pytest.approx(R_over_rp, rel=1e-14) and math.isnan(nd.eta)
    assert simulate_nd(*groups, InertialFixed()).r_min > R_FLOOR   # default floor not reached


def test_burn_start_radius_reported():
    nd = simulate_nd(0.5, 0.1, 2.0, 1e-3)    # long burn: starts far out
    assert nd.r_burn_start > 10 and nd.r_burn_end > 10
    assert nd.Pi == pytest.approx(nd.t_b * nd.v_p, rel=1e-14)


def test_coast_only_nd():
    nd = simulate_nd(0.7)
    assert math.isnan(nd.eta) and nd.Pi == 0.0 and nd.r_min == pytest.approx(1.0, rel=1e-12)


def test_burn_requires_engine():
    with pytest.raises(ValueError):
        simulate_nd(0.5, 0.1)
