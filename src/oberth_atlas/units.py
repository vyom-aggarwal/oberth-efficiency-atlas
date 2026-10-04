"""Nondimensional scaling: length r_p, velocity sqrt(mu/r_p), mass m0.

In these units mu = 1, the unperturbed periapsis radius is 1, and m(t0) = 1.
SI <-> nondimensional conversion happens only here and at the edges of `simulate.py`.
"""

from __future__ import annotations

import math
from dataclasses import dataclass


@dataclass(frozen=True)
class Scales:
    """Characteristic scales of one flyby.

    mu: gravitational parameter of the central body, m^3/s^2
    r_p: unperturbed periapsis radius, m
    m0: initial spacecraft mass, kg (1 kg is fine when only accelerations are known)
    """

    mu: float
    r_p: float
    m0: float = 1.0

    def __post_init__(self) -> None:
        if not (self.mu > 0 and self.r_p > 0 and self.m0 > 0):
            raise ValueError(f"scales must be positive, got mu={self.mu}, r_p={self.r_p}, m0={self.m0}")

    @property
    def length(self) -> float:
        """m per unit length."""
        return self.r_p

    @property
    def velocity(self) -> float:
        """m/s per unit velocity: sqrt(mu/r_p), the circular speed at r_p."""
        return math.sqrt(self.mu / self.r_p)

    @property
    def time(self) -> float:
        """s per unit time: sqrt(r_p^3/mu)."""
        return math.sqrt(self.r_p**3 / self.mu)

    @property
    def acceleration(self) -> float:
        """m/s^2 per unit acceleration: mu/r_p^2, the local gravity at r_p."""
        return self.mu / self.r_p**2

    @property
    def specific_energy(self) -> float:
        """J/kg per unit specific energy: mu/r_p."""
        return self.mu / self.r_p

    @property
    def mass(self) -> float:
        """kg per unit mass."""
        return self.m0
