"""Build the self-contained interactive explorer: explorer/oberth_explorer.html.

Inlines explorer/app.css, explorer/sim.js (the validated JS simulator), the embedded data and
explorer/app.js into explorer/template.html. The embedded data (explorer/explorer_data.json, cached):
- curve: the universal loss-vs-Π band for a near-parabolic solar Oberth burn (results/phase4.parquet,
  as in the hero figure), plus its centre line;
- atlas: linear-response η (prograde, Δv → 0, constant acceleration, centred) on a (Π, v∞/v_esc) grid,
  from theory.linear_response_eta;
- bodies: GM, equatorial radius, sphere of influence and the periapsis/v∞ envelopes (constants.py,
  configs/atlas/presets.yaml); engines: Isp and a0 ranges (presets), plus a solid-motor class.
Also writes the publish fragment (no document skeleton) to the path given by --fragment.
Run:  .venv/Scripts/python scripts/build_explorer.py [--recompute] [--fragment PATH]
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import yaml

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from oberth_atlas import theory  # noqa: E402
from oberth_atlas.constants import BODIES, G0  # noqa: E402

EXP = ROOT / "explorer"
DATA = EXP / "explorer_data.json"
SOLID = {"label": "Solid motor (STAR 48B class)", "isp_s": [286.0, 292.0], "a0_m_s2": [10.0, 60.0],
         "note": "STAR 48B: 67 kN on a 2.7 t stage-plus-payload ≈ 25 m/s² (NG catalog, 2016)"}


def make_data() -> dict:
    import fig_hero as H
    p = pd.read_parquet(ROOT / "results" / "phase4.parquet")
    curves = H.profile_curves(p)
    x = np.logspace(-3, np.log10(3000), 160)
    Y = np.vstack([H.on_grid(c, x) for c in curves.values()])
    lo, hi = np.nanmin(Y, axis=0), np.nanmax(Y, axis=0)
    pis = np.logspace(-2, 3, 41)
    vrs = np.logspace(-2, 1, 25)
    eta = [[theory.linear_response_eta(vr * math.sqrt(2.0), float(P)) for P in pis] for vr in vrs]
    pre = yaml.safe_load((ROOT / "configs" / "atlas" / "presets.yaml").read_text(encoding="utf-8"))
    bodies = {}
    for key, b in BODIES.items():
        env = pre["bodies"][key]
        bodies[key] = {"name": key.capitalize(), "gm": b.gm, "radius": b.radius_eq,
                       "soi": None if not math.isfinite(b.soi_radius) else b.soi_radius,
                       "rp_over_R": env.get("r_p_over_R"), "altitude_km": env.get("altitude_km"),
                       "v_inf_km_s": env["v_inf_km_s"]}
    engines = {k: {"label": v["label"], "isp_s": v["isp_s"], "a0_m_s2": v["a0_m_s2"]} for k, v in pre["engines"].items()}
    engines["solid"] = SOLID
    return {
        "curve": {"Pi": x.tolist(), "lo": lo.tolist(), "hi": hi.tolist(), "mid": np.sqrt(lo * hi).tolist()},
        "atlas": {"Pi": pis.tolist(), "v_over_vesc": vrs.tolist(), "eta": eta},
        "bodies": bodies, "engines": engines, "g0": G0, "dv_km_s": pre["delta_v_km_s"],
        "source": "results/phase4.parquet; theory.linear_response_eta; constants.py; configs/atlas/presets.yaml",
    }


def build(data: dict, full_document: bool) -> str:
    tpl = (EXP / "template.html").read_text(encoding="utf-8")
    css = (EXP / "app.css").read_text(encoding="utf-8")
    sim = (EXP / "sim.js").read_text(encoding="utf-8")
    app = (EXP / "app.js").read_text(encoding="utf-8")
    body = (tpl.replace("/*__CSS__*/", css)
               .replace("/*__SIM__*/", sim)
               .replace("/*__DATA__*/", "window.EXPLORER_DATA = " + json.dumps(data, separators=(",", ":")) + ";")
               .replace("/*__APP__*/", app))
    if not full_document:
        return body
    head, rest = body.split("<!--__BODY__-->", 1)
    return ("<!doctype html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n"
            "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1, viewport-fit=cover\">\n"
            + head + "</head>\n<body>\n" + rest + "\n</body>\n</html>\n")


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("--recompute", action="store_true")
    ap.add_argument("--fragment", type=Path)
    a = ap.parse_args()
    if a.recompute or not DATA.exists():
        DATA.write_text(json.dumps(make_data(), indent=0), encoding="utf-8")
    data = json.loads(DATA.read_text(encoding="utf-8"))
    (EXP / "oberth_explorer.html").write_text(build(data, True), encoding="utf-8")
    if a.fragment:
        a.fragment.write_text(build(data, False).replace("<!--__BODY__-->", ""), encoding="utf-8")
    print("wrote explorer/oberth_explorer.html", f"({(EXP / 'oberth_explorer.html').stat().st_size / 1e3:.0f} kB)")


if __name__ == "__main__":
    main()
