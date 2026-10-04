"""Engine classes and per-body mission envelopes (configs/atlas/presets.yaml), and their mapping into the
four dimensionless groups.

Every value in the presets file is a representative assumption (see that file's header).
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import yaml

from .constants import G0, KM, Body, get_body

DEFAULT_PRESETS = Path(__file__).resolve().parents[2] / "configs" / "atlas" / "presets.yaml"


@dataclass(frozen=True)
class EngineClass:
    key: str
    label: str
    isp: tuple[float, float]      # s
    a0: tuple[float, float]       # m/s²


@dataclass(frozen=True)
class BodyEnvelope:
    body: Body
    r_p: tuple[float, float]      # m
    v_inf: tuple[float, float]    # m/s


@dataclass(frozen=True)
class Presets:
    engines: dict[str, EngineClass]
    bodies: dict[str, BodyEnvelope]
    delta_v: tuple[float, float]  # m/s


def _pair(x, scale: float = 1.0) -> tuple[float, float]:
    lo, hi = (float(v) * scale for v in x)
    if not 0 < lo <= hi:
        raise ValueError(f"expected a positive [min, max] range, got {x}")
    return lo, hi


def load_presets(path: str | Path = DEFAULT_PRESETS) -> Presets:
    data = yaml.safe_load(Path(path).read_text(encoding="utf-8"))
    engines = {k: EngineClass(k, str(v.get("label", k)), _pair(v["isp_s"]), _pair(v["a0_m_s2"]))
               for k, v in data["engines"].items()}
    bodies = {}
    for name, v in data["bodies"].items():
        b = get_body(name)
        if ("r_p_over_R" in v) == ("altitude_km" in v):
            raise ValueError(f"body {name!r}: give exactly one of r_p_over_R or altitude_km")
        if "r_p_over_R" in v:
            lo, hi = _pair(v["r_p_over_R"])
            if lo <= 1.0:
                raise ValueError(f"body {name!r}: r_p_over_R must exceed 1")
            r_p = (lo * b.radius_eq, hi * b.radius_eq)
        else:
            lo, hi = _pair(v["altitude_km"], KM)
            r_p = (b.radius_eq + lo, b.radius_eq + hi)
        bodies[name] = BodyEnvelope(b, r_p, _pair(v["v_inf_km_s"], KM))
    return Presets(engines, bodies, _pair(data["delta_v_km_s"], KM))


def nd_groups(body: Body, r_p, v_inf, dv, isp, a0) -> dict[str, np.ndarray]:
    """The four dimensionless groups (and Δv/c) for SI inputs (scalars or arrays)."""
    r_p = np.asarray(r_p, dtype=float)
    V = np.sqrt(body.gm / r_p)
    g_p = body.gm / r_p**2
    c = np.asarray(isp, dtype=float) * G0
    return {
        "v_inf": np.asarray(v_inf) / V,
        "dv": np.asarray(dv) / V,
        "c": c / V,
        "a0": np.asarray(a0) / g_p,
        "dv_over_c": np.asarray(dv) / c,
    }


def nd_extremes(presets: Presets) -> dict[str, tuple[float, float]]:
    """Min and max of each dimensionless group over every (body, engine) envelope.

    Each group is monotonic in each physical input, so the extremes are at the envelope corners.
    """
    lo = {g: math.inf for g in ("v_inf", "dv", "c", "a0", "dv_over_c")}
    hi = {g: -math.inf for g in lo}
    for env in presets.bodies.values():
        for eng in presets.engines.values():
            corners = np.array(np.meshgrid(env.r_p, env.v_inf, presets.delta_v, eng.isp, eng.a0)).reshape(5, -1)
            groups = nd_groups(env.body, *corners)
            for g in lo:
                lo[g] = min(lo[g], float(np.min(groups[g])))
                hi[g] = max(hi[g], float(np.max(groups[g])))
    return {g: (lo[g], hi[g]) for g in lo}


def sample_missions(presets: Presets, n: int, seed: int = 0):
    """Scrambled-Sobol samples (log-uniform) inside every (body, engine) envelope.

    Yields (body_key, engine_key, dict of SI arrays: r_p, v_inf, dv, isp, a0).
    """
    from scipy.stats import qmc

    for bkey, env in presets.bodies.items():
        for ekey, eng in presets.engines.items():
            u = qmc.Sobol(d=5, scramble=True, seed=seed).random(n)
            bounds = [env.r_p, env.v_inf, presets.delta_v, eng.isp, eng.a0]
            cols = [np.exp(np.log(a) + u[:, i] * (np.log(b) - np.log(a))) for i, (a, b) in enumerate(bounds)]
            yield bkey, ekey, dict(zip(("r_p", "v_inf", "dv", "isp", "a0"), cols))
