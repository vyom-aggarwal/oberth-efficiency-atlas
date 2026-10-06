"""Independent cross-check of the engine-comparison animation numbers → figures/anim_numbers.json.

The animation (scripts/anim_engines.py) reports the equivalent-Δv loss of each engine on Hibberd et al.'s
solar dive. Here the same three cases are re-simulated (no rendering) and compared with theory:
- solid stack (Π ≈ 0.033) and nuclear thermal (Π ≈ 1.7): the leading-order bound loss/Δv = Π²/96 and the
  exact leading-order loss of the actual thrust profile (staged.leading_order_loss). Past Π ≈ 1 the true
  curve bends below the Π² law, so the nuclear-thermal case should sit below both.
- SEP-class (Π ≈ 368): the regime-II (parabolic-core) law η_lin ≈ (9/(2Π))^(1/3) for the kept fraction.
Note: the arrival is bound, so η (defined through v∞,in) is undefined here. The animation reports the
equivalent-Δv loss; its complement (the equivalent-Δv kept fraction) and the energy-gain fraction
Δε_fin/Δε_imp are both compared with the regime-II law, which is the Δv → 0 limit of either.
Run:  .venv/Scripts/python scripts/anim_numbers.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import anim_engines as A  # noqa: E402  (the animation's own case definitions)
from oberth_atlas.staged import leading_order_loss, simulate_staged_nd  # noqa: E402


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    cases, S, vp, dv = A.build_cases()
    out = {}
    for (title, stages), key in zip(cases, ("solid_stack", "nuclear_thermal", "sep_class")):
        r = simulate_staged_nd(vp, stages)
        eps_imp = 0.5 * (vp + r.dv_rocket) ** 2 - 1.0
        row = {"Pi": r.Pi, "Pi_eff": r.Pi_eff, "loss_rel": r.dv_loss_rel, "loss_m_s": r.dv_loss * S.velocity,
               "burn_s": r.duration * S.time,
               "energy_gain_fraction": (r.eps_out - r.eps0) / (eps_imp - r.eps0),
               "kept_fraction_equivalent_dv": 1.0 - r.dv_loss_rel,
               "rule_Pi2_over_96": r.Pi**2 / 96.0,
               "leading_order_exact": leading_order_loss(vp, stages) / r.dv_rocket}
        row["sim_over_rule"] = row["loss_rel"] / row["rule_Pi2_over_96"]
        row["sim_over_leading_order"] = row["loss_rel"] / row["leading_order_exact"]
        if key == "sep_class":
            law = (9.0 / (2.0 * r.Pi)) ** (1.0 / 3.0)
            row["regime_II_law"] = law
            row["kept_over_regime_II"] = row["kept_fraction_equivalent_dv"] / law
            row["energy_fraction_over_regime_II"] = row["energy_gain_fraction"] / law
        out[key] = row
    out["note"] = ("Loss is the equivalent-Δv loss (bound arrival: η undefined); it is not identical to 1 − η. "
                   "Regime-II law (9/(2Π))^(1/3) is the Δv → 0, constant-acceleration limit for near-parabolic arrival.")
    (ROOT / "figures" / "anim_numbers.json").write_text(json.dumps(out, indent=1, ensure_ascii=False), encoding="utf-8")
    for k, v in out.items():
        if isinstance(v, dict):
            print(k, {kk: (round(vv, 5) if isinstance(vv, float) else vv) for kk, vv in v.items()})


if __name__ == "__main__":
    main()
