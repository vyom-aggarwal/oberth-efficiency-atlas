"""Phase 3 optimizer: timing theory at small Π, feasibility, improvement over centered, constraint handling."""

import math

import pytest

from oberth_atlas.optimize import OptCase, eta_against_periapsis, optimize_case, timing_theory_delta


@pytest.mark.parametrize("lam", [0.1, 1.0, 3.0])
def test_small_pi_optimal_timing_matches_theory(lam):
    """Hypothesis test: at small Π the optimal prograde burn starts earlier than centered, by
    exactly ½ − x̄ (Δv centroid at periapsis)."""
    case = OptCase.from_targets(0.3, 0.03, lam, Pi=0.2)
    r = optimize_case(case, "timing")
    assert r.delta < 0
    assert r.delta == pytest.approx(timing_theory_delta(lam), abs=2e-3)
    assert r.eta_fixed >= r.eta_centered


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


def test_eta_rereferencing():
    case = OptCase.from_targets(0.3, 0.1, 1.0, Pi=3.0)
    assert eta_against_periapsis(case, 0.8, 1.0) == pytest.approx(0.8, rel=1e-14)
    # A higher achieved periapsis means a weaker impulsive reference, so a larger η.
    assert eta_against_periapsis(case, 0.8, 1.2) > 0.8
