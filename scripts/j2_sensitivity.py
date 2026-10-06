"""J2 sensitivity: does oblateness change η? → figures/j2_numbers.json and figures/j2_cases.csv.

Ten cases (design logged 2026-10-06 before running): Jupiter and Saturn at r_p = 1.1 R, v∞ = 6 km/s,
Δv = 1 km/s, Isp 900 s, prograde, burn centred on the J2 trajectory's periapsis.
- equatorial flybys (pole along the orbit normal) at Π = 0.1, 1, 10, 100, for both planets;
- polar flybys at Jupiter (pole in the orbit plane, periapsis over the equator) at Π = 1, 10.
Each case runs twice through the same code (oberth_atlas.j2.simulate_j2): with J2 and with J2 = 0.
Run:  .venv/Scripts/python scripts/j2_sensitivity.py
"""

from __future__ import annotations

import csv
import json
import math
import sys
from pathlib import Path

from oberth_atlas.constants import G0, J2, JUPITER, SATURN
from oberth_atlas.j2 import simulate_j2
from oberth_atlas.units import Scales

ROOT = Path(__file__).resolve().parents[1]
RP_OVER_R, V_INF, DV, ISP = 1.1, 6000.0, 1000.0, 900.0
CASES = ([(b, Pi, "equatorial") for b in (JUPITER, SATURN) for Pi in (0.1, 1.0, 10.0, 100.0)]
         + [(JUPITER, Pi, "polar") for Pi in (1.0, 10.0)])
POLES = {"equatorial": (0.0, 0.0, 1.0), "polar": (0.0, 1.0, 0.0)}


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    rows = []
    for body, Pi, geom in CASES:
        r_p = RP_OVER_R * body.radius_eq
        S = Scales(body.gm, r_p)
        v, dv, c = V_INF / S.velocity, DV / S.velocity, ISP * G0 / S.velocity
        vp = math.sqrt(v * v + 2.0)
        t_b = Pi / vp
        a0 = (c / t_b) * -math.expm1(-dv / c)
        j2rho2 = J2[body.name] / RP_OVER_R**2
        pm = simulate_j2(v, dv, c, a0, 0.0, POLES[geom])
        j2 = simulate_j2(v, dv, c, a0, j2rho2, POLES[geom])
        rows.append(dict(body=body.name, geometry=geom, Pi=Pi, eta_point_mass=pm.eta, eta_j2=j2.eta,
                         delta_eta=j2.eta - pm.eta, rel_delta_eta=(j2.eta - pm.eta) / pm.eta,
                         rel_delta_deficit=-(j2.eta - pm.eta) / (1.0 - pm.eta),
                         r_periapsis_j2_over_rp=j2.r_periapsis, energy_balance=max(pm.energy_balance, j2.energy_balance),
                         v_inf_out_impulsive_shift_m_s=(j2.v_inf_out_impulsive - pm.v_inf_out_impulsive) * S.velocity))
        print({k: (f"{v_:.6g}" if isinstance(v_, float) else v_) for k, v_ in rows[-1].items()}, flush=True)
    worst = max(rows, key=lambda r: abs(r["delta_eta"]))
    out = {"cases": rows,
           "max_abs_delta_eta": abs(worst["delta_eta"]), "max_abs_rel_delta_eta": max(abs(r["rel_delta_eta"]) for r in rows),
           "max_rel_delta_deficit": max(r["rel_delta_deficit"] for r in rows),
           "rel_delta_deficit_by_Pi_equatorial": {f"Pi={p:g}": max(r["rel_delta_deficit"] for r in rows
                                                                  if r["Pi"] == p and r["geometry"] == "equatorial")
                                                  for p in (0.1, 1.0, 10.0, 100.0)},
           "worst_case": {k: worst[k] for k in ("body", "geometry", "Pi")},
           "max_energy_balance": max(r["energy_balance"] for r in rows),
           "setup": {"r_p_over_R": RP_OVER_R, "v_inf_m_s": V_INF, "dv_m_s": DV, "isp_s": ISP,
                     "J2": {b: J2[b] for b in ("jupiter", "saturn")}}}
    (ROOT / "figures" / "j2_numbers.json").write_text(json.dumps(out, indent=1), encoding="utf-8")
    with (ROOT / "figures" / "j2_cases.csv").open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)
    print(f"max |Δη| = {out['max_abs_delta_eta']:.3g} ({worst['body']}, {worst['geometry']}, Π = {worst['Pi']:g}); "
          f"max |Δη/η| = {out['max_abs_rel_delta_eta']:.3g}")


if __name__ == "__main__":
    main()
