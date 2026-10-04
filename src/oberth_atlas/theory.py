"""Analytic approximations for the Oberth efficiency η (nondimensional units: μ = r_p = 1).

Prior work: the small-Π loss scaling (ω t_b)²Δv/24 with ω² = μ/r³ (= kΠ²Δv/24 here) is due to
Robbins (1966, AIAA J. 4(8):1417), as quoted by Confraria (2020). This module extends it to
prograde steering, finite Δv/v_p, the rocket thrust profile, any apse, and hyperbolic flybys
(RELATED_WORK.md).

Notation: v = ṽ∞, v_p = sqrt(v² + 2), k = 1/v_p² (= μ/(r_p v_p²)), τ = 1/v_p, Π = t_b/τ.
The burn runs over t ∈ [t_s, t_s + t_b] with t_s = −x_c·t_b (x_c = 1/2 is centered on periapsis).
The thrust profile of a constant-thrust rocket, in normalized time x = (t − t_s)/t_b ∈ [0, 1], is
    f(x) = (μ_r/λ) / (1 − μ_r x),   λ = Δv/c,   μ_r = 1 − e^(−λ)   (∫f = 1; f ≡ 1 as c → ∞),
with accumulated Δv fraction F(x) = −ln(1 − μ_r x)/λ.

1. Linear response (Δv → 0, any Π). To first order in the thrust, the trajectory is the unperturbed
   hyperbola v_u(t), and
       η_lin = ⟨û·v_u − v∞⟩_f / (v_p − v∞),
   the thrust-weighted mean "speed excess along the thrust" over the burn window. η_lin depends
   only on (ṽ∞, Π) and the profile shape, so it is a universal curve per v∞/v_esc.

2. Small-Π prefactor, keeping first-order finite-Δv terms (derivation in docs/theory.md):
       1 − η ≈ C Π²,   C = D₂ / (v∞,imp · B_imp),
       D₂ = ½k(1−k) v_p Δv m₂ + k(1+k) Δv² j
            + s·[ ½k² ((v_p + Δv) Δv m₂ − 2 Δv² m₂F) + k² Δv² e ],
   with s = 0 (prograde) or 1 (inertial) and profile moments
       m₂ = ∫ f (x−x_c)²,   j = ∫ f(x) ∫₀ˣ (x−x′) F(x′) dx′ dx,   m₂F = ∫ f (x−x_c)² F,
       e = ∫ f(x) ∫₀ˣ (x−x′) f(x′)(x′−x_c) dx′ dx.
   For a constant-acceleration centered burn (m₂ = 1/12, j = m₂F = 1/24, e = −1/24):
       prograde: D₂ = (k/24) Δv [(1−k) v_p + (1+k) Δv]
       inertial: D₂ = (k/24) Δv (v_p + Δv)

3. Large-Π asymptotes of η_lin (prograde, constant profile, centered):
   - Parabolic core, 1 ≪ Π ≪ Π_T (exists only when v∞ ≪ v_esc): r ∝ t^(2/3) and the speed
     excess ∝ r^(−1/2), so η_lin ≈ (9/(2Π))^(1/3).
   - Hyperbolic tail, Π ≫ Π_T = v_p/v∞³ (the ratio of the hyperbola's crossing time
     |a|/v∞ = μ/v∞³ to τ). The speed excess ∝ 1/r ∝ 1/|t|, so
         η_lin ≈ 2 v_p [ln(v∞³ t_b / e) − Σ(e)] / (v∞² (v_p − v∞) Π),   t_b = Π/v_p,
     where Σ(e) = ∫ (½ − v∞/(|v_u| + v∞)) dH over the whole hyperbola (H = hyperbolic anomaly).

4. Energy vs speed efficiency. Linear response applies to the baseline-subtracted energy efficiency
       η_W = (Δε_fin − Δε_deep)/(Δε_imp − Δε_deep),  Δε_deep = v∞Δv + Δv²/2,  Δε_imp − Δε_deep = Δv(v_p − v∞),
   not to η directly. The two are related exactly by
       η = (sqrt(1 + ξ η_W) − 1)/(sqrt(1 + ξ) − 1),   ξ = 2Δv(v_p − v∞)/(v∞ + Δv)²,
   because v∞,out = sqrt((v∞ + Δv)² + 2(W − W_deep)).
"""

from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np
from scipy.integrate import quad

from . import kepler, metrics

_GL_X, _GL_W = np.polynomial.legendre.leggauss(96)
_GL_X = 0.5 * (_GL_X + 1.0)      # nodes on [0, 1]
_GL_W = 0.5 * _GL_W


