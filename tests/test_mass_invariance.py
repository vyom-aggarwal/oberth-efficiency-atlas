"""Required test 5: scaling m0 and T together leaves every result unchanged.

Normalizing mass by m0 makes this largely structural. The test still guards the whole public
path (Engine.from_thrust → BurnSpec → simulate_flyby → FlybyResult) against absolute mass or
thrust leaking into the dynamics. The only fields allowed to change are m0 and m_final, which
must scale by exactly k.
"""

import math

import pytest

from oberth_atlas.burn import BurnSpec, Engine
from oberth_atlas.constants import JUPITER, MARS
from oberth_atlas.simulate import simulate_flyby
from oberth_atlas.steering import InertialFixed, PitchLinear, Prograde

SCALE_FACTORS = [1e-3, 1.0, 37.5, 1e3, 1e6]
MASS_FIELDS = {"m0", "m_final"}


def _compare(ref: dict, other: dict, k: float) -> None:
    for key, a in ref.items():
        b = other[key]
        if key in MASS_FIELDS:
            assert b == pytest.approx(k * a, rel=1e-14), key
        elif isinstance(a, dict):
            _compare(a, b, k)
        elif isinstance(a, float):
            if math.isnan(a):
                assert math.isnan(b), key
            else:
                assert b == pytest.approx(a, rel=1e-12, abs=1e-300), key
        else:
            assert a == b, key


@pytest.mark.parametrize(
    "body, isp, thrust, m0, dv, offset, steering",
    [
        (MARS, 465.0, 110e3, 25e3, 1500.0, 0.0, Prograde()),
        (JUPITER, 850.0, 330e3, 400e3, 2000.0, -900.0, InertialFixed()),
        (JUPITER, 3500.0, 0.6, 2000.0, 800.0, 3e5, PitchLinear(alpha0=0.05, alpha1=-0.1)),
    ],
    ids=["mars-hydrolox", "jupiter-ntr-early", "jupiter-ion-late-pitch"],
)
def test_mass_invariance(body, isp, thrust, m0, dv, offset, steering):
    def run(k: float):
        burn = BurnSpec(dv, Engine.from_thrust(isp, k * thrust, k * m0), midpoint_offset=offset)
        alt = 0.2 * body.radius_eq
        return simulate_flyby(body, 4e3, alt, burn, steering, safety_margin=50e3).to_dict()

    ref = run(1.0)
    assert math.isfinite(ref["eta"])
    for k in SCALE_FACTORS:
        _compare(ref, run(k), k)
