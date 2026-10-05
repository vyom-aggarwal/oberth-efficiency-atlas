"""Engine-comparison animation: the same solar Oberth dive flown with a solid stack, nuclear thermal and SEP.

Geometry and Δv are those of Hibberd et al. (2026): bound near-parabolic arrival (aphelion 5.2 au),
perihelion 3.2 R☉, Δv = 8.36 km/s, prograde, burn centred in time on perihelion.
- Solid stack: Hibberd's CASTOR 30B + STAR 48B (configs/phase4/hibberd_som.yaml).
- Nuclear thermal: one constant-thrust stage, Isp 900 s, initial a0 = 0.5 m/s² (Phase 2 preset range).
- SEP-class: one constant-thrust stage, Isp 6000 s, initial a0 = 3.3e-3 m/s² (Maraqten et al. 2026 peak
  acceleration, 49.8 N on 15.2 t). Hypothetical at 3.2 R☉ (thermally infeasible there); it shows the
  propulsion physics at a fixed geometry.

Top row: top-down views (the problem is planar) with a logarithmic radial axis, ρ = 1 + log10(r/r_p), so
arcs from 0.03 r_p to 40 r_p are visible together. Thrust arcs are coloured by the rate of orbital-energy
gain a·v (W/kg, log scale shared by the panels). Bottom: orbital-energy gain as a fraction of the
impulsive gain against time; time runs as τ·sinh(s), so the clock slows near perihelion.

Writes the final frame figures/anim_engines_final.png, then figures/anim_engines.mp4 (360 frames, ~15 min),
then figures/anim_engines.gif converted from the MP4 with ffmpeg (two-pass palette).
Run:  .venv/Scripts/python scripts/anim_engines.py [--frames 360] [--fps 30] [--still-only | --gif-only]
"""

from __future__ import annotations

import argparse
import math
import sys
from pathlib import Path

import numpy as np
from matplotlib import animation
from matplotlib.collections import LineCollection
from matplotlib.colors import LogNorm

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import run_phase4 as P  # noqa: E402  (shared SOM configuration)
from oberth_atlas.constants import G0, GM_SUN, JUPITER  # noqa: E402
from oberth_atlas.dynamics import specific_energy  # noqa: E402
from oberth_atlas.plotting import (INK, INK_2, MUTED, apply_style, plt, save_figure,  # noqa: E402
                                   sequential_colormap)
from oberth_atlas.simulate import Numerics  # noqa: E402
from oberth_atlas.staged import StageND, schedule, simulate_staged_nd, stack_mass, stages_to_nd  # noqa: E402
from oberth_atlas.units import Scales  # noqa: E402

LINESTYLES = ["-", (0, (6, 2)), (0, (1.5, 1.5))]


def single(dv: float, c: float, a0_nd: float) -> list[StageND]:
    m_prop = -math.expm1(-dv / c)
    return [StageND(thrust=a0_nd, c=c, m_prop=m_prop)]


def build_cases():
    si = P.stages_si()
    m0 = stack_mass(si, P.CFG["payload_kg"])
    S = Scales(GM_SUN, P.R_P, m0)
    vp = P.v_p_bound(JUPITER.sma) / S.velocity
    solid = stages_to_nd(si, P.CFG["payload_kg"], GM_SUN, P.R_P)
    dv = sum(st.dv for st in schedule(solid)[0])                    # rocket-equation Δv of the stack
    cases = [
        ("Solid stack: CASTOR 30B + STAR 48B\n(Hibberd et al. 2026 reference)", solid),
        ("Nuclear thermal: Isp 900 s, a0 = 0.5 m/s²", single(dv, 900.0 * G0 / S.velocity, 0.5 / S.acceleration)),
        ("SEP-class: Isp 6000 s, a0 = 3.3e-3 m/s²\n(hypothetical at 3.2 R☉)",
         single(dv, 6000.0 * G0 / S.velocity, 49.8 / 15189.0 / S.acceleration)),
    ]
    return cases, S, vp, dv


