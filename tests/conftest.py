"""Shared helpers for the test suite."""

import math

import pytest

from oberth_atlas.constants import BODIES, Body

# v_inf as a fraction of the escape speed at r_p: low (strong Oberth), medium, high (weak Oberth).
V_INF_RATIOS = [0.02, 0.3, 2.0]
# Approved coast energy-drift threshold, relative to μ/r_p (RESEARCH_LOG 2026-10-03, decision Q4).
ENERGY_DRIFT_TOL = 1e-11


def v_inf_for_ratio(body: Body, altitude: float, ratio: float) -> float:
    r_p = body.radius_eq + altitude
    return ratio * math.sqrt(2.0 * body.gm / r_p)


def default_altitude(body: Body) -> float:
    """A low flyby: 10% of the equatorial radius."""
    return 0.1 * body.radius_eq


@pytest.fixture(params=list(BODIES))
def body(request) -> Body:
    return BODIES[request.param]
