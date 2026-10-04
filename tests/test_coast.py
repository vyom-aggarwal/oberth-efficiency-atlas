"""Required tests 1 and 2: coast-only flyby and energy conservation on coast arcs.

Test 1: v_inf_out = v_inf_in, and the turn angle equals 2·arcsin(1/e), e = 1 + r_p v_inf²/μ.
  The turn angle is measured between the analytic incoming asymptote and the outgoing
  asymptote of the *integrated* final state's osculating conic.
  The v_inf tolerance follows from the approved energy threshold: δv/v = δε/v_inf², with
  δε ≤ ENERGY_DRIFT_TOL·v_p²/2. A flat 1e-10 relative is unreachable at v_inf ≪ v_esc
  (measured 1.1e-9 at v_inf = 0.02 v_esc; see RESEARCH_LOG 2026-10-03).

Test 2: on every coast arc, max |ε(t) − ε(t_arc_start)| / (v_p²/2) < ENERGY_DRIFT_TOL.
  Normalized by v_p²/2 = |ε| + μ/r_p, the largest term in ε, since that sets the round-off
  (RESEARCH_LOG 2026-10-04). At low v_inf it equals the earlier μ/r_p normalization.
"""

import math

import pytest

from conftest import ENERGY_DRIFT_TOL, V_INF_RATIOS, default_altitude, v_inf_for_ratio
from oberth_atlas.burn import BurnSpec, Engine
from oberth_atlas.constants import EARTH, JUPITER, SUN
from oberth_atlas.simulate import Numerics, simulate_flyby
from oberth_atlas.steering import InertialFixed, PitchLinear, Prograde

SPANS_TAU = [5.0, 50.0, 500.0]   # coast length on each side of periapsis, in units of τ


@pytest.mark.parametrize("ratio", V_INF_RATIOS)
@pytest.mark.parametrize("span", SPANS_TAU)
def test_coast_only_flyby(body, ratio, span):
    alt = default_altitude(body)
    v_inf = v_inf_for_ratio(body, alt, ratio)
    res = simulate_flyby(body, v_inf, alt, numerics=Numerics(pre_coast_tau=span, post_coast_tau=span))

    # The v_inf tolerance is propagated from the energy threshold (see the module docstring).
    v_tilde2 = v_inf**2 / (body.gm / res.r_p)
    tol_v = max(1e-10, ENERGY_DRIFT_TOL * (1.0 + 0.5 * v_tilde2) / v_tilde2)
    assert abs(res.v_inf_out / v_inf - 1.0) < tol_v

    r_p = res.r_p
    e = 1.0 + r_p * v_inf**2 / body.gm
    assert res.turn_angle == pytest.approx(2.0 * math.asin(1.0 / e), abs=1e-9)
    assert res.turn_angle_unperturbed == pytest.approx(2.0 * math.asin(1.0 / e), rel=1e-15)
    # The unperturbed flyby is safe and reaches exactly r_p.
    assert res.r_min == pytest.approx(r_p, rel=1e-12)
    assert res.r_min_numerical == pytest.approx(r_p, rel=1e-10)
    assert not any(res.flags.values())


@pytest.mark.parametrize("ratio", V_INF_RATIOS)
@pytest.mark.parametrize("span", SPANS_TAU)
def test_energy_conservation_coast_only(body, ratio, span):
    alt = default_altitude(body)
    res = simulate_flyby(body, v_inf_for_ratio(body, alt, ratio), alt,
                         numerics=Numerics(pre_coast_tau=span, post_coast_tau=span))
    assert res.energy_drift["coast"] < ENERGY_DRIFT_TOL
    assert res.energy_balance_residual < ENERGY_DRIFT_TOL   # W = 0 on coasts: same quantity


@pytest.mark.parametrize(
    "body, ratio, isp, a0, dv, steering",
    [
        (EARTH, 0.3, 465.0, 2.0, 1000.0, Prograde()),
        (EARTH, 0.02, 380.0, 20.0, 3000.0, InertialFixed()),
        (JUPITER, 0.1, 850.0, 0.5, 2000.0, Prograde()),
        (JUPITER, 2.0, 3500.0, 1e-3, 500.0, Prograde()),
        (SUN, 0.3, 465.0, 1.0, 1000.0, PitchLinear(alpha0=0.1, alpha1=-0.2)),
    ],
    ids=["earth-hydrolox", "earth-lowvinf-inertial", "jupiter-ntr", "jupiter-ion-highvinf", "sun-pitch"],
)
def test_energy_conservation_pre_and_post_burn_coasts(body, ratio, isp, a0, dv, steering):
    alt = default_altitude(body)
    res = simulate_flyby(body, v_inf_for_ratio(body, alt, ratio), alt, BurnSpec(dv, Engine(isp, a0)), steering)
    assert set(res.energy_drift) == {"pre", "post"}
    for label, drift in res.energy_drift.items():
        assert drift < ENERGY_DRIFT_TOL, label
