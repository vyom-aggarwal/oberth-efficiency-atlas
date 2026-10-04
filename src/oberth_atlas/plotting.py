"""Shared figure style, provenance-stamped saving, and the single-flyby trajectory plot.

Colors follow a validated categorical palette (first three slots pass all-pairs CVD checks on the
light surface). Text always uses ink tokens, never series colors. Gridlines are solid hairlines.
"""

from __future__ import annotations

import math
import subprocess
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
from matplotlib.patches import Circle  # noqa: E402

from . import __version__  # noqa: E402

SURFACE = "#fcfcfb"
INK = "#0b0b0b"
INK_2 = "#52514e"
MUTED = "#898781"
GRID = "#e1e0d9"
AXIS = "#c3c2b7"
SERIES = ["#2a78d6", "#eb6834", "#1baf7a"]   # blue, orange, aqua (fixed order)
MARKERS = ["o", "s", "^"]                    # secondary encoding, so identity never rests on color alone
DPI = 300


def apply_style() -> None:
    plt.rcParams.update({
        "figure.facecolor": SURFACE,
        "axes.facecolor": SURFACE,
        "savefig.facecolor": SURFACE,
        "axes.edgecolor": AXIS,
        "axes.labelcolor": INK_2,
        "axes.titlecolor": INK,
        "axes.titlesize": 11,
        "axes.titleweight": "bold",
        "axes.labelsize": 9.5,
        "axes.grid": True,
        "axes.axisbelow": True,
        "grid.color": GRID,
        "grid.linewidth": 0.6,
        "grid.linestyle": "-",
        "xtick.color": MUTED,
        "ytick.color": MUTED,
        "xtick.labelcolor": INK_2,
        "ytick.labelcolor": INK_2,
        "xtick.labelsize": 8.5,
        "ytick.labelsize": 8.5,
        "axes.spines.top": False,
        "axes.spines.right": False,
        "lines.linewidth": 1.5,
        "lines.solid_capstyle": "round",
        "lines.solid_joinstyle": "round",
        "legend.frameon": False,
        "legend.fontsize": 8.5,
        "legend.labelcolor": INK_2,
        "font.family": ["Segoe UI", "DejaVu Sans", "sans-serif"],
        "text.color": INK,
    })


def git_revision() -> str:
    """Short commit hash, with '-dirty' if anything other than generated figures is uncommitted."""
    try:
        sha = subprocess.run(["git", "rev-parse", "--short", "HEAD"], capture_output=True, text=True, check=True).stdout.strip()
        dirty = subprocess.run(["git", "status", "--porcelain", "--", ".", ":(exclude)figures"],
                               capture_output=True, text=True, check=True).stdout.strip()
        return sha + ("-dirty" if dirty else "")
    except (OSError, subprocess.CalledProcessError):
        return "unknown"


