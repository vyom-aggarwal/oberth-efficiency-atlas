"""Phase 2 parameter sweeps.

1. `run_sweep`: a tensor grid over the four dimensionless groups (ṽ∞, Δṽ, c̃, ã0) × steering law.
   It is body-free. Every row stores r_min/r_p and r_burn_start/r_p, so impact and SOI can be
   judged per body afterwards.
2. `run_missions`: Sobol samples inside every (body, engine) envelope from the presets, simulated
   with the real body (impact at R_eq, SOI from the body's orbit). This is where real missions sit.

Both write Parquet. The file metadata records the grid or sampling spec, numerics, git revision
and package versions. A case that raises is kept as a row with status="error" and its message;
nothing is dropped silently.
"""

from __future__ import annotations

import json
import math
import os
import time
from collections.abc import Iterator
from concurrent.futures import ProcessPoolExecutor
from dataclasses import asdict, dataclass, field
from pathlib import Path

import numpy as np

from . import __version__, theory
from .burn import BurnSpec, Engine
from .presets import Presets, nd_extremes, nd_groups, sample_missions
from .simulate import Numerics, simulate_flyby, simulate_nd
from .steering import InertialFixed, Prograde

STEERING = {"prograde": Prograde(), "inertial": InertialFixed()}


@dataclass(frozen=True)
class Axis:
    lo: float
    hi: float
    n: int

    @property
    def values(self) -> np.ndarray:
        return np.geomspace(self.lo, self.hi, self.n)


@dataclass(frozen=True)
class GridSpec:
    v_inf: Axis
    dv: Axis
    c: Axis
    a0: Axis
    steering: tuple[str, ...] = ("prograde", "inertial")
    max_dv_over_c: float = 2.0                 # mass ratio >= e^-2; beyond every preset (max 0.85)
    numerics: dict = field(default_factory=dict)
    # If set, the exhaust-velocity axis is replaced by these mass-loading values λ = Δv/c, and c =
    # Δv/λ for each Δv (user decision Q4: λ ≈ 0.1, 1, 3). `c` is then ignored, and so is
    # max_dv_over_c, since the list itself sets the mass ratio.
    dv_over_c: tuple[float, ...] | None = None

    def _c_values(self, dv: float) -> list[tuple[int, float]]:
        """(axis index, c) pairs for this Δv. The index is the position on the c (or Δv/c) axis."""
        if self.dv_over_c is not None:
            return [(k, dv / lam) for k, lam in enumerate(self.dv_over_c)]
        return [(k, float(c)) for k, c in enumerate(self.c.values) if dv / c <= self.max_dv_over_c]

    def cases(self) -> Iterator[dict]:
        ax = {g: getattr(self, g).values for g in ("v_inf", "dv", "a0")}
        for law in self.steering:
            for i, v in enumerate(ax["v_inf"]):
                for j, dv in enumerate(ax["dv"]):
                    for k, c in self._c_values(float(dv)):
                        for m, a0 in enumerate(ax["a0"]):
                            yield dict(steering=law, i_v_inf=i, i_dv=j, i_c=k, i_a0=m,
                                       v_inf=float(v), dv=float(dv), c=float(c), a0=float(a0))

    def n_cases(self) -> int:
        return sum(1 for _ in self.cases())

    def to_dict(self) -> dict:
        return asdict(self)


def grid_from_presets(presets: Presets, pad: float = 1.5,
                      per_decade: dict[str, float] | None = None, max_dv_over_c: float = 2.0) -> GridSpec:
    """A log grid whose bounds are the preset extremes widened by `pad` on each side.

    So every body/engine envelope lies strictly inside the grid by construction.
    """
    per_decade = per_decade or {"v_inf": 4.5, "dv": 3.0, "c": 3.0, "a0": 4.0}
    ext = nd_extremes(presets)
    axes = {}
    for g, dens in per_decade.items():
        lo, hi = ext[g][0] / pad, ext[g][1] * pad
        axes[g] = Axis(lo, hi, int(math.ceil(math.log10(hi / lo) * dens)) + 1)
    return GridSpec(**axes, max_dv_over_c=max_dv_over_c)


# ------------------------------------------------------------------ one case (top level: picklable)

