"""The website's exported data (site/public/data/*.json, scripts/export_site_data.py) matches its sources.

- Every {"value", "src"} item equals the value at its JSON pointer in the source numbers JSON, exactly.
- Plotted arrays are recomputed from the committed results with the figure scripts' own functions and must
  equal the exported (6-significant-figure) values exactly.
- Provenance hashes match the source files as committed.
"""

import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "site" / "public" / "data"
sys.path.insert(0, str(ROOT / "scripts"))
import export_site_data as E  # noqa: E402

FILES = sorted(DATA.glob("*.json"))
pytestmark = pytest.mark.skipif(not FILES, reason="site data not exported")


def load(name: str) -> dict:
    return json.loads((DATA / name).read_text(encoding="utf-8"))


def resolve(src: str):
    """Source value (numbers JSON, YAML config, or a frozen script's function result), freshly loaded."""
    value = E.resolve(src)
    return list(value) if isinstance(value, tuple) else value


def pointers(x, path=""):
    if isinstance(x, dict):
        if set(x) == {"value", "src"}:
            yield path, x
            return
        for k, v in x.items():
            yield from pointers(v, f"{path}/{k}")
    elif isinstance(x, list):
        for i, v in enumerate(x):
            yield from pointers(v, f"{path}[{i}]")


@pytest.mark.parametrize("path", FILES, ids=lambda p: p.name)
def test_every_number_matches_its_source(path):
    items = list(pointers(json.loads(path.read_text(encoding="utf-8"))))
    for where, item in items:
        assert item["value"] == resolve(item["src"]), f"{path.name}{where}: {item['src']}"


@pytest.mark.parametrize("path", FILES, ids=lambda p: p.name)
def test_provenance_hashes_match_sources(path):
    prov = json.loads(path.read_text(encoding="utf-8"))["provenance"]
    for rel, digest in prov["sources"].items():
        # CRLF read as LF, as export_site_data.sha256: the hash must not depend on the checkout's line endings.
        assert hashlib.sha256((ROOT / rel).read_bytes().replace(b"\r\n", b"\n")).hexdigest() == digest, rel


def test_curve_arrays_recompute_exactly():
    import fig_hero as H
    import fig_loss_vinf as V
    c = load("curve.json")
    curves = H.profile_curves(pd.read_parquet(ROOT / "results" / "phase4.parquet"))
    x = np.logspace(-3, np.log10(3000), 400)
    Y = np.vstack([H.on_grid(cv, x) for cv in curves.values()])
    assert c["band"]["Pi"] == E.round_sig(x)
    assert c["band"]["lo"] == E.round_sig(np.nanmin(Y, axis=0))
    assert c["band"]["hi"] == E.round_sig(np.nanmax(Y, axis=0))
    assert c["bound"]["loss_rel"] == E.round_sig(x[x <= 10] ** 2 / 96)
    d = V.data()
    for vr, cur in zip(V.VR, c["arrival_family"]["curves"]):
        bx, by, _ = V.binned(d[d["vr"] == vr])
        assert cur["median"]["Pi"] == E.round_sig(bx) and cur["median"]["loss_rel"] == E.round_sig(by)


def test_curve_band_agrees_with_hero_numbers():
    """Cross-check: the exported band's max/min ratio at the hero figure's quoted Π values."""
    c = load("curve.json")
    lx = np.log(np.array(c["band"]["Pi"]))
    ratio = np.array(c["band"]["hi"]) / np.array(c["band"]["lo"])
    for key, item in c["band"]["max_over_min"].items():
        Pi = float(key.split("=")[1])
        assert np.exp(np.interp(np.log(Pi), lx, np.log(ratio))) == pytest.approx(item["value"], rel=1e-5), key


def test_band_spread_is_the_maximum_over_the_plotted_range():
    """The quoted spread (max/min across thrust profiles) is the band's maximum over the whole plotted grid,
    recomputed at full precision, and it is at least every value hero_numbers.json samples."""
    import fig_hero as H
    c = load("curve.json")
    curves = H.profile_curves(pd.read_parquet(ROOT / "results" / "phase4.parquet"))
    x = np.logspace(-3, np.log10(3000), 400)
    Y = np.vstack([H.on_grid(cv, x) for cv in curves.values()])
    ratio = np.nanmax(Y, axis=0) / np.nanmin(Y, axis=0)
    i = int(np.nanargmax(ratio))
    spread = c["band"]["spread"]
    assert spread["max_over_min"] == float(ratio[i]) and spread["at_Pi"] == float(x[i])
    assert all(spread["max_over_min"] >= item["value"] for item in c["band"]["max_over_min"].values())


def without_git(d: dict) -> dict:
    return {**d, "provenance": {k: v for k, v in d["provenance"].items() if k != "git"}}


