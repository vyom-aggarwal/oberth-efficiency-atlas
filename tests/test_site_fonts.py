"""The website's self-hosted fonts (site/tools/fonts.py, site/src/styles/fonts.css; Phase 8).

- The Greek-and-symbol fallback subsets hold exactly the characters their manifest lists, cut from the pinned sources,
  and each face's unicode-range in fonts.css equals its file's characters.
- The primaries' faces in fonts.css are the pinned @fontsource packages' Latin and Latin-ext faces, unchanged.
- Each font stack in base.css puts its primary first, then the fallbacks.
- Every character the site can display outside KaTeX has a self-hosted glyph in every stack (sans, condensed, mono),
  so no text falls through to the platform's fonts, whose metrics differ between machines and CI.
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
CSS = (SITE / "src" / "styles" / "fonts.css").read_text(encoding="utf-8")
BASE = (SITE / "src" / "styles" / "base.css").read_text(encoding="utf-8")
MANIFEST = json.loads((FALLBACK / "manifest.json").read_text(encoding="utf-8"))
FONTSOURCE = SITE / "node_modules" / "@fontsource"

spec = importlib.util.spec_from_file_location("site_fonts", SITE / "tools" / "fonts.py")
F = importlib.util.module_from_spec(spec)
spec.loader.exec_module(F)

needs_packages = pytest.mark.skipif(not FONTSOURCE.is_dir(), reason="site/node_modules not installed (npm ci)")


def expand(urange: str) -> set[int]:
    out: set[int] = set()
    for part in urange.split(","):
        lo, _, hi = part.strip().removeprefix("U+").partition("-")
        out |= set(range(int(lo, 16), int(hi or lo, 16) + 1))
    return out


def faces() -> list[dict]:
    """The @font-face rules in fonts.css: family, weight, style, the file (repository path) and its unicode-range."""
    out = []
    for body in re.findall(r"@font-face \{(.*?)\}", CSS, re.S):
        get = lambda k: re.search(rf"{k}:\s*([^;]+);", body).group(1).strip()          # noqa: E731
        url = re.search(r'url\("([^"]+)"\)', body).group(1)
        out.append({"family": get("font-family").strip('"'), "weight": int(get("font-weight")), "style": get("font-style"),
                    "file": (SITE / "src" / "styles" / url).resolve(), "range": expand(get("unicode-range"))})
    return out


def cmap(path: Path) -> set[int]:
    """The characters a face's file maps. WOFF2 needs brotli, so a packaged WOFF2 is read through its WOFF twin (the
    @fontsource packages ship both, cut to the same subset)."""
    if path.suffix == ".woff2":
        path = path.with_suffix(".woff")
    return set(TTFont(path).getBestCmap())


def stack(name: str) -> list[str]:
    value = re.search(rf"--{name}:\s*([^;]+);", BASE).group(1)
    return [f.strip().strip('"') for f in value.split(",")]


# ---------------------------------------------------------------- the fallback subsets
def test_fallback_files_hold_exactly_the_manifest_characters():
    assert [e["file"] for e in MANIFEST] == [f"{slug}.woff" for slug, *_ in F.FALLBACKS]
    for e in MANIFEST:
        assert cmap(FALLBACK / e["file"]) == set(e["codepoints"]), e["file"]
        assert e["license"] == "OFL-1.1"


def test_fallbacks_come_from_the_pinned_sources():
    for e, (slug, family, weight, source_family, url, sha, wanted) in zip(MANIFEST, F.FALLBACKS):
        assert (e["family"], e["weight"], e["source_family"], e["source"], e["sha256"]) == (family, weight, source_family, url, sha)
        assert set(e["codepoints"]) | set(e["missing"]) == set(wanted)


def test_fallback_licences_are_shipped():
    for pkg in F.LICENSES.values():
        text = (FALLBACK / f"LICENSE-{pkg}.txt").read_text(encoding="utf-8")
        assert "SIL Open Font License, Version 1.1" in text


def test_fallback_unicode_ranges_equal_the_files():
    by_file = {f["file"].name: f for f in faces() if f["file"].parent == FALLBACK.resolve()}
    assert sorted(by_file) == sorted(e["file"] for e in MANIFEST)
    for e in MANIFEST:
        f = by_file[e["file"]]
        assert (f["family"], f["weight"], f["style"]) == (e["family"], e["weight"], "normal")
        assert f["range"] == set(e["codepoints"]), e["file"]


# ---------------------------------------------------------------- the primaries
@needs_packages
def test_primary_faces_are_the_packages():
    for rule in F.primary_faces():
        assert rule in CSS
    primaries = [f for f in faces() if "node_modules" in f["file"].parts]
    assert {(f["family"], f["weight"], f["style"]) for f in primaries} == {
        (family, w, s) for _, family, fs in F.PRIMARIES for w, s in fs}
    for f in primaries:
        assert f["file"].is_file(), f["file"]


def test_stacks_put_the_primary_first_then_the_fallbacks():
    assert stack("sans")[:3] == ["Barlow", "Oberth Greek Sans", "Oberth Symbols"]
    assert stack("sans-cond")[:4] == ["Barlow Semi Condensed", "Oberth Greek Condensed", "Oberth Greek Sans", "Oberth Symbols"]
    assert stack("mono")[:3] == ["IBM Plex Mono", "Oberth Greek Mono", "Oberth Symbols"]


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
def test_every_displayed_character_has_a_self_hosted_glyph_in_every_stack():
    chars: dict[int, str] = {}
    for name, text in displayed_text().items():
        for ch in text:
            if ord(ch) > 0x7E and ch not in " ​﻿":
                chars.setdefault(ord(ch), name)
    assert ord("η") in chars and ord("Π") in chars                       # the scan sees the site's text
    covered: dict[str, set[int]] = {}
    for f in faces():
        covered.setdefault(f["family"], set()).update(f["range"] & cmap(f["file"]))
    for name in ("sans", "sans-cond", "mono"):
        have = set().union(*(covered.get(family, set()) for family in stack(name)))
        missing = {f"U+{c:04X} {chr(c)} (e.g. {where})" for c, where in chars.items() if c not in have}
        assert not missing, f"--{name}: no self-hosted glyph for {sorted(missing)}"
