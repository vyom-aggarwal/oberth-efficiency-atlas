"""Extra validation beyond the five required tests."""

import json
import math

import numpy as np
import pytest

from oberth_atlas import kepler
from oberth_atlas.burn import BurnSpec, Engine
from oberth_atlas.constants import EARTH, G0, JUPITER, MARS, SATURN, SUN, VENUS
from oberth_atlas.simulate import Numerics, simulate_flyby
from oberth_atlas.steering import InertialFixed, PitchLinear, Prograde
from oberth_atlas.units import Scales


def _vinf(body, alt, ratio):
    return ratio * math.sqrt(2.0 * body.gm / (body.radius_eq + alt))


def test_integrated_coast_matches_analytic_kepler():
    """At every step, the coast-only trajectory equals the analytic hyperbola."""
    res = simulate_flyby(EARTH, 4e3, 500e3, numerics=Numerics(pre_coast_tau=30, post_coast_tau=30))
    seg = res.trajectory.segments[0]
    vinf_nd = 4e3 / res.trajectory.scales.velocity
    worst = 0.0
    for t, y in zip(seg.t, seg.y.T):
        r, v = kepler.hyperbola_state(t, 1.0, 1.0, vinf_nd)
        worst = max(worst, np.linalg.norm(y[:3] - r) / np.linalg.norm(r), np.linalg.norm(y[3:6] - v) / np.linalg.norm(v))
    assert worst < 1e-10


def _random_rotation(seed: int) -> np.ndarray:
    q, rr = np.linalg.qr(np.random.default_rng(seed).normal(size=(3, 3)))
    q = q @ np.diag(np.sign(np.diag(rr)))
    return q if np.linalg.det(q) > 0 else -q


@pytest.mark.parametrize("steering", [Prograde(), InertialFixed(), PitchLinear(0.2, -0.3)],
                         ids=["prograde", "inertial", "pitch"])
@pytest.mark.parametrize("seed", [1, 2])
def test_frame_rotation_invariance(steering, seed):
    """A random 3D rotation of the whole problem leaves every scalar result unchanged."""
    burn = BurnSpec(1500.0, Engine(465.0, 1.5), midpoint_offset=-200.0)
    ref = simulate_flyby(EARTH, 3e3, 400e3, burn, steering)
    rot = simulate_flyby(EARTH, 3e3, 400e3, burn, steering, rotation=_random_rotation(seed))
    for key in ("v_inf_out", "r_min", "r_min_burn", "turn_angle", "delta_eps_finite", "soi_ratio_burn_start"):
        assert getattr(rot, key) == pytest.approx(getattr(ref, key), rel=1e-10), key
    assert rot.eta == pytest.approx(ref.eta, abs=2 * (ref.eta_err + rot.eta_err))
    # The rotated trajectory leaves the original plane, so the 3D code paths are exercised.
    assert np.ptp(rot.trajectory.segments[1].y[2]) > 1e-3


def test_body_independence_at_equal_dimensionless_inputs():
    """Two bodies with the same (ṽ∞, Δṽ, c̃, ã0) give the same η: the body enters only through these groups."""
    ref_alt, ref = 300e3, dict(v_inf=3e3, dv=1e3, isp=465.0, a0=2.0)
    s_e = Scales(EARTH.gm, EARTH.radius_eq + ref_alt)
    nd = dict(v=ref["v_inf"] / s_e.velocity, dv=ref["dv"] / s_e.velocity,
              c=ref["isp"] * G0 / s_e.velocity, a0=ref["a0"] / s_e.acceleration)
    r_earth = simulate_flyby(EARTH, ref["v_inf"], ref_alt, BurnSpec(ref["dv"], Engine(ref["isp"], ref["a0"])))
    for body in (JUPITER, SUN, MARS):
        alt = 0.37 * body.radius_eq
        s = Scales(body.gm, body.radius_eq + alt)
        burn = BurnSpec(nd["dv"] * s.velocity, Engine(nd["c"] * s.velocity / G0, nd["a0"] * s.acceleration))
        r = simulate_flyby(body, nd["v"] * s.velocity, alt, burn)
        assert r.eta == pytest.approx(r_earth.eta, abs=1e-10)
        assert r.eta_E == pytest.approx(r_earth.eta_E, abs=1e-10)
        assert r.Pi == pytest.approx(r_earth.Pi, rel=1e-12)


