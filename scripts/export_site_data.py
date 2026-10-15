"""Export the website's data: site/public/data/*.json from committed results and numbers JSONs.

Phase 6 (presentation only, feature freeze). Nothing here changes an analysis result:
- simulation data is read from committed files (results/*.parquet, figures/*_numbers.json), through the
  figure scripts' own selection functions where they exist (imported, never copied);
- theory curves are evaluated by calling the frozen library functions unchanged (author decision 2026-10-14).
Every number the site prints is exported as {"value": v, "src": "<file>#<JSON pointer>"} so that
tests/test_site_data.py can check it against its source. Plotted arrays are rounded to 6 significant figures
(drawing only) and are recomputed and compared by the same test.
Each file carries provenance: the git revision and the sha256 of every source file (data and code).

Files (so far): site.json (repository, references, source links), curve.json (the universal curve).
Run:  .venv/Scripts/python scripts/export_site_data.py
"""

from __future__ import annotations

import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path

import numpy as np
import pandas as pd

from oberth_atlas.plotting import git_revision

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
OUT = ROOT / "site" / "public" / "data"
TAG = "v1.0-analysis"
SIG = 6                                           # significant figures for plotted arrays


# ---------------------------------------------------------------- helpers

def sha256(rel: str) -> str:
    return hashlib.sha256((ROOT / rel).read_bytes()).hexdigest()


def provenance(sources: list[str]) -> dict:
    return {"git": git_revision(), "generated_by": "scripts/export_site_data.py",
            "sources": {s: sha256(s) for s in sorted(set(sources))}}


def round_sig(a, sig: int = SIG) -> list:
    """Round to `sig` significant figures; NaN/inf become None (JSON null)."""
    out = []
    for v in np.asarray(a, dtype=float).ravel():
        out.append(None if not np.isfinite(v) else float(f"{v:.{sig - 1}e}"))
    return out


def pointer_escape(key: str) -> str:
    return key.replace("~", "~0").replace("/", "~1")


class Numbers:
    """Reads values from figures/*_numbers.json and returns them with a source pointer."""

    def __init__(self):
        self.cache: dict[str, dict] = {}
        self.used: set[str] = set()

    def __call__(self, rel: str, *keys) -> dict:
        if rel not in self.cache:
            self.cache[rel] = json.loads((ROOT / rel).read_text(encoding="utf-8"))
        node = self.cache[rel]
        for k in keys:
            node = node[k]
        self.used.add(rel)
        return {"value": node, "src": rel + "#/" + "/".join(pointer_escape(str(k)) for k in keys)}


def references() -> list[dict]:
    """The numbered reference list of docs/paper_outline.md (the paper's numbering)."""
    text = (ROOT / "docs" / "paper_outline.md").read_text(encoding="utf-8")
    block = text.split("## References", 1)[1]
    refs, cur = [], None
    for line in block.splitlines():
        m = re.match(r"^(\d+)\.\s+(.*)", line)
        if m:
            cur = {"n": int(m.group(1)), "text": m.group(2).strip()}
            refs.append(cur)
        elif cur and line.startswith("   ") and line.strip():
            cur["text"] += " " + line.strip()
        elif line.startswith("## "):
            break
    return refs


def ref_number(refs: list[dict], surname: str) -> int:
    hits = [r["n"] for r in refs if surname in r["text"]]
    if len(hits) != 1:
        raise ValueError(f"reference for {surname!r}: {hits}")
    return hits[0]


def repo_info() -> dict:
    url = subprocess.run(["git", "remote", "get-url", "origin"], capture_output=True, text=True,
                         check=True, cwd=ROOT).stdout.strip()
    url = re.sub(r"\.git$", "", url)
    return {"url": url, "tag": TAG}


def source_ref(rel: str) -> str:
    """Link target for a source file: the tag if the file is unchanged since it, else the current commit."""
    same = subprocess.run(["git", "diff", "--quiet", TAG, "--", rel], cwd=ROOT).returncode == 0
    return TAG if same else git_revision()