def _derived(v: float, dv: float, c: float) -> dict:
    v_p = math.sqrt(v * v + 2.0)
    return dict(v_p=v_p, k=1.0 / v_p**2, v_inf_over_vesc=v / math.sqrt(2.0), dv_over_vp=dv / v_p,
                dv_over_c=dv / c, xi=theory.xi_parameter(v, dv), Pi_T=theory.tail_crossover_pi(v))


def run_case(case: dict, numerics: dict | None = None) -> dict:
    row = dict(case)
    v, dv, c, a0, law = case["v_inf"], case["dv"], case["c"], case["a0"], case["steering"]
    row.update(_derived(v, dv, c))
    t0 = time.perf_counter()
    try:
        r = simulate_nd(v, dv, c, a0, STEERING[law], numerics=Numerics(**(numerics or {})))
        row.update(
            status="ok", error="",
            Pi=r.Pi, t_b=r.t_b, mass_ratio=r.mass_ratio,
            eta=r.eta, eta_err=r.eta_err, eta_E=r.eta_E, eta_E_err=r.eta_E_err, eta_W=r.eta_W, eta_W_err=r.eta_W_err,
            v_inf_out=r.v_inf_out, v_inf_imp=r.v_inf_imp, b_imp=r.b_imp, b_finite=r.b_finite,
            r_min=r.r_min, r_min_burn=r.r_min_burn, r_burn_start=r.r_burn_start, r_burn_end=r.r_burn_end,
            turn_angle=r.turn_angle, hit_floor=r.impacted, captured=r.captured,
            b_imp_small=r.b_imp_small, eta_unreliable=r.eta_unreliable,
            energy_drift_max=max(r.energy_drift.values()), energy_balance_residual=r.energy_balance_residual,
            nfev=sum(r.nfev.values()),
        )
    except Exception as exc:  # noqa: BLE001 (recorded, never dropped)
        row.update(status="error", error=f"{type(exc).__name__}: {exc}")
    row["runtime_s"] = time.perf_counter() - t0
    # Theory predictions for the same point (recorded alongside, never used to alter the simulation).
    try:
        Pi = row.get("Pi", (c / a0) * -math.expm1(-dv / c) * row["v_p"])
        row["C_theory"] = theory.small_pi_prefactor(v, dv, c, law)
        row["C_user"] = theory.small_pi_prefactor_user(v, dv, law)
        row["eta_W_lin"] = theory.linear_response_eta(v, Pi, law, lam=dv / c)
        row["eta_lin"] = theory.eta_from_eta_W(row["eta_W_lin"], v, dv)
    except Exception as exc:  # noqa: BLE001
        row.update(C_theory=math.nan, C_user=math.nan, eta_W_lin=math.nan, eta_lin=math.nan,
                   theory_error=f"{type(exc).__name__}: {exc}")
    return row


def _run_case_star(args):
    return run_case(*args)


# ------------------------------------------------------------------ drivers

def _metadata(kind: str, spec: dict) -> dict:
    import pandas
    import pyarrow
    import scipy

    from .plotting import git_revision
    return {"kind": kind, "spec": spec, "package_version": __version__, "git": git_revision(),
            "created": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
            "versions": {"numpy": np.__version__, "scipy": scipy.__version__, "pandas": pandas.__version__,
                         "pyarrow": pyarrow.__version__}}


def _write_parquet(rows: list[dict], path: Path, meta: dict):
    import pandas as pd
    import pyarrow as pa
    import pyarrow.parquet as pq

    df = pd.DataFrame(rows)
    table = pa.Table.from_pandas(df, preserve_index=False)
    table = table.replace_schema_metadata({**(table.schema.metadata or {}),
                                           b"oberth_atlas": json.dumps(meta).encode()})
    path.parent.mkdir(parents=True, exist_ok=True)
    pq.write_table(table, path, compression="zstd")
    return df


def read_metadata(path: str | Path) -> dict:
    import pyarrow.parquet as pq
    return json.loads(pq.read_schema(path).metadata[b"oberth_atlas"])


