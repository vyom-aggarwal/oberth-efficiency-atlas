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
from .steering import InertialFixed, PitchLinear, PitchPiecewise, Prograde

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
    """Caches one simulation per control vector, so the objective and constraint share it.

    Controls are (α-parameters..., δ). law='linear': (α₀, α₁, δ); law='piecewise': (knots..., δ).
    """

    def __init__(self, case: OptCase, numerics: Numerics, law: str = "linear"):
        if law not in ("linear", "piecewise"):
            raise ValueError(f"unknown pitch law {law!r}")
        self.case, self.num, self.law, self.cache, self.n_sims = case, numerics, law, {}, 0

    def __call__(self, *z: float) -> Evaluation:
        key = tuple(round(float(v), 14) for v in z)
        if key not in self.cache:
            c = self.case
            *alpha, delta = key
            if all(a == 0.0 for a in alpha):
                steer = Prograde()
            elif self.law == "linear":
                steer = PitchLinear(*alpha)
            else:
                steer = PitchPiecewise(tuple(alpha))
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
                  starts: list[tuple[float, float, float]] | None = None,
                  reference_inertial: bool = True) -> OptResult:
    """Optimize one case. mode = 'timing' (α ≡ 0, δ free) or 'full' (α₀, α₁, δ).

    reference_inertial=False skips the inertial reference run (eta_inertial is then NaN).
    """
    ev = _Evaluator(case, numerics)
    ref = ev(0.0, 0.0, 0.0)
    inert_eta = (simulate_nd(case.v_inf, case.dv, case.c, case.a0, InertialFixed(), numerics=numerics).eta
                 if reference_inertial else math.nan)
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
        eta_centered=ref.eta, eta_inertial=inert_eta, r_min_centered=ref.r_min, n_sims=ev.n_sims, starts=tried,
    )


def timing_theory_delta(dv_over_c: float) -> float:
    """Small-Π prediction for the optimal prograde midpoint offset, in units of t_b.

    At leading order only the Δv-weighted second moment about periapsis depends on timing (the
    finite-Δv term is translation-invariant), so the optimum puts the Δv centroid at periapsis:
    δ* = ½ − x̄, with x̄ = 1/μ_r − 1/λ (λ = Δv/c, μ_r = 1 − e^(−λ)). The centroid of a rocket burn
    lies after its time midpoint, so δ* < 0: start earlier.
    """
    if dv_over_c < 1e-8:
        return 0.0
    return 0.5 - x_centroid(dv_over_c)


def x_centroid(dv_over_c: float) -> float:
    """Δv-weighted mean burn time, normalized to [0, 1]: x̄ = 1/μ_r − 1/λ (λ = Δv/c, μ_r = 1 − e^(−λ))."""
    lam = dv_over_c
    if lam < 1e-8:
        return 0.5 + lam / 12.0
    mu_r = -math.expm1(-lam)
    return 1.0 / mu_r - 1.0 / lam


def x_median(dv_over_c: float) -> float:
    """Normalized time at which half the Δv has been delivered: (1 − e^(−λ/2))/μ_r.

    With mass m = 1 − μ_r x, the delivered Δv is −c ln(1 − μ_r x); setting it to Δv/2 gives this.
    """
    lam = dv_over_c
    if lam < 1e-8:
        return 0.5 + lam / 8.0
    return math.expm1(-0.5 * lam) / math.expm1(-lam)


def timing_half_dv_delta(dv_over_c: float) -> float:
    """Midpoint offset of the half-Δv rule: periapsis at the moment half the Δv is delivered."""
    return 0.5 - x_median(dv_over_c)


def timing_rule_capture(dv_over_c: float, x_rule: float) -> float:
    """Share of the optimal small-Π retiming gain captured by putting periapsis at x_rule.

    1 − (x̄ − x_rule)²/(x̄ − ½)². Exact at leading order in Π for any Δv/v_p and v∞, because only
    m₂(x_c) = σ² + (x̄ − x_c)² depends on the placement.
    """
    xb = x_centroid(dv_over_c)
    return 1.0 - (xb - x_rule) ** 2 / (xb - 0.5) ** 2


def timing_rule_extra_loss(case: OptCase, x_rule: float) -> float:
    """Small-Π deficit with periapsis at x_rule relative to the optimal (centroid) placement, minus 1."""
    c_rule = theory.small_pi_prefactor(case.v_inf, case.dv, case.c, "prograde", x_c=x_rule)
    c_opt = theory.small_pi_prefactor(case.v_inf, case.dv, case.c, "prograde", x_c=x_centroid(case.dv / case.c))
    return c_rule / c_opt - 1.0