def write(name: str, payload: dict) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    text = json.dumps(payload, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
    (OUT / name).write_text(text + "\n", encoding="utf-8")
    print(f"wrote site/public/data/{name}: {len(text) / 1024:.1f} KB")


# ---------------------------------------------------------------- site.json

def export_site(refs: list[dict], linked: list[str]) -> None:
    write("site.json", {
        "provenance": provenance(["docs/paper_outline.md"]),
        "repo": repo_info(),
        "references": refs,
        "source_links": {rel: source_ref(rel) for rel in sorted(set(linked))},
    })


# ---------------------------------------------------------------- curve.json (the universal curve)

def curve_data(num: Numbers, refs: list[dict]) -> tuple[dict, list[str]]:
    import fig_hero as H
    import fig_loss_vinf as V

    p = pd.read_parquet(ROOT / "results" / "phase4.parquet")
    curves = H.profile_curves(p)
    x = np.logspace(-3, np.log10(3000), 400)                     # the hero figure's grid
    Y = np.vstack([H.on_grid(c, x) for c in curves.values()])
    lo, hi = np.nanmin(Y, axis=0), np.nanmax(Y, axis=0)

    hero, anim, p4 = "figures/hero_numbers.json", "figures/anim_numbers.json", "figures/phase4_numbers.json"
    lv = "figures/loss_vinf_numbers.json"
    hib, mar = ref_number(refs, "Hibberd"), ref_number(refs, "Maraqten")

    cases = [
        {"id": "hibberd", "label": "Hibberd et al.", "ref": hib, "kind": "published",
         "detail": "3I/ATLAS solar Oberth: CASTOR 30B + STAR 48B solid stack",
         "Pi": num(hero, "hibberd", "Pi"), "loss_rel": num(hero, "hibberd", "loss_rel"),
         "loss_m_s": num(p4, "reference", "time_centred", "dv_loss_m_s"), "data": p4},
        {"id": "ntp", "label": "Nuclear thermal", "ref": None, "kind": "simulation",
         "detail": "the same dive flown with one nuclear-thermal stage (Isp 900 s, a0 = 0.5 m/s²)",
         "Pi": num(anim, "nuclear_thermal", "Pi"), "loss_rel": num(anim, "nuclear_thermal", "loss_rel"),
         "loss_m_s": num(anim, "nuclear_thermal", "loss_m_s"), "data": anim},
        {"id": "sep", "label": "SEP-class", "ref": None, "kind": "simulation",
         "detail": "the same dive flown with one SEP-class stage (Isp 6000 s); hypothetical at 3.2 R☉",
         "Pi": num(anim, "sep_class", "Pi"), "loss_rel": num(anim, "sep_class", "loss_rel"),
         "loss_m_s": num(anim, "sep_class", "loss_m_s"), "data": anim},
        {"id": "maraqten", "label": "Maraqten et al.", "ref": mar, "kind": "published-range",
         "detail": "SEP perihelion arc at 0.3 au with their F ∝ r^−1.5 thrust, placed at Π_eff",
         "Pi_range": num(hero, "maraqten_Pi_eff_range"), "loss_rel_range": num(hero, "maraqten_loss_rel_range"),
         "data": hero},
    ]
    ranges = [{"id": key.split(" ")[0], "label": key, "n": num(hero, "solar_samples", key, "n_above_floor"),
               "Pi": num(hero, "solar_samples", key, "Pi_p10_med_p90"),
               "loss_rel": num(hero, "solar_samples", key, "loss_rel_p10_med_p90"), "data": hero}
              for key in ("chemical", "nuclear thermal", "electric (Hall, ion)")]

    d = V.data()
    family = []
    for vr in V.VR:
        bx, by, bn = V.binned(d[d["vr"] == vr])
        key = f"{vr:g}"
        k = num(lv, "by_v_over_vesc", key, "k")
        xs = np.logspace(-3, 0.5, 50)
        family.append({
            "v_over_vesc": vr, "k": k,
            "coeff": num(lv, "by_v_over_vesc", key, "leading_order_coeff_k(1-k)/24"),
            "Pi_at_1pct": num(lv, "by_v_over_vesc", key, "Pi_at_1pct"),
            "Pi_at_0.1pct": num(lv, "by_v_over_vesc", key, "Pi_at_0.1pct"),
            "n_runs": num(lv, "by_v_over_vesc", key, "n_runs"),
            "median": {"Pi": round_sig(bx), "loss_rel": round_sig(by), "n": [int(v) for v in bn]},
            "theory": {"Pi": round_sig(xs), "loss_rel": round_sig(k["value"] * (1 - k["value"]) * xs**2 / 24)},
        })

    payload = {
        "band": {"Pi": round_sig(x), "lo": round_sig(lo), "hi": round_sig(hi), "profiles": list(curves),
                 "max_over_min": {f"Pi={v:g}": num(hero, "band_max_over_min", f"Pi={v:g}")
                                  for v in (0.01, 0.1, 1.0, 10.0, 100.0, 1000.0)},
                 "data": "results/phase4.parquet"},
        "bound": {"Pi": round_sig(x[x <= 10]), "loss_rel": round_sig(x[x <= 10] ** 2 / 96),
                  "statement": num("figures/rule_numbers.json", "rule"),
                  "max_ratio_Pi_le_1": num("figures/rule_numbers.json", "sweep_prograde_Pi_le_1", "max_R_over_bound"),
                  "data": "figures/rule_numbers.json"},
        "thresholds": [{"level": "0.1%", "loss_rel": 1e-3, "Pi": num(p4, "thresholds", "time_centred", "0.1%", "Pi")},
                       {"level": "1%", "loss_rel": 1e-2, "Pi": num(p4, "thresholds", "time_centred", "1%", "Pi")}],
        "cases": cases,
        "ranges": ranges,
        "arrival_family": {"selection": {"dv_over_vp_max": num(lv, "selection", "dv_over_vp_max"),
                                         "dv_over_c_max": num(lv, "selection", "dv_over_c_max"),
                                         "n_runs": num(lv, "selection", "n_runs")},
                           "curves": family, "data": lv},
    }
    sources = ["results/phase4.parquet", "results/sweep_nd.parquet", "scripts/fig_hero.py", "scripts/fig_loss_vinf.py",
               "docs/paper_outline.md", *num.used]
    linked = [c["data"] for c in cases] + [r["data"] for r in ranges] + [payload["bound"]["data"], lv, "results/phase4.parquet"]
    return {"provenance": provenance(sources), **payload}, linked


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    refs = references()
    num = Numbers()
    curve, linked = curve_data(num, refs)
    write("curve.json", curve)
    export_site(refs, linked)


if __name__ == "__main__":
    main()
