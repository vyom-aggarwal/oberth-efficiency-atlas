"""The explorer's JavaScript simulator (explorer/sim.js) reproduces the Python simulator.

Ten reference cases span Π (0.01–100), v∞/v_esc (0.03–3), Δv/v_p (0.01–0.3), Δv/c (0.1–3) and both
steering laws. Stated tolerances (DP5(4) at rtol = atol = 1e-12 in JS, DOP853 at 1e-12 in Python):
  |Δη| ≤ 1e-8,  |Δv∞,out|/v∞,out ≤ 1e-9,  |Δr_min| ≤ 1e-8 (units of r_p),  |Δ(loss/Δv)| ≤ 1e-8.
Measured maxima (2026-10-05): 2.0e-10, 5.4e-11, 2.7e-10, 1.1e-10. Skipped when node is not installed.
"""

import json
import math
import shutil
import subprocess
from pathlib import Path

import pytest

from oberth_atlas.optimize import OptCase
from oberth_atlas.simulate import simulate_nd
from oberth_atlas.steering import InertialFixed, Prograde

ROOT = Path(__file__).resolve().parents[1]
NODE = shutil.which("node")
pytestmark = pytest.mark.skipif(NODE is None, reason="node is not installed")

# (Π, v∞/v_esc, Δv/v_p, Δv/c, steering)
CASES = [
    (0.01, 0.3, 0.03, 0.1, "prograde"),
    (0.1, 0.03, 0.01, 0.3, "prograde"),
    (0.3, 1.0, 0.03, 1.0, "prograde"),
    (1.0, 0.1, 0.1, 1.0, "prograde"),
    (3.0, 3.0, 0.3, 3.0, "prograde"),
    (10.0, 0.3, 0.03, 0.1, "prograde"),
    (30.0, 1.0, 0.1, 1.0, "prograde"),
    (100.0, 0.1, 0.03, 0.3, "prograde"),
    (1.0, 0.3, 0.03, 1.0, "inertial"),
    (10.0, 3.0, 0.1, 0.3, "inertial"),
]
TOL = {"eta": 1e-8, "v_inf_out_rel": 1e-9, "r_min": 1e-8, "loss_rel": 1e-8}


def run_js(params: list[dict]) -> list[dict]:
    code = ("const S = require(process.argv[1]);"
            "const cases = JSON.parse(require('fs').readFileSync(0, 'utf8'));"
            "process.stdout.write(JSON.stringify(cases.map(c => {"
            " if (c.targets) return S.fromTargets(...c.targets);"
            " const r = S.simulate(c);"
            " return {eta: r.eta, v_inf_out: r.v_inf_out, r_min: r.r_min, loss_rel: r.loss_rel, Pi: r.Pi,"
            " impacted: r.impacted}; })));")
    out = subprocess.run([NODE, "-e", code, str(ROOT / "explorer" / "sim.js")], input=json.dumps(params),
                         capture_output=True, text=True, timeout=600, check=True)
    return json.loads(out.stdout)


def python_reference(case: OptCase, steering: str) -> dict:
    r = simulate_nd(case.v_inf, case.dv, case.c, case.a0, Prograde() if steering == "prograde" else InertialFixed())
    v_p = math.sqrt(case.v_inf**2 + 2.0)
    loss = 1.0 - (math.sqrt(2.0 * (r.eps_out + 1.0)) - v_p) / case.dv
    return {"eta": r.eta, "v_inf_out": r.v_inf_out, "r_min": r.r_min, "loss_rel": loss, "Pi": case.Pi}


@pytest.fixture(scope="module")
def results():
    cases = [OptCase.from_targets(vr, dvr, lam, Pi) for Pi, vr, dvr, lam, _ in CASES]
    js = run_js([{"v_inf": c.v_inf, "dv": c.dv, "c": c.c, "a0": c.a0, "steering": s}
                 for c, (*_, s) in zip(cases, CASES)])
    py = [python_reference(c, s) for c, (*_, s) in zip(cases, CASES)]
    return list(zip(CASES, py, js))


@pytest.mark.parametrize("i", range(len(CASES)))
def test_js_matches_python(results, i):
    case, py, js = results[i]
    assert not js["impacted"]
    assert js["Pi"] == pytest.approx(py["Pi"], rel=1e-12)
    assert abs(js["eta"] - py["eta"]) <= TOL["eta"], (case, js["eta"], py["eta"])
    assert abs(js["v_inf_out"] / py["v_inf_out"] - 1.0) <= TOL["v_inf_out_rel"]
    assert abs(js["r_min"] - py["r_min"]) <= TOL["r_min"], (case, js["r_min"], py["r_min"])
    assert abs(js["loss_rel"] - py["loss_rel"]) <= TOL["loss_rel"]


def test_js_target_mapping_matches_python():
    targets = [(Pi, vr, dvr, lam) for Pi, vr, dvr, lam, _ in CASES]
    js = run_js([{"targets": t} for t in targets])
    for (Pi, vr, dvr, lam), j in zip(targets, js):
        c = OptCase.from_targets(vr, dvr, lam, Pi)
        for key in ("v_inf", "dv", "c", "a0"):
            assert j[key] == pytest.approx(getattr(c, key), rel=1e-14)