def _map_parallel(func, args: list, workers: int | None, label: str, chunksize: int = 64) -> list[dict]:
    workers = workers or os.cpu_count() or 1
    out, t0, n = [], time.perf_counter(), len(args)
    if workers == 1:
        it = map(func, args)
    else:
        ex = ProcessPoolExecutor(max_workers=workers)
        it = ex.map(func, args, chunksize=chunksize)
    try:
        for i, row in enumerate(it, 1):
            out.append(row)
            if i % max(1, n // 20) == 0 or i == n:
                el = time.perf_counter() - t0
                print(f"  {label}: {i}/{n} ({el:.0f} s elapsed, ~{el / i * (n - i):.0f} s left)", flush=True)
    finally:
        if workers != 1:
            ex.shutdown()
    return out


def run_sweep(spec: GridSpec, out: str | Path, workers: int | None = None):
    cases = list(spec.cases())
    print(f"sweep: {len(cases)} cases on {workers or os.cpu_count()} workers", flush=True)
    rows = _map_parallel(_run_case_star, [(c, spec.numerics) for c in cases], workers, "sweep")
    return _write_parquet(rows, Path(out), _metadata("nd_sweep", spec.to_dict()))


def run_mission_case(args) -> dict:
    bkey, ekey, idx, law, r_p, v_inf, dv, isp, a0, body_name = args
    from .constants import get_body
    body = get_body(body_name)
    g = nd_groups(body, r_p, v_inf, dv, isp, a0)
    row = dict(body=bkey, engine=ekey, sample=idx, steering=law, r_p=r_p, altitude=r_p - body.radius_eq,
               R_over_rp=body.radius_eq / r_p, v_inf_in=v_inf, delta_v=dv, isp=isp, a0_si=a0,
               **{f"nd_{k}": float(v) for k, v in g.items()})
    row.update(_derived(row["nd_v_inf"], row["nd_dv"], row["nd_c"]))
    t0 = time.perf_counter()
    try:
        res = simulate_flyby(body, v_inf, r_p - body.radius_eq, BurnSpec(dv, Engine(isp, a0)), STEERING[law])
        row.update(status="ok", error="", Pi=res.Pi, eta=res.eta, eta_err=res.eta_err, eta_E=res.eta_E,
                   eta_W=res.eta_W, b_imp=res.b_imp, b_finite=res.b_finite, delta_v_loss=res.delta_v_loss,
                   v_inf_out=res.v_inf_out, altitude_min=res.altitude_min, r_min_over_rp=res.r_min / r_p,
                   soi_ratio_burn_start=res.soi_ratio_burn_start, soi_ratio_burn_end=res.soi_ratio_burn_end,
                   **{f"flag_{k}": v for k, v in res.flags.items()})
    except Exception as exc:  # noqa: BLE001
        row.update(status="error", error=f"{type(exc).__name__}: {exc}")
    row["runtime_s"] = time.perf_counter() - t0
    try:
        v_nd, dv_nd, c_nd = row["nd_v_inf"], row["nd_dv"], row["nd_c"]
        Pi = row.get("Pi", math.nan)
        row["C_theory"] = theory.small_pi_prefactor(v_nd, dv_nd, c_nd, law)
        row["eta_lin"] = theory.eta_from_eta_W(theory.linear_response_eta(v_nd, Pi, law, lam=dv_nd / c_nd),
                                               v_nd, dv_nd) if math.isfinite(Pi) else math.nan
    except Exception as exc:  # noqa: BLE001
        row.update(C_theory=math.nan, eta_lin=math.nan, theory_error=f"{type(exc).__name__}: {exc}")
    return row


def run_missions(presets: Presets, n: int, out: str | Path, workers: int | None = None, seed: int = 0,
                 steering: tuple[str, ...] = ("prograde", "inertial")):
    args = []
    for bkey, ekey, s in sample_missions(presets, n, seed):
        for law in steering:
            for i in range(n):
                args.append((bkey, ekey, i, law, float(s["r_p"][i]), float(s["v_inf"][i]), float(s["dv"][i]),
                             float(s["isp"][i]), float(s["a0"][i]), presets.bodies[bkey].body.name))
    print(f"missions: {len(args)} runs on {workers or os.cpu_count()} workers", flush=True)
    rows = _map_parallel(run_mission_case, args, workers, "missions", chunksize=16)
    spec = {"n_per_combo": n, "seed": seed, "steering": list(steering), "sampler": "scrambled Sobol, log-uniform",
            "presets": {"engines": {k: asdict(v) for k, v in presets.engines.items()},
                        "bodies": {k: {"body": v.body.name, "r_p": v.r_p, "v_inf": v.v_inf}
                                   for k, v in presets.bodies.items()},
                        "delta_v": presets.delta_v}}
    return _write_parquet(rows, Path(out), _metadata("missions", spec))
