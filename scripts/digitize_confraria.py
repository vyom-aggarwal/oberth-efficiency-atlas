"""Digitize Confraria (2020) thesis Fig. 4.34 ("Finite burn losses Robbins-vnb (%)").

That figure plots Robbins' relative overestimate for tangential steering, Isp = 300 s, LEO 200 km.
This script replaces values read by eye with pixel-level digitization, for the two C3-targeting
curves whose MATLAB default colors are unique in the figure:
- Δv = 3.5 km/s (color 6, light blue);
- Δv = 4.0 km/s (color 7, dark red).

The Δv = 4.5 and 5 km/s curves reuse the colors of 1 and 1.5 km/s, so they are not separable by
color and are not digitized.

The figure image itself is NOT stored in this repo (thesis copyright). Extract it from the thesis
PDF (page 61, first image) and pass its path:
    .venv/Scripts/python scripts/digitize_confraria.py path/to/p61_0_Im37.png
Writes figures/confraria_fig434_digitized.csv, plus a check overlay to runs/confraria_digitization_check.png.
The overlay is gitignored, because it reproduces the thesis figure.
"""

from __future__ import annotations

import csv
import sys
from pathlib import Path

import numpy as np

from oberth_atlas.plotting import apply_style, plt, save_figure

ROOT = Path(__file__).resolve().parents[1]
CURVES = {3.5: (75, 186, 234), 4.0: (168, 48, 72)}       # MATLAB colors 6 and 7 as rendered (anti-aliased)
TW_TARGETS = (0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5)


def _runs(mask_1d: np.ndarray) -> list[tuple[int, int]]:
    idx = np.flatnonzero(mask_1d)
    if idx.size == 0:
        return []
    splits = np.flatnonzero(np.diff(idx) > 1)
    starts = np.concatenate([[idx[0]], idx[splits + 1]])
    ends = np.concatenate([idx[splits], [idx[-1]]])
    return list(zip(starts, ends))


def calibrate(img: np.ndarray):
    """Axis lines and tick marks → linear pixel ↔ data maps (x: T/W, y: percent)."""
    dark = img[..., :3].max(axis=2) < 90
    h, w = dark.shape
    row_counts, col_counts = dark.sum(axis=1), dark.sum(axis=0)
    y_axis_row = int(np.argmax(row_counts[h // 2:]) + h // 2)          # bottom axis line
    x_axis_col = int(np.argmax(col_counts[: w // 2]))                   # left axis line
    # x ticks: short dark marks just above the bottom axis line.
    band = dark[y_axis_row - 5: y_axis_row - 1, x_axis_col + 3:].any(axis=0)
    xt = [x_axis_col + 3 + (a + b) / 2 for a, b in _runs(band)]
    # y ticks: short dark marks just right of the left axis line. Skip the top frame line, and
    # count the bottom axis line itself as the 0 tick.
    top_frame = int(np.argmax(row_counts[: h // 2]))
    bandy = dark[top_frame + 3: y_axis_row - 3, x_axis_col + 1: x_axis_col + 5].any(axis=1)
    yt = [top_frame + 3 + (a + b) / 2 for a, b in _runs(bandy)] + [float(y_axis_row)]
    return y_axis_row, x_axis_col, np.array(xt), np.array(yt)


def main(path: str) -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    import matplotlib.image as mpimg
    img = (mpimg.imread(path)[..., :3] * 255).astype(float)
    y_row, x_col, xt, yt = calibrate(img)
    # The x ticks are 0.1, 0.15, …, 0.5 (labelled, 9 ticks); the y ticks are 0, 50, …, 300 from
    # the bottom. Fit pixel→data linearly.
    if len(xt) != 9:
        raise SystemExit(f"expected 9 x ticks, found {len(xt)}: {xt}")
    xvals = np.linspace(0.1, 0.5, 9)
    ax_x = np.polyfit(xt, xvals, 1)
    yt_sorted = np.sort(yt)[::-1]                                       # bottom (largest row) first
    yvals = 50.0 * np.arange(len(yt_sorted))
    ax_y = np.polyfit(yt_sorted, yvals, 1)
    x_res = np.std(np.polyval(ax_x, xt) - xvals)
    y_res = np.std(np.polyval(ax_y, yt_sorted) - yvals)
    print(f"axis row {y_row}, col {x_col}; x ticks {len(xt)} (fit rms {x_res:.2e} T/W), "
          f"y ticks {len(yt)} (fit rms {y_res:.2f} %)")

    rows = []
    hh, ww = img.shape[:2]
    X, Y = np.meshgrid(np.arange(ww), np.arange(hh))
    xdata, ydata = np.polyval(ax_x, X), np.polyval(ax_y, Y)
    legend = (xdata > 0.33) & (ydata > 150)                              # legend box region
    for dv, rgb in CURVES.items():
        mask = (np.linalg.norm(img - np.array(rgb), axis=2) < 40) & ~legend & (Y < y_row - 1) & (X > x_col + 1)
        for tw in TW_TARGETS:
            col = np.polyval(np.polyfit(xvals, xt, 1), tw)
            sel = mask & (np.abs(X - col) <= 3.0)
            ys = Y[sel]
            if ys.size == 0:
                rows.append(dict(dv_kms=dv, tw=tw, overestimate_pct=float("nan"), n_px=0))
                continue
            rows.append(dict(dv_kms=dv, tw=tw, overestimate_pct=float(np.polyval(ax_y, np.median(ys))), n_px=int(ys.size)))
    out = ROOT / "figures" / "confraria_fig434_digitized.csv"
    with out.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)
    for r in rows:
        print(f"  Δv {r['dv_kms']} km/s  T/W {r['tw']:.2f}: {r['overestimate_pct']:6.1f} %  ({r['n_px']} px)")

    apply_style()
    fig, ax = plt.subplots(figsize=(6.5, 5), layout="constrained")
    ax.imshow(img.astype(np.uint8))
    for r in rows:
        if r["n_px"]:
            ax.plot(np.polyval(np.polyfit(xvals, xt, 1), r["tw"]), np.polyval(np.polyfit(yvals, yt_sorted, 1), r["overestimate_pct"]),
                    "x", color="black", markersize=8)
    ax.set_title("Digitization check: × = digitized points (Confraria 2020, Fig. 4.34)", fontsize=9)
    ax.axis("off")
    save_figure(fig, ROOT / "runs" / "confraria_digitization_check.png", "scripts/digitize_confraria.py")


if __name__ == "__main__":
    main(sys.argv[1])
