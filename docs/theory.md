# Analytic theory of the finite-burn Oberth efficiency

Implemented in `src/oberth_atlas/theory.py`, tested in `tests/test_theory.py`.

**Prior work** (details in RELATED_WORK.md):
- **Robbins (1966).** The leading-order loss scaling (ω t_b)²Δv/24 with ω² = μ/r³, which is
  kΠ²Δv/24 in our variables, is due to Robbins (AIAA J. 4(8):1417–1423), as quoted by Confraria
  (2020). We could not access the original. In section 4 below:
  - for fixed-direction thrust at an apse, the equivalent-Δv loss D/(v + Δv) *equals* Robbins'
    expression at leading order;
  - prograde thrust comes in below it;
  - the derivation holds at an apse of any conic (`small_pi_deficit_apse`).
- **Willis (1966).** The nondimensionalization (radius, circular speed, local gravity at the
  reference apse) follows the same scheme Willis used for finite-thrust escape/capture charts
  (NASA TN D-3606).
Units are nondimensional throughout: μ = r_p = 1, so V = 1, g_p = μ/r_p² = 1, τ = 1/v_p.

## 1. Notation

| symbol | meaning |
|---|---|
| v (or v∞) | incoming excess speed ṽ∞ |
| v_p = √(v² + 2) | unperturbed periapsis speed |
| k = 1/v_p² | μ/(r_p v_p²); k ∈ (0, ½] |
| Π = t_b/τ = t_b v_p | burn parameter |
| t_s = −x_c t_b | burn start; x_c = ½ is a burn centered on periapsis |
| f(x), x ∈ [0,1] | normalized thrust-acceleration profile, ∫f = 1 |
| F(x) = ∫₀ˣ f | fraction of Δv delivered |

For a constant-thrust rocket with λ = Δv/c and μ_r = 1 − e^(−λ):

> f(x) = (μ_r/λ)/(1 − μ_r x),  F(x) = −ln(1 − μ_r x)/λ.

As λ → 0 these become f ≡ 1 and F = x (constant acceleration).

## 2. Exact energy bookkeeping

Along any burn, dε/dt = a û·v, so ε_out = ε_in + W with W = ∫ a û·v dt. That gives three reference
values of W and one exact identity:

- **Deep space:** W_deep = vΔv + Δv²/2.
- **Impulsive at periapsis:** W_imp = v_pΔv + Δv²/2.
- **Baseline-subtracted energy efficiency:**
  > η_W ≡ (W − W_deep)/(W_imp − W_deep),  where W_imp − W_deep = Δv(v_p − v).
- **Speed efficiency:** since v∞,out = √((v + Δv)² + 2(W − W_deep)), the brief's η = B_fin/B_imp is
  an exact function of η_W:
  > η = (√(1 + ξη_W) − 1)/(√(1 + ξ) − 1),  ξ = 2Δv(v_p − v)/(v + Δv)².
  - For ξ ≪ 1, η ≈ η_W.
  - For ξ ≫ 1 (low v∞, large Δv), η ≈ √η_W.

## 3. Linear response (Δv → 0 at fixed Π)

To first order in the thrust, W is evaluated on the unperturbed hyperbola v_u(t):

> η_W → η_lin(Π) = ⟨û·v_u − v⟩_f / (v_p − v),

where ⟨·⟩_f is the thrust-weighted average over the burn window.

η_lin depends only on (v, Π, x_c) and the profile shape. So for each v∞/v_esc there is one
universal curve, valid at **every** Π. It is computed by quadrature in the hyperbolic anomaly
(dt = (r/v)dH), so months-long burns cost no more than short ones.

**Validated** (prograde): η_W(sim) − η_lin = O(Δv/v_p), with coefficient ≤ 0.25, for
v ∈ {0.05, 0.5, 2} and Π from 0.1 to 1e5.

## 4. Small-Π expansion (burn near periapsis, t = O(t_b))

### Prograde

Speed and flight-path angle (planar) obey:

> dv/dt = a − g sin γ,  dγ/dt = (v/r − g/v) cos γ.

**Step 1: the unperturbed expansions near periapsis.**
- γ̇ = ω_p ≡ v_p(1 − k).
- The speed falls quadratically: v_u = v_p − ½K t², with K = g_p ω_p = k(1 − k) v_p³.
  In SI this is K = k(1−k) v_p/τ², which confirms the user's (a).

**Step 2: what changes during the burn.** The speed is v_p + Δv_acc(t). That changes the turn rate:

> ω(v) = v − 1/v = ω_p + (1 + k)Δv_acc + O(Δv²).

**Step 3: collect the work deficit.** With W = ∫ a v dt, and r = 1 + O(t_b²) and sin γ = γ + O(t_b³):

> D ≡ W_imp − W = (K/2) ∫ a t² dt + g_p ∫ a(t) ∫_{t_s}^{t} (t − t′)[ω(v(t′)) − ω_p] dt′ dt + O(t_b⁴).

