"""Finite-burn flyby simulation: coast → burn → coast, in nondimensional units.

Inputs and outputs are SI. Internally: length r_p, velocity sqrt(μ/r_p), mass m0 (`units.Scales`).
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
    energy_drift: dict               # per coast segment: max |ε(t) − ε(t_seg0)| / (μ/r_p)
    energy_drift_rel_eps: dict       # per coast segment: same, divided by |ε(t_seg0)|
    energy_balance_residual: float   # max |ε − ε0 − W| / (μ/r_p) up to burnout
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
    if isinstance(x, (float, np.floating, int, np.integer)):
        xf = float(x)
        if isinstance(x, (int, np.integer)):
            return int(x)
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
    """Simulate one (optionally powered) hyperbolic flyby. All arguments are SI.

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
    rot = np.eye(3) if rotation is None else np.asarray(rotation, dtype=float)
    if not (np.allclose(rot.T @ rot, np.eye(3), atol=1e-12) and np.linalg.det(rot) > 0):
        raise ValueError("rotation must be a proper orthogonal 3×3 matrix")

    num = numerics
    r_p = body.radius_eq + periapsis_altitude
    s = Scales(mu=body.gm, r_p=r_p, m0=burn.engine.m0 if burn else 1.0)
    mu = 1.0 if num.gravity else 0.0

    # Geometry of the incoming (unperturbed) hyperbola. It always uses the real μ = 1.
    vinf = v_inf_in / s.velocity
    em1 = kepler.hyperbola_em1(1.0, 1.0, vinf)
    vp = metrics.periapsis_speed(1.0, 1.0, vinf)
    tau = 1.0 / vp
    R_body = body.radius_eq / r_p

    if burn is not None:
        ts, te = burn.t_start / s.time, burn.t_end / s.time
        t0 = min(ts, 0.0) - num.pre_coast_tau * tau
    else:
        t0 = -num.pre_coast_tau * tau

    r0, v0 = kepler.hyperbola_state(t0, 1.0, 1.0, vinf)
    y0 = np.concatenate([rot @ r0, rot @ v0, [1.0, 0.0]])

    segments: list[Segment] = []
    impacted = False
    if burn is None:
        tf = num.post_coast_tau * tau
        seg = _integrate("coast", coast_rhs(mu), t0, tf, y0, num, R_body, thrusting=False)
        segments.append(seg)
        impacted = seg.impacted
        y_bo = seg.y[:, -1]
    else:
        pre = _integrate("pre", coast_rhs(mu), t0, ts, y0, num, R_body, thrusting=False)
        segments.append(pre)
        ctx = SteeringContext(t_start=ts, t_end=te, rotation=rot)
        a0 = burn.engine.a0 / s.acceleration
        c = burn.engine.exhaust_velocity / s.velocity
        b = _integrate("burn", thrust_rhs(mu, a0, c, steering.bind(ctx)), ts, te, pre.y[:, -1], num, R_body,
                       thrusting=True)
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
            post = _integrate("post", coast_rhs(mu), te, tf, y_bo, num, R_body, thrusting=False)
            segments.append(post)
            impacted = post.impacted

    y_final = segments[-1].y[:, -1]
    if burn is None:
        y_bo = y_final

    # --- energy diagnostics ---
    eps0 = float(specific_energy(y0, mu))
    energy_drift, energy_drift_rel_eps = {}, {}
    balance = 0.0
    for seg in segments:
        eps = specific_energy(seg.y, mu)
        if not seg.thrusting:
            d = float(np.max(np.abs(eps - eps[0])))
            energy_drift[seg.label] = d                     # already relative to μ/r_p = 1
            energy_drift_rel_eps[seg.label] = d / abs(eps[0]) if eps[0] != 0 else math.inf
        if seg.label in ("coast", "pre", "burn"):
            balance = max(balance, float(np.max(np.abs(eps - eps0 - seg.y[7]))))

    # --- burnout energy and outgoing excess speed ---
    # An impact ends the run early, so no outgoing state exists and all outcomes are NaN.
    eps_out = math.nan if impacted else float(specific_energy(y_bo, mu))
    v_inf_out = math.sqrt(2.0 * eps_out) if eps_out > 0 else math.nan
    captured = burn is not None and not impacted and not eps_out > 0

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
            r_min_parts.append(R_body)
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

    # --- metrics (nondimensional), then conversion to SI ---
    if burn is not None:
        dv = burn.delta_v / s.velocity
        v_inf_imp = metrics.v_inf_impulsive(1.0, 1.0, vinf, dv)
        b_imp = metrics.oberth_bonus_impulsive(1.0, 1.0, vinf, dv)
        b_fin = metrics.oberth_bonus(v_inf_out, vinf, dv)
        eta, b_imp_small = metrics.oberth_efficiency(b_fin, b_imp, dv, num.b_imp_min_rel)
        deps_imp = metrics.energy_gain_impulsive(1.0, 1.0, vinf, dv)
        deps_fin = eps_out - 0.5 * vinf**2
        eta_E = deps_fin / deps_imp
        # Error model: the energy-balance residual bounds the error in ε at burnout. Then
        # δv_inf = δε / v_inf_out, plus rounding in the B subtraction.
        d_eps = balance
        d_b = d_eps / v_inf_out + 4.0 * _EPS * (v_inf_out + vinf + dv)
        eta_err = d_b / b_imp
        eta_E_err = d_eps / deps_imp
        m_final_nd = float(segments[1].y[6, -1])
        dv_int = burn.engine.exhaust_velocity * -math.log(m_final_nd)
        Pi = (te - ts) / tau
        r_bs = float(_radius(segments[1].y[:, 0])) * s.length
        r_be = float(_radius(segments[1].y[:, -1])) * s.length
    else:
        dv = 0.0
        v_inf_imp = b_imp = b_fin = eta = eta_err = eta_E = eta_E_err = math.nan
        deps_imp = deps_fin = math.nan
        b_imp_small = False
        m_final_nd = 1.0
        dv_int = 0.0
        Pi = 0.0
        r_bs = r_be = math.nan

    r_soi = body.soi_radius
    soi_start = r_bs / r_soi if math.isfinite(r_soi) else 0.0
    soi_end = r_be / r_soi if math.isfinite(r_soi) else 0.0
    eta_unreliable = bool(math.isfinite(eta) and eta_err > num.eta_err_max)

    flags = {
        "unsafe_periapsis": bool(impacted or r_min * s.length < body.radius_eq + safety_margin),
        "impact": bool(impacted),
        "captured": bool(captured),
        "outside_soi": bool(burn is not None and max(soi_start, soi_end) > 1.0),
        "b_imp_small": bool(b_imp_small),
        "eta_unreliable": eta_unreliable,
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
        steering=steering.to_dict() if burn else {},
        v_p=vp * V,
        tau=tau * s.time,
        burn_duration=burn.duration if burn else 0.0,
        t_burn_start=burn.t_start if burn else math.nan,
        t_burn_end=burn.t_end if burn else math.nan,
        Pi=Pi,
        v_inf_out=v_inf_out * V,
        v_inf_imp=v_inf_imp * V,
        b_imp=b_imp * V,
        b_finite=b_fin * V,
        eta=eta,
        eta_err=eta_err,
        eta_E=eta_E,
        eta_E_err=eta_E_err,
        delta_v_loss=(v_inf_imp - v_inf_out) * V,
        delta_eps_finite=deps_fin * E,
        delta_eps_imp=deps_imp * E,
        m_final=m_final_nd * s.mass,
        delta_v_integrated=dv_int,
        turn_angle=turn,
        turn_angle_unperturbed=kepler.turn_angle(1.0 + em1),
        r_min=r_min * s.length,
        altitude_min=r_min * s.length - body.radius_eq,
        r_min_burn=r_min_burn * s.length,
        r_min_numerical=r_min_numerical * s.length,
        r_soi=r_soi if math.isfinite(r_soi) else None,
        soi_ratio_burn_start=soi_start,
        soi_ratio_burn_end=soi_end,
        energy_drift=energy_drift,
        energy_drift_rel_eps=energy_drift_rel_eps,
        energy_balance_residual=balance,
        nfev={seg.label: seg.nfev for seg in segments},
        flags=flags,
        trajectory=Trajectory(scales=s, segments=segments),
    )