# ---------------------------------------------------------------- thrust profile and its moments

def _profile(lam: float):
    """(f, F) for the constant-thrust rocket profile with λ = Δv/c (λ = 0: constant acceleration)."""
    if lam < 1e-12:
        return (lambda x: np.ones_like(x)), (lambda x: np.asarray(x, dtype=float))
    mu_r = -math.expm1(-lam)

    def f(x):
        return (mu_r / lam) / (1.0 - mu_r * np.asarray(x))

    def F(x):
        return -np.log1p(-mu_r * np.asarray(x)) / lam

    return f, F


@dataclass(frozen=True)
class ProfileMoments:
    m2: float     # ∫ f (x − x_c)²
    j: float      # ∫ f(x) ∫_0^x (x − x′) F(x′) dx′ dx
    m2F: float    # ∫ f (x − x_c)² F
    e: float      # ∫ f(x) ∫_0^x (x − x′) f(x′)(x′ − x_c) dx′ dx


def profile_moments(lam: float, x_c: float = 0.5) -> ProfileMoments:
    """Moments of the thrust profile (96-point Gauss–Legendre; the integrands are smooth on [0, 1])."""
    f, F = _profile(lam)
    x, w = _GL_X, _GL_W
    fx, Fx = f(x), F(x)
    # Q(x′) = ∫_{x′}^1 f(x)(x − x′) dx, so that j = ∫ F Q and e = ∫ f (x − x_c) Q (order swapped).
    xs = x[:, None] + (1.0 - x[:, None]) * x[None, :]          # nodes on [x′, 1] for each x′
    Q = (1.0 - x) * np.sum(w[None, :] * f(xs) * (xs - x[:, None]), axis=1)
    return ProfileMoments(
        m2=float(np.sum(w * fx * (x - x_c) ** 2)),
        j=float(np.sum(w * Fx * Q)),
        m2F=float(np.sum(w * fx * (x - x_c) ** 2 * Fx)),
        e=float(np.sum(w * fx * (x - x_c) * Q)),
    )


# ---------------------------------------------------------------- small-Π prefactor

def _j_exact(lam: float, v_p: float, dv: float) -> float:
    """j with the flight-path turn rate kept to all orders in Δv:
    ∫ F(x′) [1 + 1/(v_p (v_p + Δv F(x′)))] Q(x′) dx′ / (1 + k). It equals j as Δv → 0."""
    f, F = _profile(lam)
    x, w = _GL_X, _GL_W
    xs = x[:, None] + (1.0 - x[:, None]) * x[None, :]
    Q = (1.0 - x) * np.sum(w[None, :] * f(xs) * (xs - x[:, None]), axis=1)
    Fx = F(x)
    k = 1.0 / v_p**2
    return float(np.sum(w * Fx * (1.0 + 1.0 / (v_p * (v_p + dv * Fx))) * Q)) / (1.0 + k)


def small_pi_deficit(v_inf: float, dv: float, c: float = math.inf, steering: str = "prograde",
                     x_c: float = 0.5, exact_dv: bool = True) -> float:
    """D₂ = (W_imp − W_finite)/Π² to leading order in Π, for a burn about a hyperbola's periapsis.

    exact_dv=True keeps the speed dependence of the flight-path turn rate, ω(v) = v/r − μ/(r² v),
    exactly along a *prograde* burn (all orders in Δv). False uses its first-order form
    (1 + k)Δv_acc, which gives the closed-form prefactors in the module docstring.

    For inertial (fixed-direction) thrust, the first-order form is already exact. The equations
    of motion are linear in the thrust vector up to O(t_b²), so W = ∫ A·v dt is exactly quadratic
    in Δv at O(Π²). Applying the ω(v) correction there would double-count, so exact_dv is ignored.
    """
    return small_pi_deficit_apse(metrics.periapsis_speed(1.0, 1.0, v_inf), dv, c, steering, x_c, exact_dv)


def small_pi_deficit_apse(v_apse: float, dv: float, c: float = math.inf, steering: str = "prograde",
                          x_c: float = 0.5, exact_dv: bool = True) -> float:
    """D₂ for a burn about an apse of ANY conic, with radius r = 1 and speed v_apse (units of sqrt(μ/r)).

    k = 1/v_apse² covers every case:
    - hyperbolic periapsis: k < ½;
    - parabolic periapsis: k = ½;
    - elliptic periapsis: ½ < k < 1;
    - circular orbit: k = 1;
    - elliptic apoapsis: k > 1.

    The derivation (docs/theory.md, section 4) uses only γ = 0 at the expansion point, so it holds
    unchanged. Π is t_b·v_apse/r, as for a flyby.
    """
    s = _steering_flag(steering)
    v_p = v_apse
    k = 1.0 / v_p**2
    lam = dv / c if math.isfinite(c) else 0.0
    mom = profile_moments(lam, x_c)
    j = _j_exact(lam, v_p, dv) if (exact_dv and s == 0) else mom.j
    d = 0.5 * k * (1 - k) * v_p * dv * mom.m2 + k * (1 + k) * dv**2 * j
    if s:
        d += 0.5 * k**2 * ((v_p + dv) * dv * mom.m2 - 2.0 * dv**2 * mom.m2F) + k**2 * dv**2 * mom.e
    return d


