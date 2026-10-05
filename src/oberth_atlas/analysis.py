"""Post-processing of the Phase 2 sweep: reliability masks, per-body impact and SOI, collapse metrics.

The collapse metrics are model-free, so they cannot flatter any particular hypothesis:
- `binned_scatter(x, y)`: RMS of y about its bin median, in narrow bins of log x. It measures how
  well x alone collapses y.
- `explained_fraction(x, y, z)`: the fraction of that within-bin variance removed by also binning
  on z. It measures how much a secondary parameter z explains the remaining scatter.
"""

from __future__ import annotations

import math

import numpy as np
import pandas as pd

ETA_ERR_MAX = 1e-6


def load(path) -> pd.DataFrame:
    df = pd.read_parquet(path)
    if "C_theory" in df:
        df["Pi_sqrtC"] = df["Pi"] * np.sqrt(df["C_theory"])
        df["Pi_sqrtC_user"] = df["Pi"] * np.sqrt(df["C_user"]) if "C_user" in df else np.nan
    if "Pi_T" in df:
        df["Pi_over_PiT"] = df["Pi"] / df["Pi_T"]
    if "t_b" in df:
        # Thrust-induced displacement scale Δv·t_b (units of r_p). Sideways thrust changes the
        # flyby geometry once this is O(1): the suspected driver of inertial behavior at large Π.
        df["dv_tb"] = df["dv"] * df["t_b"]
    return df


def reliable(df: pd.DataFrame) -> pd.Series:
    """Rows whose η is a trustworthy number: ok status, finite η, error estimate below ETA_ERR_MAX,
    no floor hit, not captured, and B_imp not negligible."""
    m = (df["status"] == "ok") & np.isfinite(df["eta"]) & (df["eta_err"] < ETA_ERR_MAX)
    for col in ("hit_floor", "captured", "b_imp_small"):
        if col in df:
            m &= ~df[col].astype(bool)
    return m


def impact_mask(df: pd.DataFrame, R_over_rp: float) -> pd.Series:
    """Body-free rows that would hit a body whose radius is R_over_rp·r_p (r_min < R/r_p)."""
    return df["hit_floor"].astype(bool) | (df["r_min"] < R_over_rp)


def soi_ratio(df: pd.DataFrame, body, r_p: float) -> pd.Series:
    """(burn-start radius)/r_SOI for a body-free row placed at body `body` with periapsis r_p (m)."""
    r_soi = body.soi_radius
    if not math.isfinite(r_soi):
        return pd.Series(0.0, index=df.index)
    return df["r_burn_start"] * r_p / r_soi


def _log_bins(x: np.ndarray, per_decade: float) -> np.ndarray:
    lx = np.log10(x)
    lo, hi = np.floor(lx.min() * per_decade), np.ceil(lx.max() * per_decade)
    return np.floor(lx * per_decade).astype(np.int64) - int(lo) if hi > lo else np.zeros(len(x), np.int64)


def binned_scatter(x, y, per_decade: float = 8.0, min_count: int = 5, detrend: bool = True) -> dict:
    """Scatter of y about a single curve in x. In each log10(x) bin, y is compared with a local
    straight line in log10(x) (detrend=True) or with the bin median (detrend=False).

    Detrending matters for steep curves: without it, a perfect collapse onto y = 2 log10 x would
    still show 2/(per_decade·√12) of "scatter" from the slope inside each bin. Bins with fewer than
    min_count points are ignored. Returns rms, the median absolute deviation, the 95th percentile
    |dev|, and the count.
    """
    x, y = np.asarray(x, float), np.asarray(y, float)
    ok = np.isfinite(x) & np.isfinite(y) & (x > 0)
    x, y = x[ok], y[ok]
    lx = np.log10(x)
    b = _log_bins(x, per_decade)
    dev = np.full(len(y), np.nan)
    for key in np.unique(b):
        idx = b == key
        if idx.sum() >= min_count:
            if detrend and np.ptp(lx[idx]) > 0:
                slope, icpt = np.polyfit(lx[idx], y[idx], 1)
                dev[idx] = y[idx] - (slope * lx[idx] + icpt)
            else:
                dev[idx] = y[idx] - np.median(y[idx])
    d = dev[np.isfinite(dev)]
    return {"rms": float(np.sqrt(np.mean(d**2))), "mad": float(np.median(np.abs(d))),
            "p95": float(np.percentile(np.abs(d), 95)), "n": int(d.size)}


