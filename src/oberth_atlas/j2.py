"""J2 oblateness sensitivity: a powered flyby in point-mass + J2 gravity (nondimensional, 3D).

Units as in simulate.py: μ = r_p = 1 (r_p the periapsis radius of the point-mass hyperbola), V = sqrt(μ/r_p).
With ρ = R/r_p and pole direction p̂, the J2 potential and acceleration are

    U_J2 = (J2 ρ²/2)(3 s² − 1)/r³,   s = (r·p̂)/r,
    a_J2 = −∇U_J2 = −(3 J2 ρ²/(2 r⁴)) [(1 − 5 s²) r̂ + 2 s p̂].

The total energy E = v²/2 − 1/r + U_J2 is conserved on coasts, and E − E0 − W = 0 with thrust (W is the
specific thrust work), which gives the integration-error check. Because U_J2 → 0 at infinity,
v∞ = sqrt(2E) exactly.

η in the J2 field compares a finite burn and an impulsive burn *in the same field*. Both start from the
same state; the impulsive Δv is applied at the J2 trajectory's own periapsis (r·v = 0), and the finite
burn is centred on that time. With J2 = 0 this reproduces simulate_nd (tested).
"""

from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np

from . import kepler
from .simulate import R_FLOOR, Numerics, _integrate
from .steering import Prograde, SteeringContext


def j2_accel(r: np.ndarray, j2rho2: float, pole: np.ndarray) -> np.ndarray:
    rn = math.sqrt(float(r @ r))
    s = float(r @ pole) / rn
    return -(1.5 * j2rho2 / rn**4) * ((1.0 - 5.0 * s * s) * (r / rn) + 2.0 * s * pole)


def total_energy(y: np.ndarray, j2rho2: float, pole: np.ndarray) -> float:
    r, v = y[0:3], y[3:6]
    rn = math.sqrt(float(r @ r))
    s = float(r @ pole) / rn
    return 0.5 * float(v @ v) - 1.0 / rn + 0.5 * j2rho2 * (3.0 * s * s - 1.0) / rn**3


def _rhs(j2rho2: float, pole: np.ndarray, a0: float = 0.0, c: float = math.inf, steer=None):
    pole = np.asarray(pole, dtype=float)

    def rhs(t: float, y: np.ndarray) -> np.ndarray:
        r, v, m = y[0:3], y[3:6], y[6]
        rn = math.sqrt(float(r @ r))
        g = -r / rn**3
        if j2rho2:
            g = g + j2_accel(r, j2rho2, pole)
        if a0 > 0.0:
            u = steer(t, r, v, m)
            at = (a0 / m) * u
            return np.concatenate([v, g + at, [-a0 / c], [float(at @ v)]])
        return np.concatenate([v, g, [0.0, 0.0]])

    return rhs


@dataclass
class J2Result:
    eta: float
    v_inf_in: float
    v_inf_out_finite: float
    v_inf_out_impulsive: float
    t_periapsis: float          # periapsis time of the J2 coast trajectory (point-mass: 0)
    r_periapsis: float          # its radius (units of the point-mass r_p)
    Pi: float
    energy_balance: float       # max |E − E0 − W| over coast and burn


def simulate_j2(v_inf: float, dv: float, c: float, a0: float, j2rho2: float, pole=(0.0, 0.0, 1.0),
                numerics: Numerics = Numerics(), pre_tau: float = 40.0) -> J2Result:
    """Prograde finite and impulsive burns about the periapsis of a flyby in point-mass + J2 gravity."""
    pole = np.asarray(pole, dtype=float)
    pole = pole / np.linalg.norm(pole)
    vp = math.sqrt(v_inf**2 + 2.0)
    tau = 1.0 / vp
    t_b = (c / a0) * -math.expm1(-dv / c)
    t0 = -(0.6 * t_b + pre_tau * tau)
    r0, v0 = kepler.hyperbola_state(t0, 1.0, 1.0, v_inf)          # same start for every run
    y0 = np.concatenate([r0, v0, [1.0, 0.0]])
    E0 = total_energy(y0, j2rho2, pole)
    coast = _rhs(j2rho2, pole)
    # Periapsis of the J2 coast trajectory (first r·v = 0 crossing from − to +).
    seg = _integrate("coast", coast, t0, -t0, y0, numerics, R_FLOOR, thrusting=False)
    if not len(seg.t_periapsis):
        raise RuntimeError("no periapsis on the coast")
    tp, yp = float(seg.t_periapsis[0]), np.asarray(seg.y_periapsis[0])
    balance = float(np.max(np.abs([total_energy(seg.y[:, i], j2rho2, pole) - E0 for i in range(seg.y.shape[1])])))
    # Impulsive prograde Δv at that periapsis; the energy is conserved afterwards.
    y_imp = yp.copy()
    y_imp[3:6] += dv * yp[3:6] / np.linalg.norm(yp[3:6])
    E_imp = total_energy(y_imp, j2rho2, pole)
    # Finite burn centred on the same periapsis time.
    ts, te = tp - 0.5 * t_b, tp + 0.5 * t_b
    pre = _integrate("pre", coast, t0, ts, y0, numerics, R_FLOOR, thrusting=False)
    steer = Prograde().bind(SteeringContext(t_start=ts, t_end=te))
    burn = _integrate("burn", _rhs(j2rho2, pole, a0, c, steer), ts, te, pre.y[:, -1], numerics, R_FLOOR,
                      thrusting=True)
    if pre.impacted or burn.impacted:
        raise RuntimeError("impact")
    for sg in (pre, burn):
        resid = [total_energy(sg.y[:, i], j2rho2, pole) - E0 - sg.y[7, i] for i in range(sg.y.shape[1])]
        balance = max(balance, float(np.max(np.abs(resid))))
    E_fin = total_energy(burn.y[:, -1], j2rho2, pole)
    v_in, v_imp, v_fin = math.sqrt(2.0 * E0), math.sqrt(2.0 * E_imp), math.sqrt(2.0 * E_fin)
    eta = (v_fin - v_in - dv) / (v_imp - v_in - dv)
    return J2Result(eta=eta, v_inf_in=v_in, v_inf_out_finite=v_fin, v_inf_out_impulsive=v_imp, t_periapsis=tp,
                    r_periapsis=float(np.linalg.norm(yp[0:3])), Pi=t_b * vp, energy_balance=balance)


__all__ = ["j2_accel", "total_energy", "simulate_j2", "J2Result"]