@pytest.mark.parametrize("name, make", [
    ("hero.json", lambda: E.hero_data(E.Numbers())),
    ("regimes.json", lambda: E.regimes_data(E.Numbers())),
    ("atlas.json", E.atlas_data),
    ("missions.json", E.missions_data),
    ("timing.json", lambda: E.timing_data(E.Numbers())),
    ("case.json", lambda: E.case_data(E.Numbers(), E.references())),
    ("presets.json", E.presets_data),
])
def test_exported_file_is_current(name, make):
    """Each derived file equals a fresh export from the committed sources (so the site never shows stale data)."""
    fresh = json.loads(json.dumps(make(), ensure_ascii=False, allow_nan=False))
    assert without_git(fresh) == without_git(load(name))


def test_engines_binary_is_current_and_matches_the_animation_numbers():
    header, blob = E.engines_data(E.Numbers())
    assert without_git(json.loads(json.dumps(header))) == without_git(load("engines.json"))
    assert blob == (DATA / "engines.bin").read_bytes()
    for c in load("engines.json")["cases"]:
        assert c["sim_Pi"] == pytest.approx(c["Pi"]["value"], rel=1e-12)
        # The animation integrates longer coasts than scripts/anim_numbers.py; measured loss differences
        # (2026-10-15): solid stack 6.6e-7 relative (8e-12 of Δv), nuclear thermal 4e-10, SEP-class 3e-12.
        assert c["sim_loss_rel"] == pytest.approx(c["loss_rel"]["value"], rel=2e-6)
        n = c["arrays"][0]["length"]
        x = np.frombuffer((DATA / "engines.bin").read_bytes(), dtype="<f4", count=n, offset=c["arrays"][0]["offset"])
        assert np.isfinite(x).all()


def test_hero_units_and_nondimensional_case():
    import run_phase4 as P
    from oberth_atlas.constants import GM_SUN
    h = load("hero.json")
    V = np.sqrt(GM_SUN / P.R_P)
    assert h["units"]["V_m_s"] == V
    assert h["units"]["time_s"] == P.R_P / V and h["units"]["av_W_per_kg"] == V**3 / P.R_P
    assert h["nd"]["dv"] == h["propulsion"]["dv_m_s"]["value"] / V
    assert h["nd"]["c"] == h["propulsion"]["c_km_s"]["value"] * 1000 / V
    assert [m["id"] for m in h["marks"]] == ["solid_stack", "nuclear_thermal", "sep_class"]


def test_timing_closed_forms_reproduce_phase3():
    t = load("timing.json")
    rows = {r["lam"]: r for r in t["rows"]}
    for chk in t["phase3_checks"]:
        r = rows[chk["lam"]]
        for k in ("recovered_fraction_dv0", "x_centroid", "x_median", "half_rule_capture"):
            assert r[k] == pytest.approx(chk[k]["value"], rel=1e-9), (chk["lam"], k)


def test_regimes_half_points_match_the_csv():
    rows = E.load_source("figures/regimes_half_point.csv")
    for fam in load("regimes.json")["families"]:
        sel = [r for r in rows if r["v_inf_over_vesc"] == fam["v_over_vesc"] and np.isfinite(r["Pi_half_data"])]
        assert fam["half_point"]["Pi_half_data"] == E.round_sig([r["Pi_half_data"] for r in sel])


def test_methods_test_count_is_current():
    out = subprocess.run([sys.executable, "-m", "pytest", "--collect-only", "-q"], capture_output=True, text=True, cwd=ROOT)
    n = int(re.search(r"(\d+) tests? collected", out.stdout).group(1))
    assert load("methods.json")["tests_collected"] == n, "re-run scripts/export_site_data.py --only methods"


def test_site_numbers_are_current_and_consistent():
    """The quotable values equal a fresh computation, agree with regimes.json and curve.json, and the numbers
    checker accepts a quote of the η–η_W divergence."""
    fresh = json.loads(json.dumps(E.site_numbers_data(), allow_nan=False))
    sn = load("site_numbers.json")
    assert without_git(fresh) == without_git(sn)
    assert sn["eta_vs_eta_W"]["max_abs_diff"] == load("regimes.json")["eta_minus_eta_W_max_abs"]
    assert sn["band_spread"]["max_over_min"] == load("curve.json")["band"]["spread"]["max_over_min"]
    draft = ROOT / "runs" / "check_numbers_probe.md"
    draft.parent.mkdir(exist_ok=True)
    draft.write_text(f"η and η_W differ by up to {sn['eta_vs_eta_W']['max_abs_diff']:.2f}.\n", encoding="utf-8")
    out = subprocess.run([sys.executable, str(ROOT / "scripts" / "check_numbers.py"), str(draft)], capture_output=True, text=True)
    assert out.returncode == 0, out.stdout + out.stderr


def test_reference_numbers_follow_the_paper_outline():
    site = load("site.json")
    curve = load("curve.json")
    numbers = {r["n"]: r["text"] for r in site["references"]}
    for case in curve["cases"]:
        if case["ref"] is not None:
            assert case["label"].split()[0] in numbers[case["ref"]]
