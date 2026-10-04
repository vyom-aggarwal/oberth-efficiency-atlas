"""Required test 3: gravity-free burn. The integrated Δv equals Isp·g0·ln(m0/m_f).

With gravity off and a constant thrust direction (inertial, or prograde, which stays fixed when
there is no gravity), the burn has a closed-form solution:
  v(t) − v_i = û c ln(m0/m(t))
  r(t) − r_i − v_i t = û c [t + (m(t)/ṁ) ln(m(t)/m0)]
The test checks the velocity change, mass, work and displacement against these expressions.
"""

import math

import numpy as np
import pytest

from oberth_atlas.burn import BurnSpec, Engine
from oberth_atlas.constants import EARTH, G0, JUPITER
from oberth_atlas.simulate import Numerics, simulate_flyby
from oberth_atlas.steering import InertialFixed, Prograde

NO_GRAVITY = Numerics(gravity=False)


@pytest.mark.parametrize("steering", [Prograde(), InertialFixed(), InertialFixed(direction=(0.3, -1.0, 0.2))],
                         ids=["prograde", "inertial-default", "inertial-oblique"])
@pytest.mark.parametrize(
    "isp, a0, dv",
    [(300.0, 30.0, 3000.0), (465.0, 1.0, 500.0), (850.0, 0.2, 4000.0), (3000.0, 1e-3, 1500.0)],
    ids=["solid-like", "hydrolox", "ntr", "ion"],
)
@pytest.mark.parametrize("body", [EARTH, JUPITER], ids=lambda b: b.name)
def test_gravity_free_burn(body, steering, isp, a0, dv):
    burn = BurnSpec(dv, Engine(isp, a0, m0=1500.0))
    res = simulate_flyby(body, 5e3, 1000e3, burn, steering, numerics=NO_GRAVITY)
    seg = res.trajectory.segments[1]
    assert seg.label == "burn"
    t, r, v, m = res.trajectory.si(seg)
    c = isp * G0
    m0, mf = 1500.0, m[-1]

    # Mass: m_f = m0 exp(−Δv/c), as the rocket equation requires.
    assert mf / m0 == pytest.approx(math.exp(-dv / c), rel=1e-12)
    # Required test 3: the integrated Δv equals c ln(m0/m_f), and equals the requested Δv.
    dv_vec = v[:, -1] - v[:, 0]
    assert np.linalg.norm(dv_vec) == pytest.approx(c * math.log(m0 / mf), rel=1e-10)
    assert np.linalg.norm(dv_vec) == pytest.approx(dv, rel=1e-10)
    assert res.delta_v_integrated == pytest.approx(dv, rel=1e-12)

    # Direction: the thrust direction is constant, so Δv points along it.
    u = v[:, 0] / np.linalg.norm(v[:, 0]) if steering.name == "prograde" else None
    if u is None:
        d = np.array([0.0, 1.0, 0.0]) if steering.direction is None else np.array(steering.direction)
        u = d / np.linalg.norm(d)
    np.testing.assert_allclose(dv_vec / np.linalg.norm(dv_vec), u, atol=1e-12)

    # Displacement: closed form of the constant-direction rocket.
    tb = t[-1] - t[0]
    mdot = burn.engine.thrust / c
    disp_expected = v[:, 0] * tb + u * c * (tb + (mf / mdot) * math.log(mf / m0))
    disp = r[:, -1] - r[:, 0]
    np.testing.assert_allclose(disp, disp_expected, rtol=1e-10, atol=1e-10 * np.linalg.norm(disp))

    # Work: W at burnout = Δ(v²/2) (nondimensional, scaled back to J/kg).
    W = seg.y[7, -1] * res.trajectory.scales.specific_energy
    assert W == pytest.approx(0.5 * (v[:, -1] @ v[:, -1] - v[:, 0] @ v[:, 0]), rel=1e-10)
