"""The website's self-hosted fonts (site/tools/fonts.py; Phase 8, and the Phase 9 set beside it until pass 1).

For each generated set (site/src/styles/fonts.css with base.css's stacks; site/src/styles/v9/fonts.css with
v9/tokens.css's stacks):
- The Greek-and-symbol fallback subsets hold exactly the characters their manifest lists, cut from the pinned sources,
  and each face's unicode-range equals its file's characters.
- The primaries' faces are the pinned @fontsource packages' Latin and Latin-ext faces, unchanged.
- Each font stack puts its primary first, then the fallbacks.
- Every character the site can display outside KaTeX has a self-hosted glyph in every stack, so no text falls through
  to the platform's fonts, whose metrics differ between machines and CI.
"""

import importlib.util
import json
import re
from pathlib import Path

import pytest
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "site"
FALLBACK = SITE / "src" / "fonts" / "fallback"
FONTSOURCE = SITE / "node_modules" / "@fontsource"

spec = importlib.util.spec_from_file_location("site_fonts", SITE / "tools" / "fonts.py")
F = importlib.util.module_from_spec(spec)
spec.loader.exec_module(F)

needs_packages = pytest.mark.skipif(not FONTSOURCE.is_dir(), reason="site/node_modules not installed (npm ci)")
SETS = pytest.mark.parametrize("name", list(F.SETS))
# Each set's stacks: primary first, then its fallbacks (Phase 9: one sans family, so no condensed stack).
STACKS = {
    "phase8": {"sans": ["Barlow", "Oberth Greek Sans", "Oberth Symbols"],
               "sans-cond": ["Barlow Semi Condensed", "Oberth Greek Condensed", "Oberth Greek Sans", "Oberth Symbols"],
               "mono": ["IBM Plex Mono", "Oberth Greek Mono", "Oberth Symbols"]},
    "phase9": {"sans": ["DM Sans", "Oberth Greek Sans", "Oberth Symbols"],
               "mono": ["IBM Plex Mono", "Oberth Greek Mono", "Oberth Symbols"]},
}


def manifest(name: str) -> list[dict]:
    return json.loads((FALLBACK / F.SETS[name].manifest).read_text(encoding="utf-8"))


def expand(urange: str) -> set[int]:
    out: set[int] = set()
    for part in urange.split(","):
        lo, _, hi = part.strip().removeprefix("U+").partition("-")
        out |= set(range(int(lo, 16), int(hi or lo, 16) + 1))
    return out


def faces(name: str) -> list[dict]:
    """The @font-face rules in a set's stylesheet: family, weight, style, the file (repository path) and its
    unicode-range."""
    css = F.SETS[name].css
    out = []
    for body in re.findall(r"@font-face \{(.*?)\}", css.read_text(encoding="utf-8"), re.S):
        get = lambda k: re.search(rf"{k}:\s*([^;]+);", body).group(1).strip()          # noqa: E731
        url = re.search(r'url\("([^"]+)"\)', body).group(1)
        out.append({"family": get("font-family").strip('"'), "weight": int(get("font-weight")), "style": get("font-style"),
                    "file": (css.parent / url).resolve(), "range": expand(get("unicode-range"))})
    return out


def cmap(path: Path) -> set[int]:
    """The characters a face's file maps. WOFF2 needs brotli, so a packaged WOFF2 is read through its WOFF twin (the
    @fontsource packages ship both, cut to the same subset)."""
    if path.suffix == ".woff2":
        path = path.with_suffix(".woff")
    return set(TTFont(path).getBestCmap())


def stack(name: str, which: str) -> list[str]:
    value = re.search(rf"--{which}:\s*([^;]+);", F.SETS[name].stacks.read_text(encoding="utf-8")).group(1)
    return [f.strip().strip('"') for f in value.split(",")]


# ---------------------------------------------------------------- the fallback subsets
@SETS
def test_fallback_files_hold_exactly_the_manifest_characters(name):
    m = manifest(name)
    assert [e["file"] for e in m] == [f"{slug}.woff" for slug, *_ in F.SETS[name].fallbacks]
    for e in m:
        assert cmap(FALLBACK / e["file"]) == set(e["codepoints"]), e["file"]
        assert e["license"] == "OFL-1.1"


@SETS
def test_fallbacks_come_from_the_pinned_sources(name):
    for e, (slug, family, weight, source_family, url, sha, wanted) in zip(manifest(name), F.SETS[name].fallbacks):
        assert (e["family"], e["weight"], e["source_family"], e["source"], e["sha256"]) == (family, weight, source_family, url, sha)
        assert set(e["codepoints"]) | set(e["missing"]) == set(wanted)


@SETS
def test_fallback_licences_are_shipped_with_each_subset(name):
    """Each subset's licence: its own copyright notice (name record 0, kept by the subsetter), then the OFL 1.1 text
    (author, 2026-10-24). No Reserved Font Name is declared, so the subsets may keep their internal names."""
    for e in manifest(name):
        slug, url, _ = F.LICENSES[e["source_family"]]
        assert (e["license_file"], e["license_text"]) == (f"LICENSE-{slug}.txt", url)
        text = (FALLBACK / e["license_file"]).read_text(encoding="utf-8")
        notice = TTFont(FALLBACK / e["file"])["name"].getDebugName(0).strip()
        header, _, body = text.partition(F.OFL_START)
        assert header.strip() == notice, e["file"]
        assert "SIL OPEN FONT LICENSE Version 1.1" in body and "Reserved Font Name" in body   # the licence's definitions
        assert "reserved font name" not in header.lower()