def trajectory(stages, vp, window_tau, n=6000):
    """Dense samples (times in τ·sinh spacing) of position, thrust a·v and energy gain."""
    num = Numerics(dense_output=True, pre_coast_tau=window_tau * 1.05, post_coast_tau=window_tau * 1.05)
    res = simulate_staged_nd(vp, stages, numerics=num)
    tau = 1.0 / vp
    s_max = math.asinh(window_tau)
    t = tau * np.sinh(np.linspace(-s_max, s_max, n))
    Y = np.full((8, n), np.nan)
    thrust = np.zeros(n)
    k_burn = 0
    for seg in res.segments:
        sel = (t >= seg.t[0]) & (t <= seg.t[-1])
        Y[:, sel] = seg.sol(t[sel])
        if seg.thrusting:
            st = stages[k_burn]
            thrust[sel] = st.thrust
            k_burn += 1
    a = thrust / Y[6]
    v = np.sqrt(np.sum(Y[3:6] ** 2, axis=0))
    eps = specific_energy(Y, 1.0)
    return dict(t=t, x=Y[0], y=Y[1], r=np.hypot(Y[0], Y[1]), av=a * v, eps=eps, res=res)


def fmt_duration(seconds: float) -> str:
    if seconds < 3600:
        return f"{seconds / 60:.1f} min"
    if seconds < 48 * 3600:
        return f"{seconds / 3600:.1f} h"
    return f"{seconds / 86400:.1f} d"


