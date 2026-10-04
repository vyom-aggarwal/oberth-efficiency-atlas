"""Figures: trajectory plots (thrust arc highlighted) for every example config in configs/.

Writes figures/trajectory_<config name>.png (300 dpi) and prints each run's key metrics.
Run:  .venv/Scripts/python scripts/fig_example_trajectories.py
"""

from __future__ import annotations

from pathlib import Path

from oberth_atlas.config import load_config
from oberth_atlas.plotting import plot_trajectory, plt, save_figure

ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    configs = sorted(p for p in (ROOT / "configs").iterdir() if p.suffix.lower() in (".yaml", ".yml", ".json"))
    for path in configs:
        cfg = load_config(path)
        res = cfg.run(dense_output=True)
        fig = plot_trajectory(res)
        out = save_figure(fig, ROOT / "figures" / f"trajectory_{cfg.name}.png", "scripts/fig_example_trajectories.py")
        plt.close(fig)
        flags = ", ".join(k for k, v in res.flags.items() if v) or "none"
        print(f"{cfg.name:28s} Pi={res.Pi:10.4g}  eta={res.eta:.6f}  eta_E={res.eta_E:.6f}  "
              f"loss={res.delta_v_loss:9.2f} m/s  flags: {flags}  -> {out.relative_to(ROOT).as_posix()}")


if __name__ == "__main__":
    main()