def timing_theory_fraction(case: OptCase) -> float:
    """Small-Π fraction of the centered prograde deficit 1 − η that optimal retiming recovers.

    [C(½) − C(x̄)]/C(½), with C(x_c) the finite-Δv small-Π prefactor (`theory.small_pi_prefactor`)
    for periapsis at normalized burn time x_c. It is independent of Π at leading order. As Δv → 0
    it tends to (x̄ − ½)²/⟨(x − ½)²⟩_f, because only the m₂ term depends on timing; the finite-Δv
    term j is translation-invariant and dilutes the fraction.
    """
    x_bar = 0.5 - timing_theory_delta(case.dv / case.c)
    c_mid = theory.small_pi_prefactor(case.v_inf, case.dv, case.c, "prograde", x_c=0.5)
    c_bar = theory.small_pi_prefactor(case.v_inf, case.dv, case.c, "prograde", x_c=x_bar)
    return (c_mid - c_bar) / c_mid


@dataclass
class PiecewiseResult:
    case: dict
    knots: tuple
    delta: float
    eta_fixed: float
    eta_achieved: float
    r_min: float
    eta_err: float
    n_sims: int
    starts: list = field(default_factory=list)


def optimize_piecewise(case: OptCase, n_knots: int = 6, linear: tuple[float, float, float] | None = None,
                       numerics: Numerics = Numerics()) -> PiecewiseResult:
    """Optimize a piecewise-linear pitch law with n_knots knots plus the timing δ (SLSQP, r_min ≥ ρ).

    Starts: the linear optimum `linear` = (α₀, α₁, δ) mapped onto the knots (so the result is never
    worse than it), the same timing with zero pitch, and a perturbed copy of the first.
    """
    ev = _Evaluator(case, numerics, law="piecewise")
    s_k = np.linspace(-0.5, 0.5, n_knots)
    a0, a1, d0 = linear if linear is not None else (0.0, 0.0, 0.0)
    lin = list(a0 + a1 * s_k) + [d0]
    wiggle = 0.05 * np.where(np.arange(n_knots) % 2 == 0, 1.0, -1.0)
    starts = [lin, [0.0] * n_knots + [d0], list(np.asarray(lin[:-1]) + wiggle) + [d0]]
    span = BOUNDS["alpha0"][1] + 0.5 * BOUNDS["alpha1"][1]          # same pitch range as the linear law
    bounds = [(-span, span)] * n_knots + [BOUNDS["delta"]]
    cons = [{"type": "ineq", "fun": lambda z: ev(*z).r_min - case.rho}]
    best, x, tried = None, None, []
    for x0 in starts:
        r = minimize(lambda z: _objective(ev(*z)), np.array(x0, float), method="SLSQP", bounds=bounds,
                     constraints=cons, options={"ftol": 1e-12, "maxiter": 400, "eps": 1e-6})
        e = ev(*r.x)
        feas = (e.r_min >= case.rho - 1e-7) and not e.impacted
        tried.append(dict(x0=[float(v) for v in x0], x=[float(v) for v in r.x], eta=e.eta, feasible=bool(feas),
                          message=str(r.message)))
        if feas and (best is None or e.eta_W > best.eta_W):
            best, x = e, [float(v) for v in r.x]
    if best is None:
        raise RuntimeError("no feasible piecewise optimum")
    return PiecewiseResult(
        case={**asdict(case), "Pi": case.Pi, "v_inf_over_vesc": case.v_inf / math.sqrt(2.0),
              "dv_over_vp": case.dv / case.v_p, "dv_over_c": case.dv / case.c},
        knots=tuple(x[:-1]), delta=x[-1], eta_fixed=best.eta,
        eta_achieved=eta_against_periapsis(case, best.eta, best.r_min), r_min=best.r_min, eta_err=best.eta_err,
        n_sims=ev.n_sims, starts=tried)


__all__ = ["OptCase", "OptResult", "PiecewiseResult", "optimize_case", "optimize_piecewise", "timing_theory_delta",
           "timing_theory_fraction", "timing_half_dv_delta", "timing_rule_capture", "timing_rule_extra_loss",
           "x_centroid", "x_median", "eta_against_periapsis", "R_FLOOR", "theory"]