def log_xy(x, y):
    r = np.hypot(x, y)
    rho = 1.0 + np.log10(r)
    return rho * x / r, rho * y / r


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("--frames", type=int, default=360)
    ap.add_argument("--fps", type=int, default=30)
    ap.add_argument("--still-only", action="store_true", help="only the final-frame PNG")
    ap.add_argument("--gif-only", action="store_true", help="only convert the existing MP4 to GIF")
    a = ap.parse_args()
    cases, S, vp, dv = build_cases()
    tau = 1.0 / vp
    # Window: cover the SEP burn (the longest) with margin.
    t_half = max(sum(s.burn_time for s in st) for _, st in cases) / 2
    window_tau = 1.25 * t_half / tau
    trajs = [trajectory(st, vp, window_tau) for _, st in cases]
    eps0 = 0.5 * vp**2 - 1.0
    deps_imp = 0.5 * (vp + dv) ** 2 - 1.0 - eps0
    av_si = S.acceleration * S.velocity                               # W/kg per unit a·v
    vmin, vmax = 1e2, 1e8
    norm = LogNorm(vmin, vmax)
    cmap = sequential_colormap()
    hours = S.time / 3600.0

    apply_style()
    fig = plt.figure(figsize=(13.5, 8.2), layout="constrained")
    gs = fig.add_gridspec(2, 4, height_ratios=[3.2, 1.25], width_ratios=[1, 1, 1, 0.06])
    axes = [fig.add_subplot(gs[0, i]) for i in range(3)]
    cax = fig.add_subplot(gs[0, 3])
    axe = fig.add_subplot(gs[1, :3])
    rho_max = 1.0 + math.log10(60.0)
    rho_sun = 1.0 + math.log10(1.0 / P.CFG["som"]["r_p_over_R_sun"])
    artists = []
    for ax, (title, _), tr in zip(axes, cases, trajs):
        ax.set_aspect("equal")
        ax.set_xlim(-rho_max, rho_max)
        ax.set_ylim(-rho_max, rho_max)
        ax.axis("off")
        for rr, lab in ((1, "r_p"), (3, "3 r_p"), (10, "10"), (30, "30")):
            rho = 1 + math.log10(rr)
            ax.add_patch(plt.Circle((0, 0), rho, fill=False, color=MUTED, linewidth=0.5, linestyle=(0, (2, 3))))
            ax.text(rho * 0.72, -rho * 0.72, lab, fontsize=7, color=MUTED)
        ax.add_patch(plt.Circle((0, 0), rho_sun, color="#f3c35b", zorder=1))
        X, Yy = log_xy(tr["x"], tr["y"])
        ax.plot(X, Yy, color=MUTED, linewidth=0.8, alpha=0.5, zorder=2)          # full path, faint
        trail, = ax.plot([], [], color=INK_2, linewidth=1.3, zorder=3)
        lc = LineCollection([], cmap=cmap, norm=norm, linewidths=4.0, zorder=4, capstyle="round")
        ax.add_collection(lc)
        dot, = ax.plot([], [], "o", color=INK, markersize=6, zorder=5)
        ax.set_title(title, fontsize=10)
        res = tr["res"]
        ax.text(0.02, 0.02, f"burn {fmt_duration(res.duration * S.time)},  Π = {res.Pi:.3g}\n"
                f"loss = {100 * res.dv_loss_rel:.3g}% of Δv", transform=ax.transAxes, fontsize=9, color=INK_2,
                va="bottom")
        artists.append(dict(trail=trail, lc=lc, dot=dot, X=X, Y=Yy))
    sm = plt.cm.ScalarMappable(norm=norm, cmap=cmap)
    fig.colorbar(sm, cax=cax, label="rate of orbital-energy gain a·v  [W/kg]")
    # Energy panel.
    lines = []
    for (title, _), tr, ls in zip(cases, trajs, LINESTYLES):
        frac = (tr["eps"] - eps0) / deps_imp
        name = title.split(":")[0]
        axe.plot(tr["t"] / tau, frac, color=MUTED, linewidth=0.8, linestyle=ls, alpha=0.6)
        ln, = axe.plot([], [], color=INK, linewidth=1.8, linestyle=ls, label=name)
        lines.append((ln, frac))
    axe.step([-window_tau, 0, window_tau], [0, 1, 1], where="post", color=SERIES_IMP, linewidth=1.2,
             label="impulsive burn at perihelion")
    axe.set_xscale("symlog", linthresh=1.0)
    axe.set_xlim(-window_tau, window_tau)
    axe.set_ylim(-0.02, 1.08)
    axe.set_xlabel("time from perihelion  [τ = r_p/v_p = %.0f s]" % (S.time * tau))
    axe.set_ylabel("energy gain /\nimpulsive gain")
    axe.legend(fontsize=8, loc="upper left", ncol=4, frameon=False)
    cursor = axe.axvline(0.0, color=INK_2, linewidth=0.8)
    clock = fig.text(0.01, 0.985, "", fontsize=11, color=INK, va="top")
    fig.suptitle("The same solar Oberth dive (3.2 R☉, Δv = 8.36 km/s, prograde) with three engines — "
                 "radial axis logarithmic", fontsize=11, x=0.5)

    s_max = math.asinh(window_tau)
    frame_t = tau * np.sinh(np.linspace(-s_max, s_max, a.frames))

    def draw(t_now):
        for art, tr in zip(artists, trajs):
            k = int(np.searchsorted(tr["t"], t_now))
            X, Yy = art["X"][:k], art["Y"][:k]
            art["trail"].set_data(X, Yy)
            if k:
                art["dot"].set_data([X[-1]], [Yy[-1]])
            on = tr["av"][:k] > 0
            pts = np.column_stack([X, Yy])
            segs = np.stack([pts[:-1], pts[1:]], axis=1) if k > 1 else np.empty((0, 2, 2))
            mask = on[1:] & on[:-1] if k > 1 else np.zeros(0, bool)
            art["lc"].set_segments(segs[mask])
            art["lc"].set_array(np.clip(tr["av"][1:k][mask] * av_si, vmin, vmax))
        for (ln, frac), tr in zip(lines, trajs):
            k = int(np.searchsorted(tr["t"], t_now))
            ln.set_data(tr["t"][:k] / tau, frac[:k])
        cursor.set_xdata([t_now / tau, t_now / tau])
        clock.set_text(f"t = {t_now * S.time / 3600:+.2f} h from perihelion")
        return []

    import subprocess

    import imageio_ffmpeg
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    mp4, gif = ROOT / "figures" / "anim_engines.mp4", ROOT / "figures" / "anim_engines.gif"
    if not a.gif_only:
        draw(frame_t[-1])                                              # the still first: cheap and always useful
        save_figure(fig, ROOT / "figures" / "anim_engines_final.png", "scripts/anim_engines.py")
    if not (a.gif_only or a.still_only):
        plt.rcParams["animation.ffmpeg_path"] = ffmpeg
        anim = animation.FuncAnimation(fig, lambda i: draw(frame_t[i]), frames=len(frame_t), blit=False)
        anim.save(mp4, writer=animation.FFMpegWriter(fps=a.fps, bitrate=4000), dpi=110)
    plt.close(fig)
    if not a.still_only:
        # GIF from the MP4 with a two-pass palette: fast, and identical frames to the video.
        vf = "fps=15,scale=900:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer"
        subprocess.run([ffmpeg, "-y", "-loglevel", "error", "-i", str(mp4), "-vf", vf, str(gif)], check=True)
    for (title, _), tr in zip(cases, trajs):
        r = tr["res"]
        print(f"{title.splitlines()[0]}: Π = {r.Pi:.4g}, loss = {100 * r.dv_loss_rel:.4g}% of Δv, "
              f"burn {r.duration * S.time / 3600:.3g} h")


SERIES_IMP = MUTED

if __name__ == "__main__":
    main()