@pytest.mark.parametrize(
    "body, ratio, dv, isp, a0, steering",
    [
        (EARTH, 0.3, 1000.0, 465.0, 2.0, Prograde()),
        (EARTH, 0.02, 3000.0, 380.0, 20.0, InertialFixed()),
        (JUPITER, 0.1, 2000.0, 850.0, 0.5, Prograde()),
        (JUPITER, 0.1, 1000.0, 1800.0, 3e-4, Prograde()),
        (MARS, 0.5, 500.0, 3500.0, 1e-3, Prograde()),
        (SUN, 0.3, 5000.0, 465.0, 1.0, PitchLinear(0.1, -0.2)),
        (SATURN, 0.3, 1.0, 465.0, 1.0, Prograde()),
        (VENUS, 5.0, 500.0, 465.0, 0.5, Prograde()),
    ],
    ids=["earth-hydrolox", "earth-lowvinf", "jupiter-ntr", "jupiter-hall", "mars-ion", "sun-pitch",
         "saturn-tiny-dv", "venus-highvinf"],
)
def test_eta_error_estimate_is_not_optimistic(body, ratio, dv, isp, a0, steering):
    """The energy-balance error estimate bounds the change seen when rtol/atol drop 1e-12 → 1e-13.

    The rerun difference approximates the true error of the 1e-12 run. Measured estimate/actual
    ratios are 1.0–63 (RESEARCH_LOG 2026-10-03). The factor 2 allows for the rerun's own error.
    """
    alt = 0.1 * body.radius_eq
    burn = BurnSpec(dv, Engine(isp, a0))
    v = _vinf(body, alt, ratio)
    r1 = simulate_flyby(body, v, alt, burn, steering)
    r2 = simulate_flyby(body, v, alt, burn, steering, numerics=Numerics(rtol=1e-13, atol=1e-13))
    assert abs(r1.eta - r2.eta) <= 2.0 * r1.eta_err
    assert abs(r1.eta_E - r2.eta_E) <= 2.0 * r1.eta_E_err


@pytest.mark.parametrize("offset", [-3000.0, 0.0, 2000.0])
@pytest.mark.parametrize("steering", [Prograde(), PitchLinear(0.4, 0.0)], ids=["prograde", "pitch-in"])
def test_min_radius_analytic_matches_numerical(offset, steering):
    burn = BurnSpec(2000.0, Engine(465.0, 1.0), midpoint_offset=offset)
    res = simulate_flyby(EARTH, 2e3, 600e3, burn, steering)
    assert res.r_min == pytest.approx(res.r_min_numerical, rel=1e-9)
    assert res.r_min <= res.r_min_burn


def test_energy_balance_residual_small_on_burn():
    res = simulate_flyby(JUPITER, 5e3, 50e6, BurnSpec(3000.0, Engine(850.0, 0.3)), PitchLinear(0.1, 0.3))
    assert res.energy_balance_residual < 1e-11


def test_result_is_json_serializable():
    res = simulate_flyby(SUN, 20e3, 2e9, BurnSpec(2000.0, Engine(465.0, 0.5)))
    d = json.loads(json.dumps(res.to_dict(), allow_nan=False))
    assert d["r_soi"] is None and d["soi_ratio_burn_start"] == 0.0
    assert set(d["flags"]) == {"unsafe_periapsis", "impact", "captured", "outside_soi", "b_imp_small", "eta_unreliable"}
