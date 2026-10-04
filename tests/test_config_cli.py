"""Config parsing/validation and the `oberth run` CLI."""

import json
import math
from pathlib import Path

import pytest

from oberth_atlas.cli import main
from oberth_atlas.config import load_config, parse_config
from oberth_atlas.constants import EARTH, JUPITER
from oberth_atlas.metrics import periapsis_timescale
from oberth_atlas.steering import PitchLinear

ROOT = Path(__file__).resolve().parents[1]
BASE = {
    "body": "earth",
    "flyby": {"v_inf_in_km_s": 3.0, "periapsis_altitude_km": 300.0},
    "engine": {"isp_s": 465.0, "a0_m_s2": 2.0},
    "burn": {"delta_v_km_s": 1.0},
}


def _with(merge: bool = True, **sections):
    """Copy of BASE with sections merged into (merge=True) or replacing (merge=False) the defaults; None drops one."""
    d = json.loads(json.dumps(BASE))
    for k, v in sections.items():
        if v is None:
            d.pop(k, None)
        elif merge and isinstance(v, dict) and isinstance(d.get(k), dict):
            d[k].update(v)
        else:
            d[k] = v
    return d


def test_units_converted_to_si():
    cfg = parse_config(BASE)
    assert cfg.body is EARTH
    assert cfg.v_inf_in == 3000.0 and cfg.periapsis_altitude == 300e3
    assert cfg.burn.delta_v == 1000.0 and cfg.burn.engine.a0 == 2.0 and cfg.burn.midpoint_offset == 0.0


def test_thrust_and_mass_engine():
    cfg = parse_config(_with(merge=False, engine={"isp_s": 850.0, "thrust_N": 1e5, "m0_kg": 2e5}))
    assert cfg.burn.engine.a0 == pytest.approx(0.5) and cfg.burn.engine.m0 == 2e5


@pytest.mark.parametrize("key, factor", [("midpoint_offset_s", None), ("midpoint_offset_tau", "tau"),
                                         ("midpoint_offset_tb", "tb")])
def test_midpoint_offset_units(key, factor):
    cfg = parse_config(_with(burn={key: -0.25}))
    if factor is None:
        expected = -0.25
    elif factor == "tau":
        expected = -0.25 * periapsis_timescale(EARTH.gm, EARTH.radius_eq + 300e3, 3000.0)
    else:
        expected = -0.25 * cfg.burn.duration
    assert cfg.burn.midpoint_offset == pytest.approx(expected, rel=1e-15)


def test_coast_only_config():
    cfg = parse_config(_with(engine=None, burn=None))
    assert cfg.burn is None
    assert math.isnan(cfg.run().eta)


@pytest.mark.parametrize(
    "bad",
    [
        _with(flyby={"v_inf_km_s": 3.0}),                        # typo in a key
        _with(engine=None),                                      # burn without engine
        _with(merge=False, engine={"isp_s": 465.0, "thrust_N": 5.0}),
        _with(burn={"midpoint_offset_s": 0.0, "midpoint_offset_tau": 1.0}),
        _with(steering={"law": "warp"}),
        _with(numerics={"rtol": 1e-12, "gravity": False}),       # not user-settable
        _with(body="pluto"),
    ],
    ids=["typo", "burn-no-engine", "thrust-no-mass", "two-offsets", "bad-law", "gravity-not-allowed", "bad-body"],
)
def test_invalid_configs_rejected(bad):
    with pytest.raises((ValueError, KeyError)):
        parse_config(bad)


def test_example_configs_load_and_run():
    paths = sorted((ROOT / "configs").glob("*.*"))
    assert len(paths) >= 3
    for p in paths:
        cfg = load_config(p)
        res = cfg.run()
        assert math.isfinite(res.eta) and not res.flags["impact"], p.name
    pitch = load_config(ROOT / "configs" / "earth_pitch_example.json")
    assert isinstance(pitch.steering, PitchLinear) and pitch.burn.midpoint_offset < 0
    assert load_config(ROOT / "configs" / "jupiter_nuclear_thermal.yaml").body is JUPITER


def test_cli_run_writes_outputs(tmp_path, capsys):
    cfg = tmp_path / "case.yaml"
    cfg.write_text(json.dumps(_with(name="cli_case")), encoding="utf-8")   # JSON is valid YAML
    assert main(["run", str(cfg), "--out", str(tmp_path / "out")]) == 0
    printed = capsys.readouterr().out
    assert "eta = B_finite / B_imp" in printed and "Flags" in printed
    out = tmp_path / "out" / "cli_case"
    data = json.loads((out / "result.json").read_text(encoding="utf-8"))
    assert data["result"]["eta"] == pytest.approx(parse_config(_with()).run().eta, rel=1e-12)
    assert (out / "trajectory.png").stat().st_size > 50_000


def test_saved_png_has_provenance(tmp_path):
    from PIL import Image

    cfg = tmp_path / "case.json"
    cfg.write_text(json.dumps(BASE), encoding="utf-8")
    main(["run", str(cfg), "--out", str(tmp_path)])
    img = Image.open(tmp_path / "case" / "trajectory.png")
    assert img.info["Source"].startswith("oberth run ") and img.info["Comment"].startswith("git ")
    assert round(img.info["dpi"][0]) == 300
