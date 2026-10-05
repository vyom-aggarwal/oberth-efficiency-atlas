"""Command-line interface.

    oberth run CONFIG [--out DIR] [--no-plot]
        One flyby from a YAML/JSON config. Prints the metrics, and writes <out>/<name>/result.json
        and trajectory.png (default out: runs/).
    oberth sweep [--presets PATH] [--out FILE] [--workers N] [--coarse]
        Phase 2 dimensionless-grid sweep -> Parquet (default results/sweep_nd.parquet).
    oberth missions [--presets PATH] [--n N] [--out FILE] [--workers N]
        Sobol samples inside each (body, engine) envelope -> Parquet (default results/missions.parquet).
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

from .config import load_config
from .simulate import FlybyResult


def _fmt(x: float, scale: float = 1.0, digits: int = 6) -> str:
    if x is None or (isinstance(x, float) and not math.isfinite(x)):
        return "n/a"
    return f"{x / scale:.{digits}g}"


def format_report(res: FlybyResult, name: str) -> str:
    burn = res.delta_v > 0
    rows = [
        ("Flyby", ""),
        ("  body", res.body),
        ("  v_inf_in", f"{_fmt(res.v_inf_in, 1e3)} km/s"),
        ("  periapsis altitude", f"{_fmt(res.periapsis_altitude, 1e3)} km   (r_p = {_fmt(res.r_p, 1e3)} km)"),
        ("  v_p (unperturbed)", f"{_fmt(res.v_p, 1e3)} km/s"),
        ("  tau = r_p / v_p", f"{_fmt(res.tau)} s"),
    ]
    if burn:
        rows += [
            ("Burn", ""),
            ("  delta_v / Isp / a0", f"{_fmt(res.delta_v, 1e3)} km/s / {_fmt(res.isp)} s / {_fmt(res.a0)} m/s^2"),
            ("  steering", ", ".join(f"{k}={v}" for k, v in res.steering.items())),
            ("  burn duration t_b", f"{_fmt(res.burn_duration)} s   [{_fmt(res.t_burn_start)} s, {_fmt(res.t_burn_end)} s] vs periapsis"),
            ("  Pi = t_b / tau", _fmt(res.Pi)),
            ("  m_f / m0", _fmt(res.m_final / res.m0, digits=8)),
            ("Results", ""),
            ("  v_inf_out (finite)", f"{_fmt(res.v_inf_out, 1e3, 10)} km/s"),
            ("  v_inf_imp (impulsive)", f"{_fmt(res.v_inf_imp, 1e3, 10)} km/s"),
            ("  B_finite / B_imp", f"{_fmt(res.b_finite, 1e3, 8)} / {_fmt(res.b_imp, 1e3, 8)} km/s"),
            ("  eta = B_finite / B_imp", f"{_fmt(res.eta, digits=10)}   (+/- {_fmt(res.eta_err, digits=2)})"),
            ("  eta_W (energy, baseline-subtracted)", f"{_fmt(res.eta_W, digits=10)}   (+/- {_fmt(res.eta_W_err, digits=2)})"),
            ("  eta_E (deprecated)", f"{_fmt(res.eta_E, digits=10)}"),
            ("  equivalent dv loss", f"{_fmt(res.delta_v_loss, 1.0, 6)} m/s"),
            ("  integrated dv (rocket eq.)", f"{_fmt(res.delta_v_integrated, 1e3, 12)} km/s"),
        ]
    else:
        rows += [("Results", ""), ("  v_inf_out", f"{_fmt(res.v_inf_out, 1e3, 12)} km/s")]
    rows += [
        ("  turn angle", f"{_fmt(math.degrees(res.turn_angle) if math.isfinite(res.turn_angle) else math.nan)} deg   "
                         f"(unperturbed {_fmt(math.degrees(res.turn_angle_unperturbed))} deg)"),
        ("  min altitude", f"{_fmt(res.altitude_min, 1e3)} km   (safety margin {_fmt(res.safety_margin, 1e3)} km)"),
    ]
    if burn:
        rows.append(("  r(burn start) / r_SOI", _fmt(res.soi_ratio_burn_start, digits=4)))
    rows += [
        ("Numerics", ""),
        ("  coast energy drift / (mu/r_p)", ", ".join(f"{k}: {v:.2e}" for k, v in res.energy_drift.items())),
        ("  coast energy drift / |eps|", ", ".join(f"{k}: {v:.2e}" for k, v in res.energy_drift_rel_eps.items())),
        ("  energy-balance residual", f"{res.energy_balance_residual:.2e}"),
        ("Flags", ", ".join(k for k, v in res.flags.items() if v) or "none"),
    ]
    width = max(len(k) for k, _ in rows) + 2
    lines = [f"Oberth flyby: {name}"] + [f"{k:<{width}}{v}" if v != "" else k for k, v in rows]
    return "\n".join(lines)


def cmd_run(args: argparse.Namespace) -> int:
    cfg = load_config(args.config)
    res = cfg.run(dense_output=not args.no_plot)
    print(format_report(res, cfg.name))
    out_dir = Path(args.out) / cfg.name
    out_dir.mkdir(parents=True, exist_ok=True)
    payload = {"config": str(Path(args.config).as_posix()), "units": "SI (m, s, kg, m/s, J/kg, rad)",
               "result": res.to_dict()}
    (out_dir / "result.json").write_text(json.dumps(payload, indent=2, allow_nan=False), encoding="utf-8")
    written = [out_dir / "result.json"]
    if not args.no_plot:
        from .plotting import plot_trajectory, plt, save_figure
        fig = plot_trajectory(res)
        written.append(save_figure(fig, out_dir / "trajectory.png", f"oberth run {Path(args.config).as_posix()}"))
        plt.close(fig)
    print("\nwrote " + ", ".join(p.as_posix() for p in written))
    return 0


def cmd_sweep(args: argparse.Namespace) -> int:
    from .presets import load_presets
    from .sweep import grid_from_presets, run_sweep
    presets = load_presets(args.presets) if args.presets else load_presets()
    dens = {"v_inf": 1.0, "dv": 1.0, "c": 1.0, "a0": 1.0} if args.coarse else None
    spec = grid_from_presets(presets, per_decade=dens)
    for g in ("v_inf", "dv", "c", "a0"):
        ax = getattr(spec, g)
        print(f"  {g:6s} {ax.lo:.3e} .. {ax.hi:.3e}  ({ax.n} points)")
    df = run_sweep(spec, args.out, args.workers)
    print(f"wrote {args.out}: {len(df)} rows, {int((df['status'] != 'ok').sum())} errors")
    return 0


def cmd_missions(args: argparse.Namespace) -> int:
    from .presets import load_presets
    from .sweep import run_missions
    presets = load_presets(args.presets) if args.presets else load_presets()
    df = run_missions(presets, args.n, args.out, args.workers, seed=args.seed)
    print(f"wrote {args.out}: {len(df)} rows, {int((df['status'] != 'ok').sum())} errors")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="oberth", description="Finite-burn Oberth efficiency simulator")
    sub = parser.add_subparsers(dest="command", required=True)
    run = sub.add_parser("run", help="simulate one flyby from a YAML/JSON config")
    run.add_argument("config", help="path to a .yaml/.yml/.json flyby config")
    run.add_argument("--out", default="runs", help="output directory (default: runs/)")
    run.add_argument("--no-plot", action="store_true", help="skip the trajectory plot")
    run.set_defaults(func=cmd_run)
    sw = sub.add_parser("sweep", help="dimensionless-grid sweep (Phase 2) to Parquet")
    sw.add_argument("--presets", default=None, help="presets YAML (default configs/atlas/presets.yaml)")
    sw.add_argument("--out", default="results/sweep_nd.parquet")
    sw.add_argument("--workers", type=int, default=None)
    sw.add_argument("--coarse", action="store_true", help="1 point per decade (smoke test)")
    sw.set_defaults(func=cmd_sweep)
    mi = sub.add_parser("missions", help="simulate Sobol samples of every (body, engine) envelope")
    mi.add_argument("--presets", default=None)
    mi.add_argument("--n", type=int, default=256, help="samples per (body, engine) combination")
    mi.add_argument("--seed", type=int, default=0)
    mi.add_argument("--out", default="results/missions.parquet")
    mi.add_argument("--workers", type=int, default=None)
    mi.set_defaults(func=cmd_missions)
    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
