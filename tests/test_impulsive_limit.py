"""Required test 4: instantaneous-burn limit. As a0 → ∞ (Π → 0), η → 1.

For a burn centered on periapsis, a symmetry argument predicts 1 − η = O(Π²): the
first-order terms are odd in time and cancel. The empirical order is measured here. It is
asserted over the range where 1 − η is far above the per-run numerical error, so round-off
cannot bias the fit. The convergence plot is figures/eta_vs_a0.png (scripts/fig_eta_vs_a0.py).
"""

import numpy as np
import pytest

from oberth_atlas.burn import BurnSpec, Engine
from oberth_atlas.constants import EARTH, JUPITER
from oberth_atlas.simulate import simulate_flyby
from oberth_atlas.steering import InertialFixed, Prograde

CASES = {
    "earth-hydrolox-prograde": (EARTH, 3e3, 300e3, 1e3, 465.0, Prograde()),
    "jupiter-ntr-prograde": (JUPITER, 6e3, 0.5 * JUPITER.radius_eq, 2e3, 850.0, Prograde()),
    "earth-hydrolox-inertial": (EARTH, 3e3, 300e3, 1e3, 465.0, InertialFixed()),
}
A0_SWEEP = np.logspace(0, 4, 17)   # 1 to 1e4 m/s², quarter-decade steps


def _sweep(case):
    body, v_inf, alt, dv, isp, steering = CASES[case]
    return [simulate_flyby(body, v_inf, alt, BurnSpec(dv, Engine(isp, a0)), steering) for a0 in A0_SWEEP]


@pytest.mark.parametrize("case", list(CASES))
def test_eta_converges_to_one(case):
    runs = _sweep(case)
    eta = np.array([r.eta for r in runs])
    err = np.array([r.eta_err for r in runs])
    assert np.all(np.isfinite(eta)) and not any(r.flags["impact"] or r.flags["captured"] for r in runs)
    # η rises steadily toward 1 (to within the per-run numerical error).
    assert np.all(np.diff(eta) > -2 * (err[1:] + err[:-1]))
    assert np.all(eta <= 1 + 2 * err)
    # At a0 = 1e4 m/s² (Π ~ 1e-4) the burn is effectively impulsive.
    assert abs(1 - eta[-1]) < 1e-6
    # η_E converges as well.
    assert abs(1 - runs[-1].eta_E) < 1e-6


@pytest.mark.parametrize("case", list(CASES))
def test_convergence_order_is_two(case):
    runs = _sweep(case)
    Pi = np.array([r.Pi for r in runs])
    gap = np.array([1 - r.eta for r in runs])
    err = np.array([r.eta_err for r in runs])
    use = (Pi < 0.2) & (gap > 1e3 * err)   # 1000x above noise: round-off bias in the fit < 0.1%
    assert use.sum() >= 4
    slope = np.polyfit(np.log(Pi[use]), np.log(gap[use]), 1)[0]
    assert slope == pytest.approx(2.0, abs=0.02)