def small_pi_prefactor(v_inf: float, dv: float, c: float = math.inf, steering: str = "prograde",
                       x_c: float = 0.5, exact_dv: bool = True) -> float:
    """C in 1 − η ≈ C Π² (finite-Δv-corrected theory)."""
    d = small_pi_deficit(v_inf, dv, c, steering, x_c, exact_dv)
    return d / (metrics.v_inf_impulsive(1.0, 1.0, v_inf, dv) * metrics.oberth_bonus_impulsive(1.0, 1.0, v_inf, dv))


def robbins_loss_per_pi2(v_apse: float, dv: float) -> float:
    """Robbins' (1966) finite-burn loss expression, (1/24)(ω_s t_b)² Δv with ω_s² = μ/r³, divided by Π².

    In our variables (ω_s t_b)² = k Π², so this is kΔv/24 (units of sqrt(μ/r)). The form is as
    quoted by Confraria (2020, eq. 2.17), who describes it as an upper bound on the extra Δv. The
    original paper (AIAA J. 4(8):1417–1423, doi:10.2514/3.3687) was not accessible (RELATED_WORK.md).
    """
    return dv / (24.0 * v_apse**2)


def equivalent_dv_loss_per_pi2(v_apse: float, dv: float, c: float = math.inf, steering: str = "prograde",
                               x_c: float = 0.5) -> float:
    """Leading-order extra Δv a finite burn needs to match the impulsive burn's final energy, divided
    by Π². This is D₂/(v_apse + Δv), since the marginal work per unit Δv at burnout is v_apse + Δv.
    It is the quantity Robbins' expression bounds.

    For constant-acceleration fixed-direction thrust centered on the apse it equals kΔv/24 exactly,
    i.e. Robbins' expression. For prograde thrust it is smaller, by [(1−k)v + (1+k)Δv]/(v + Δv) at
    first order in Δv.
    """
    return small_pi_deficit_apse(v_apse, dv, c, steering, x_c) / (v_apse + dv)


def small_pi_prefactor_user(v_inf: float, dv: float, steering: str = "prograde") -> float:
    """The user's hand-derived prefactor (constant acceleration, unperturbed trajectory):
    C = [k(1−k) + s k²] v_p Δv / (24 v∞,imp B_imp).

    Its inertial case (s = 1) is Robbins' (1966) expression kΠ²Δv/24, turned into an energy
    deficit with the pre-burn speed v_p. The exact conversion uses v_p + Δv, which accounts for
    the factor v_p/(v_p + Δv) in its error (RESEARCH_LOG, literature review).
    """
    s = _steering_flag(steering)
    v_p = metrics.periapsis_speed(1.0, 1.0, v_inf)
    k = 1.0 / v_p**2
    num = (k * (1 - k) + s * k**2) * v_p * dv
    return num / (24.0 * metrics.v_inf_impulsive(1.0, 1.0, v_inf, dv) * metrics.oberth_bonus_impulsive(1.0, 1.0, v_inf, dv))


# ---------------------------------------------------------------- linear response (Δv → 0)

