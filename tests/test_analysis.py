"""Collapse metrics on synthetic data with known answers."""

import numpy as np
import pytest

from oberth_atlas.analysis import binned_scatter, eta_half_point, explained_fraction


def test_binned_scatter_zero_for_perfect_collapse_and_positive_otherwise():
    rng = np.random.default_rng(0)
    x = 10 ** rng.uniform(-3, 3, 20000)
    z = rng.uniform(0, 1, x.size)
    perfect = binned_scatter(x, 1 / (1 + x), per_decade=50)["rms"]          # only within-bin slope
    scattered = binned_scatter(x, 1 / (1 + x * (1 + z)), per_decade=50)["rms"]
    assert perfect < 0.002 and scattered > 10 * perfect


def test_detrending_removes_the_within_bin_slope():
    """A perfect power-law collapse has zero scatter once detrended; the median version shows
    ~2/(per_decade·√12) dex from the slope alone."""
    x = np.logspace(-3, 0, 30000)
    y = 2 * np.log10(x)
    assert binned_scatter(x, y, per_decade=8)["rms"] < 1e-12
    assert binned_scatter(x, y, per_decade=8, detrend=False)["rms"] == pytest.approx(2 / (8 * np.sqrt(12)), rel=0.05)


def test_explained_fraction_detects_the_hidden_parameter():
    rng = np.random.default_rng(1)
    x = 10 ** rng.uniform(-2, 2, 40000)
    z = rng.uniform(0, 1, x.size)
    w = rng.uniform(0, 1, x.size)                     # an irrelevant parameter
    y = 1 / (1 + x * (1 + 2 * z))
    assert explained_fraction(x, y, z, per_decade=20, z_bins=10) > 0.9
    assert abs(explained_fraction(x, y, w, per_decade=20, z_bins=10)) < 0.05


def test_eta_half_point():
    Pi = np.logspace(-2, 3, 200)
    eta = 1 / (1 + Pi / 7.0)
    assert eta_half_point(Pi, eta) == pytest.approx(7.0, rel=1e-3)
    assert np.isnan(eta_half_point(Pi, 0.9 + 0 * Pi))