def save_figure(fig: plt.Figure, path: str | Path, script: str) -> Path:
    """Save a 300-dpi PNG stamped with the generating script and git revision in its metadata."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(path, dpi=DPI, metadata={
        "Software": f"oberth_atlas {__version__}",
        "Source": Path(script).as_posix(),
        "Comment": f"git {git_revision()}",
    })
    return path


def plot_trajectory(result, title: str | None = None) -> plt.Figure:
    """Three panels: periapsis close-up, burn-scale view, and specific energy vs time.

    Positions are in units of the body's equatorial radius. Coast arcs are muted gray and the
    thrust arc is highlighted. Expects a FlybyResult whose trajectory was stored with dense output.
    """
    apply_style()
    traj = result.trajectory
    s = traj.scales
    R = result.r_p - result.periapsis_altitude          # equatorial radius
    fig = plt.figure(figsize=(11.0, 4.2), layout="constrained")
    gs = fig.add_gridspec(1, 3, width_ratios=[1, 1, 1.25])
    ax_zoom, ax_wide, ax_e = fig.add_subplot(gs[0]), fig.add_subplot(gs[1]), fig.add_subplot(gs[2])

    # Smooth samples of each segment (SI): every adaptive integrator step is subdivided via the
    # dense output, so fast periapsis passages stay resolved even within months-long burns.
    curves = []
    for seg in traj.segments:
        if seg.sol is not None:
            k = 12
            frac = np.linspace(0.0, 1.0, k, endpoint=False)
            tt = (seg.t[:-1, None] + np.diff(seg.t)[:, None] * frac[None, :]).ravel()
            tt = np.append(tt, seg.t[-1]) * s.time
            t, r, v, m = traj.si(seg, tt)
        else:
            t, r, v, m = traj.si(seg)
        curves.append((seg, t, r, v))

    # Wide-view extent: the whole burn arc, or ±25 r_p for short burns.
    rp = result.r_p / R
    burn = [c for c in curves if c[0].thrusting]
    extent = 25.0 * rp
    if burn:
        extent = max(extent, 1.15 * float(np.max(np.abs(burn[0][2][:2] / R))))
    # Display-only coast extensions out to the panel edge (two-body, so exact in form).
    # They do not enter any reported number.
    extensions = []
    if not result.flags["impact"] and s.mu > 0:
        r_stop = 1.6 * extent * R / s.length
        for y_start, sign in ((traj.segments[0].y[:, 0], -1.0), (traj.segments[-1].y[:, -1], 1.0)):
            ext = _coast_extension(y_start, sign, r_stop)
            if ext is not None:
                extensions.append(ext[1] * s.length)

    burn_label_done = False
    for ax in (ax_zoom, ax_wide):
        ax.add_patch(Circle((0, 0), 1.0, facecolor=GRID, edgecolor=AXIS, linewidth=0.8, zorder=1))
        if result.safety_margin > 0:
            ax.add_patch(Circle((0, 0), 1.0 + result.safety_margin / R, fill=False, edgecolor=MUTED,
                                linewidth=0.6, linestyle=(0, (2, 2)), zorder=1))
        for r in extensions:
            ax.plot(r[0] / R, r[1] / R, color=MUTED, linewidth=1.2, zorder=3)
        for seg, t, r, v in curves:
            x, y = r[0] / R, r[1] / R
            if seg.thrusting:
                ax.plot(x, y, color=SERIES[1], linewidth=2.6, zorder=4,
                        label=None if burn_label_done else "thrust arc")
                burn_label_done = True
            else:
                ax.plot(x, y, color=MUTED, linewidth=1.2, zorder=3,
                        label="coast" if seg.label in ("pre", "coast") and ax is ax_zoom else None)
        ax.set_aspect("equal")
        ax.set_xlabel("x / R")
        ax.set_ylabel("y / R")

    # Minimum radius actually reached, from the simulated samples.
    all_r = np.concatenate([c[2] for c in curves], axis=1)
    i_min = int(np.argmin(np.linalg.norm(all_r, axis=0)))
    for ax in (ax_zoom, ax_wide):
        ax.plot(all_r[0, i_min] / R, all_r[1, i_min] / R, "o", color=INK, markersize=4.5,
                markeredgecolor=SURFACE, markeredgewidth=1.2, zorder=5,
                label="min radius" if ax is ax_zoom else None)

    lim = 4.0 * rp
    ax_zoom.set_xlim(-lim, lim)
    ax_zoom.set_ylim(-lim, lim)
    ax_zoom.set_title("Periapsis close-up")
    ax_zoom.legend(loc="lower left", fontsize=7.5, handlelength=1.6)
    ax_wide.set_xlim(-extent, extent)
    ax_wide.set_ylim(-extent, extent)
    ax_wide.set_title("Burn-scale view")
    for ax in (ax_zoom, ax_wide):
        ax.ticklabel_format(style="sci", scilimits=(-3, 4))

    # Specific energy vs time, in units of τ, with the burn window shaded.
    tau = result.tau
    for seg, t, r, v in curves:
        eps = 0.5 * np.sum(v**2, axis=0) - s.mu / np.linalg.norm(r, axis=0)
        ax_e.plot(t / tau, eps / 1e6, color=SERIES[1] if seg.thrusting else MUTED,
                  linewidth=2.0 if seg.thrusting else 1.2)
    if math.isfinite(result.t_burn_start):
        ax_e.axvspan(result.t_burn_start / tau, result.t_burn_end / tau, color=SERIES[1], alpha=0.10, linewidth=0)
        pad = 0.1 * max(result.t_burn_end - result.t_burn_start, 20.0 * tau) / tau
        ax_e.set_xlim(min(result.t_burn_start, 0.0) / tau - pad, max(result.t_burn_end, 0.0) / tau + pad)
    ax_e.set_xlabel("t / τ   (t = 0: unperturbed periapsis)")
    ax_e.set_ylabel("specific energy ε  [MJ/kg]")
    ax_e.set_title("Orbital energy")

    lines = [
        f"{result.body.capitalize()}   v∞,in = {result.v_inf_in / 1e3:.3g} km/s   h_p = {result.periapsis_altitude / 1e3:.4g} km",
    ]
    if result.delta_v > 0:
        lines.append(
            f"Δv = {result.delta_v / 1e3:.3g} km/s   Isp = {result.isp:.4g} s   a0 = {result.a0:.3g} m/s²   "
            f"Π = {result.Pi:.3g}   η = {result.eta:.4f}   η_E = {result.eta_E:.4f}"
        )
    fig.suptitle(title or "\n".join(lines), fontsize=9.5, color=INK, x=0.01, ha="left")
    return fig


def _coast_extension(y_start: np.ndarray, sign: float, r_stop: float):
    """Propagate a coast (nondimensional, μ = 1) from y_start forward (sign > 0) or backward until r = r_stop.

    For display only. Returns (t, r, v) arrays, or None if y_start is already beyond r_stop.
    """
    from scipy.integrate import solve_ivp

    from .dynamics import coast_rhs

    r0 = float(np.linalg.norm(y_start[0:3]))
    if r0 >= r_stop:
        return None
    eps = 0.5 * float(y_start[3:6] @ y_start[3:6]) - 1.0 / r0
    speed_far = math.sqrt(max(2.0 * eps, 1.0 / r_stop))
    t_max = 3.0 * r_stop / speed_far + 10.0

    def leave(t, y):
        return math.sqrt(y[0] ** 2 + y[1] ** 2 + y[2] ** 2) - r_stop

    leave.terminal = True
    sol = solve_ivp(coast_rhs(1.0), (0.0, sign * t_max), y_start, method="DOP853", rtol=1e-10, atol=1e-12,
                    events=leave, dense_output=True)
    tt = np.linspace(0.0, sol.t[-1], 1500)
    y = sol.sol(tt)
    return tt, y[0:3], y[3:6]


# ---------------------------------------------------------------- Phase 2 helpers

RED = "#e34948"
NEUTRAL = "#f0efec"
BLUE_RAMP = ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95", "#0d366b"]


def eta_colormap():
    """Diverging map for η: red for negative (worse than deep space), neutral gray at 0, blue ramp to 1."""
    from matplotlib.colors import LinearSegmentedColormap
    return LinearSegmentedColormap.from_list("eta", [RED, "#f2b8b5", NEUTRAL] + BLUE_RAMP[1:], N=256)


def eta_norm(vmin: float = -0.5):
    """Asymmetric norm with 0 at the neutral midpoint and 1 at the top."""
    from matplotlib.colors import TwoSlopeNorm
    return TwoSlopeNorm(vmin=vmin, vcenter=0.0, vmax=1.0)


def sequential_colormap():
    from matplotlib.colors import LinearSegmentedColormap
    return LinearSegmentedColormap.from_list("seq_blue", BLUE_RAMP, N=256)
