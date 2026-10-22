"""Export the website's data: site/public/data/*.json from committed results and numbers JSONs.

Phase 6 (presentation only, feature freeze). Nothing here changes an analysis result:
- simulation data is read from committed files (results/*.parquet, figures/*_numbers.json), through the
  figure scripts' own selection functions where they exist (imported, never copied);
- theory curves are evaluated by calling the frozen library functions unchanged (author decision 2026-10-14).
Every number the site prints is exported as {"value": v, "src": "<file>#<JSON pointer>"} so that
tests/test_site_data.py can check it against its source. Plotted arrays are rounded to 6 significant figures
(drawing only) and are recomputed and compared by the same test.
Each file carries provenance: the git revision and the sha256 of every source file (data and code).

Files:
- site.json      repository, references (paper-outline numbering), source links      (eager)
- curve.json     the universal curve                                                   (eager)
- hero.json      the live flyby's case: Hibberd's dive, engine marks on the Π axis     (eager)
- regimes.json   η and η_W against Π per v∞/v_esc, asymptotes, Π_T                     (lazy)
- atlas.json     η cells per Δv/V slice and steering law, impact contours, theory, SOI  (lazy)
- missions.json  the Phase 2 mission samples (prograde)                                (lazy)
- engines.json + engines.bin   the animation's three trajectories (Float32)            (lazy)
- timing.json    burn-timing closed forms over Δv/c, with the Phase 3 check values    (lazy)
- case.json      Hibberd et al.'s burn: reference losses, thrust-margin curve          (lazy)
- methods.json   tag, commit, test count, J2 and rule checks                           (lazy)
- presets.json   explorer bodies, engines and the Δv→0 theory atlas                    (explorer)
- site_numbers.json  derived values the author may quote (read by scripts/check_numbers.py)
Run:  .venv/Scripts/python scripts/export_site_data.py [--only name ...]
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
import re
import subprocess
import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
OUT = ROOT / "site" / "public" / "data"
TAG = "v1.0-analysis"
SIG = 6                                           # significant figures for plotted arrays


# ---------------------------------------------------------------- helpers

def git_revision() -> str:
    """Short commit, with '-dirty' if anything other than generated outputs (figures/, this script's output
    directory) is uncommitted. Like plotting.git_revision, which cannot exclude the site data directory."""
    run = lambda *a: subprocess.run(["git", *a], capture_output=True, text=True, check=True, cwd=ROOT).stdout.strip()
    sha = run("rev-parse", "--short", "HEAD")
    dirty = run("status", "--porcelain", "--", ".", ":(exclude)figures", ":(exclude)site/public/data")
    return sha + ("-dirty" if dirty else "")


def sha256(rel: str) -> str:
    """sha256 of the file with CRLF read as LF: a checkout's line endings (core.autocrlf) must not change the hash.

    Text files then hash as git stores them; binary files are byte-identical in every checkout, so the same
    normalization keeps their hash consistent too. Found by the fresh-clone audit of 2026-10-18.
    """
    return hashlib.sha256((ROOT / rel).read_bytes().replace(b"\r\n", b"\n")).hexdigest()


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


def load_source(rel: str):
    """A source document: a numbers JSON, a YAML config, or the return value of a frozen script's function
    (`scripts/x.py#func()`: the document is `func()`, called with no arguments)."""
    if "#" in rel:
        path, call = rel.split("#", 1)
        mod = __import__(Path(path).stem)
        return getattr(mod, call.removesuffix("()"))()
    text = (ROOT / rel).read_text(encoding="utf-8")
    if rel.endswith((".yaml", ".yml")):
        import yaml
        return yaml.safe_load(text)
    if rel.endswith(".csv"):                        # rows as dicts; numeric cells as floats
        def cell(v: str):
            try:
                return float(v)
            except ValueError:
                return v
        return [{k: cell(v) for k, v in row.items()} for row in csv.DictReader(text.splitlines())]
    return json.loads(text)


def resolve(src: str):
    """Value at `<document>#/<pointer>` (RFC 6901 pointer; list indices allowed)."""
    doc, ptr = src.rsplit("#/", 1) if "#/" in src else (src, "")
    node = load_source(doc)
    for part in filter(None, ptr.split("/")):
        key = part.replace("~1", "/").replace("~0", "~")
        node = node[int(key)] if isinstance(node, (list, tuple)) else node[key]
    return node


class Numbers:
    """Reads values from numbers JSONs, configs or frozen script functions, with a source pointer."""

    def __init__(self):
        self.cache: dict[str, object] = {}
        self.used: set[str] = set()

    def __call__(self, rel: str, *keys) -> dict:
        if rel not in self.cache:
            self.cache[rel] = load_source(rel)
        node = self.cache[rel]
        for k in keys:
            node = node[k]
        if isinstance(node, tuple):
            node = list(node)
        self.used.add(rel.split("#", 1)[0])
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
    """Link target for a source file: the tag if the committed file is unchanged since it, else HEAD's commit.

    Committed files are compared, not the working tree: a link names a git object, and a rebuilt checkout's
    regenerated outputs differ from the tag only in their stamps. Never '-dirty', which is not a ref
    (RESEARCH_LOG 2026-10-19)."""
    same = subprocess.run(["git", "diff", "--quiet", TAG, "HEAD", "--", rel], cwd=ROOT).returncode == 0
    head = subprocess.run(["git", "rev-parse", "--short", "HEAD"], capture_output=True, text=True, check=True,
                          cwd=ROOT).stdout.strip()
    return TAG if same else head


def write(name: str, payload: dict) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    text = json.dumps(payload, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
    (OUT / name).write_text(text + "\n", encoding="utf-8")
    print(f"wrote site/public/data/{name}: {len(text) / 1024:.1f} KB")


# ---------------------------------------------------------------- site.json

def citation_info() -> dict:
    """The project's citation, from CITATION.cff (its single source, author 2026-10-21), for the site footer."""
    import yaml
    c = yaml.safe_load((ROOT / "CITATION.cff").read_text(encoding="utf-8"))
    return {"title": c["title"], "authors": [{"given": a["given-names"], "family": a["family-names"]} for a in c["authors"]],
            "version": c.get("version"), "date_released": str(c["date-released"]) if c.get("date-released") else None,
            "repository": c["repository-code"], "url": c.get("url"), "license": c.get("license")}


