"""Physical constants and body parameters (SI units throughout).

This is the only place physical constants are defined. Every value cites its
source. Sources were retrieved on 2026-10-03:

[DE440]   JPL SSD "Astrodynamic Parameters", Planetary Masses table and
          heliocentric gravitational constant, from planetary ephemeris DE440.
          https://ssd.jpl.nasa.gov/astro_par.html
[SATS]    JPL SSD "Planetary Satellite Physical Parameters", planet-only GM
          from satellite-system orbit solutions JUP365 (Jupiter) and SAT441 (Saturn).
          https://ssd.jpl.nasa.gov/sats/phys_par/
[PHYS]    JPL SSD "Planetary Physical Parameters" (page dated 2019-Dec-12).
          Equatorial radii come from Archinal et al. (2018), IAU WGCCRE 2015 report.
          https://ssd.jpl.nasa.gov/planets/phys_par.html
[APPROX]  JPL SSD "Approximate Positions of the Planets", Table 1 (Standish &
          Williams 1992): Keplerian elements valid 1800-2050 AD, semi-major
          axis at J2000. https://ssd.jpl.nasa.gov/planets/approx_pos.html
[IAU2015] IAU 2015 Resolution B3, nominal solar radius R_sun^N = 695 700 km.
          (Not tabulated by JPL SSD.)

Choices recorded in RESEARCH_LOG.md (2026-10-03):
- Jupiter and Saturn use planet-only GM [SATS], not the DE440 system values
  (planet plus satellites). Flybys at a few planetary radii pass inside the
  orbits of the Galilean moons and Titan. The system values are kept below
  for reference only.
- Mars uses the DE440 "Mars system" GM. Phobos and Deimos change it by ~2e-8.
- Collision checks use the equatorial radius.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

KM = 1.0e3          # m per km
KM3_S2 = 1.0e9      # (m^3/s^2) per (km^3/s^2)

# Standard gravity, exact by definition (3rd CGPM, 1901). Used only to turn Isp into exhaust velocity.
G0 = 9.80665  # m/s^2

# US customary units used in motor datasheets, exact by definition (international yard and pound
# agreement, 1959; NIST SP 811, 2008, App. B): 1 lbm = 0.45359237 kg, 1 lbf = 1 lbm × g0.
LBM = 0.45359237     # kg
LBF = LBM * G0       # N (= 4.4482216152605 N)

# Astronomical unit, exact by definition (IAU 2012), as quoted by [DE440].
AU = 149_597_870_700.0  # m

# Heliocentric gravitational constant [DE440].
GM_SUN = 1.32712440041279419e20  # m^3/s^2

# DE440 system GMs (planet + satellites) [DE440], for reference and comparison only.
GM_SYSTEM_DE440 = {
    "mars": 42828.375816 * KM3_S2,
    "jupiter": 126712764.100000 * KM3_S2,
    "saturn": 37940584.841800 * KM3_S2,
}


@dataclass(frozen=True)
class Body:
    """A central body: point-mass gravity plus a spherical collision radius."""

    name: str
    gm: float                    # m^3/s^2, gravitational parameter used in the dynamics
    radius_eq: float             # m, equatorial radius (collision / safety checks)
    sma: float | None            # m, heliocentric semi-major axis; None for the Sun

    @property
    def soi_radius(self) -> float:
        """Laplace sphere of influence r_SOI = a (m/M_sun)^(2/5), in m. Infinite for the Sun.

        Uses the body's dynamical GM. The DE440 system GM would change r_SOI by
        <1e-4 for Jupiter and Saturn.
        """
        if self.sma is None:
            return math.inf
        return self.sma * (self.gm / GM_SUN) ** 0.4

    def escape_speed(self, r: float) -> float:
        """Escape speed sqrt(2 mu / r) at radius r (m), in m/s."""
        return math.sqrt(2.0 * self.gm / r)


SUN = Body(
    name="sun",
    gm=GM_SUN,                                   # [DE440]
    radius_eq=695_700.0 * KM,                    # [IAU2015] nominal solar radius
    sma=None,
)

VENUS = Body(
    name="venus",
    gm=324858.592000 * KM3_S2,                   # [DE440] Venus
    radius_eq=6051.8 * KM,                       # [PHYS] equatorial radius, +/- 1.0 km
    sma=0.72333566 * AU,                         # [APPROX] Table 1, J2000
)

EARTH = Body(
    name="earth",
    gm=398600.435507 * KM3_S2,                   # [DE440] Earth alone (Moon listed separately)
    radius_eq=6378.1366 * KM,                    # [PHYS] equatorial radius, +/- 0.0001 km
    sma=1.00000261 * AU,                         # [APPROX] Table 1, Earth-Moon barycenter, J2000
)

MARS = Body(
    name="mars",
    gm=42828.375816 * KM3_S2,                    # [DE440] Mars system (satellites ~2e-8 of total)
    radius_eq=3396.19 * KM,                      # [PHYS] equatorial radius, +/- 0.1 km
    sma=1.52371034 * AU,                         # [APPROX] Table 1, J2000
)

JUPITER = Body(
    name="jupiter",
    gm=126686531.9 * KM3_S2,                     # [SATS] JUP365, planet only, +/- 0.42 km^3/s^2
    radius_eq=71492.0 * KM,                      # [PHYS] equatorial radius, +/- 4 km
    sma=5.20288700 * AU,                         # [APPROX] Table 1, J2000
)

SATURN = Body(
    name="saturn",
    gm=37931206.23 * KM3_S2,                     # [SATS] SAT441, planet only, +/- 0.24 km^3/s^2
    radius_eq=60268.0 * KM,                      # [PHYS] equatorial radius, +/- 4 km
    sma=9.53667594 * AU,                         # [APPROX] Table 1, J2000
)

BODIES: dict[str, Body] = {b.name: b for b in (SUN, VENUS, EARTH, MARS, JUPITER, SATURN)}


def get_body(name: str) -> Body:
    """Look up a body by case-insensitive name."""
    key = name.strip().lower()
    if key not in BODIES:
        raise KeyError(f"unknown body {name!r}; known bodies: {sorted(BODIES)}")
    return BODIES[key]
