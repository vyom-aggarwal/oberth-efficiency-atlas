"""Engine and burn specification (SI units).

A burn is defined by (Δv, Isp, a0 = T/m0) and its timing relative to the unperturbed
periapsis passage. Absolute mass cancels out of every result. m0 is carried only so that
absolute masses and thrust can be reported.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

from .constants import G0


@dataclass(frozen=True)
class Engine:
    """Constant-thrust, constant-Isp engine.

    isp: specific impulse, s
    a0: initial thrust acceleration T/m0, m/s^2
    m0: initial spacecraft mass, kg (reporting only)
    """

    isp: float
    a0: float
    m0: float = 1.0

    def __post_init__(self) -> None:
        if not (self.isp > 0 and self.a0 > 0 and self.m0 > 0):
            raise ValueError(f"engine parameters must be positive: isp={self.isp}, a0={self.a0}, m0={self.m0}")

    @classmethod
    def from_thrust(cls, isp: float, thrust: float, m0: float) -> Engine:
        """Build from thrust (N) and initial mass (kg)."""
        return cls(isp=isp, a0=thrust / m0, m0=m0)

    @property
    def exhaust_velocity(self) -> float:
        """c = Isp g0, m/s."""
        return self.isp * G0

    @property
    def thrust(self) -> float:
        """T = a0 m0, N."""
        return self.a0 * self.m0


@dataclass(frozen=True)
class BurnSpec:
    """A single constant-thrust burn.

    delta_v: ideal (rocket-equation) Δv, m/s
    engine: the engine
    midpoint_offset: burn midpoint relative to unperturbed periapsis passage, s (0 = centered)
    """

    delta_v: float
    engine: Engine
    midpoint_offset: float = 0.0

    def __post_init__(self) -> None:
        if not self.delta_v > 0:
            raise ValueError(f"delta_v must be positive, got {self.delta_v}")

    @property
    def mass_ratio(self) -> float:
        """m_f / m0 = exp(−Δv / c)."""
        return math.exp(-self.delta_v / self.engine.exhaust_velocity)

    @property
    def duration(self) -> float:
        """t_b = (c / a0) (1 − exp(−Δv / c)), s."""
        c = self.engine.exhaust_velocity
        return (c / self.engine.a0) * -math.expm1(-self.delta_v / c)

    @property
    def t_start(self) -> float:
        return self.midpoint_offset - 0.5 * self.duration

    @property
    def t_end(self) -> float:
        return self.midpoint_offset + 0.5 * self.duration
