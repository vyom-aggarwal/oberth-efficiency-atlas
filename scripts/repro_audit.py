"""Compare the outputs of two checkouts (the reference repository and a fresh rebuild).

Every file under figures/ and results/, plus explorer/oberth_explorer.html and explorer/explorer_data.json,
is compared by content, ignoring provenance stamps and wall-clock fields:
- PNG: decoded pixels (text metadata such as the script path and git commit is ignored);
- PDF: bytes with /CreationDate, /ModDate and /Producer removed;
- JSON: parsed values, exactly;
- CSV, HTML, other text: bytes;
- Parquet: the table, exactly, without its key-value metadata and without wall-clock columns
  (runtime_s); on a difference, the columns and the largest absolute difference are reported;
- MP4: decoded frames (ffmpeg via imageio-ffmpeg); GIF: decoded frames (Pillow).
Run:  .venv/Scripts/python scripts/repro_audit.py REFERENCE_DIR REBUILT_DIR [--json out.json]
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from PIL import Image

WALL_CLOCK = {"runtime_s"}


def png_equal(a: Path, b: Path):
    x, y = np.asarray(Image.open(a).convert("RGBA")), np.asarray(Image.open(b).convert("RGBA"))
    if x.shape != y.shape:
        return False, f"shape {x.shape} vs {y.shape}"
    n = int(np.any(x != y, axis=-1).sum())
    return n == 0, f"{n} pixels differ" if n else ""


def strip_pdf(p: Path) -> bytes:
    return re.sub(rb"/(CreationDate|ModDate|Producer) \([^)]*\)", b"", p.read_bytes())


def parquet_equal(a: Path, b: Path):
    x, y = pd.read_parquet(a), pd.read_parquet(b)
    drop = [c for c in x.columns if c in WALL_CLOCK]
    x, y = x.drop(columns=drop, errors="ignore"), y.drop(columns=drop, errors="ignore")
    if list(x.columns) != list(y.columns) or len(x) != len(y):
        return False, f"columns/rows differ: {x.shape} vs {y.shape}"
    bad = []
    for c in x.columns:
        xs, ys = x[c], y[c]
        if pd.api.types.is_float_dtype(xs):
            same = np.array_equal(xs.to_numpy(), ys.to_numpy(), equal_nan=True)
            if not same:
                d = np.nanmax(np.abs(xs.to_numpy() - ys.to_numpy()))
                bad.append(f"{c} (max |Δ| {d:.3g})")
        elif not xs.equals(ys):
            bad.append(c)
    return not bad, ("differ: " + ", ".join(bad[:12]) + (" …" if len(bad) > 12 else "")) if bad else f"(ignored {drop})" if drop else ""


def video_frames_hash(p: Path) -> str:
    h = hashlib.sha256()
    if p.suffix == ".gif":
        im = Image.open(p)
        try:
            while True:
                h.update(np.asarray(im.convert("RGBA")).tobytes())
                im.seek(im.tell() + 1)
        except EOFError:
            pass
        return h.hexdigest()
    import imageio_ffmpeg
    for frame in imageio_ffmpeg.read_frames(str(p)):
        if isinstance(frame, (bytes, bytearray)):
            h.update(frame)
    return h.hexdigest()


def compare(a: Path, b: Path):
    if not b.exists():
        return False, "missing in rebuild"
    s = a.suffix.lower()
    if s == ".png":
        return png_equal(a, b)
    if s == ".pdf":
        return strip_pdf(a) == strip_pdf(b), ""
    if s == ".json":
        return json.loads(a.read_text(encoding="utf-8")) == json.loads(b.read_text(encoding="utf-8")), ""
    if s == ".parquet":
        return parquet_equal(a, b)
    if s in (".mp4", ".gif"):
        return video_frames_hash(a) == video_frames_hash(b), "decoded frames"
    return a.read_bytes() == b.read_bytes(), ""


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("reference", type=Path)
    ap.add_argument("rebuilt", type=Path)
    ap.add_argument("--json", type=Path)
    a = ap.parse_args()
    files = sorted([p for d in ("figures", "results") for p in (a.reference / d).glob("*") if p.is_file()]
                   + [a.reference / "explorer" / "oberth_explorer.html", a.reference / "explorer" / "explorer_data.json"])
    report, bad = [], 0
    for f in files:
        rel = f.relative_to(a.reference).as_posix()
        try:
            ok, note = compare(f, a.rebuilt / rel)
        except Exception as exc:  # noqa: BLE001
            ok, note = False, f"error: {type(exc).__name__}: {exc}"
        bad += not ok
        report.append({"file": rel, "identical": ok, "note": note})
        print(f"{'same' if ok else 'DIFF'}  {rel}  {note}")
    print(f"{len(files) - bad}/{len(files)} outputs identical (ignoring provenance stamps and wall-clock columns)")
    if a.json:
        a.json.write_text(json.dumps(report, indent=1), encoding="utf-8")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
