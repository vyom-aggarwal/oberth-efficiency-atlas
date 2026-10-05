"""Phase 3: optimize the prograde family (pitch law + burn timing) under a minimum-altitude constraint.

Controls, all dimensionless:
- α₀, α₁: in-plane pitch from the velocity, α(s) = α₀ + α₁·s, with s = (t − t_mid)/t_b ∈ [−½, ½].
  α > 0 tilts the thrust toward the planet (steering.PitchLinear).
- δ: burn-midpoint offset from the unperturbed periapsis, in units of t_b (δ < 0 is an earlier
  burn).

(0, 0, 0) is the centered prograde burn of Phases 1–2.

Objective: maximize the outgoing energy ε_out at fixed (Δv, Isp, a0). This is the same as
maximizing v∞,out, η and η_W. The internal objective is −η_W, which is O(1)-scaled.

Constraint: r_min ≥ ρ·r_p, the minimum radius over the whole trajectory.

Baselines reported for each optimum (as agreed in Phase 1):
- eta_fixed: η against the impulsive burn at the nominal r_p (the usual η);
- eta_achieved: η against an impulsive burn of the same Δv at the *achieved* periapsis r_min,
  for the same v∞.

All quantities are nondimensional (μ = r_p = 1), as in `simulate.simulate_nd`.
"""

from __future__ import annotations

import math
from dataclasses import asdict, dataclass, field

import numpy as np
from scipy.optimize import minimize, minimize_scalar

from . import metrics, theory
from .simulate import Numerics, R_FLOOR, simulate_nd
from .steering import InertialFixed, PitchLinear, Prograde

BOUNDS = {"alpha0": (-1.2, 1.2), "alpha1": (-3.0, 3.0), "delta": (-1.0, 1.0)}


@dataclass(frozen=True)
class OptCase:
    v_inf: float          # ṽ∞
    dv: float             # Δṽ
    c: float              # c̃
    a0: float             # ã0
    rho: float = 1.0      # constraint: r_min ≥ rho · r_p

    @property
    def t_b(self) -> float:
        return (self.c / self.a0) * -math.expm1(-self.dv / self.c)

    @property
    def v_p(self) -> float:
        return math.sqrt(self.v_inf**2 + 2.0)

    @property
    def Pi(self) -> float:
        return self.t_b * self.v_p

    @classmethod
    def from_targets(cls, v_over_vesc: float, dv_over_vp: float, dv_over_c: float, Pi: float, rho: float = 1.0):
        """Build a case from the physically meaningful targets (v∞/v_esc, Δv/v_p, Δv/c, Π)."""
        v = v_over_vesc * math.sqrt(2.0)
        v_p = math.sqrt(v * v + 2.0)
        dv = dv_over_vp * v_p
        c = dv / dv_over_c
        t_b = Pi / v_p
        return cls(v, dv, c, (c / t_b) * -math.expm1(-dv_over_c), rho)


@dataclass
class Evaluation:
    x: tuple
    eta: float
    eta_W: float
    eps_out: float
    r_min: float
    impacted: bool
    eta_err: float


class _Evaluator:
    """Caches one simulation per control vector, so the objective and constraint share it."""

    def __init__(self, case: OptCase, numerics: Numerics):
        self.case, self.num, self.cache, self.n_sims = case, numerics, {}, 0

    def __call__(self, alpha0: float, alpha1: float, delta: float) -> Evaluation:
        key = (round(alpha0, 14), round(alpha1, 14), round(delta, 14))
        if key not in self.cache:
            c = self.case
            steer = Prograde() if alpha0 == 0.0 and alpha1 == 0.0 else PitchLinear(alpha0, alpha1)
            r = simulate_nd(c.v_inf, c.dv, c.c, c.a0, steer, midpoint_offset=delta * c.t_b, numerics=self.num)
            self.n_sims += 1
            self.cache[key] = Evaluation(key, r.eta, r.eta_W, r.eps_out, r.r_min, r.impacted, r.eta_err)
        return self.cache[key]


def _objective(e: Evaluation) -> float:
    # Impacts end the run early (no outgoing state): heavily penalized but finite.
    return 1e3 if e.impacted or not math.isfinite(e.eta_W) else -e.eta_W


@dataclass
class OptResult:
    case: dict
    mode: str
    alpha0: float
    alpha1: float
    delta: float
    eta_fixed: float
    eta_achieved: float
    eta_W: float
    r_min: float
    eta_err: float
    feasible: bool
    eta_centered: float          # prograde, centered (reference)
    eta_inertial: float          # inertial, centered (reference curve)
    r_min_centered: float
    n_sims: int
    starts: list = field(default_factory=list)


