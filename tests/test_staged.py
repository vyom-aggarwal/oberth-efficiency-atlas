"""Phase 4 staged-burn simulator: arrival conics of any eccentricity, staging, the equivalent-Δv metric."""

import math

import numpy as np
import pytest

from oberth_atlas import theory
from oberth_atlas.optimize import x_centroid
from oberth_atlas.simulate import simulate_nd
from oberth_atlas.staged import (StageND, centroid_offset, dv_centroid_time, optimal_offset, schedule,
                                 simulate_staged_nd)


def single_stage(dv: float, c: float, Pi: float, v_p: float) -> StageND:
    """One constant-thrust stage with the given Δv, exhaust velocity and Π = t_b v_p."""
    m_prop = -math.expm1(-dv / c)
    t_b = Pi / v_p
    return StageND(thrust=m_prop * c / t_b, c=c, m_prop=m_prop)


def test_single_stage_hyperbolic_matches_simulate_nd():
    v_inf, dv, c, Pi = 0.4, 0.05, 0.5, 0.8
    v_p = math.sqrt(v_inf**2 + 2.0)
    st = single_stage(dv, c, Pi, v_p)
    a0 = st.thrust                                      # T/m0 in the same units
    for offset in (0.0, -0.1):
        ref = simulate_nd(v_inf, dv, c, a0, midpoint_offset=offset)
        res = simulate_staged_nd(v_p, [st], midpoint_offset=offset)
        assert res.eps_out == pytest.approx(ref.eps_out, abs=1e-11)
        assert res.r_min == pytest.approx(ref.r_min, abs=1e-9)
        assert res.energy_balance < 1e-10


@pytest.mark.parametrize("v_p", [1.3, math.sqrt(2.0), 1.6])   # bound, parabolic, hyperbolic
def test_small_pi_loss_matches_theory_for_any_conic(v_p):
    dv, c, Pi = 0.02, 0.1, 0.02
    st = single_stage(dv, c, Pi, v_p)
    res = simulate_staged_nd(v_p, [st])
    th = theory.equivalent_dv_loss_per_pi2(v_p, dv, c, "prograde", x_c=0.5) * Pi**2
    assert res.dv_loss == pytest.approx(th, rel=2e-3)
    assert res.dv_loss > 0 and res.dv_loss_err < 1e-3 * res.dv_loss


def test_loss_scales_as_pi_squared_and_vanishes():
    v_p, dv, c = 1.40, 0.03, 0.2                       # near-parabolic bound arrival
    l1 = simulate_staged_nd(v_p, [single_stage(dv, c, 0.04, v_p)]).dv_loss
    l2 = simulate_staged_nd(v_p, [single_stage(dv, c, 0.02, v_p)]).dv_loss
    assert l1 / l2 == pytest.approx(4.0, rel=2e-3)


def test_two_identical_stages_without_drop_or_gap_equal_one_stage():
    v_p, c, T = 1.39, 0.15, 0.5
    one = StageND(thrust=T, c=c, m_prop=0.4)
    two = [StageND(thrust=T, c=c, m_prop=0.25), StageND(thrust=T, c=c, m_prop=0.15)]
    r1, r2 = simulate_staged_nd(v_p, [one]), simulate_staged_nd(v_p, two)
    assert r2.eps_out == pytest.approx(r1.eps_out, abs=1e-11)
    assert r2.dv_rocket == pytest.approx(r1.dv_rocket, rel=1e-14)


def test_mass_bookkeeping_and_schedule():
    stages = [StageND(thrust=2.0, c=0.2, m_prop=0.6, m_drop=0.05, coast_after=0.01),
              StageND(thrust=0.5, c=0.19, m_prop=0.2, m_drop=0.02)]
    sched, duration = schedule(stages)
    assert sched[1].m_ignition == pytest.approx(0.35, rel=1e-15)
    assert duration == pytest.approx(stages[0].burn_time + 0.01 + stages[1].burn_time, rel=1e-15)
    res = simulate_staged_nd(1.4, stages)
    assert res.m_final == pytest.approx(1.0 - 0.6 - 0.05 - 0.2 - 0.02, abs=1e-11)
    assert res.dv_rocket == pytest.approx(0.2 * math.log(1 / 0.4) + 0.19 * math.log(0.35 / 0.15), rel=1e-14)
    with pytest.raises(ValueError):
        schedule([StageND(thrust=1.0, c=0.2, m_prop=1.2)])


def test_leading_order_loss_matches_theory_and_simulation():
    from oberth_atlas.staged import leading_order_loss
    v_p, c, Pi = 1.40, 0.1, 0.02
    st = single_stage(1e-5, c, Pi, v_p)                  # Δv → 0: only the m₂ term survives
    th = theory.equivalent_dv_loss_per_pi2(v_p, 1e-5, c, "prograde", x_c=0.5) * Pi**2
    assert leading_order_loss(v_p, [st]) == pytest.approx(th, rel=1e-4)
    # Two stages with a coast gap: the m₂ estimate tracks the simulation up to the small j term.
    stages = [StageND(thrust=2.0, c=0.012, m_prop=0.75, m_drop=0.06, coast_after=0.001),
              StageND(thrust=0.6, c=0.0115, m_prop=0.12, m_drop=0.008)]
    sim = simulate_staged_nd(v_p, stages)
    assert leading_order_loss(v_p, stages) == pytest.approx(sim.dv_loss, rel=0.1)


def test_si_stack_nondimensionalization():
    from oberth_atlas.constants import GM_SUN, SUN
    from oberth_atlas.staged import StageSI, stack_mass, stages_to_nd
    from oberth_atlas.units import Scales
    si = [StageSI("A", 13970.6, 1000.0, 2964.9, 126.7, coast_after=10.0), StageSI("B", 2137.0, 124.0, 2802.8, 84.1)]
    r_p = 3.2 * SUN.radius_eq
    nd = stages_to_nd(si, 546.0, GM_SUN, r_p)
    sc = Scales(GM_SUN, r_p, stack_mass(si, 546.0))
    assert stack_mass(si, 546.0) == pytest.approx(16653.6, rel=1e-12)
    sched, duration = schedule(nd)
    dv_si = sum(st.dv for st in sched) * sc.velocity
    m0 = 16653.6
    expect = 2964.9 * math.log(m0 / (m0 - 12970.6)) + 2802.8 * math.log((m0 - 13970.6) / (m0 - 13970.6 - 2013.0))
    assert dv_si == pytest.approx(expect, rel=1e-12)
    assert duration * sc.time == pytest.approx(126.7 + 10.0 + 84.1, rel=1e-12)
    assert nd[0].thrust * sc.m0 * sc.acceleration == pytest.approx(si[0].thrust, rel=1e-12)


def test_centroid_helpers():
    st = StageND(thrust=1.0, c=0.1, m_prop=0.5)
    lam = st.c * math.log(2.0) / st.c
    assert dv_centroid_time([st]) == pytest.approx(x_centroid(lam) * st.burn_time, rel=1e-12)
    assert centroid_offset([st]) == pytest.approx(st.burn_time * (0.5 - x_centroid(lam)), rel=1e-12)


def test_optimal_offset_beats_time_centered_and_is_near_centroid():
    v_p, dv, c, Pi = 1.40, 0.05, 0.03, 0.05           # Δv/c ≈ 1.7: centroid well after the midpoint
    st = single_stage(dv, c, Pi, v_p)
    d, r = optimal_offset(v_p, [st])
    centered = simulate_staged_nd(v_p, [st])
    assert r.dv_loss < centered.dv_loss
    assert d == pytest.approx(centroid_offset([st]), abs=0.01 * st.burn_time)