def _explained(b, y, z, z_bins, min_per_zbin, lx):
    within_x, within_xz = 0.0, 0.0
    for key in np.unique(b):
        idx = np.flatnonzero(b == key)
        if idx.size < min_per_zbin * z_bins:
            continue
        yy, zz = y[idx], z[idx]
        if np.ptp(lx[idx]) > 0:                            # remove the within-bin trend in x first
            slope, icpt = np.polyfit(lx[idx], yy, 1)
            yy = yy - (slope * lx[idx] + icpt)
        within_x += np.sum((yy - yy.mean()) ** 2)
        order = np.argsort(zz, kind="stable")              # equal-count bins of z
        for part in np.array_split(order, z_bins):
            within_xz += np.sum((yy[part] - yy[part].mean()) ** 2)
    return within_x, within_xz


def explained_fraction(x, y, z, per_decade: float = 8.0, z_bins: int = 8, min_per_zbin: int = 10,
                       null_seed: int | None = 0) -> float:
    """Share of the scatter left after collapsing y on x that is explained by z.

    Computed as [1 − E Var(y | x-bin, z-bin) / E Var(y | x-bin)] on y detrended against log10 x
    inside each x-bin, minus the same quantity with z randomly permuted within each x-bin
    (null_seed=None skips this). The null removes the upward
    bias from splitting finite samples into sub-bins. x-bins with fewer than min_per_zbin·z_bins
    points are skipped.
    """
    x, y, z = (np.asarray(a, float) for a in (x, y, z))
    ok = np.isfinite(x) & np.isfinite(y) & np.isfinite(z) & (x > 0)
    x, y, z = x[ok], y[ok], z[ok]
    b = _log_bins(x, per_decade)
    lx = np.log10(x)
    wx, wxz = _explained(b, y, z, z_bins, min_per_zbin, lx)
    if wx <= 0:
        return math.nan
    frac = 1.0 - wxz / wx
    if null_seed is not None:
        rng = np.random.default_rng(null_seed)
        zp = z.copy()
        for key in np.unique(b):
            idx = np.flatnonzero(b == key)
            zp[idx] = rng.permutation(z[idx])
        _, wxz0 = _explained(b, y, zp, z_bins, min_per_zbin, lx)
        frac -= 1.0 - wxz0 / wx
    return float(frac)


def eta_half_point(Pi: np.ndarray, eta: np.ndarray) -> float:
    """Π at which η crosses 0.5 (log-linear interpolation along increasing Π); NaN if never crossed."""
    order = np.argsort(Pi)
    P, E = np.asarray(Pi)[order], np.asarray(eta)[order]
    for i in range(len(P) - 1):
        if (E[i] - 0.5) * (E[i + 1] - 0.5) <= 0 and E[i] != E[i + 1]:
            f = (E[i] - 0.5) / (E[i] - E[i + 1])
            return float(10 ** (np.log10(P[i]) + f * (np.log10(P[i + 1]) - np.log10(P[i]))))
    return math.nan


def mission_table(missions: pd.DataFrame, law: str = "prograde") -> pd.DataFrame:
    """Per (body, engine): η quantiles, median Π, and the fractions impacting or outside the SOI.

    The η statistics use only *valid* samples: no impact, and a burn starting inside the body's
    sphere of influence. Outside the SOI the planet-centred model is invalid (user decision Q2,
    2026-10-04). n_valid counts those samples. Where fewer than 5 are valid, the η columns are NaN.
    """
    m = missions[(missions["steering"] == law) & (missions["status"] == "ok")]
    rows = []
    for (b, e), g in m.groupby(["body", "engine"], sort=False):
        ok = np.isfinite(g["eta"]) & ~g["flag_impact"] & (g["soi_ratio_burn_start"] <= 1.0)
        if ok.sum() < 5:
            ok = ok & False
        q = np.nanpercentile(g.loc[ok, "eta"], [10, 50, 90]) if ok.any() else [np.nan] * 3
        rows.append(dict(body=b, engine=e, n=len(g), n_valid=int(ok.sum()), Pi_median=float(np.median(g["Pi"])),
                         eta_p10=q[0], eta_median=q[1], eta_p90=q[2],
                         dv_loss_median_m_s=float(np.nanmedian(g.loc[ok, "delta_v_loss"])) if ok.any() else np.nan,
                         frac_impact=float(g["flag_impact"].mean()), frac_outside_soi=float(g["flag_outside_soi"].mean()),
                         soi_ratio_median=float(np.median(g["soi_ratio_burn_start"]))))
    return pd.DataFrame(rows)