**Step 4: in profile moments**, using t_b² = kΠ²:

> D/Π² = ½ k(1−k) v_p Δv m₂ + k(1+k) Δv² j,

with

> m₂ = ∫ f (x − x_c)²,  j = ∫ f(x) ∫₀ˣ (x − x′) F(x′) dx′ dx.

- **Exact in Δv:** keeping ω(v) exact replaces (1+k)F by F·[1 + 1/(v_p(v_p + ΔvF))]
  (`exact_dv=True`).
- **Mass ratio:** handled exactly by the moments of f.
- **Burn timing:** enters only through m₂ = (variance of the Δv distribution) + (Δv centroid −
  periapsis)².

### Inertial (thrust fixed along ŷ, the periapsis velocity direction)

Here φ is the angle of the velocity from ŷ.

**The angle.** φ evolves as dφ/dt = (g/v) cos γ − (a/v) sin φ. This gives
φ ≈ (k/τ) t (1 − Δv_acc/v_p). The rotation rate k/τ confirms the user's (b).

**Three contributions to the deficit:**
1. **Cosine loss.** It feeds back into the later speed, so it is weighted by (v_p + Δv):
   > S = ½ k²Π² [(v_p + Δv) Δv m₂ − 2Δv² m₂F],  m₂F = ∫ f (x − x_c)² F.
2. **Sideways thrust component.** The term (a/v) sin φ adds to γ̇, which *reduces* the gravity loss:
   > k²Δv²Π² e,  e = ∫ f(x) ∫₀ˣ (x − x′) f(x′)(x′ − x_c) dx′ dx  (e = −1/24 for constant a).
3. **The prograde terms,** unchanged.

**Why this is exact in Δv.** With a fixed thrust vector, the equations of motion are linear in it up
to O(t_b²). So W = ∫ A·v dt is exactly quadratic in Δv at O(Π²), and the first-order
expression is exact there.

### Constant acceleration, centered burn

| | D/Π² |
|---|---|
| prograde | (k/24) Δv [(1−k) v_p + (1+k) Δv] |
| inertial | (k/24) Δv (v_p + Δv) |

Then **1 − η = C Π²**, with C = (D/Π²)/(v∞,imp B_imp).

### Comparison with the user's hand formula

The user's formula is C_user = [k(1−k) + s k²] v_p Δv/(24 v∞,imp B_imp). It evaluates the gravity
and steering losses on the unperturbed trajectory, so it omits:
- the speed-dependence of the turn rate during the burn: +k(1+k)Δv² (prograde);
- the (v_p + Δv) weighting of the cosine loss;
- the sideways-thrust term: net +kΔv² (inertial);
- the thrust profile (mass ratio).

Its relative error is therefore O(Δv/v_p) + O(μ_r²):

| case | C_user error | corrected theory error |
|---|---|---|
| Earth prograde (Δv/v_p = 0.088) | −19.5% | +1e-4 |
| Earth inertial | −8.4% | < 1e-4 |
| prograde, Δv/v_p = 1 | −70% | < 1e-6 |
| inertial, Δv/v_p = 1 | −50% | < 1e-6 |
| constant-a theory at Δv/c = 3 | — | −30% (exact moments: < 1e-4) |

The remaining discrepancy is the extraction noise of C from simulations, which scales as 1/Δv.

## 5. Large Π: three regimes (prograde, linear response)

The speed excess along the hyperbola is δ(t) = |v_u(t)| − v. The hyperbola has a second timescale,
the core-crossing time |a|/v = 1/v³. Its ratio to τ is

> **Π_T = v_p/v³**  (nondimensional; dimensionally Π_T = (μ/v∞³)/(r_p/v_p) = v_p V²/v∞³ = (v_p/V)(V/v∞)³).

**I. Impulsive, Π ≪ 1:** 1 − η = CΠ² (section 4).

**II. Parabolic core, 1 ≪ Π ≪ Π_T.** This regime exists only if v ≪ v_esc. On the near-parabolic
core, r ≈ (9t²/2)^(1/3) and δ ≈ √(2/r) ∝ t^(−1/3). This gives

> η_lin ≈ (9/(2Π))^(1/3) ≈ 1.65 Π^(−1/3).

**III. Hyperbolic tail, Π ≫ Π_T.** Here δ ≈ 1/(v² |t|), so the average picks up a logarithm:

> η_lin ≈ 2 v_p [ln(v³ t_b/e) − Σ(e)] / (v² (v_p − v) Π),  t_b = Π/v_p,
> Σ(e) = ∫ (½ − v/(|v_u| + v)) dH over the whole hyperbola.

**Inertial at large Π.** η_lin tends to the far-field misalignment limit
v(cos(δ/2) − 1)/(v_p − v) < 0. Linear response also fails earlier for inertial thrust, once the
sideways displacement ~Δv·t_b becomes comparable to r_p, because the flyby geometry itself changes.
