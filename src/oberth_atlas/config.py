"""Load and validate single-flyby configs (YAML or JSON). Unit conversion to SI happens only here.

Schema (unknown keys are rejected, which catches typos):

    name: earth_hydrolox            # optional; defaults to the file stem
    body: earth                     # sun | venus | earth | mars | jupiter | saturn
    flyby:
      v_inf_in_km_s: 3.0
      periapsis_altitude_km: 300.0
    engine:                         # omit engine and burn together for a coast-only flyby
      isp_s: 465.0
      a0_m_s2: 2.0                  # either a0_m_s2 (optionally with m0_kg) ...
      # thrust_N: 110000.0          # ... or thrust_N together with m0_kg
      # m0_kg: 25000.0
    burn:
      delta_v_km_s: 1.0
      midpoint_offset_s: 0.0        # at most one of: midpoint_offset_s, midpoint_offset_tau, midpoint_offset_tb
    steering:
      law: prograde                 # prograde | inertial (direction: [x, y, z]) | pitch_linear (alpha0_deg, alpha1_deg)
    safety_margin_km: 100.0
    numerics:                       # optional overrides of simulate.Numerics
      rtol: 1.0e-12
"""

from __future__ import annotations

import json
from dataclasses import dataclass, fields, replace
from pathlib import Path

import yaml

from . import metrics
from .burn import BurnSpec, Engine
from .constants import KM, Body, get_body
from .simulate import FlybyResult, Numerics, simulate_flyby
from .steering import SteeringLaw, make_steering

_TOP_KEYS = {"name", "body", "flyby", "engine", "burn", "steering", "safety_margin_km", "numerics"}
_FLYBY_KEYS = {"v_inf_in_km_s", "periapsis_altitude_km"}
_ENGINE_KEYS = {"isp_s", "a0_m_s2", "thrust_N", "m0_kg"}
_BURN_KEYS = {"delta_v_km_s", "midpoint_offset_s", "midpoint_offset_tau", "midpoint_offset_tb"}
_NUMERICS_KEYS = {f.name for f in fields(Numerics)} - {"gravity", "dense_output"}


@dataclass(frozen=True)
class FlybyConfig:
    """A fully resolved single-flyby specification (SI units)."""

    name: str
    body: Body
    v_inf_in: float
    periapsis_altitude: float
    burn: BurnSpec | None
    steering: SteeringLaw
    safety_margin: float
    numerics: Numerics

    def run(self, dense_output: bool = False) -> FlybyResult:
        num = replace(self.numerics, dense_output=dense_output)
        return simulate_flyby(self.body, self.v_inf_in, self.periapsis_altitude, self.burn, self.steering,
                              safety_margin=self.safety_margin, numerics=num)


def _check_keys(section: str, data: dict, allowed: set[str], required: set[str] = frozenset()) -> None:
    if not isinstance(data, dict):
        raise ValueError(f"config section {section!r} must be a mapping")
    unknown = set(data) - allowed
    if unknown:
        raise ValueError(f"unknown key(s) in {section!r}: {sorted(unknown)}; allowed: {sorted(allowed)}")
    missing = set(required) - set(data)
    if missing:
        raise ValueError(f"missing key(s) in {section!r}: {sorted(missing)}")


def parse_config(data: dict, name: str = "flyby") -> FlybyConfig:
    """Build a FlybyConfig from a parsed mapping."""
    _check_keys("<top level>", data, _TOP_KEYS, {"body", "flyby"})
    body = get_body(str(data["body"]))

    fly = data["flyby"]
    _check_keys("flyby", fly, _FLYBY_KEYS, _FLYBY_KEYS)
    v_inf = float(fly["v_inf_in_km_s"]) * KM
    alt = float(fly["periapsis_altitude_km"]) * KM

    eng_d, burn_d = data.get("engine"), data.get("burn")
    if (eng_d is None) != (burn_d is None):
        raise ValueError("'engine' and 'burn' must be given together (or both omitted for a coast-only flyby)")

    burn = None
    if burn_d is not None:
        _check_keys("engine", eng_d, _ENGINE_KEYS, {"isp_s"})
        isp = float(eng_d["isp_s"])
        if "a0_m_s2" in eng_d:
            if "thrust_N" in eng_d:
                raise ValueError("give either engine.a0_m_s2 or engine.thrust_N (+ m0_kg), not both")
            engine = Engine(isp=isp, a0=float(eng_d["a0_m_s2"]), m0=float(eng_d.get("m0_kg", 1.0)))
        elif "thrust_N" in eng_d and "m0_kg" in eng_d:
            engine = Engine.from_thrust(isp, float(eng_d["thrust_N"]), float(eng_d["m0_kg"]))
        else:
            raise ValueError("engine needs a0_m_s2, or thrust_N together with m0_kg")

        _check_keys("burn", burn_d, _BURN_KEYS, {"delta_v_km_s"})
        dv = float(burn_d["delta_v_km_s"]) * KM
        offsets = [k for k in ("midpoint_offset_s", "midpoint_offset_tau", "midpoint_offset_tb") if k in burn_d]
        if len(offsets) > 1:
            raise ValueError(f"give at most one burn midpoint offset, got {offsets}")
        offset = 0.0
        if offsets == ["midpoint_offset_s"]:
            offset = float(burn_d["midpoint_offset_s"])
        elif offsets == ["midpoint_offset_tau"]:
            tau = metrics.periapsis_timescale(body.gm, body.radius_eq + alt, v_inf)
            offset = float(burn_d["midpoint_offset_tau"]) * tau
        elif offsets == ["midpoint_offset_tb"]:
            offset = float(burn_d["midpoint_offset_tb"]) * BurnSpec(dv, engine).duration
        burn = BurnSpec(delta_v=dv, engine=engine, midpoint_offset=offset)

    steering = make_steering(data.get("steering"))
    num_d = data.get("numerics") or {}
    _check_keys("numerics", num_d, _NUMERICS_KEYS)
    numerics = Numerics(**{k: (str(v) if k == "method" else float(v)) for k, v in num_d.items()})

    return FlybyConfig(
        name=str(data.get("name", name)),
        body=body,
        v_inf_in=v_inf,
        periapsis_altitude=alt,
        burn=burn,
        steering=steering,
        safety_margin=float(data.get("safety_margin_km", 0.0)) * KM,
        numerics=numerics,
    )


def load_config(path: str | Path) -> FlybyConfig:
    """Load a .yaml/.yml or .json flyby config."""
    path = Path(path)
    text = path.read_text(encoding="utf-8")
    if path.suffix.lower() in (".yaml", ".yml"):
        data = yaml.safe_load(text)
    elif path.suffix.lower() == ".json":
        data = json.loads(text)
    else:
        raise ValueError(f"config must be .yaml, .yml or .json, got {path.suffix!r}")
    return parse_config(data, name=path.stem)