@SETS
def test_fallback_unicode_ranges_equal_the_files(name):
    m = manifest(name)
    by_file = {f["file"].name: f for f in faces(name) if f["file"].parent == FALLBACK.resolve()}
    assert sorted(by_file) == sorted(e["file"] for e in m)
    for e in m:
        f = by_file[e["file"]]
        assert (f["family"], f["weight"], f["style"]) == (e["family"], e["weight"], "normal")
        assert f["range"] == set(e["codepoints"]), e["file"]


def test_phase9_greek_comes_from_commissioner_and_fira_mono():
    """Author decision 3 (2026-11-01): Commissioner's Greek behind DM Sans, Fira Mono's behind IBM Plex Mono, so Greek
    renders identically everywhere; every letter of the basic Greek alphabet is in both."""
    m = {(e["family"], e["weight"]): e for e in manifest("phase9")}
    for (family, weight), source in {("Oberth Greek Sans", 400): "Commissioner", ("Oberth Greek Sans", 600): "Commissioner",
                                     ("Oberth Greek Mono", 400): "Fira Mono", ("Oberth Greek Mono", 500): "Fira Mono"}.items():
        e = m[(family, weight)]
        assert e["source_family"] == source
        assert set(F.GREEK) <= set(e["codepoints"]), (family, weight)


# ---------------------------------------------------------------- the primaries
@needs_packages
@SETS
def test_primary_faces_are_the_packages(name):
    css = F.SETS[name].css.read_text(encoding="utf-8")
    for rule in F.primary_faces(F.SETS[name]):
        assert rule in css
    primaries = [f for f in faces(name) if "node_modules" in f["file"].parts]
    assert {(f["family"], f["weight"], f["style"]) for f in primaries} == {
        (family, w, s) for _, family, fs in F.SETS[name].primaries for w, s in fs}
    for f in primaries:
        assert f["file"].is_file(), f["file"]


@SETS
def test_stacks_put_the_primary_first_then_the_fallbacks(name):
    for which, want in STACKS[name].items():
        assert stack(name, which)[:len(want)] == want, which


# ---------------------------------------------------------------- every displayed character
SKIP_DIRS = {"node_modules", "e2e", "tools", "public"} | {p.name for p in SITE.glob("dist*")}


def displayed_text() -> dict[str, str]:
    """Text the site can display outside KaTeX, by file: string literals in its code, its pages and partials, the
    author's content (KaTeX spans removed) and the exported data. Comments are stripped; KaTeX sources
    (src/math/labels.json, $…$ in Markdown) are left out, since KaTeX brings its own fonts."""
    out = {}
    for p in sorted(SITE.rglob("*")):
        if not p.is_file() or p.suffix not in {".ts", ".html", ".md"} or SKIP_DIRS & set(p.relative_to(SITE).parts):
            continue
        if p.name.endswith(".test.ts") or p.name.endswith(".d.ts"):
            continue
        if p.relative_to(SITE).as_posix() == "src/lib/notation.ts":
            # Its tables list every Unicode sub- and superscript for plain(), which writes only accessible names and
            # title attributes: read aloud or shown by the browser in system fonts, never drawn in the site's fonts.
            continue
        text = p.read_text(encoding="utf-8")
        if p.suffix == ".md":
            text = re.sub(r"\$\$.*?\$\$|\$[^$\n]+\$|<!--.*?-->", "", text, flags=re.S)
        elif p.suffix == ".ts":
            text = re.sub(r"/\*.*?\*/", "", text, flags=re.S)
            text = re.sub(r"(?<![:\"'`\\])//.*$", "", text, flags=re.M)
        else:
            text = re.sub(r"<!--(?!#).*?-->|<x-tex>.*?</x-tex>", "", text, flags=re.S)
        out[p.relative_to(SITE).as_posix()] = text
    for p in sorted((SITE / "public" / "data").glob("*.json")):
        out[p.relative_to(SITE).as_posix()] = json.dumps(json.loads(p.read_text(encoding="utf-8")), ensure_ascii=False)
    return out


@needs_packages
@SETS
def test_every_displayed_character_has_a_self_hosted_glyph_in_every_stack(name):
    chars: dict[int, str] = {}
    for where, text in displayed_text().items():
        for ch in text:
            if ord(ch) > 0x7E and ch not in " ​﻿":
                chars.setdefault(ord(ch), where)
    assert ord("η") in chars and ord("Π") in chars                       # the scan sees the site's text
    covered: dict[str, set[int]] = {}
    for f in faces(name):
        covered.setdefault(f["family"], set()).update(f["range"] & cmap(f["file"]))
    for which in STACKS[name]:
        have = set().union(*(covered.get(family, set()) for family in stack(name, which)))
        missing = {f"U+{c:04X} {chr(c)} (e.g. {where})" for c, where in chars.items() if c not in have}
        assert not missing, f"{name} --{which}: no self-hosted glyph for {sorted(missing)}"
