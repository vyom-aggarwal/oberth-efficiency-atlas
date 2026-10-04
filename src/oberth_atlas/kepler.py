"""Analytic two-body relations: hyperbolic Kepler solver, conic elements, asymptotes.

All functions are unit-agnostic (any consistent units). The simulator calls them in
nondimensional units (mu = 1).

Perifocal frame of the incoming hyperbola: x̂ toward periapsis, ẑ along the angular
momentum, ŷ = ẑ × x̂ along the periapsis velocity. Time t is measured from periapsis passage.

Eccentricity is passed around as `em1 = e - 1 = r_p v_inf^2 / mu` (computed directly) to
avoid cancellation for near-parabolic orbits.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np

_EPS = np.finfo(float).eps


def hyperbola_em1(mu: float, r_p: float, v_inf: float) -> float:
    """e - 1 = r_p v_inf^2 / mu for a hyperbola with periapsis r_p and excess speed v_inf."""
    if v_inf <= 0:
        raise ValueError(f"hyperbolic arrival requires v_inf > 0, got {v_inf}")
    return r_p * v_inf**2 / mu


def turn_angle(e: float) -> float:
    """Total turn angle of the velocity between the asymptotes: 2 arcsin(1/e)."""
    return 2.0 * math.asin(1.0 / e)


def _sinh_minus_x(x: float) -> float:
    """sinh(x) - x without cancellation for |x| < 1 (direct evaluation beyond).

    Taylor series through x^21. Its first omitted term, x^23/23!, is < 3e-21 relative at |x| = 1.
    Direct evaluation at |x| = 1 loses a factor sinh(1)/(sinh(1) - 1) ≈ 6.7 to cancellation, and
    less beyond. (An earlier version stopped at x^11 and switched at |x| = 0.5, where the omitted
    term was ~1e-12 relative. That bug was caught by test_kepler_converges_everywhere.)
    """
    if abs(x) < 1.0:
        x2 = x * x
        c = (1 / 6, 1 / 120, 1 / 5040, 1 / 362880, 1 / 39916800, 1 / 6227020800, 1 / 1307674368000,
             1 / 355687428096000, 1 / 121645100408832000, 1 / 51090942171709440000)
        acc = c[-1]
        for coef in c[-2::-1]:
            acc = coef + x2 * acc
        return x * x2 * acc
    return math.sinh(x) - x


def solve_kepler_hyperbolic(M: float, em1: float, maxiter: int = 100) -> float:
    """Solve M = e sinh H - H for the hyperbolic anomaly H, given e - 1 = em1 > 0.

    Uses Newton's method on f(H) = (e-1) sinh H + (sinh H - H) - M for M >= 0, and the odd
    symmetry H(-M) = -H(M). For H >= 0, f is increasing and convex, so Newton started to the
    RIGHT of the root converges monotonically, with no overshoot. The start is the tightest of
    three rigorous upper bounds on the root:
        M/(e-1)        (f >= (e-1)H - M),
        (6M)^(1/3)     (f >= H^3/6 - M),
        asinh(M/(e-1)) (f >= (e-1) sinh H - M).
    This stays fast from near-parabolic (e - 1 -> 0, cubic regime) to |M| >> 1. Starting to the
    left instead (e.g. at asinh(M/e)) can overshoot to H ~ 100 when e - 1 is tiny, and then needs
    ~100 iterations to come back.
    """
    if em1 <= 0:
        raise ValueError(f"hyperbolic Kepler equation requires e > 1, got e - 1 = {em1}")
    if M == 0.0:
        return 0.0
    sign = 1.0 if M > 0 else -1.0
    M = abs(M)
    e = 1.0 + em1
    H = min(M / em1, (6.0 * M) ** (1.0 / 3.0), math.asinh(M / em1))
    dH_prev = math.inf
    for _ in range(maxiter):
        f = em1 * math.sinh(H) + _sinh_minus_x(H) - M
        fp = e * math.cosh(H) - 1.0
        dH = f / fp
        H -= dH
        # Converged when the step is at rounding level, or when it has stopped shrinking
        # while already below 1e-12 relative (Newton bouncing on rounding noise).
        if abs(dH) <= 4.0 * _EPS * abs(H) or (abs(dH) >= dH_prev and abs(dH) < 1e-12 * abs(H)):
            return sign * H
        dH_prev = abs(dH)
    raise RuntimeError(f"hyperbolic Kepler solver did not converge (M={M}, e-1={em1})")


def hyperbola_state(t: float, mu: float, r_p: float, v_inf: float) -> tuple[np.ndarray, np.ndarray]:
    """Analytic position and velocity (perifocal frame, 3D) at time t from periapsis."""
    em1 = hyperbola_em1(mu, r_p, v_inf)
    a_abs = mu / v_inf**2                  # |a|; a < 0 for a hyperbola
    n = v_inf**3 / mu                      # mean motion sqrt(mu/|a|^3)
    H = solve_kepler_hyperbolic(n * t, em1)
    sh, ch = math.sinh(H), math.cosh(H)
    s2 = 2.0 * math.sinh(0.5 * H) ** 2      # cosh H - 1, without cancellation
    sqrt_e2m1 = math.sqrt(em1 * (em1 + 2.0))
    r = a_abs * (em1 + (1.0 + em1) * s2)    # |a| (e cosh H - 1)
    x = a_abs * (em1 - s2)                  # |a| (e - cosh H)
    y = a_abs * sqrt_e2m1 * sh
    k = math.sqrt(mu * a_abs) / r
    vx = -k * sh
    vy = k * sqrt_e2m1 * ch
    return np.array([x, y, 0.0]), np.array([vx, vy, 0.0])


def incoming_asymptote_perifocal(em1: float) -> np.ndarray:
    """Unit direction of the incoming excess velocity (t -> -inf) in the perifocal frame."""
    e = 1.0 + em1
    return np.array([1.0, math.sqrt(em1 * (em1 + 2.0)), 0.0]) / e


@dataclass(frozen=True)
class Conic:
    """Osculating two-body conic of a state (r, v)."""

    energy: float           # specific orbital energy v^2/2 - mu/r
    h_vec: np.ndarray       # specific angular momentum r x v
    e_vec: np.ndarray       # eccentricity vector (points to periapsis)
    e: float                # eccentricity
    p: float                # semi-latus rectum h^2/mu
    mu: float

    @property
    def r_periapsis(self) -> float:
        return self.p / (1.0 + self.e)

    @property
    def is_hyperbolic(self) -> bool:
        return self.energy > 0.0

    def asymptotes(self) -> tuple[np.ndarray, np.ndarray]:
        """Unit incoming and outgoing excess-velocity directions (hyperbolic conics only)."""
        if not self.is_hyperbolic or self.e <= 1.0:
            raise ValueError("asymptotes are defined only for hyperbolic conics")
        e_hat = self.e_vec / self.e
        q_hat = np.cross(self.h_vec / np.linalg.norm(self.h_vec), e_hat)
        s = math.sqrt(self.e**2 - 1.0)
        v_in = (e_hat + s * q_hat) / self.e
        v_out = (-e_hat + s * q_hat) / self.e
        return v_in, v_out


def conic(r: np.ndarray, v: np.ndarray, mu: float) -> Conic:
    """Osculating conic of the state (r, v) about a point mass mu."""
    r = np.asarray(r, dtype=float)
    v = np.asarray(v, dtype=float)
    rn = float(np.linalg.norm(r))
    v2 = float(v @ v)
    h = np.cross(r, v)
    e_vec = ((v2 - mu / rn) * r - float(r @ v) * v) / mu
    return Conic(
        energy=0.5 * v2 - mu / rn,
        h_vec=h,
        e_vec=e_vec,
        e=float(np.linalg.norm(e_vec)),
        p=float(h @ h) / mu,
        mu=mu,
    )


def time_since_periapsis(r: np.ndarray, v: np.ndarray, mu: float) -> float:
    """Signed time since the nearest periapsis passage (negative while inbound).

    Hyperbola: uses r.v = e sqrt(mu |a|) sinh H. Ellipse: uses E = atan2(...), giving t in (-P/2, P/2].
    """
    c = conic(r, v, mu)
    rv = float(np.dot(r, v))
    rn = float(np.linalg.norm(r))
    if c.energy > 0:
        a_abs = mu / (2.0 * c.energy)
        H = math.asinh(rv / (c.e * math.sqrt(mu * a_abs)))
        M = c.e * math.sinh(H) - H
        return M / math.sqrt(mu / a_abs**3)
    if c.energy < 0:
        a = -mu / (2.0 * c.energy)
        E = math.atan2(rv / math.sqrt(mu * a), 1.0 - rn / a)
        M = E - c.e * math.sin(E)
        return M / math.sqrt(mu / a**3)
    raise ValueError("parabolic (zero-energy) states are not supported")


def time_to_next_periapsis(r: np.ndarray, v: np.ndarray, mu: float) -> float:
    """Time until the next periapsis passage. Infinite for a hyperbola that is already outbound."""
    ts = time_since_periapsis(r, v, mu)
    c = conic(r, v, mu)
    if ts < 0:
        return -ts
    if c.energy < 0:
        a = -mu / (2.0 * c.energy)
        return 2.0 * math.pi * math.sqrt(a**3 / mu) - ts
    return math.inf


def conic_min_radius(r_a: np.ndarray, v_a: np.ndarray, r_b: np.ndarray, duration: float, mu: float) -> float:
    """Exact minimum radius along a two-body coast arc from state a lasting `duration`.

    If the arc passes a periapsis, the result is the osculating periapsis radius. Otherwise it
    is the smaller endpoint radius, because r is monotonic between apsides.
    """
    if duration >= time_to_next_periapsis(r_a, v_a, mu):
        return conic(r_a, v_a, mu).r_periapsis
    return float(min(np.linalg.norm(r_a), np.linalg.norm(r_b)))


def angle_between(a: np.ndarray, b: np.ndarray) -> float:
    """Angle between two vectors via atan2(|a x b|, a.b). Accurate near 0 and pi."""
    return math.atan2(float(np.linalg.norm(np.cross(a, b))), float(np.dot(a, b)))