def export_site(refs: list[dict], linked: list[str]) -> None:
    write("site.json", {
        "provenance": provenance(["docs/paper_outline.md", "CITATION.cff"]),
        "repo": repo_info(),
        "citation": citation_info(),
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
    lv, som = "figures/loss_vinf_numbers.json", "configs/phase4/hibberd_som.yaml"
    titles = "scripts/anim_engines.py#build_cases()"        # the animation's own case titles (frozen code)
    hib, mar = ref_number(refs, "Hibberd"), ref_number(refs, "Maraqten")

    # Descriptions carry no hand-typed numbers: they are the animation's case titles, or templates whose
    # {fields} are filled from source pointers by the site.
    cases = [
        {"id": "hibberd", "label": "Hibberd et al.", "ref": hib, "kind": "published",
         "detail": num(titles, 0, 0, 0),
         "Pi": num(hero, "hibberd", "Pi"), "loss_rel": num(hero, "hibberd", "loss_rel"),
         "loss_m_s": num(p4, "reference", "time_centred", "dv_loss_m_s"), "data": p4},
        # The same dive flown by other engines (author, 2026-10-15): labelled by the site as Hibberd's dive.
        {"id": "ntp", "label": "Nuclear thermal", "ref": None, "kind": "simulation", "dive_of": "hibberd",
         "detail": num(titles, 0, 1, 0),
         "Pi": num(anim, "nuclear_thermal", "Pi"), "loss_rel": num(anim, "nuclear_thermal", "loss_rel"),
         "loss_m_s": num(anim, "nuclear_thermal", "loss_m_s"), "data": anim},
        {"id": "sep", "label": "SEP-class", "ref": None, "kind": "simulation", "dive_of": "hibberd",
         "detail": num(titles, 0, 2, 0),
         "Pi": num(anim, "sep_class", "Pi"), "loss_rel": num(anim, "sep_class", "loss_rel"),
         "loss_m_s": num(anim, "sep_class", "loss_m_s"), "data": anim},
        {"id": "maraqten", "label": "Maraqten et al.", "ref": mar, "kind": "published-range",
         "detail": {"template": "SEP perihelion arc at {r_p} au, thrust ∝ r^−{kappa}, placed at Π_eff",
                    "fields": {"r_p": num(som, "sep_maraqten2026", "r_p_au"),
                               "kappa": num(som, "sep_maraqten2026", "power_exponent_kappa")}},
         "Pi_range": num(hero, "maraqten_Pi_eff_range"), "loss_rel_range": num(hero, "maraqten_loss_rel_range"),
         "data": hero},
    ]
    stat = "Pi_p10_med_p90"                                     # the percentiles are read from the key name
    lo_p, hi_p = (int(v) for v in re.fullmatch(r"Pi_p(\d+)_med_p(\d+)", stat).groups())
    ranges = [{"id": key.split(" ")[0], "label": key, "n": num(hero, "solar_samples", key, "n_above_floor"),
               "percentiles": [lo_p, hi_p], "Pi": num(hero, "solar_samples", key, stat),
               "loss_rel": num(hero, "solar_samples", key, "loss_rel_p10_med_p90"), "data": hero}
              for key in num.cache.setdefault(hero, load_source(hero))["solar_samples"]]

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

    # The band's spread across thrust profiles over the whole plotted range (RESEARCH_LOG 2026-10-15: the numbers
    # JSON samples it at six Π values only; its maximum lies between samples).
    ratio = hi / lo
    i_max = int(np.nanargmax(ratio))
    payload = {
        "band": {"Pi": round_sig(x), "lo": round_sig(lo), "hi": round_sig(hi), "profiles": list(curves),
                 "max_over_min": {f"Pi={v:g}": num(hero, "band_max_over_min", f"Pi={v:g}")
                                  for v in (0.01, 0.1, 1.0, 10.0, 100.0, 1000.0)},
                 "spread": {"max_over_min": float(ratio[i_max]), "at_Pi": float(x[i_max]),
                            "Pi_range": [float(x[0]), float(x[-1])],
                            "computed_from": "band = fig_hero.profile_curves/on_grid on results/phase4.parquet"},
                 "data": "results/phase4.parquet"},
        "bound": {"Pi": round_sig(x[x <= 10]), "loss_rel": round_sig(x[x <= 10] ** 2 / 96),
                  "statement": num("figures/rule_numbers.json", "rule"),
                  "max_ratio_Pi_le_1": num("figures/rule_numbers.json", "sweep_prograde_Pi_le_1", "max_R_over_bound"),
                  "data": "figures/rule_numbers.json"},
        # Threshold levels are the numbers JSON's own keys ("0.1%", "1%"), parsed, not typed here.
        "thresholds": [{"level": key, "loss_rel": float(key.rstrip("%")) / 100,
                        "Pi": num(p4, "thresholds", "time_centred", key, "Pi")}
                       for key in json.loads((ROOT / p4).read_text(encoding="utf-8"))["thresholds"]["time_centred"]],
        "cases": cases,
        "ranges": ranges,
        "arrival_family": {"selection": {"dv_over_vp_max": num(lv, "selection", "dv_over_vp_max"),
                                         "dv_over_c_max": num(lv, "selection", "dv_over_c_max"),
                                         "n_runs": num(lv, "selection", "n_runs")},
                           "curves": family, "data": lv},
    }
    sources = ["results/phase4.parquet", "results/sweep_nd.parquet", "scripts/fig_hero.py", "scripts/fig_loss_vinf.py",
               "scripts/run_phase4.py", "docs/paper_outline.md", *num.used]
    linked = [c["data"] for c in cases] + [r["data"] for r in ranges] + [payload["bound"]["data"], lv, "results/phase4.parquet"]
    return {"provenance": provenance(sources), **payload}, linked


# ---------------------------------------------------------------- hero.json (the live flyby)

SOM, P4, ANIM = "configs/phase4/hibberd_som.yaml", "figures/phase4_numbers.json", "figures/anim_numbers.json"
TITLES = "scripts/anim_engines.py#build_cases()"         # the animation's own case titles (frozen code)


def thresholds(num: Numbers) -> list[dict]:
    """The 0.1 % and 1 % loss points of Hibberd's stack (levels parsed from the numbers JSON's keys)."""
    keys = load_source(P4)["thresholds"]["time_centred"]
    return [{"level": key, "loss_rel": float(key.rstrip("%")) / 100, "Pi": num(P4, "thresholds", "time_centred", key, "Pi")}
            for key in keys]


def hero_data(num: Numbers) -> dict:
    """Hibberd et al.'s solar dive for the site's live JS simulation (RESEARCH_LOG 2026-10-15): parabolic arrival
    (the JS simulator takes hyperbolic or parabolic arrivals; Phase 4's arrival-orbit sensitivity is quoted), and
    one equivalent constant-thrust stage with the stack's rocket-equation Δv and the STAR 48B exhaust velocity
    (Hibberd et al. Table 2), as in the existing explorer's Hibberd preset."""
    import run_phase4 as P
    from oberth_atlas.constants import GM_SUN
    V = math.sqrt(GM_SUN / P.R_P)                          # velocity unit at r_p, m/s
    dv = num(P4, "stack", "dv_rocket_m_s")
    c = num(SOM, "stages", 1, "exhaust_velocity_km_s")
    names = {"solid_stack": 0, "nuclear_thermal": 1, "sep_class": 2}
    marks = [{"id": key, "title": num(TITLES, 0, i, 0), "Pi": num(ANIM, key, "Pi")} for key, i in names.items()]
    sens = "reference (aphelion 5.2 au, no staging coast)"
    return {
        "provenance": provenance([SOM, P4, ANIM, "scripts/anim_engines.py", "scripts/run_phase4.py",
                                  "src/oberth_atlas/constants.py", *num.used]),
        "geometry": {"r_p_over_R_sun": num(SOM, "som", "r_p_over_R_sun"), "arrival": "parabolic",
                     "arrival_sensitivity_m_s": {"parabolic": num(P4, "sensitivity_m_s", "parabolic arrival", "time_centred"),
                                                 "reference": num(P4, "sensitivity_m_s", sens, "time_centred")}},
        "propulsion": {"dv_m_s": dv, "c_km_s": c, "stage": num(SOM, "stages", 1, "name")},
        "reference": {"Pi": num(P4, "stack", "Pi"), "tau_s": num(P4, "stack", "tau_s"), "burn_s": num(P4, "stack", "duration_s")},
        "units": {"V_m_s": V, "time_s": P.R_P / V, "av_W_per_kg": V**3 / P.R_P,
                  "computed_from": "V = sqrt(constants.GM_SUN / run_phase4.R_P); time = R_P / V; a·v unit = V^3 / R_P"},
        "nd": {"v_inf": 0.0, "dv": dv["value"] / V, "c": c["value"] * 1000.0 / V},
        "marks": marks,
        "thresholds": thresholds(num),
    }


# ---------------------------------------------------------------- regimes.json

def regimes_data(num: Numbers) -> dict:
    """The selection of scripts/fig_regimes.py (reliable, prograde, Δv/v_p < 0.03), binned in log Π per v∞/v_esc,
    with the asymptotes it draws (I: 1 − C₀Π², II: (9/(2Π))^(1/3), III: tail beyond 30 Π_T) and the Δv→0 curve."""
    from oberth_atlas import theory
    from oberth_atlas.analysis import load, reliable
    df = load(ROOT / "results" / "sweep_nd.parquet")
    d = df[reliable(df) & (df["steering"] == "prograde") & (df["dv_over_vp"] < 0.03)]
    bins = np.logspace(-3, 7, 41)                             # 4 bins per decade
    P = np.logspace(-3, 7, 160)
    half = "figures/regimes_half_point.csv"
    half_rows = load_source(half)
    families = []
    for vr, g in d.groupby("v_inf_over_vesc"):
        rows = []
        for _, s in g.groupby(np.digitize(g["Pi"], bins)):
            if len(s) >= 3:
                rows.append([np.exp(np.log(s["Pi"]).mean()), s["eta_W"].median(), s["eta_W"].quantile(0.1),
                             s["eta_W"].quantile(0.9), s["eta"].median(), len(s)])
        rows = np.array(rows)
        v = vr * math.sqrt(2.0)
        c0 = theory.small_pi_prefactor(v, 1e-9, np.inf)
        PiT = theory.tail_crossover_pi(v)
        small, core, tail = P[P < 1.0], P[P > 3.0], P[P > 30 * PiT]
        families.append({
            "v_over_vesc": float(vr), "Pi_T": PiT, "c0": c0, "n_runs": int(len(g)),
            "bins": {"Pi": round_sig(rows[:, 0]), "eta_W": round_sig(rows[:, 1]), "eta_W_p10": round_sig(rows[:, 2]),
                     "eta_W_p90": round_sig(rows[:, 3]), "eta": round_sig(rows[:, 4]), "n": [int(n) for n in rows[:, 5]]},
            "linear": {"Pi": round_sig(P), "eta_W": round_sig([theory.linear_response_eta(v, x) for x in P])},
            "small": {"Pi": round_sig(small), "eta_W": round_sig(1 - c0 * small**2)},
            "core": {"Pi": round_sig(core), "eta_W": round_sig(theory.parabolic_core_asymptote(core))},
            "tail": {"Pi": round_sig(tail), "eta_W": round_sig([theory.large_pi_asymptote(v, x) for x in tail])},
            # η_W = 0.5 points per (Δv, c) family: compact arrays (6 significant figures) from the CSV, which
            # tests/test_site_data.py re-reads and compares.
            "half_point": {k: round_sig([r[k] for r in half_rows if r["v_inf_over_vesc"] == vr and np.isfinite(r["Pi_half_data"])])
                           for k in ("Pi_half_data", "Pi_half_theory", "dv_over_vp")},
        })
    return {
        "provenance": provenance(["results/sweep_nd.parquet", "scripts/fig_regimes.py", "src/oberth_atlas/theory.py", half]),
        "selection": "reliable, prograde, dv_over_vp < 0.03 (scripts/fig_regimes.py)",
        "eta_minus_eta_W_max_abs": float(np.max(np.abs(d["eta"] - d["eta_W"]))),
        "families": families,
    }


# ---------------------------------------------------------------- atlas.json and missions.json

def atlas_data() -> dict:
    """The cells of scripts/fig_atlas.py (three Δv/V slices, c̃ nearest 1, both steering laws), its impact
    contours (h = 0.1 R and 1 R), per-body SOI radii, and Δv→0 theory contours (linear response)."""
    import contourpy
    import fig_atlas as FA
    from oberth_atlas import theory
    from oberth_atlas.analysis import load, reliable
    from oberth_atlas.constants import BODIES
    df = load(ROOT / "results" / "sweep_nd.parquet")
    df["ok"] = reliable(df)
    v_axis, a_axis = np.sort(df["v_inf"].unique()), np.sort(df["a0"].unique())
    dv_vals, c_vals = np.sort(df["dv"].unique()), np.sort(df["c"].unique())
    c_sel = c_vals[np.argmin(np.abs(np.log(c_vals / FA.C_TARGET)))]
    lines = lambda gen, level: [round_sig(seg.ravel()) for seg in gen.lines(level)]
    slices = []
    for target in FA.DV_TARGETS:
        dv = dv_vals[np.argmin(np.abs(np.log(dv_vals / target)))]
        for law in ("prograde", "inertial"):
            g = df[(df["steering"] == law) & (df["dv"] == dv) & (df["c"] == c_sel)]
            grid = g.pivot_table(index="v_inf", columns="a0", values=["eta", "r_min", "r_burn_start", "Pi"],
                                 aggfunc="first").reindex(index=v_axis)
            okg = g.pivot_table(index="v_inf", columns="a0", values="ok", aggfunc="first").reindex(index=v_axis)
            eta, rmin, rbs, Pi = (grid[k].reindex(columns=a_axis).to_numpy() for k in ("eta", "r_min", "r_burn_start", "Pi"))
            ok = okg.reindex(columns=a_axis).to_numpy().astype(bool)
            vp_e = np.sqrt(FA._edges(v_axis) ** 2 + 2.0)
            tb_e = (c_sel / FA._edges(a_axis)) * -np.expm1(-dv / c_sel)
            X = tb_e[None, :] * vp_e[:, None]
            Yc = np.broadcast_to((v_axis / np.sqrt(2.0))[:, None], Pi.shape)
            impact = rmin < FA.R_OVER_RP_MASK
            gen = contourpy.contour_generator(x=Pi, y=Yc, z=np.ma.masked_invalid(rmin), line_type="Separate")
            slices.append({
                "dv_over_V": float(dv), "c_over_V": float(c_sel), "steering": law,
                "Pi_edges": [round_sig(row) for row in X], "v_over_vesc_edges": round_sig(FA._edges(v_axis) / np.sqrt(2.0)),
                "eta": [round_sig(np.where(ok[i] & ~impact[i], eta[i], np.nan)) for i in range(len(v_axis))],
                "impact": impact.astype(int).tolist(), "unreliable": (~ok & ~impact).astype(int).tolist(),
                "r_burn_start": [round_sig(row, 4) for row in rbs],
                "impact_contours": {"h=0.1R": lines(gen, FA.R_OVER_RP_MASK), "h=1R": lines(gen, FA.R_OVER_RP_ALT)},
            })
    # Δv→0 theory (linear response), contoured on a log grid spanning the atlas.
    lp = np.linspace(-3, 7, 121)
    lv = np.linspace(np.log10(v_axis.min() / np.sqrt(2.0)), np.log10(v_axis.max() / np.sqrt(2.0)), 41)
    theory_lines = {}
    for law in ("prograde", "inertial"):
        Z = np.array([[theory.linear_response_eta(10 ** b * math.sqrt(2.0), 10 ** a, steering=law) for a in lp] for b in lv])
        gen = contourpy.contour_generator(x=lp, y=lv, z=Z, line_type="Separate")
        theory_lines[law] = {f"{lev:g}": [round_sig(10 ** seg.ravel()) for seg in gen.lines(lev)] for lev in (0.5, 0.9, 0.99)}
    bodies = [{"id": k, "r_soi_over_R": b.soi_radius / b.radius_eq} for k, b in BODIES.items() if math.isfinite(b.soi_radius)]
    return {
        "provenance": provenance(["results/sweep_nd.parquet", "scripts/fig_atlas.py", "src/oberth_atlas/theory.py",
                                  "src/oberth_atlas/constants.py"]),
        "mask_r_p_over_R": 1.0 / FA.R_OVER_RP_MASK, "alt_r_p_over_R": 1.0 / FA.R_OVER_RP_ALT,
        "slices": slices, "theory_contours": theory_lines, "bodies": bodies,
        "theory_note": "linear-response η (Δv → 0, constant acceleration): theory.linear_response_eta",
    }


def missions_data() -> dict:
    """The Phase 2 mission samples (prograde, status ok), as plotted by scripts/fig_missions.py."""
    import yaml
    m = pd.read_parquet(ROOT / "results" / "missions.parquet")
    pro = m[(m["steering"] == "prograde") & (m["status"] == "ok")]
    pre = yaml.safe_load((ROOT / "configs" / "atlas" / "presets.yaml").read_text(encoding="utf-8"))
    bodies, engines = sorted(pro["body"].unique()), list(pre["engines"])
    return {
        "provenance": provenance(["results/missions.parquet", "scripts/fig_missions.py", "configs/atlas/presets.yaml"]),
        "bodies": bodies, "engines": engines, "engine_labels": {k: pre["engines"][k]["label"] for k in engines},
        "Pi": round_sig(pro["Pi"], 4), "v_over_vesc": round_sig(pro["v_inf_over_vesc"], 4), "eta": round_sig(pro["eta"], 4),
        "inside_soi": (pro["soi_ratio_burn_start"] <= 1.0).astype(int).tolist(),
        "body": [bodies.index(b) for b in pro["body"]], "engine": [engines.index(e) for e in pro["engine"]],
    }


# ---------------------------------------------------------------- engines.json + engines.bin

ENGINE_STRIDE = 3                                    # every 3rd of the animation's 6000 samples

def engines_data(num: Numbers) -> tuple[dict, bytes]:
    """The animation's own trajectories (scripts/anim_engines.py: build_cases and trajectory, imported; the window
    and normalizations as in its build_figure). Arrays are Float32, little-endian, in one binary file."""
    import anim_engines as A
    cases, S, vp, dv = A.build_cases()
    tau = 1.0 / vp
    t_half = max(sum(s.burn_time for s in st) for _, st in cases) / 2
    window_tau = 1.25 * t_half / tau
    trajs = [A.trajectory(st, vp, window_tau) for _, st in cases]
    eps0 = 0.5 * vp**2 - 1.0
    deps_imp = 0.5 * (vp + dv) ** 2 - 1.0 - eps0
    blobs, layout, offset = [], [], 0
    t = trajs[0]["t"][::ENGINE_STRIDE]
    def add(name: str, arr) -> dict:
        nonlocal offset
        a = np.asarray(arr, dtype="<f4")
        blobs.append(a.tobytes())
        entry = {"name": name, "offset": offset, "length": int(a.size)}
        offset += a.nbytes
        return entry
    layout.append(add("t", t))
    keys = ("solid_stack", "nuclear_thermal", "sep_class")
    out_cases = []
    for i, (tr, key) in enumerate(zip(trajs, keys)):
        frac = (tr["eps"] - eps0) / deps_imp
        arrays = [add(f"{key}.{k}", v[::ENGINE_STRIDE]) for k, v in
                  (("x", tr["x"]), ("y", tr["y"]), ("av", tr["av"]), ("energy_fraction", frac))]
        r = tr["res"]
        out_cases.append({"id": key, "title": num(TITLES, 0, i, 0), "Pi": num(ANIM, key, "Pi"),
                          "loss_rel": num(ANIM, key, "loss_rel"), "burn_s": num(ANIM, key, "burn_s"),
                          "arrays": arrays, "sim_Pi": r.Pi, "sim_loss_rel": r.dv_loss_rel})
    header = {
        "provenance": provenance(["scripts/anim_engines.py", "scripts/run_phase4.py", ANIM, SOM]),
        "binary": "engines.bin", "dtype": "float32-le", "stride": ENGINE_STRIDE,
        "units": {"time_s": S.time, "length_m": S.length, "av_W_per_kg": S.acceleration * S.velocity,
                  "tau": tau, "window_tau": window_tau, "r_p_over_R_sun": num(SOM, "som", "r_p_over_R_sun")},
        "time": layout[0], "cases": out_cases,
    }
    return header, b"".join(blobs)


# ---------------------------------------------------------------- timing.json

def timing_data(num: Numbers) -> dict:
    """Burn-timing closed forms over λ = Δv/c (src/oberth_atlas/optimize.py, theory.py), with Phase 3's check values."""
    from oberth_atlas import optimize as O
    from oberth_atlas import theory
    p3 = "figures/phase3_numbers.json"
    checks = sorted(float(k.split("=")[1]) for k in load_source(p3)["small_pi_fraction_limit_dv0"])
    lams = np.unique(np.concatenate([np.logspace(-2, np.log10(3), 41), checks]))
    x = np.linspace(0, 1, 51)
    rows = []
    for lam in lams:
        xb, xm = O.x_centroid(lam), O.x_median(lam)
        f, _ = theory._profile(lam)
        rows.append({"lam": float(lam), "x_centroid": xb, "x_median": xm, "delta_opt": O.timing_theory_delta(lam),
                     "delta_half": O.timing_half_dv_delta(lam), "half_rule_capture": O.timing_rule_capture(lam, xm),
                     "recovered_fraction_dv0": (xb - 0.5) ** 2 / theory.profile_moments(lam, 0.5).m2,
                     "profile": round_sig(f(x))})
    key = lambda lam: f"lam={lam:g}"
    check = [{"lam": lam,
              "recovered_fraction_dv0": num(p3, "small_pi_fraction_limit_dv0", key(lam)),
              "x_centroid": num(p3, "followups", "half_dv_rule_closed_form", key(lam), "x_centroid"),
              "x_median": num(p3, "followups", "half_dv_rule_closed_form", key(lam), "x_median"),
              "half_rule_capture": num(p3, "followups", "half_dv_rule_closed_form", key(lam), "capture")}
             for lam in checks]
    return {"provenance": provenance(["src/oberth_atlas/optimize.py", "src/oberth_atlas/theory.py", p3]),
            "x": round_sig(x), "rows": rows, "phase3_checks": check}


# ---------------------------------------------------------------- case.json

def case_data(num: Numbers, refs: list[dict]) -> dict:
    """Hibberd et al.'s burn (Phase 4): reference losses, the thrust-margin curve, thresholds, sensitivities."""
    p = pd.read_parquet(ROOT / "results" / "phase4.parquet")
    sw = p[(p["kind"] == "sweep") & (p["placement"] == "time_centred")].sort_values("f")
    sens = load_source(P4)["sensitivity_m_s"]
    return {
        "provenance": provenance(["results/phase4.parquet", P4, SOM, "docs/paper_outline.md"]),
        "ref": ref_number(refs, "Hibberd"),
        "stack": {k: num(P4, "stack", k) for k in ("m0_kg", "dv_rocket_m_s", "hibberd_dv_m_s", "v_p_km_s", "tau_s", "duration_s", "Pi")},
        "loss_m_s": {k: num(P4, "reference", k, "dv_loss_m_s") for k in ("time_centred", "optimal")},
        "loss_rel": {k: num(P4, "reference", k, "loss_rel") for k in ("time_centred", "optimal")},
        "optimal_offset_s": num(P4, "reference", "optimal", "offset_s"),
        "thresholds": [{"level": key, **{k: num(P4, "thresholds", "time_centred", key, k)
                                         for k in ("Pi", "thrust_scale_divisor", "a0_m_s2", "burn_duration_s")}}
                       for key in load_source(P4)["thresholds"]["time_centred"]],
        "margin_curve": {"thrust_scale": round_sig(sw["f"]), "Pi": round_sig(sw["Pi"]), "loss_rel": round_sig(sw["loss_rel"]),
                         "loss_m_s": round_sig(sw["dv_loss_m_s"]), "data": "results/phase4.parquet"},
        "sensitivity_m_s": [{"label": k, "time_centred": num(P4, "sensitivity_m_s", k, "time_centred")} for k in sens],
    }


# ---------------------------------------------------------------- methods.json

AUDIT = "docs/audit/2026-10-19_f185234/summary.json"      # the latest fresh-clone audit (scripts/audit_record.py)


def methods_data(num: Numbers) -> dict:
    """Facts for the methods section and the landing page's reproducibility and scope block: the tag and its commit,
    the collected test count, two checks, the latest fresh-clone audit (its summary is computed by
    scripts/audit_record.py from the full comparison), and the scope (Phase 7): the mission engines and bodies of the
    atlas, and the sweep's size."""
    run = lambda *a: subprocess.run(list(a), capture_output=True, text=True, check=True, cwd=ROOT).stdout
    collected = run(sys.executable, "-m", "pytest", "--collect-only", "-q")
    n_tests = int(re.search(r"(\d+) tests? collected", collected).group(1))
    j2, rule = "figures/j2_numbers.json", "figures/rule_numbers.json"
    presets, p2 = "configs/atlas/presets.yaml", "figures/phase2_numbers.json"
    return {
        "provenance": provenance([j2, rule, "docs/repro.md", AUDIT, presets, p2]),
        "scope": {
            "engines": [num(presets, "engines", k, "label") for k in load_source(presets)["engines"]],
            "bodies": num(presets, "bodies"),
            "sweep_rows": num(p2, "sweep", "rows"),
        },
        "tag": TAG, "tag_commit": run("git", "rev-list", "-n", "1", TAG).strip()[:7],
        "tests_collected": n_tests,
        "j2_max_abs_delta_eta": num(j2, "max_abs_delta_eta"),
        "j2_max_rel_delta_deficit": num(j2, "max_rel_delta_deficit"),
        "rule_max_ratio_Pi_le_1": num(rule, "sweep_prograde_Pi_le_1", "max_R_over_bound"),
        "audit": {k: num(AUDIT, k) for k in ("date", "audited_commit", "outputs", "identical", "tests_passed", "packages_match_lock")},
        "repro_doc": "docs/repro.md",
    }


# ---------------------------------------------------------------- presets.json (explorer)

def presets_data() -> dict:
    """Explorer bodies, engines and the Δv→0 theory atlas: scripts/build_explorer.make_data (imported)."""
    import build_explorer as B
    d = B.make_data()
    return {"provenance": provenance(["scripts/build_explorer.py", "configs/atlas/presets.yaml",
                                      "src/oberth_atlas/constants.py", "src/oberth_atlas/theory.py"]),
            "bodies": d["bodies"], "engines": d["engines"], "g0": d["g0"], "dv_km_s": d["dv_km_s"],
            "theory_atlas": {"Pi": round_sig(d["atlas"]["Pi"]), "v_over_vesc": round_sig(d["atlas"]["v_over_vesc"]),
                             "eta": [round_sig(row) for row in d["atlas"]["eta"]]}}


# ---------------------------------------------------------------- site_numbers.json (quotable derived values)

def site_numbers_data() -> dict:
    """Values the site export derives that the author may quote in prose. scripts/check_numbers.py reads this file
    with figures/*_numbers.json, so a number quoted from it passes the numbers check."""
    from oberth_atlas.analysis import load, reliable
    import fig_hero as H
    df = load(ROOT / "results" / "sweep_nd.parquet")
    d = df[reliable(df) & (df["steering"] == "prograde") & (df["dv_over_vp"] < 0.03)].copy()   # the regimes selection
    d["diff"] = (d["eta"] - d["eta_W"]).abs()
    i = d["diff"].idxmax()
    by_v = []
    for vr, g in d.groupby("v_inf_over_vesc"):
        j = g["diff"].idxmax()
        by_v.append({"v_over_vesc": float(vr), "max_abs_diff": float(g.loc[j, "diff"]), "at_Pi": float(g.loc[j, "Pi"]),
                     "median_abs_diff": float(g["diff"].median()), "n_runs": int(len(g))})
    p = pd.read_parquet(ROOT / "results" / "phase4.parquet")
    curves = H.profile_curves(p)
    x = np.logspace(-3, np.log10(3000), 400)
    Y = np.vstack([H.on_grid(c, x) for c in curves.values()])
    ratio = np.nanmax(Y, axis=0) / np.nanmin(Y, axis=0)
    k = int(np.nanargmax(ratio))
    return {
        "provenance": provenance(["results/sweep_nd.parquet", "results/phase4.parquet", "scripts/fig_regimes.py",
                                  "scripts/fig_hero.py"]),
        "eta_vs_eta_W": {
            "selection": "reliable, prograde, dv_over_vp < 0.03 (the regimes figure's selection, scripts/fig_regimes.py)",
            "n_runs": int(len(d)),
            "max_abs_diff": float(d.loc[i, "diff"]), "at_v_over_vesc": float(d.loc[i, "v_inf_over_vesc"]),
            "at_Pi": float(d.loc[i, "Pi"]), "median_abs_diff": float(d["diff"].median()),
            "by_v_over_vesc": by_v,
        },
        "band_spread": {"max_over_min": float(ratio[k]), "at_Pi": float(x[k]), "Pi_range": [float(x[0]), float(x[-1])],
                        "profiles": len(curves)},
    }


def write_bin(name: str, data: bytes) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / name).write_bytes(data)
    print(f"wrote site/public/data/{name}: {len(data) / 1024:.1f} KB")


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", nargs="*", help="export only these files (by stem, e.g. curve atlas)")
    a = ap.parse_args()
    want = lambda stem: not a.only or stem in a.only
    refs = references()
    num = Numbers()
    linked: list[str] = []
    if want("curve"):
        curve, linked = curve_data(num, refs)
        write("curve.json", curve)
    if want("hero"):
        write("hero.json", hero_data(Numbers()))
    if want("regimes"):
        write("regimes.json", regimes_data(Numbers()))
    if want("atlas"):
        write("atlas.json", atlas_data())
    if want("missions"):
        write("missions.json", missions_data())
    if want("engines"):
        header, blob = engines_data(Numbers())
        write("engines.json", header)
        write_bin("engines.bin", blob)
    if want("timing"):
        write("timing.json", timing_data(Numbers()))
    if want("case"):
        write("case.json", case_data(Numbers(), refs))
    if want("methods"):
        write("methods.json", methods_data(Numbers()))
    if want("presets"):
        write("presets.json", presets_data())
    if want("site_numbers"):
        write("site_numbers.json", site_numbers_data())
    if want("site"):
        export_site(refs, linked + [P4, ANIM, "figures/hero_numbers.json", "figures/phase3_numbers.json",
                                    "figures/j2_numbers.json", "figures/rule_numbers.json", "results/phase4.parquet",
                                    "results/sweep_nd.parquet", "results/missions.parquet", "docs/repro.md",
                                    "docs/ai_use_log.md", "figures/loss_vinf_numbers.json"])


if __name__ == "__main__":
    main()
