"""Equations of motion in nondimensional units.

State y = [x, y, z, vx, vy, vz, m, W]:
  dr/dt = v
  dv/dt = −μ r/|r|³ + (a0/m) u        (a0 = T/m0 nondimensional, m = mass/m0)
  dm/dt = −a0/c                        (c = Isp·g0 nondimensional)
  dW/dt = (a0/m) u·v                   (specific work done by thrust)

W is not needed for the dynamics. It gives an energy-balance check: in exact arithmetic,
ε(r, v) − ε(t0) − W(t) = 0 on every segment, so its size measures integration error,
including on the burn arc.

Setting mu = 0 switches gravity off (used for the gravity-free validation case).
"""

from __future__ import annotations

import math
from collections.abc import Callable

import numpy as np

from .steering import SteeringFn

STATE_SIZE = 8
RHS = Callable[[float, np.ndarray], np.ndarray]


def coast_rhs(mu: float) -> RHS:
    """Point-mass gravity only."""

    def rhs(t: float, y: np.ndarray) -> np.ndarray:
        x, yy, z = y[0], y[1], y[2]
        r2 = x * x + yy * yy + z * z
        k = -mu / (r2 * math.sqrt(r2)) if mu != 0.0 else 0.0
        return np.array([y[3], y[4], y[5], k * x, k * yy, k * z, 0.0, 0.0])

    return rhs


def thrust_rhs(mu: float, a0: float, c: float, steer: SteeringFn) -> RHS:
    """Point-mass gravity plus constant thrust along steer(t, r, v, m)."""
    mdot = a0 / c

    def rhs(t: float, y: np.ndarray) -> np.ndarray:
        r = y[0:3]
        v = y[3:6]
        m = y[6]
        x, yy, z = r[0], r[1], r[2]
        r2 = x * x + yy * yy + z * z
        k = -mu / (r2 * math.sqrt(r2)) if mu != 0.0 else 0.0
        u = steer(t, r, v, m)
        am = a0 / m
        ax, ay, az = am * u[0], am * u[1], am * u[2]
        return np.array([
            v[0], v[1], v[2],
            k * x + ax, k * yy + ay, k * z + az,
            -mdot,
            ax * v[0] + ay * v[1] + az * v[2],
        ])

    return rhs


def variable_thrust_rhs(mu: float, thrust_of_r: Callable[[float], float], c: float, steer: SteeringFn) -> RHS:
    """Point-mass gravity plus thrust T(|r|) (units m0 μ/r_p²) along steer(t, r, v, m); dm/dt = −T/c.

    Used for solar-electric propulsion, whose available power (and so thrust, at constant Isp and
    efficiency) depends on the distance from the Sun.
    """

    def rhs(t: float, y: np.ndarray) -> np.ndarray:
        r = y[0:3]
        v = y[3:6]
        m = y[6]
        x, yy, z = r[0], r[1], r[2]
        r2 = x * x + yy * yy + z * z
        rn = math.sqrt(r2)
        k = -mu / (r2 * rn) if mu != 0.0 else 0.0
        T = thrust_of_r(rn)
        u = steer(t, r, v, m)
        am = T / m
        ax, ay, az = am * u[0], am * u[1], am * u[2]
        return np.array([
            v[0], v[1], v[2],
            k * x + ax, k * yy + ay, k * z + az,
            -T / c,
            ax * v[0] + ay * v[1] + az * v[2],
        ])

    return rhs


def specific_energy(y: np.ndarray, mu: float) -> np.ndarray:
    """ε = v²/2 − μ/r for a state array of shape (8,) or (8, N)."""
    r = np.sqrt(y[0] ** 2 + y[1] ** 2 + y[2] ** 2)
    v2 = y[3] ** 2 + y[4] ** 2 + y[5] ** 2
    return 0.5 * v2 - (mu / r if mu != 0.0 else 0.0 * r)