def eta_against_periapsis(case: OptCase, eta_fixed: float, r: float) -> float:
    """Re-reference η to an impulsive burn at radius r (units of r_p), for the same v∞ and Δv."""
    b_fin = eta_fixed * metrics.oberth_bonus_impulsive(1.0, 1.0, case.v_inf, case.dv)
    return b_fin / metrics.oberth_bonus_impulsive(1.0, r, case.v_inf, case.dv)


def optimize_case(case: OptCase, mode: str = "full", numerics: Numerics = Numerics(),
                  starts: list[tuple[float, float, float]] | None = None) -> OptResult:
    """Optimize one case. mode = 'timing' (α ≡ 0, δ free) or 'full' (α₀, α₁, δ)."""
    ev = _Evaluator(case, numerics)
    ref = ev(0.0, 0.0, 0.0)
    inert = simulate_nd(case.v_inf, case.dv, case.c, case.a0, InertialFixed(), numerics=numerics)
    tried = []

    if mode == "timing":
        # The constraint is inactive here: prograde thrust never lowers periapsis (Phase 2), and an
        # off-center prograde burn cannot dip below r_p either. That is checked after the fact.
        res = minimize_scalar(lambda d: _objective(ev(0.0, 0.0, d)), bounds=BOUNDS["delta"], method="bounded",
                              options={"xatol": 1e-5})
        best = ev(0.0, 0.0, float(res.x))
        x = (0.0, 0.0, float(res.x))
        tried.append(dict(x0=None, x=x, eta=best.eta, feasible=best.r_min >= case.rho - 1e-9))
    elif mode == "full":
        starts = starts or [(0.0, 0.0, 0.0), (0.0, 0.0, -0.15), (0.15, -0.3, -0.1), (-0.1, 0.2, 0.05), (0.3, 0.0, -0.3)]
        bounds = [BOUNDS["alpha0"], BOUNDS["alpha1"], BOUNDS["delta"]]
        cons = [{"type": "ineq", "fun": lambda z: ev(*z).r_min - case.rho}]
        best, x = None, None
        for x0 in starts:
            r = minimize(lambda z: _objective(ev(*z)), np.array(x0, float), method="SLSQP", bounds=bounds,
                         constraints=cons, options={"ftol": 1e-12, "maxiter": 300, "eps": 1e-6})
            e = ev(*r.x)
            feas = (e.r_min >= case.rho - 1e-7) and not e.impacted
            tried.append(dict(x0=x0, x=tuple(map(float, r.x)), eta=e.eta, feasible=bool(feas), message=r.message))
            if feas and (best is None or e.eta_W > best.eta_W):
                best, x = e, tuple(map(float, r.x))
        if best is None:                       # no feasible optimum: fall back to the centered burn
            best, x = ref, (0.0, 0.0, 0.0)
    else:
        raise ValueError(f"unknown mode {mode!r}")

    feasible = bool(best.r_min >= case.rho - 1e-7 and not best.impacted)
    return OptResult(
        case={**asdict(case), "Pi": case.Pi, "v_inf_over_vesc": case.v_inf / math.sqrt(2.0),
              "dv_over_vp": case.dv / case.v_p, "dv_over_c": case.dv / case.c, "k": 1.0 / case.v_p**2},
        mode=mode, alpha0=x[0], alpha1=x[1], delta=x[2],
        eta_fixed=best.eta, eta_achieved=eta_against_periapsis(case, best.eta, best.r_min) if feasible else math.nan,
        eta_W=best.eta_W, r_min=best.r_min, eta_err=best.eta_err, feasible=feasible,
        eta_centered=ref.eta, eta_inertial=inert.eta, r_min_centered=ref.r_min, n_sims=ev.n_sims, starts=tried,
    )


def timing_theory_delta(dv_over_c: float) -> float:
    """Small-Π prediction for the optimal prograde midpoint offset, in units of t_b.

    At leading order only the Δv-weighted second moment about periapsis depends on timing (the
    finite-Δv term is translation-invariant), so the optimum puts the Δv centroid at periapsis:
    δ* = ½ − x̄, with x̄ = 1/μ_r − 1/λ (λ = Δv/c, μ_r = 1 − e^(−λ)). The centroid of a rocket burn
    lies after its time midpoint, so δ* < 0: start earlier.
    """
    lam = dv_over_c
    if lam < 1e-8:
        return 0.0
    mu_r = -math.expm1(-lam)
    return 0.5 - (1.0 / mu_r - 1.0 / lam)


__all__ = ["OptCase", "OptResult", "optimize_case", "timing_theory_delta", "eta_against_periapsis", "R_FLOOR",
           "theory"]
