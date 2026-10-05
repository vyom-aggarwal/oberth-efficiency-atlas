"""Phase 4: staged finite burns about the periapsis of any arrival conic (bound, parabolic or hyperbolic).

Nondimensional units as in `simulate.py`: μ = r_p = 1, V = sqrt(μ/r_p), time sqrt(r_p³/μ), and
mass m0 (the whole stack at first ignition).

Arrival. The unperturbed conic is set by its periapsis speed v_p, with ε0 = v_p²/2 − 1: bound
for v_p < √2, parabolic at √2, hyperbolic above. The initial state is found by integrating the
coast *backward* from periapsis (r = x̂, v = v_p ŷ). No Kepler solver is needed for any
eccentricity, including the near-parabolic ellipses of solar Oberth dives.

Stages fire in sequence. Each has a constant thrust T (units m0 μ/r_p²), an exhaust velocity c
and a propellant mass m_prop (units m0). At burnout it drops its inert mass m_drop, then
optionally coasts before the next ignition. The sequence runs from the first ignition to the last
burnout; `midpoint_offset` places its midpoint relative to the unperturbed periapsis passage.

Metric: the equivalent-Δv penalty, defined for bound and hyperbolic arrivals alike.
    Δv_eq = sqrt(2(ε_out + 1)) − v_p   (the impulsive prograde burn at r_p giving the same ε_out)
    loss  = Δv_rocket − Δv_eq,          Δv_rocket = Σ c ln(m_ignition / m_burnout)
At small Π this tends to D₂Π²/(v_p + Δv) (`theory.equivalent_dv_loss_per_pi2`).
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field

import numpy as np
from scipy.integrate import solve_ivp
from scipy.optimize import minimize_scalar

from . import kepler
from .dynamics import coast_rhs, specific_energy, thrust_rhs, variable_thrust_rhs
from .optimize import x_centroid
from .simulate import R_FLOOR, Numerics, _integrate
from .steering import Prograde, SteeringContext, SteeringLaw


@dataclass(frozen=True)
class StageND:
    thrust: float               # T / (m0 μ/r_p²)
    c: float                    # exhaust velocity / V
    m_prop: float               # propellant / m0
    m_drop: float = 0.0         # inert mass dropped at burnout / m0
    coast_after: float = 0.0    # coast before the next ignition, units sqrt(r_p³/μ)

    @property
    def burn_time(self) -> float:
        return self.m_prop * self.c / self.thrust


@dataclass(frozen=True)
class PowerLawStageND:
    """A stage whose thrust depends on distance: T(r) = thrust_ref (r/r_ref)^(−kappa), optionally capped.

    Models solar-electric propulsion at constant Isp and efficiency, where thrust follows the
    available power. It burns for a fixed `duration`; its Δv follows from the integrated mass.
    Units as in StageND (thrust in m0 μ/r_p², r in r_p).
    """

    thrust_ref: float
    r_ref: float
    kappa: float
    c: float
    duration: float
    thrust_cap: float = math.inf
    m_drop: float = 0.0
    coast_after: float = 0.0

    @property
    def burn_time(self) -> float:
        return self.duration

    def thrust_at(self, r: float) -> float:
        return min(self.thrust_ref * (r / self.r_ref) ** (-self.kappa), self.thrust_cap)


@dataclass(frozen=True)
class StageSI:
    """One motor in SI units. Thrust is constant at m_prop·c/burn_time (the burn-time average)."""

    name: str
    total_kg: float
    dry_kg: float
    exhaust_velocity: float      # m/s
    burn_time: float             # s
    coast_after: float = 0.0     # s before the next ignition

    @property
    def m_prop(self) -> float:
        return self.total_kg - self.dry_kg

    @property
    def thrust(self) -> float:
        return self.m_prop * self.exhaust_velocity / self.burn_time


def stack_mass(stages: list[StageSI], payload_kg: float) -> float:
    return sum(s.total_kg for s in stages) + payload_kg


def stages_to_nd(stages: list[StageSI], payload_kg: float, mu: float, r_p: float) -> list[StageND]:
    """Nondimensionalize a stack (all stages + payload) for a periapsis at r_p about a body of GM mu."""
    from .units import Scales
    sc = Scales(mu=mu, r_p=r_p, m0=stack_mass(stages, payload_kg))
    return [StageND(thrust=s.thrust / (sc.m0 * sc.acceleration), c=s.exhaust_velocity / sc.velocity,
                    m_prop=s.m_prop / sc.m0, m_drop=s.dry_kg / sc.m0, coast_after=s.coast_after / sc.time)
            for s in stages]


@dataclass(frozen=True)
class StageTiming:
    t_ignition: float           # from the first ignition
    t_burnout: float
    m_ignition: float
    dv: float                   # rocket-equation Δv of this stage


def schedule(stages: list) -> tuple[list[StageTiming], float]:
    """Ignition/burnout times (from the first ignition), ignition masses and stage Δv; total duration.

    After a PowerLawStageND the masses and Δv are known only from the integration (NaN here).
    """
    if not stages:
        raise ValueError("need at least one stage")
    t, m, out = 0.0, 1.0, []
    for i, s in enumerate(stages):
        if isinstance(s, PowerLawStageND):
            if not (s.thrust_ref > 0 and s.c > 0 and s.duration > 0 and s.r_ref > 0 and s.m_drop >= 0):
                raise ValueError(f"invalid stage {i + 1}: {s}")
            out.append(StageTiming(t, t + s.duration, m, math.nan))
            m = math.nan
        else:
            if not (s.thrust > 0 and s.c > 0 and s.m_prop > 0 and s.m_drop >= 0 and s.coast_after >= 0
                    and (math.isnan(m) or s.m_prop < m)):
                raise ValueError(f"invalid stage {i + 1}: {s} (stack mass at ignition {m})")
            out.append(StageTiming(t, t + s.burn_time, m,
                                   s.c * math.log(m / (m - s.m_prop)) if not math.isnan(m) else math.nan))
            m -= s.m_prop + s.m_drop
            if m <= 0:
                raise ValueError(f"stage {i + 1} leaves no mass")
        t += s.burn_time + (s.coast_after if i < len(stages) - 1 else 0.0)
    return out, out[-1].t_burnout


def _constant_only(stages: list) -> None:
    if any(isinstance(s, PowerLawStageND) for s in stages):
        raise ValueError("needs constant-thrust stages (a power-law stage's profile is known only after integration)")


def dv_centroid_time(stages: list[StageND]) -> float:
    """Δv-weighted mean time of the sequence, measured from the first ignition (constant-thrust stages)."""
    _constant_only(stages)
    sched, _ = schedule(stages)
    num = sum((st.t_ignition + x_centroid(st.dv / s.c) * s.burn_time) * st.dv for s, st in zip(stages, sched))
    return num / sum(st.dv for st in sched)


def centroid_offset(stages: list[StageND]) -> float:
    """midpoint_offset that puts the Δv centroid of the sequence at periapsis (the Phase 3 small-Π optimum)."""
    _, duration = schedule(stages)
    return 0.5 * duration - dv_centroid_time(stages)


def leading_order_loss(v_p: float, stages: list[StageND], midpoint_offset: float = 0.0, n: int = 64) -> float:
    """O(Π²) equivalent-Δv loss of a prograde staged burn from its second moment about periapsis.

    ½ K ∫ a(t) t² dt / (v_p + Δv), with K = k(1 − k)v_p³ = v_p − 1/v_p (docs/theory.md §4) and t
    measured from the unperturbed periapsis. This is the m₂ term of the small-Π deficit,
    generalized to any staged profile. It neglects the finite-Δv term j, of relative size
    ~2(1 + k)Δv j/((1 − k) v_p m₂), and O(Π⁴).
    """
    _constant_only(stages)
    sched, duration = schedule(stages)
    t_ign = midpoint_offset - 0.5 * duration
    xg, wg = np.polynomial.legendre.leggauss(n)
    moment = 0.0
    for s, st in zip(stages, sched):
        tb, mdot = s.burn_time, s.thrust / s.c
        tt = 0.5 * (xg + 1.0) * tb
        a = s.thrust / (st.m_ignition - mdot * tt)
        moment += 0.5 * tb * float(np.sum(wg * a * (t_ign + st.t_ignition + tt) ** 2))
    dv = sum(st.dv for st in sched)
    return 0.5 * (v_p - 1.0 / v_p) * moment / (v_p + dv)


@dataclass
class StagedResult:
    v_p: float
    eps0: float
    eps_out: float
    dv_rocket: float
    dv_eq: float
    dv_loss: float               # Δv_rocket − Δv_eq
    dv_loss_rel: float           # dv_loss / dv_rocket
    dv_loss_err: float           # from the energy-balance residual
    r_min: float
    impacted: bool
    t_ignition: float            # relative to the unperturbed periapsis passage
    t_burnout: float
    duration: float
    Pi: float                    # duration · v_p (= duration/τ)
    centroid_time: float         # Δv centroid relative to periapsis
    energy_balance: float
    m_final: float
    stage_dv: list = field(default_factory=list)
    dv_time_std: float = math.nan  # Δv-weighted standard deviation of the thrust time
    Pi_eff: float = math.nan       # √12 · dv_time_std / τ: duration of the uniform burn with the same spread
    segments: list | None = None   # integration segments (only with Numerics(dense_output=True))


def _moments_constant(stages: list[StageND], sched: list[StageTiming], t_ign: float, n: int = 64):
    """(∫a dt, ∫a t dt, ∫a t² dt) of constant-thrust stages from their analytic profiles (Gauss–Legendre)."""
    xg, wg = np.polynomial.legendre.leggauss(n)
    A = np.zeros(3)
    for s, st in zip(stages, sched):
        tt = 0.5 * (xg + 1.0) * s.burn_time
        a = s.thrust / (st.m_ignition - s.thrust / s.c * tt)
        t = t_ign + st.t_ignition + tt
        A += 0.5 * s.burn_time * np.array([np.sum(wg * a), np.sum(wg * a * t), np.sum(wg * a * t * t)])
    return A


def _moments_dense(stages: list, burn_segments: list, n: int = 4001):
    """The same moments from the dense output of the burn segments (any thrust law; Simpson's rule)."""
    from scipy.integrate import simpson
    A = np.zeros(3)
    for s, seg in zip(stages, burn_segments):
        t = np.linspace(seg.t[0], seg.t[-1], n)
        Y = seg.sol(t)
        r = np.sqrt(np.sum(Y[0:3] ** 2, axis=0))
        T = (np.minimum(s.thrust_ref * (r / s.r_ref) ** (-s.kappa), s.thrust_cap)
             if isinstance(s, PowerLawStageND) else np.full_like(t, s.thrust))
        a = T / Y[6]
        A += np.array([simpson(a, x=t), simpson(a * t, x=t), simpson(a * t * t, x=t)])
    return A


def simulate_staged_nd(v_p: float, stages: list, steering: SteeringLaw | None = None, *,
                       midpoint_offset: float = 0.0, numerics: Numerics = Numerics(),
                       impact_radius: float = R_FLOOR) -> StagedResult:
    """Integrate a staged burn about the periapsis of the conic with periapsis speed v_p (r_p = 1)."""
    if not v_p > 0:
        raise ValueError("v_p must be positive")
    steering = steering or Prograde()
    num = numerics
    mu = 1.0 if num.gravity else 0.0
    sched, duration = schedule(stages)
    tau = 1.0 / v_p
    eps0 = 0.5 * v_p**2 - 1.0
    t_ign = midpoint_offset - 0.5 * duration
    t_end = t_ign + duration
    t0 = min(t_ign, 0.0) - num.pre_coast_tau * tau

    # Initial state on the exact unperturbed conic: coast backward from periapsis (always real μ = 1).
    y_peri = np.array([1.0, 0.0, 0.0, 0.0, v_p, 0.0, 1.0, 0.0])
    back = solve_ivp(coast_rhs(1.0), (0.0, t0), y_peri, method=num.method, rtol=num.rtol, atol=num.atol)
    if back.status != 0:
        raise RuntimeError(f"backward arrival integration failed: {back.message}")
    y = back.y[:, -1].copy()
    y[6], y[7] = 1.0, 0.0

    segments = [_integrate("pre", coast_rhs(mu), t0, t_ign, y, num, impact_radius, thrusting=False)]
    impacted = segments[-1].impacted
    y = segments[-1].y[:, -1].copy()
    steer = steering.bind(SteeringContext(t_start=t_ign, t_end=t_end))
    burn_segments, stage_dv = [], []
    for i, (s, st) in enumerate(zip(stages, sched)):
        if impacted:
            break
        ts, te = t_ign + st.t_ignition, t_ign + st.t_burnout
        rhs = (variable_thrust_rhs(mu, s.thrust_at, s.c, steer) if isinstance(s, PowerLawStageND)
               else thrust_rhs(mu, s.thrust, s.c, steer))
        m_start = float(y[6])
        seg = _integrate(f"burn{i + 1}", rhs, ts, te, y, num, impact_radius, thrusting=True)
        segments.append(seg)
        burn_segments.append(seg)
        impacted = seg.impacted
        y = seg.y[:, -1].copy()
        if y[6] <= 0:
            raise ValueError(f"stage {i + 1} burns more than the available mass")
        # Constant stages: exact rocket-equation Δv; power-law stages: from the integrated mass.
        stage_dv.append(st.dv if math.isfinite(st.dv) else s.c * math.log(m_start / float(y[6])))
        y[6] -= s.m_drop
        if i < len(stages) - 1 and s.coast_after > 0 and not impacted:
            seg = _integrate(f"gap{i + 1}", coast_rhs(mu), te, te + s.coast_after, y, num, impact_radius,
                             thrusting=False)
            segments.append(seg)
            impacted = seg.impacted
            y = seg.y[:, -1].copy()
    y_bo = y.copy()
    if not impacted:
        tf = max(t_end, 0.0) + num.post_coast_tau * tau
        if mu and specific_energy(y_bo, mu) != 0.0:
            t_next = kepler.time_to_next_periapsis(y_bo[0:3], y_bo[3:6], mu)
            if math.isfinite(t_next):
                tf = max(tf, t_end + t_next + num.post_coast_tau * tau)
        segments.append(_integrate("post", coast_rhs(mu), t_end, tf, y_bo, num, impact_radius, thrusting=False))
        impacted = segments[-1].impacted

    # Energy balance ε − ε0 − W on every segment up to burnout (W carries across drops and gaps).
    balance = 0.0
    for seg in segments:
        if seg.label != "post":
            eps = specific_energy(seg.y, mu)
            balance = max(balance, float(np.max(np.abs(eps - eps0 - seg.y[7]))))
    r_all = [np.sqrt(np.sum(seg.y[0:3] ** 2, axis=0)).min() for seg in segments]
    r_all += [float(np.linalg.norm(p[0:3])) for seg in segments for p in seg.y_periapsis]
    r_min = impact_radius if impacted else float(min(r_all))

    dv_rocket = sum(stage_dv) if len(stage_dv) == len(stages) else math.nan
    if impacted:
        eps_out = dv_eq = dv_loss = math.nan
    else:
        eps_out = float(specific_energy(y_bo, mu))
        dv_eq = math.sqrt(2.0 * (eps_out + 1.0)) - v_p
        dv_loss = dv_rocket - dv_eq
    # Δv-weighted time moments: analytic for constant stages, from dense output otherwise.
    if not any(isinstance(s, PowerLawStageND) for s in stages):
        A = _moments_constant(stages, sched, t_ign)
    elif num.dense_output and not impacted:
        A = _moments_dense(stages, burn_segments)
    else:
        A = np.full(3, math.nan)
    t_mean = A[1] / A[0]
    t_std = math.sqrt(max(A[2] / A[0] - t_mean**2, 0.0)) if math.isfinite(t_mean) else math.nan
    return StagedResult(
        v_p=v_p, eps0=eps0, eps_out=eps_out, dv_rocket=dv_rocket, dv_eq=dv_eq, dv_loss=dv_loss,
        dv_loss_rel=dv_loss / dv_rocket, dv_loss_err=balance / (v_p + (dv_eq if math.isfinite(dv_eq) else 0.0)),
        r_min=r_min, impacted=impacted, t_ignition=t_ign, t_burnout=t_end, duration=duration, Pi=duration * v_p,
        centroid_time=float(t_mean), energy_balance=balance, m_final=float(y_bo[6]), stage_dv=stage_dv,
        dv_time_std=float(t_std), Pi_eff=float(math.sqrt(12.0) * t_std * v_p),
        segments=segments if num.dense_output else None)


def optimal_offset(v_p: float, stages: list[StageND], numerics: Numerics = Numerics(),
                   xatol_rel: float = 1e-6) -> tuple[float, StagedResult]:
    """Prograde timing that minimizes the equivalent-Δv loss (bounded Brent over ±duration)."""
    _, duration = schedule(stages)
    cache = {}

    def loss(d):
        r = simulate_staged_nd(v_p, stages, midpoint_offset=float(d), numerics=numerics)
        cache[float(d)] = r
        return r.dv_loss if math.isfinite(r.dv_loss) else 1e3

    res = minimize_scalar(loss, bounds=(-duration, duration), method="bounded",
                          options={"xatol": xatol_rel * duration})
    d = float(res.x)
    return d, cache.get(d) or simulate_staged_nd(v_p, stages, midpoint_offset=d, numerics=numerics)


__all__ = ["StageND", "PowerLawStageND", "StageSI", "StageTiming", "StagedResult", "schedule", "dv_centroid_time",
           "centroid_offset",
           "simulate_staged_nd", "optimal_offset", "stack_mass", "stages_to_nd", "leading_order_loss"]
