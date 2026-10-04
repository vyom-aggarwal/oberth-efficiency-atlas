"""Finite-burn flyby simulation: coast → burn → coast, in nondimensional units.

Two layers:
- `simulate_nd` is the body-free core. Everything is nondimensional (μ = 1, r_p = 1, m0 = 1), so a
  run is fully defined by the four groups ṽ∞ = v∞/V, Δṽ = Δv/V, c̃ = Isp·g0/V, ã0 = a0 r_p²/μ
  (plus steering, timing and frame). It knows no body. Radii are reported in units of r_p, so
  impact and SOI can be judged per body afterwards.
- `simulate_flyby` is the SI wrapper for a real body. It converts to the four groups, sets the
  impact radius R/r_p, and adds the body-specific flags (safety margin, sphere of influence).

Time t = 0 is the unperturbed periapsis passage. The frame is the perifocal frame of the incoming
hyperbola, optionally rotated by `rotation`.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field, fields

import numpy as np
from scipy.integrate import solve_ivp

from . import kepler, metrics
from .burn import BurnSpec
from .constants import Body
from .dynamics import coast_rhs, specific_energy, thrust_rhs
from .steering import Prograde, SteeringContext, SteeringLaw
from .units import Scales

_EPS = np.finfo(float).eps
# Terminal floor radius (units of r_p) for body-free runs. It avoids the r → 0 singularity, and
# any trajectory reaching it is inside every body of interest (r_p < 1000 R).
R_FLOOR = 1e-3


@dataclass(frozen=True)
class Numerics:
    """Integrator and diagnostic settings."""

    rtol: float = 1e-12
    atol: float = 1e-12
    method: str = "DOP853"
    pre_coast_tau: float = 5.0     # coast before min(burn start, periapsis), in units of τ
    post_coast_tau: float = 5.0    # coast after max(burn end, final periapsis), in units of τ
    b_imp_min_rel: float = 1e-6    # η = NaN (flag b_imp_small) when B_imp < b_imp_min_rel · Δv
    eta_err_max: float = 1e-6      # flag eta_unreliable when the η error estimate exceeds this
    gravity: bool = True           # False switches gravity off (validation only)
    dense_output: bool = False     # keep continuous solutions on each segment (for plotting)


@dataclass
class Segment:
    """One integration segment, in nondimensional units."""

    label: str                    # "coast", "pre", "burn" or "post"
    thrusting: bool
    t: np.ndarray                 # accepted step times
    y: np.ndarray                 # (8, N) states at those times
    nfev: int
    t_periapsis: np.ndarray       # times of periapsis events (r·v crossing 0 upward)
    y_periapsis: np.ndarray       # (K, 8) states at those events
    impacted: bool
    sol: object | None = None     # scipy OdeSolution if dense output was requested


@dataclass
class Trajectory:
    """All segments plus the scales needed to convert them to SI."""

    scales: Scales
    segments: list[Segment]

    def si(self, seg: Segment, t: np.ndarray | None = None) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
        """(t [s], r [m] (3,N), v [m/s] (3,N), m [kg] (N,)) for a segment, at its steps or at times t (s)."""
        s = self.scales
        if t is None:
            tt, y = seg.t, seg.y
        else:
            if seg.sol is None:
                raise ValueError("dense output was not stored; rerun with Numerics(dense_output=True)")
            tt = np.asarray(t) / s.time
            y = seg.sol(tt)
        return tt * s.time, y[0:3] * s.length, y[3:6] * s.velocity, y[6] * s.mass


@dataclass
class NDResult:
    """Outcome of a body-free run. All quantities are nondimensional (μ = r_p = m0 = 1)."""

    # --- inputs (the four groups, steering, timing) ---
    v_inf: float
    dv: float
    c: float
    a0: float
    steering: dict
    midpoint_offset: float
    # --- characteristic quantities ---
    v_p: float
    k: float                         # μ/(r_p v_p²) = 1/v_p²
    tau: float
    t_b: float
    t_start: float
    t_end: float
    Pi: float
    mass_ratio: float                # m_f/m0 from the integrated mass
    # --- outcomes ---
    eps_out: float
    v_inf_out: float
    v_inf_imp: float
    b_imp: float
    b_finite: float
    eta: float
    eta_err: float
    eta_E: float
    eta_E_err: float
    delta_eps_finite: float
    delta_eps_imp: float
    dv_integrated: float
    turn_angle: float
    turn_angle_unperturbed: float
    r_min: float                     # minimum radius over the whole trajectory (units of r_p)
    r_min_burn: float
    r_min_numerical: float
    r_burn_start: float              # |r| at burn start (units of r_p)
    r_burn_end: float
    # --- numerical diagnostics (dimensionless) ---
    energy_drift: dict               # per coast segment: max |ε(t) − ε(t_seg0)| / (v_p²/2)
    energy_drift_rel_eps: dict       # per coast segment: same, divided by |ε(t_seg0)|
    energy_balance_residual: float   # max |ε − ε0 − W| / (v_p²/2) up to burnout
    nfev: dict
    impacted: bool
    captured: bool
    b_imp_small: bool
    eta_unreliable: bool
    segments: list = field(default_factory=list, repr=False)


@dataclass
class FlybyResult:
    """Everything one flyby produces, in SI units (m, s, kg, m/s, J/kg, rad)."""

    # --- inputs ---
    body: str
    v_inf_in: float
    r_p: float                       # unperturbed periapsis radius
    periapsis_altitude: float
    safety_margin: float
    delta_v: float                   # rocket-equation Δv (0 for a coast-only flyby)
    isp: float
    a0: float
    m0: float
    midpoint_offset: float           # burn midpoint relative to unperturbed periapsis passage
    steering: dict
    # --- characteristic quantities ---
    v_p: float                       # unperturbed periapsis speed
    tau: float                       # τ = r_p / v_p
    burn_duration: float
    t_burn_start: float
    t_burn_end: float
    Pi: float                        # Π = t_b / τ
    # --- outcomes ---
    v_inf_out: float                 # sqrt(2 ε) at burnout (NaN if captured)
    v_inf_imp: float
    b_imp: float
    b_finite: float
    eta: float                       # B_finite / B_imp (NaN when b_imp_small)
    eta_err: float                   # numerical error estimate of eta
    eta_E: float                     # Δε_finite / Δε_imp
    eta_E_err: float
    delta_v_loss: float              # v_inf_imp − v_inf_out
    delta_eps_finite: float          # ε_out − ε_in
    delta_eps_imp: float
    m_final: float
    delta_v_integrated: float        # c ln(m0 / m_final) from the integrated mass
    turn_angle: float                # angle between incoming and outgoing asymptotes
    turn_angle_unperturbed: float    # 2 arcsin(1/e) of the incoming hyperbola
    r_min: float                     # minimum radius over the whole trajectory
    altitude_min: float
    r_min_burn: float                # minimum radius on the burn arc
    r_min_numerical: float           # min over step points and events (cross-check on r_min)
    r_soi: float | None              # Laplace sphere of influence (None for the Sun)
    soi_ratio_burn_start: float      # |r(t_burn_start)| / r_SOI
    soi_ratio_burn_end: float
    # --- numerical diagnostics (dimensionless) ---
    energy_drift: dict               # per coast segment: max |ε(t) − ε(t_seg0)| / (v_p²/2)
    energy_drift_rel_eps: dict       # per coast segment: same, divided by |ε(t_seg0)|
    energy_balance_residual: float   # max |ε − ε0 − W| / (v_p²/2) up to burnout
    nfev: dict
    flags: dict
    trajectory: Trajectory | None = field(default=None, repr=False)

    def to_dict(self) -> dict:
        """JSON-ready dict (trajectory excluded; NaN/inf → None)."""
        out = {}
        for f in fields(self):
            if f.name == "trajectory":
                continue
            out[f.name] = _jsonable(getattr(self, f.name))
        return out


def _jsonable(x):
    if isinstance(x, dict):
        return {k: _jsonable(v) for k, v in x.items()}
    if isinstance(x, (list, tuple, np.ndarray)):
        return [_jsonable(v) for v in x]
    if isinstance(x, (bool, np.bool_)):
        return bool(x)
    if isinstance(x, (int, np.integer)):
        return int(x)
    if isinstance(x, (float, np.floating)):
        xf = float(x)
        return xf if math.isfinite(xf) else None
    return x


def _periapsis_event(t: float, y: np.ndarray) -> float:
    return y[0] * y[3] + y[1] * y[4] + y[2] * y[5]


_periapsis_event.direction = 1.0


def _impact_event(radius: float):
    def ev(t: float, y: np.ndarray) -> float:
        return math.sqrt(y[0] ** 2 + y[1] ** 2 + y[2] ** 2) - radius

    ev.terminal = True
    ev.direction = -1.0
    return ev


def _integrate(label: str, rhs, t0: float, t1: float, y0: np.ndarray, num: Numerics, impact_radius: float,
               thrusting: bool) -> Segment:
    sol = solve_ivp(
        rhs, (t0, t1), y0, method=num.method, rtol=num.rtol, atol=num.atol,
        events=[_periapsis_event, _impact_event(impact_radius)], dense_output=num.dense_output,
    )
    if sol.status == -1:
        raise RuntimeError(f"integration failed on segment {label!r}: {sol.message}")
    y_peri = sol.y_events[0] if len(sol.y_events[0]) else np.empty((0, y0.size))
    return Segment(
        label=label, thrusting=thrusting, t=sol.t, y=sol.y, nfev=sol.nfev,
        t_periapsis=np.asarray(sol.t_events[0]), y_periapsis=np.asarray(y_peri),
        impacted=sol.status == 1, sol=sol.sol if num.dense_output else None,
    )


def _radius(y: np.ndarray) -> np.ndarray:
    return np.sqrt(y[0] ** 2 + y[1] ** 2 + y[2] ** 2)


def _check_rotation(rotation: np.ndarray | None) -> np.ndarray:
    rot = np.eye(3) if rotation is None else np.asarray(rotation, dtype=float)
    if not (np.allclose(rot.T @ rot, np.eye(3), atol=1e-12) and np.linalg.det(rot) > 0):
        raise ValueError("rotation must be a proper orthogonal 3×3 matrix")
    return rot


def simulate_nd(
    v_inf: float,
    dv: float = 0.0,
    c: float = math.inf,
    a0: float = math.inf,
    steering: SteeringLaw | None = None,
    *,
    midpoint_offset: float = 0.0,
    impact_radius: float = R_FLOOR,
    numerics: Numerics = Numerics(),
    rotation: np.ndarray | None = None,
) -> NDResult:
    """Body-free flyby in nondimensional units (μ = 1, r_p = 1, m0 = 1).

    v_inf: ṽ∞ = v∞/V (> 0), where V = sqrt(μ/r_p)
    dv: Δṽ = Δv/V (0 for a coast-only flyby)
    c: c̃ = Isp·g0/V (exhaust velocity)
    a0: ã0 = a0 r_p²/μ (initial thrust acceleration in units of the local gravity at r_p)
    midpoint_offset: burn midpoint relative to unperturbed periapsis passage, in units of sqrt(r_p³/μ)
    impact_radius: terminal radius in units of r_p (R/r_p for a real body; R_FLOOR when body-free)
    """
    steering = steering or Prograde()
    rot = _check_rotation(rotation)
    num = numerics
    mu = 1.0 if num.gravity else 0.0
    burn = dv > 0.0
    if burn and not (c > 0 and a0 > 0 and math.isfinite(c) and math.isfinite(a0)):
        raise ValueError(f"a burn needs finite positive c and a0, got c={c}, a0={a0}")

    # Geometry of the incoming (unperturbed) hyperbola. It always uses the real μ = 1.
    em1 = kepler.hyperbola_em1(1.0, 1.0, v_inf)
    vp = metrics.periapsis_speed(1.0, 1.0, v_inf)
    tau = 1.0 / vp
    e_ref = 0.5 * vp**2            # largest term in ε along the unperturbed flyby: energy-drift scale

    if burn:
        t_b = (c / a0) * -math.expm1(-dv / c)
        ts, te = midpoint_offset - 0.5 * t_b, midpoint_offset + 0.5 * t_b
        t0 = min(ts, 0.0) - num.pre_coast_tau * tau
    else:
        t_b, ts, te = 0.0, math.nan, math.nan
        t0 = -num.pre_coast_tau * tau

    r0, v0 = kepler.hyperbola_state(t0, 1.0, 1.0, v_inf)
    y0 = np.concatenate([rot @ r0, rot @ v0, [1.0, 0.0]])

    segments: list[Segment] = []
    if not burn:
        tf = num.post_coast_tau * tau
        seg = _integrate("coast", coast_rhs(mu), t0, tf, y0, num, impact_radius, thrusting=False)
        segments.append(seg)
        impacted = seg.impacted
        y_bo = seg.y[:, -1]
    else:
        pre = _integrate("pre", coast_rhs(mu), t0, ts, y0, num, impact_radius, thrusting=False)
        segments.append(pre)
        ctx = SteeringContext(t_start=ts, t_end=te, rotation=rot)
        b = _integrate("burn", thrust_rhs(mu, a0, c, steering.bind(ctx)), ts, te, pre.y[:, -1], num,
                       impact_radius, thrusting=True)
        segments.append(b)
        impacted = pre.impacted or b.impacted
        y_bo = b.y[:, -1]
        if not impacted:
            tf = max(te, 0.0) + num.post_coast_tau * tau
            if num.gravity and specific_energy(y_bo, mu) != 0.0:
                # Make sure the final coast passes the post-burn periapsis if one is still ahead.
                t_next = kepler.time_to_next_periapsis(y_bo[0:3], y_bo[3:6], mu)
                if math.isfinite(t_next):
                    tf = max(tf, te + t_next + num.post_coast_tau * tau)
            post = _integrate("post", coast_rhs(mu), te, tf, y_bo, num, impact_radius, thrusting=False)
            segments.append(post)
            impacted = post.impacted

    y_final = segments[-1].y[:, -1]
    if not burn:
        y_bo = y_final

    # --- energy diagnostics, normalized by v_p²/2 (round-off scales with the largest terms in ε) ---
    eps0 = float(specific_energy(y0, mu))
    energy_drift, energy_drift_rel_eps = {}, {}
    balance = 0.0
    for seg in segments:
        eps = specific_energy(seg.y, mu)
        if not seg.thrusting:
            d = float(np.max(np.abs(eps - eps[0])))
            energy_drift[seg.label] = d / e_ref
            energy_drift_rel_eps[seg.label] = d / abs(eps[0]) if eps[0] != 0 else math.inf
        if seg.label in ("coast", "pre", "burn"):
            balance = max(balance, float(np.max(np.abs(eps - eps0 - seg.y[7]))))

    # An impact ends the run early, so no outgoing state exists and all outcomes are NaN.
    eps_out = math.nan if impacted else float(specific_energy(y_bo, mu))
    v_inf_out = math.sqrt(2.0 * eps_out) if eps_out > 0 else math.nan
    captured = burn and not impacted and not eps_out > 0

    # --- turn angle (from the integrated final state's osculating conic) ---
    v_in_hat = rot @ kepler.incoming_asymptote_perifocal(em1)
    turn = math.nan
    if num.gravity and not impacted:
        final = kepler.conic(y_final[0:3], y_final[3:6], mu)
        if final.is_hyperbolic and final.e > 1:
            _, v_out_hat = final.asymptotes()
            turn = kepler.angle_between(v_in_hat, v_out_hat)

    # --- minimum radius: exact conic minimum on coasts, events + endpoints on the burn ---
    r_min_parts, r_min_burn = [], math.nan
    for seg in segments:
        if seg.impacted:
            r_min_parts.append(impact_radius)
        if seg.thrusting:
            cand = [float(_radius(seg.y[:, 0])), float(_radius(seg.y[:, -1]))]
            cand += [float(_radius(yp)) for yp in seg.y_periapsis]
            r_min_burn = min(cand)
            r_min_parts.append(r_min_burn)
        elif num.gravity and not seg.impacted:
            r_min_parts.append(kepler.conic_min_radius(seg.y[0:3, 0], seg.y[3:6, 0], seg.y[0:3, -1],
                                                       seg.t[-1] - seg.t[0], mu))
        else:
            r_min_parts.append(float(np.min(_radius(seg.y))))
    r_min = min(r_min_parts)
    r_min_numerical = min(
        min(float(np.min(_radius(seg.y))) for seg in segments),
        min((float(_radius(yp)) for seg in segments for yp in seg.y_periapsis), default=math.inf),
    )

    # --- metrics ---
    if burn:
        v_inf_imp = metrics.v_inf_impulsive(1.0, 1.0, v_inf, dv)
        b_imp = metrics.oberth_bonus_impulsive(1.0, 1.0, v_inf, dv)
        b_fin = metrics.oberth_bonus(v_inf_out, v_inf, dv)
        eta, b_imp_small = metrics.oberth_efficiency(b_fin, b_imp, dv, num.b_imp_min_rel)
        deps_imp = metrics.energy_gain_impulsive(1.0, 1.0, v_inf, dv)
        deps_fin = eps_out - 0.5 * v_inf**2
        eta_E = deps_fin / deps_imp
        # Error model: the energy-balance residual bounds the error in ε at burnout. Then
        # δv_inf = δε / v_inf_out, plus rounding in the B subtraction.
        d_eps = balance
        d_b = d_eps / v_inf_out + 4.0 * _EPS * (v_inf_out + v_inf + dv)
        eta_err = d_b / b_imp
        eta_E_err = d_eps / deps_imp
        m_final = float(segments[1].y[6, -1])
        dv_int = c * -math.log(m_final)
        Pi = t_b / tau
        r_bs = float(_radius(segments[1].y[:, 0]))
        r_be = float(_radius(segments[1].y[:, -1]))
    else:
        v_inf_imp = b_imp = b_fin = eta = eta_err = eta_E = eta_E_err = math.nan
        deps_imp = deps_fin = math.nan
        b_imp_small = False
        m_final, dv_int, Pi = 1.0, 0.0, 0.0
        r_bs = r_be = math.nan

    return NDResult(
        v_inf=v_inf, dv=dv, c=c if burn else math.nan, a0=a0 if burn else math.nan,
        steering=steering.to_dict() if burn else {}, midpoint_offset=midpoint_offset if burn else math.nan,
        v_p=vp, k=1.0 / vp**2, tau=tau, t_b=t_b, t_start=ts, t_end=te, Pi=Pi, mass_ratio=m_final,
        eps_out=eps_out, v_inf_out=v_inf_out, v_inf_imp=v_inf_imp, b_imp=b_imp, b_finite=b_fin,
        eta=eta, eta_err=eta_err, eta_E=eta_E, eta_E_err=eta_E_err,
        delta_eps_finite=deps_fin, delta_eps_imp=deps_imp, dv_integrated=dv_int,
        turn_angle=turn, turn_angle_unperturbed=kepler.turn_angle(1.0 + em1),
        r_min=r_min, r_min_burn=r_min_burn, r_min_numerical=r_min_numerical, r_burn_start=r_bs, r_burn_end=r_be,
        energy_drift=energy_drift, energy_drift_rel_eps=energy_drift_rel_eps,
        energy_balance_residual=balance / e_ref, nfev={seg.label: seg.nfev for seg in segments},
        impacted=bool(impacted), captured=bool(captured), b_imp_small=bool(b_imp_small),
        eta_unreliable=bool(math.isfinite(eta) and eta_err > num.eta_err_max),
        segments=segments,
    )


def simulate_flyby(
    body: Body,
    v_inf_in: float,
    periapsis_altitude: float,
    burn: BurnSpec | None = None,
    steering: SteeringLaw | None = None,
    *,
    safety_margin: float = 0.0,
    numerics: Numerics = Numerics(),
    rotation: np.ndarray | None = None,
) -> FlybyResult:
    """Simulate one (optionally powered) hyperbolic flyby of a real body. All arguments are SI.

    body: central body
    v_inf_in: incoming hyperbolic excess speed, m/s (> 0)
    periapsis_altitude: unperturbed periapsis altitude above the equatorial radius, m (> 0)
    burn: the burn, or None for a coast-only flyby
    steering: steering law (default prograde)
    safety_margin: flag trajectories whose minimum altitude is below this, m
    rotation: optional 3×3 rotation from the perifocal frame to the simulation frame
    """
    steering = steering or Prograde()
    if periapsis_altitude <= 0:
        raise ValueError(f"periapsis altitude must be positive, got {periapsis_altitude}")
    r_p = body.radius_eq + periapsis_altitude
    s = Scales(mu=body.gm, r_p=r_p, m0=burn.engine.m0 if burn else 1.0)

    if burn is not None:
        nd = simulate_nd(
            v_inf_in / s.velocity, burn.delta_v / s.velocity, burn.engine.exhaust_velocity / s.velocity,
            burn.engine.a0 / s.acceleration, steering, midpoint_offset=burn.midpoint_offset / s.time,
            impact_radius=body.radius_eq / r_p, numerics=numerics, rotation=rotation,
        )
    else:
        nd = simulate_nd(v_inf_in / s.velocity, impact_radius=body.radius_eq / r_p, numerics=numerics,
                         rotation=rotation)

    r_soi = body.soi_radius
    soi_start = nd.r_burn_start * r_p / r_soi if math.isfinite(r_soi) else 0.0
    soi_end = nd.r_burn_end * r_p / r_soi if math.isfinite(r_soi) else 0.0
    flags = {
        "unsafe_periapsis": bool(nd.impacted or nd.r_min * r_p < body.radius_eq + safety_margin),
        "impact": nd.impacted,
        "captured": nd.captured,
        "outside_soi": bool(burn is not None and max(soi_start, soi_end) > 1.0),
        "b_imp_small": nd.b_imp_small,
        "eta_unreliable": nd.eta_unreliable,
    }

    V, E = s.velocity, s.specific_energy
    return FlybyResult(
        body=body.name,
        v_inf_in=v_inf_in,
        r_p=r_p,
        periapsis_altitude=periapsis_altitude,
        safety_margin=safety_margin,
        delta_v=burn.delta_v if burn else 0.0,
        isp=burn.engine.isp if burn else math.nan,
        a0=burn.engine.a0 if burn else math.nan,
        m0=s.m0,
        midpoint_offset=burn.midpoint_offset if burn else math.nan,
        steering=nd.steering,
        v_p=nd.v_p * V,
        tau=nd.tau * s.time,
        burn_duration=burn.duration if burn else 0.0,
        t_burn_start=burn.t_start if burn else math.nan,
        t_burn_end=burn.t_end if burn else math.nan,
        Pi=nd.Pi,
        v_inf_out=nd.v_inf_out * V,
        v_inf_imp=nd.v_inf_imp * V,
        b_imp=nd.b_imp * V,
        b_finite=nd.b_finite * V,
        eta=nd.eta,
        eta_err=nd.eta_err,
        eta_E=nd.eta_E,
        eta_E_err=nd.eta_E_err,
        delta_v_loss=(nd.v_inf_imp - nd.v_inf_out) * V,
        delta_eps_finite=nd.delta_eps_finite * E,
        delta_eps_imp=nd.delta_eps_imp * E,
        m_final=nd.mass_ratio * s.mass,
        delta_v_integrated=nd.dv_integrated * V,
        turn_angle=nd.turn_angle,
        turn_angle_unperturbed=nd.turn_angle_unperturbed,
        r_min=nd.r_min * r_p,
        altitude_min=nd.r_min * r_p - body.radius_eq,
        r_min_burn=nd.r_min_burn * r_p,
        r_min_numerical=nd.r_min_numerical * r_p,
        r_soi=r_soi if math.isfinite(r_soi) else None,
        soi_ratio_burn_start=soi_start,
        soi_ratio_burn_end=soi_end,
        energy_drift=nd.energy_drift,
        energy_drift_rel_eps=nd.energy_drift_rel_eps,
        energy_balance_residual=nd.energy_balance_residual,
        nfev=nd.nfev,
        flags=flags,
        trajectory=Trajectory(scales=s, segments=nd.segments),
    )
