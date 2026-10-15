"""The website's exported data (site/public/data/*.json, scripts/export_site_data.py) matches its sources.

- Every {"value", "src"} item equals the value at its JSON pointer in the source numbers JSON, exactly.
- Plotted arrays are recomputed from the committed results with the figure scripts' own functions and must
  equal the exported (6-significant-figure) values exactly.
- Provenance hashes match the source files as committed.
"""

import hashlib
import json
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
        assert hashlib.sha256((ROOT / rel).read_bytes()).hexdigest() == digest, rel


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


def test_reference_numbers_follow_the_paper_outline():
    site = load("site.json")
    curve = load("curve.json")
    numbers = {r["n"]: r["text"] for r in site["references"]}
    for case in curve["cases"]:
        if case["ref"] is not None:
            assert case["label"].split()[0] in numbers[case["ref"]]
