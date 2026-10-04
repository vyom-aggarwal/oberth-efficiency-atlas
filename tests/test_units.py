"""Nondimensional scales are mutually consistent."""

import pytest

from oberth_atlas.constants import EARTH
from oberth_atlas.units import Scales


def test_scales_consistent():
    s = Scales(mu=EARTH.gm, r_p=EARTH.radius_eq + 300e3, m0=1234.0)
    assert s.time == pytest.approx(s.length / s.velocity, rel=1e-15)
    assert s.acceleration == pytest.approx(s.velocity / s.time, rel=1e-15)
    assert s.specific_energy == pytest.approx(s.velocity**2, rel=1e-15)
    # Circular speed at Earth + 300 km is ~7.73 km/s.
    assert s.velocity == pytest.approx(7726.0, rel=1e-3)


def test_scales_reject_nonpositive():
    with pytest.raises(ValueError):
        Scales(mu=1.0, r_p=0.0)
