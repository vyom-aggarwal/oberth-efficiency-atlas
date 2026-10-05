"""Pluggable thrust-steering laws.

A steering law is a frozen dataclass of parameters. `bind(ctx)` returns a fast closure
`u(t, r, v, m) -> unit vector`. It is evaluated in nondimensional units on the burn segment.
All laws are smooth within the burn, so the integrator never meets a discontinuity.

Sign convention for pitch: the in-plane normal is n̂ = ẑ₀ × v̂, where ẑ₀ is the normal of the
incoming flyby plane (fixed). For a prograde flyby, n̂ points toward the central-body side of the
velocity, so α > 0 tilts thrust toward the planet.
"""

from __future__ import annotations

import math
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Protocol

import numpy as np

SteeringFn = Callable[[float, np.ndarray, np.ndarray, float], np.ndarray]


@dataclass(frozen=True)
class SteeringContext:
    """Information a steering law may need, all in nondimensional units and the simulation frame."""

    t_start: float                     # burn start time
    t_end: float                       # burn end time
    rotation: np.ndarray = field(default_factory=lambda: np.eye(3))  # perifocal -> simulation frame

    @property
    def periapsis_velocity_dir(self) -> np.ndarray:
        """Unperturbed periapsis velocity direction (perifocal ŷ) in the simulation frame."""
        return self.rotation @ np.array([0.0, 1.0, 0.0])

    @property
    def plane_normal(self) -> np.ndarray:
        """Normal of the incoming flyby plane (perifocal ẑ) in the simulation frame."""
        return self.rotation @ np.array([0.0, 0.0, 1.0])


class SteeringLaw(Protocol):
    name: str

    def bind(self, ctx: SteeringContext) -> SteeringFn: ...

    def to_dict(self) -> dict: ...


def _unit(v: np.ndarray) -> np.ndarray:
    return v / math.sqrt(float(v @ v))


@dataclass(frozen=True)
class Prograde:
    """Thrust along the instantaneous (planet-relative) velocity."""

    name: str = field(default="prograde", init=False)

    def bind(self, ctx: SteeringContext) -> SteeringFn:
        def u(t: float, r: np.ndarray, v: np.ndarray, m: float) -> np.ndarray:
            return v / math.sqrt(float(v @ v))
        return u

    def to_dict(self) -> dict:
        return {"law": self.name}


@dataclass(frozen=True)
class InertialFixed:
    """Thrust along a fixed inertial direction.

    `direction` is given in the perifocal frame of the incoming hyperbola. None means the
    unperturbed periapsis velocity direction ŷ.
    """

    direction: tuple[float, float, float] | None = None
    name: str = field(default="inertial", init=False)

    def bind(self, ctx: SteeringContext) -> SteeringFn:
        if self.direction is None:
            d = ctx.periapsis_velocity_dir
        else:
            d = ctx.rotation @ np.asarray(self.direction, dtype=float)
        d = _unit(d)

        def u(t: float, r: np.ndarray, v: np.ndarray, m: float) -> np.ndarray:
            return d
        return u

    def to_dict(self) -> dict:
        return {"law": self.name, "direction": None if self.direction is None else list(self.direction)}


@dataclass(frozen=True)
class PitchLinear:
    """In-plane pitch from the velocity vector: α(s) = alpha0 + alpha1 · s, angles in radians.

    s = (t − t_mid) / t_b runs over [−1/2, 1/2], so `alpha1` is the total pitch change over the
    burn. This keeps both parameters O(1) for any burn duration.
    u = cos α · v̂ + sin α · (ẑ₀ × v̂), where ẑ₀ is the fixed normal of the incoming flyby plane.

    ẑ₀ equals the instantaneous orbit normal ĥ while the angular momentum keeps its sense, i.e. for
    every flyby that does not reverse direction. Using ĥ itself is singular at h = 0: the sideways
    term changes |h| at the finite rate sin α · (r·v̂) · a, so a strong pitch can drive h to zero,
    where ĥ flips and the thrust direction chatters (a sliding mode that stalls the integrator).
    Found in the Phase 3 optimizer, which probes such controls (RESEARCH_LOG 2026-10-04).
    """

    alpha0: float = 0.0
    alpha1: float = 0.0
    name: str = field(default="pitch_linear", init=False)

    def bind(self, ctx: SteeringContext) -> SteeringFn:
        t_mid = 0.5 * (ctx.t_start + ctx.t_end)
        t_b = ctx.t_end - ctx.t_start
        a0, a1 = self.alpha0, self.alpha1
        inv_tb = 1.0 / t_b if t_b > 0 else 0.0
        z0 = ctx.plane_normal

        def u(t: float, r: np.ndarray, v: np.ndarray, m: float) -> np.ndarray:
            vhat = v / math.sqrt(float(v @ v))
            alpha = a0 + a1 * (t - t_mid) * inv_tb
            return math.cos(alpha) * vhat + math.sin(alpha) * np.cross(z0, vhat)
        return u

    def to_dict(self) -> dict:
        return {"law": self.name, "alpha0_deg": math.degrees(self.alpha0), "alpha1_deg": math.degrees(self.alpha1)}


STEERING_LAWS = {"prograde": Prograde, "inertial": InertialFixed, "pitch_linear": PitchLinear}


def make_steering(spec: dict | None) -> SteeringLaw:
    """Build a steering law from a config mapping such as {"law": "pitch_linear", "alpha0_deg": 5}."""
    spec = dict(spec or {"law": "prograde"})
    law = spec.pop("law", "prograde")
    if law == "prograde":
        _reject_extra(law, spec)
        return Prograde()
    if law == "inertial":
        direction = spec.pop("direction", None)
        _reject_extra(law, spec)
        return InertialFixed(direction=None if direction is None else tuple(float(x) for x in direction))
    if law == "pitch_linear":
        alpha0 = math.radians(float(spec.pop("alpha0_deg", 0.0)))
        alpha1 = math.radians(float(spec.pop("alpha1_deg", 0.0)))
        _reject_extra(law, spec)
        return PitchLinear(alpha0=alpha0, alpha1=alpha1)
    raise ValueError(f"unknown steering law {law!r}; choose from {sorted(STEERING_LAWS)}")


def _reject_extra(law: str, spec: dict) -> None:
    if spec:
        raise ValueError(f"unexpected parameters for steering law {law!r}: {sorted(spec)}")


__all__ = [
    "SteeringContext", "SteeringLaw", "Prograde", "InertialFixed", "PitchLinear",
    "make_steering", "STEERING_LAWS",
]
