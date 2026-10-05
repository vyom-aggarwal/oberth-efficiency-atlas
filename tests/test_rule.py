"""Practical rule loss/Δv ≲ Π²/96 for prograde flyby burns: the closed-form bound over the arrival conic."""

import math

import numpy as np
import pytest

from oberth_atlas import theory


def test_rule_limit_is_one_over_96():
    assert theory.prograde_loss_bound(0.0) == pytest.approx(1 / 96, rel=1e-12)


@pytest.mark.parametrize("r", [0.003, 0.03, 0.2])
def test_constant_acceleration_closed_forms(r):
    assert theory.prograde_loss_bound(r) == pytest.approx((1 + r) / (96 * (1 - r)), rel=1e-12)
    # Hyperbolic/parabolic arrivals only (k ≤ ½): the maximum sits at k = ½.
    assert theory.prograde_loss_bound(r, k_max=0.5) == pytest.approx((1 + 3 * r) / (96 * (1 + r)), rel=1e-12)


@pytest.mark.parametrize("r, lam", [(0.01, 0.0), (0.05, 1.0), (0.3, 3.0)])
def test_bound_dominates_leading_order_loss_on_every_conic(r, lam):
    bound = theory.prograde_loss_bound(r, lam)
    for k in np.linspace(0.02, 0.98, 49):
        v = 1 / math.sqrt(k)
        dv = r * v
        c = dv / lam if lam > 0 else math.inf
        d2 = theory.small_pi_deficit_apse(v, dv, c, "prograde", exact_dv=False)
        assert d2 / (dv * (v + dv)) <= bound * (1 + 1e-12)


def test_mass_ratio_raises_the_bound():
    # A centred rocket burn has a larger second moment than constant acceleration.
    assert theory.prograde_loss_bound(0.0, lam=1.0) == pytest.approx(12 * theory.profile_moments(1.0).m2 / 96, rel=1e-12)
    assert theory.prograde_loss_bound(0.0, lam=1.0) > 1 / 96
