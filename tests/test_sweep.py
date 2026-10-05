"""Sweep infrastructure: grid coverage, row contents, Parquet provenance, error capture."""

import numpy as np
import pandas as pd
import pytest

from oberth_atlas.presets import load_presets, nd_extremes, nd_groups, sample_missions
from oberth_atlas.simulate import simulate_nd
from oberth_atlas.steering import InertialFixed
from oberth_atlas.sweep import Axis, GridSpec, grid_from_presets, read_metadata, run_case, run_missions, run_sweep


def test_grid_covers_every_mission_envelope():
    presets = load_presets()
    spec = grid_from_presets(presets)
    for bkey, ekey, s in sample_missions(presets, 64):
        g = nd_groups(presets.bodies[bkey].body, s["r_p"], s["v_inf"], s["dv"], s["isp"], s["a0"])
        for name in ("v_inf", "dv", "c", "a0"):
            ax = getattr(spec, name)
            assert ax.lo < g[name].min() and g[name].max() < ax.hi, (bkey, ekey, name)
        assert g["dv_over_c"].max() < spec.max_dv_over_c


def test_extremes_bracket_samples():
    presets = load_presets()
    ext = nd_extremes(presets)
    for bkey, ekey, s in sample_missions(presets, 32, seed=3):
        g = nd_groups(presets.bodies[bkey].body, s["r_p"], s["v_inf"], s["dv"], s["isp"], s["a0"])
        for name, (lo, hi) in ext.items():
            assert lo * (1 - 1e-12) <= g[name].min() and g[name].max() <= hi * (1 + 1e-12)


def test_infeasible_mass_ratios_skipped():
    spec = GridSpec(Axis(0.5, 0.5, 1), Axis(0.1, 1.0, 2), Axis(0.1, 1.0, 2), Axis(1.0, 1.0, 1),
                    steering=("prograde",), max_dv_over_c=2.0)
    pairs = {(c["dv"], c["c"]) for c in spec.cases()}
    assert pairs == {(0.1, 0.1), (0.1, 1.0), (1.0, 1.0)}             # Δv/c = 10 is skipped


def test_dv_over_c_axis_replaces_exhaust_velocity_axis():
    spec = GridSpec(Axis(0.5, 0.5, 1), Axis(0.1, 1.0, 2), Axis(99.0, 99.0, 1), Axis(1.0, 1.0, 1),
                    steering=("prograde",), dv_over_c=(0.1, 1.0, 3.0))
    cases = list(spec.cases())
    assert len(cases) == 2 * 3
    for c in cases:
        assert c["dv"] / c["c"] == pytest.approx((0.1, 1.0, 3.0)[c["i_c"]], rel=1e-15)


def test_original_grid_indices_preserved_when_skipping():
    spec = GridSpec(Axis(0.5, 0.5, 1), Axis(1.0, 1.0, 1), Axis(0.1, 1.0, 2), Axis(1.0, 1.0, 1), steering=("prograde",))
    assert [c["i_c"] for c in spec.cases()] == [1]          # c = 0.1 skipped (Δv/c = 10), index 1 kept


def test_small_sweep_roundtrip(tmp_path):
    spec = GridSpec(Axis(0.1, 2.0, 2), Axis(0.01, 0.3, 2), Axis(0.5, 5.0, 2), Axis(1e-3, 10.0, 3))
    out = tmp_path / "s.parquet"
    df = run_sweep(spec, out, workers=1)
    back = pd.read_parquet(out)
    assert len(back) == len(df) == spec.n_cases() == 2 * 2 * 2 * 2 * 3
    assert (back["status"] == "ok").all()
    meta = read_metadata(out)
    assert meta["kind"] == "nd_sweep" and meta["spec"]["a0"]["n"] == 3 and "git" in meta
    # Spot-check one row against a direct simulation (bitwise: same code, same inputs).
    row = back[back.steering == "inertial"].iloc[5]
    r = simulate_nd(row.v_inf, row.dv, row.c, row.a0, InertialFixed())
    assert row.eta == r.eta and row.r_min == r.r_min
    for col in ("C_theory", "eta_lin", "eta_W_lin", "xi", "Pi_T", "r_burn_start", "eta_W"):
        assert np.isfinite(back[col]).all(), col


def test_errors_are_recorded_not_dropped():
    row = run_case(dict(steering="prograde", i_v_inf=0, i_dv=0, i_c=0, i_a0=0, v_inf=-1.0, dv=0.1, c=1.0, a0=1.0))
    assert row["status"] == "error" and "ValueError" in row["error"]


def test_missions_small(tmp_path):
    presets = load_presets()
    out = tmp_path / "m.parquet"
    df = run_missions(presets, 2, out, workers=1, steering=("prograde",))
    assert len(df) == 2 * len(presets.bodies) * len(presets.engines)
    assert (df["status"] == "ok").all()
    assert set(df["body"]) == set(presets.bodies) and set(df["engine"]) == set(presets.engines)
    assert {"flag_impact", "flag_outside_soi", "soi_ratio_burn_start", "eta_lin", "C_theory"} <= set(df.columns)
    assert np.isfinite(df["Pi"]).all()
    assert read_metadata(out)["spec"]["n_per_combo"] == 2
    assert (df[df.body == "sun"]["soi_ratio_burn_start"] == 0).all()
    assert pytest.approx(df["R_over_rp"].to_numpy()) == (df["r_p"] - df["altitude"]).to_numpy() / df["r_p"].to_numpy()
