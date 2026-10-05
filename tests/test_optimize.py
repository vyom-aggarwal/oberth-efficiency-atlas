"""Phase 3 optimizer: timing theory at small Π, feasibility, improvement over centered, constraint handling."""

import math

import pytest

from oberth_atlas import theory
from oberth_atlas.optimize import (OptCase, _Evaluator, eta_against_periapsis, optimize_case, optimize_piecewise,
                                   timing_half_dv_delta, timing_rule_capture, timing_rule_extra_loss,
                                   timing_theory_delta, timing_theory_fraction, x_centroid, x_median)
from oberth_atlas.simulate import Numerics


@pytest.mark.parametrize("lam", [0.1, 1.0, 3.0])
def test_small_pi_optimal_timing_matches_theory(lam):
    """Hypothesis test: at small Π the optimal prograde burn starts earlier than centered, by
    exactly ½ − x̄ (Δv centroid at periapsis)."""
    case = OptCase.from_targets(0.3, 0.03, lam, Pi=0.2)
    r = optimize_case(case, "timing")
    assert r.delta < 0
    assert r.delta == pytest.approx(timing_theory_delta(lam), abs=2e-3)
    assert r.eta_fixed >= r.eta_centered


@pytest.mark.parametrize("lam, v_over_vesc, dv_over_vp", [(1.0, 0.03, 0.03), (3.0, 0.3, 0.3), (3.0, 3.0, 0.03)])
def test_small_pi_recoverable_fraction_matches_theory(lam, v_over_vesc, dv_over_vp):
    """The fraction of 1 − η recovered by retiming at small Π is predicted with no free parameter."""
    case = OptCase.from_targets(v_over_vesc, dv_over_vp, lam, Pi=0.1)
    r = optimize_case(case, "timing")
    measured = (r.eta_fixed - r.eta_centered) / (1.0 - r.eta_centered)
    assert measured == pytest.approx(timing_theory_fraction(case), abs=5e-4)


def test_recoverable_fraction_small_dv_limit():
    lam = 3.0
    m2 = theory.profile_moments(lam).m2
    limit = timing_theory_delta(lam) ** 2 / m2
    case = OptCase.from_targets(0.3, 1e-6, lam, Pi=0.1)
    assert timing_theory_fraction(case) == pytest.approx(limit, rel=1e-4)


def test_placement_rule_closed_forms():
    lam = 3.0
    f = 1.0 - math.exp(-lam)
    assert x_centroid(lam) == pytest.approx(1 / f - 1 / lam, rel=1e-15)
    assert x_median(lam) == pytest.approx((1 - math.exp(-lam / 2)) / f, rel=1e-15)
    # Half-Δv rule: ≈ 80% of the optimal retiming gain at Δv/c = 3, ≈ 76% at 1, → 75% as Δv/c → 0.
    assert timing_rule_capture(3.0, x_median(3.0)) == pytest.approx(0.7978, abs=1e-4)
    assert timing_rule_capture(1.0, x_median(1.0)) == pytest.approx(0.7561, abs=1e-4)
    assert timing_rule_capture(1e-4, x_median(1e-4)) == pytest.approx(0.75, abs=1e-4)
    assert timing_half_dv_delta(3.0) == pytest.approx(0.5 - x_median(3.0), rel=1e-15)


def test_half_dv_rule_matches_simulation_at_small_pi():
    lam = 3.0
    case = OptCase.from_targets(0.3, 0.03, lam, Pi=0.1)
    r = optimize_case(case, "timing", reference_inertial=False)
    e_half = _Evaluator(case, Numerics())(0.0, 0.0, timing_half_dv_delta(lam))
    capture = (e_half.eta - r.eta_centered) / (r.eta_fixed - r.eta_centered)
    assert capture == pytest.approx(timing_rule_capture(lam, x_median(lam)), abs=2e-3)
    extra = (1 - e_half.eta) / (1 - r.eta_fixed) - 1
    assert extra == pytest.approx(timing_rule_extra_loss(case, x_median(lam)), abs=2e-3)
    assert math.isnan(r.eta_inertial)


def test_piecewise_optimum_not_worse_than_linear():
    case = OptCase.from_targets(0.1, 0.3, 1.0, Pi=3.0)
    lin = optimize_case(case, "full", reference_inertial=False)
    pw = optimize_piecewise(case, n_knots=4, linear=(lin.alpha0, lin.alpha1, lin.delta))
    assert pw.r_min >= case.rho - 1e-7
    assert pw.eta_fixed >= lin.eta_fixed - 1e-9
    assert len(pw.knots) == 4


def test_timing_theory_values():
    assert timing_theory_delta(1e-12) == 0.0
    assert timing_theory_delta(1.0) == pytest.approx(0.5 - (1 / (1 - math.exp(-1)) - 1), rel=1e-15)


def test_full_optimum_feasible_and_better_than_centered():
    case = OptCase.from_targets(0.1, 0.03, 1.0, Pi=3.0)
    r = optimize_case(case, "full")
    assert r.feasible and r.r_min >= case.rho - 1e-7
    assert r.eta_fixed >= r.eta_centered - 1e-9
    assert r.eta_fixed >= optimize_case(case, "timing").eta_fixed - 1e-6     # full ⊇ timing-only


def test_constraint_is_enforced_when_active():
    """Demand a periapsis 2% above the centered burn's: the optimum must respect it."""
    base = OptCase.from_targets(0.3, 0.1, 1.0, Pi=3.0)
    centered = optimize_case(base, "timing")
    rho = centered.r_min_centered + 0.02
    case = OptCase(base.v_inf, base.dv, base.c, base.a0, rho=rho)
    r = optimize_case(case, "full")
    assert r.feasible and r.r_min >= rho - 1e-6


def test_extreme_pitch_corner_evaluates():
    """Regression: under the old ĥ-based pitch law this corner of the control box drove h → 0 and
    stalled the integrator (sliding mode). It must now run and give a finite energy outcome."""
    case = OptCase.from_targets(0.03, 0.3, 3.0, Pi=100.0)
    e = _Evaluator(case, Numerics())(-1.2, -3.0, 1.0)
    assert math.isfinite(e.eta_W) and not e.impacted


def test_eta_rereferencing():
    case = OptCase.from_targets(0.3, 0.1, 1.0, Pi=3.0)
    assert eta_against_periapsis(case, 0.8, 1.0) == pytest.approx(0.8, rel=1e-14)
    # A higher achieved periapsis means a weaker impulsive reference, so a larger η.
    assert eta_against_periapsis(case, 0.8, 1.2) > 0.8