def linear_response_eta(v_inf: float, Pi: float, steering: str = "prograde", lam: float = 0.0,
                        x_c: float = 0.5) -> float:
    """η in the limit Δv → 0 at fixed Π: ⟨û·v_u − v∞⟩_f / (v_p − v∞) over the unperturbed hyperbola.

    lam = Δv/c sets the profile shape (0: constant acceleration). Integrated in hyperbolic anomaly H,
    with dt = (r/v∞) dH, so that months-long burns (|H| ~ 20) cost the same as short ones.
    """
    s = _steering_flag(steering)
    v = v_inf
    em1 = kepler.hyperbola_em1(1.0, 1.0, v)
    e = 1.0 + em1
    sq = math.sqrt(em1 * (em1 + 2.0))
    v_p = metrics.periapsis_speed(1.0, 1.0, v)
    n = v**3
    t_b = Pi / v_p
    t_s = -x_c * t_b
    f, _ = _profile(lam)
    H_s = kepler.solve_kepler_hyperbolic(n * t_s, em1)
    H_e = kepler.solve_kepler_hyperbolic(n * (t_s + t_b), em1)

    def integrand(H):
        t = (e * math.sinh(H) - H) / n
        w = float(f((t - t_s) / t_b)) / t_b
        s2 = 2.0 * math.sinh(0.5 * H) ** 2                     # cosh H − 1
        r = (em1 + e * s2) / v**2
        if s == 0:
            speed = math.sqrt(v**2 + 2.0 / r)
            return w * (2.0 / v) / (speed + v)                 # (|v_u| − v∞)·dt/dH
        # inertial: (v_y − v∞)·dt/dH = [1 − (e − √(e²−1)) cosh H] / v²
        return w * (1.0 - (e - sq) * (1.0 + s2)) / v**2

    pts = [0.0] if H_s < 0.0 < H_e else None
    val, _ = quad(integrand, H_s, H_e, points=pts, limit=400, epsabs=0.0, epsrel=1e-12)
    return val / (v_p - v)


def large_pi_sigma(v_inf: float) -> float:
    """Σ(e) = ∫_{−∞}^{∞} (½ − v∞/(|v_u| + v∞)) dH for the hyperbola with excess speed v_inf."""
    v = v_inf
    em1 = kepler.hyperbola_em1(1.0, 1.0, v)
    e = 1.0 + em1

    def g(H):
        r = (em1 + e * 2.0 * math.sinh(0.5 * H) ** 2) / v**2
        return 0.5 - v / (math.sqrt(v**2 + 2.0 / r) + v)

    # The integrand decays like e^(−H); beyond H = 80 it is < 1e-30 (and sinh would overflow at ~710).
    val, _ = quad(g, 0.0, 80.0, limit=400, epsabs=0.0, epsrel=1e-12)
    return 2.0 * val


def large_pi_asymptote(v_inf: float, Pi: float) -> float:
    """Leading large-Π form of η_lin (prograde, constant profile, centered): ~ (ln Π − const)/Π."""
    v = v_inf
    v_p = metrics.periapsis_speed(1.0, 1.0, v)
    e = 1.0 + kepler.hyperbola_em1(1.0, 1.0, v)
    t_b = Pi / v_p
    return 2.0 * (math.log(v**3 * t_b / e) - large_pi_sigma(v)) / (v**2 * t_b * (v_p - v))


def _steering_flag(steering: str) -> int:
    if steering not in ("prograde", "inertial"):
        raise ValueError(f"theory covers 'prograde' and 'inertial' steering, got {steering!r}")
    return 0 if steering == "prograde" else 1


def parabolic_core_asymptote(Pi: float) -> float:
    """Intermediate-Π form of η_lin for v∞ ≪ v_esc: (9/(2Π))^(1/3) (valid for 1 ≪ Π ≪ v_p/v∞³)."""
    return (4.5 / Pi) ** (1.0 / 3.0)


def tail_crossover_pi(v_inf: float) -> float:
    """Π_T = v_p/v∞³: the burn length (in units of τ) beyond which the hyperbolic 1/r tail dominates."""
    return metrics.periapsis_speed(1.0, 1.0, v_inf) / v_inf**3


def xi_parameter(v_inf: float, dv: float) -> float:
    """ξ = 2Δv(v_p − v∞)/(v∞ + Δv)²: how nonlinear the map from η_W to η is (ξ → 0: η = η_W)."""
    v_p = metrics.periapsis_speed(1.0, 1.0, v_inf)
    return 2.0 * dv * (2.0 / (v_p + v_inf)) / (v_inf + dv) ** 2


def eta_from_eta_W(eta_W: float, v_inf: float, dv: float) -> float:
    """Exact map from the baseline-subtracted energy efficiency η_W to the speed efficiency η."""
    xi = xi_parameter(v_inf, dv)
    arg = 1.0 + xi * eta_W
    if arg < 0:
        return math.nan                       # bound outgoing orbit: v∞,out undefined
    return math.expm1(0.5 * math.log1p(xi * eta_W)) / math.expm1(0.5 * math.log1p(xi))


def eta_W_from_energy(delta_eps_finite: float, v_inf: float, dv: float) -> float:
    """η_W = (Δε_fin − Δε_deep)/(Δε_imp − Δε_deep) (nondimensional inputs)."""
    v_p = metrics.periapsis_speed(1.0, 1.0, v_inf)
    return (delta_eps_finite - dv * (v_inf + 0.5 * dv)) / (dv * 2.0 / (v_p + v_inf))
