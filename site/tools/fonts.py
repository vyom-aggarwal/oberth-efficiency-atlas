"""The site's self-hosted fonts (Phase 8; RESEARCH_LOG 2026-10-23), written to site/src/styles/fonts.css.

1. The classic explorer's three families, from the pinned @fontsource packages (Latin and Latin-ext subsets):
   Barlow (body), Barlow Semi Condensed (display, annotations) and IBM Plex Mono (data).
2. Greek-and-symbol fallbacks, first in each stack after its primary (author decision, 2026-10-23: CI's Linux
   fallbacks differ from the development machine's, and the layout, fold and headline-budget tests measure text).
   None of the classic families has Greek, and the packages' subsets leave out the super- and subscripts, the
   arrows and the maths signs the site displays, so each fallback is cut here, with fontTools, from a pinned
   full font (Google Fonts' versioned file, checked by sha256), keeping exactly the characters below that it has.
   The families were chosen with fontTools for coverage, then for the closest x-height, cap height and widths
   to the primary they back (RESEARCH_LOG 2026-10-23):
     sans       Arimo             ("Oberth Greek Sans")       behind Barlow
     condensed  Roboto Condensed  ("Oberth Greek Condensed")  behind Barlow Semi Condensed; then Greek Sans
     mono       Noto Sans Mono    ("Oberth Greek Mono")       behind IBM Plex Mono; advance 0.6 em, as Plex Mono
     symbols    Noto Sans Math    ("Oberth Symbols")          last: ∝ and ☉, which none of the three has
   All four are under the SIL Open Font License 1.1 (site/src/fonts/fallback/LICENSE-*.txt).
Each face declares a unicode-range equal to the characters its file covers, so the browser fetches it only when
a page uses one of them. tests/test_site_fonts.py checks the files, the ranges, and that every character the
site displays has a self-hosted glyph.

Phase 9 (docs/revamp_plan.md §2.3; author decision 3, 2026-11-01): the reference's DM Sans and IBM Plex Mono, with
Greek from Commissioner behind DM Sans and from Fira Mono behind IBM Plex Mono, so Greek renders identically
everywhere. Measured 2026-11-01 (fontTools): x-height ratios 1.016 (DM Sans / Commissioner) and 0.979 (IBM Plex Mono /
Fira Mono), cap heights 0.982 and 1.013, and Fira Mono keeps Plex Mono's 0.6 em advance, so no size-adjust is needed.
The super- and subscripts and signs those two lack come from the existing sources: → (with ∝ and ☉) from Noto Sans
Math, and ⁻ ⁿ ₚ from Arimo. Until pass 1 makes it the only set, the Phase 9 set is written beside the Phase 8 one: its
own stylesheet (site/src/styles/v9/fonts.css), subsets named v9-*, and manifest-v9.json.

Run (repository root): .venv/Scripts/python site/tools/fonts.py   (downloads into runs/fonts-cache/ once)
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import urllib.request
from pathlib import Path
from typing import NamedTuple

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[2]
SITE = ROOT / "site"
OUT_DIR = SITE / "src" / "fonts" / "fallback"
CSS = SITE / "src" / "styles" / "fonts.css"
CSS9 = SITE / "src" / "styles" / "v9" / "fonts.css"
CACHE = ROOT / "runs" / "fonts-cache"

# The characters the site displays that the primaries' Latin and Latin-ext subsets leave out (measured
# 2026-10-23 over the site's code, pages, content and data): the basic Greek alphabet (the site uses ten of its
# letters), super- and subscripts, the arrow and maths signs, and the Sun symbol.
GREEK = [c for c in range(0x0391, 0x03AA) if c != 0x03A2] + list(range(0x03B1, 0x03CA))
SYMBOLS = [ord(c) for c in "⁰⁴⁵⁶⁷⁸⁹⁻ⁿ₀₁ₚ→∞≈≤≥"]
LAST = [ord(c) for c in "∝☉"]                  # only the symbols face has these

# (slug, CSS family, weight, source family, versioned URL, sha256, characters wanted)
FALLBACKS = [
    ("greek-sans-400", "Oberth Greek Sans", 400, "Arimo",
     "https://fonts.gstatic.com/s/arimo/v36/P5sfzZCDf9_T_3cV7NCUECyoxNk37cxsBw.ttf",
     "e5717ff6c2063b0e596176ddad929b0a98a6d8db694f43a8ba26c99675625b67", GREEK + SYMBOLS),
    ("greek-sans-700", "Oberth Greek Sans", 700, "Arimo",
     "https://fonts.gstatic.com/s/arimo/v36/P5sfzZCDf9_T_3cV7NCUECyoxNk3CstsBw.ttf",
     "22261f10e78d5e16e5ae305cc6f4a0c5ca24a4b1f0e14d3eec5750fb57877a5a", GREEK + SYMBOLS),
    ("greek-condensed-400", "Oberth Greek Condensed", 400, "Roboto Condensed",
     "https://fonts.gstatic.com/s/robotocondensed/v31/ieVo2ZhZI2eCN5jzbjEETS9weq8-_d6T_POl0fRJeyWyovBJ.ttf",
     "ef9d48725ff2bd72cd569ca50555fb781f99cf8f3a88a3bb3c8a4c85fd574458", GREEK + SYMBOLS),
    ("greek-condensed-700", "Oberth Greek Condensed", 700, "Roboto Condensed",
     "https://fonts.gstatic.com/s/robotocondensed/v31/ieVo2ZhZI2eCN5jzbjEETS9weq8-_d6T_POl0fRJeyVVpfBJ.ttf",
     "35140bfdde80295fbcd04dad086f51688abca96cb8c87529daf781c4462b6e33", GREEK + SYMBOLS),
    ("greek-mono-400", "Oberth Greek Mono", 400, "Noto Sans Mono",
     "https://fonts.gstatic.com/s/notosansmono/v37/BngrUXNETWXI6LwhGYvaxZikqZqK6fBq6kPvUce2oAZcdthSBUsYck4-_FNJ49o.ttf",
     "bc58118562112a4c876e2771199b0f35aae07000e5fe1f4ac6d03496900981f4", GREEK + SYMBOLS),
    ("greek-mono-500", "Oberth Greek Mono", 500, "Noto Sans Mono",
     "https://fonts.gstatic.com/s/notosansmono/v37/BngrUXNETWXI6LwhGYvaxZikqZqK6fBq6kPvUce2oAZcdthSBUsYck4-_GFJ49o.ttf",
     "be96ee99786a6fd3ba295b70621b81eed81c822066fa55fa7387d7fb4a1880ab", GREEK + SYMBOLS),
    ("symbols-400", "Oberth Symbols", 400, "Noto Sans Math",
     "https://fonts.gstatic.com/s/notosansmath/v19/7Aump_cpkSecTWaHRlH2hyV5UHkG.ttf",
     "3cbaf44af13f592bc7f7172a50edab4c73ac2f3d19af2d697a01ebd3288e322d", LAST),
]
ARIMO_400 = FALLBACKS[0][4:6]
NOTO_MATH = FALLBACKS[-1][4:6]
FALLBACKS9 = [
    ("v9-greek-sans-400", "Oberth Greek Sans", 400, "Commissioner",
     "https://fonts.gstatic.com/s/commissioner/v24/tDaH2o2WnlgI0FNDgduEk4jAhwgumbU1SVfU5BD8OuRL8OstC6KOhgvBYWSFJ-Mgdrgiju6fF8meZm0rk4eF-ZugTMNdGPc.ttf",
     "ca0b5b501b33f678dadd7bff7e7b139d91659930afd332c4495c0196e18d46fe", GREEK + SYMBOLS),
    ("v9-greek-sans-600", "Oberth Greek Sans", 600, "Commissioner",
     "https://fonts.gstatic.com/s/commissioner/v24/tDaH2o2WnlgI0FNDgduEk4jAhwgumbU1SVfU5BD8OuRL8OstC6KOhgvBYWSFJ-Mgdrgiju6fF8meZm0rk4eF-ZugTB1aGPc.ttf",
     "4c341530211050734b52526c8fb10645b3bc1e431f252570763f032469b9a589", GREEK + SYMBOLS),
    ("v9-greek-mono-400", "Oberth Greek Mono", 400, "Fira Mono",
     "https://fonts.gstatic.com/s/firamono/v16/N0bX2SlFPv1weGeLZDtQIQ.ttf",
     "da844d7e07243308a5b668a89bf194693e440bc6a31f6f5c37d29542f914ceca", GREEK + SYMBOLS),
    ("v9-greek-mono-500", "Oberth Greek Mono", 500, "Fira Mono",
     "https://fonts.gstatic.com/s/firamono/v16/N0bS2SlFPv1weGeLZDto1d33mQ.ttf",
     "e1edd52f9bdcdc4d4b31f4d3acbba634fa906aa320ed77556b9899df873e5fa8", GREEK + SYMBOLS),
    # The signs neither Greek source has: one family in two files, each limited to its own characters.
    ("v9-symbols-400", "Oberth Symbols", 400, "Noto Sans Math", *NOTO_MATH, LAST + [ord("→")]),
    ("v9-supers-400", "Oberth Symbols", 400, "Arimo", *ARIMO_400, [ord(c) for c in "⁻ⁿₚ"]),
]
# The licence of each source family: the SIL Open Font License 1.1 text from the family's OFL.txt in google/fonts,
# pinned to a commit and checked by sha256. Each committed LICENSE-<slug>.txt is the copyright notice of the very file
# subset here (its name table, record 0) followed by that licence text. None of the four declares a Reserved Font Name
# (checked when generating, and in tests/test_site_fonts.py), so the subsets keep their internal names; the CSS family
# names differ anyway.
GOOGLE_FONTS = "https://raw.githubusercontent.com/google/fonts/e7db6ca603fd4862010383ff17ffd6cc4ffac1c0/ofl"
LICENSES = {
    "Arimo": ("arimo", f"{GOOGLE_FONTS}/arimo/OFL.txt", "11cce536cd2f3864d767003af5dcd739e2e15818cf2279b6175edeadd3960992"),
    "Roboto Condensed": ("roboto-condensed", f"{GOOGLE_FONTS}/robotocondensed/OFL.txt",
                         "0e4cc6ece88573545be2ed25835363662a6182ba4a4c1b5c8feda52add30e8a6"),
    "Noto Sans Mono": ("noto-sans-mono", f"{GOOGLE_FONTS}/notosansmono/OFL.txt",
                       "cee9892f9f0cc8fe882c9e9537ee6a89621d86ee7ceaf70b02e2b2b1c25c061a"),
    "Noto Sans Math": ("noto-sans-math", f"{GOOGLE_FONTS}/notosansmath/OFL.txt",
                       "403a95275b469061b7d4371c328e0ada3bc7d63328abe2e88aad5cd243b2fe21"),
    "Commissioner": ("commissioner", f"{GOOGLE_FONTS}/commissioner/OFL.txt",
                     "4a7d88c77b4bc39ff84f2e058ba8f015636c50ce33588a86d9da97defe519933"),
    "Fira Mono": ("fira-mono", f"{GOOGLE_FONTS}/firamono/OFL.txt",
                  "d1829ff3455bbf3b9d13dfb0a57758a863107c9108aab48558f26f37f1094180"),
}
OFL_START = "This Font Software is licensed under the SIL Open Font License, Version 1.1."


def licence_text(source_family: str, font_path: Path) -> str:
    """The font file's copyright notice, then the OFL 1.1 text of its family's pinned OFL.txt (its header checked for a
    Reserved Font Name)."""
    _, url, sha = LICENSES[source_family]
    ofl = source(url, sha).read_text(encoding="utf-8").replace("\r\n", "\n")
    header, _, body = ofl.partition(OFL_START)
    if not body or "reserved font name" in header.lower():
        raise SystemExit(f"{url}: not plain OFL 1.1, or it declares a Reserved Font Name; rename the subsets' name tables")
    copyright = TTFont(font_path)["name"].getDebugName(0).strip()
    return f"{copyright}\n\n{OFL_START}{body}"

# The primaries: (package, CSS family, the (weight, style) faces the site uses), Latin and Latin-ext subsets.
PRIMARIES = [
    ("barlow", "Barlow", [(400, "normal"), (500, "normal"), (600, "normal"), (700, "normal"), (400, "italic")]),
    ("barlow-semi-condensed", "Barlow Semi Condensed", [(400, "normal"), (500, "normal"), (600, "normal"), (700, "normal")]),
    ("ibm-plex-mono", "IBM Plex Mono", [(400, "normal"), (500, "normal")]),
]
# Phase 9: 400 almost everywhere, as in the reference; 600 for figure titles and engine names; 400 italic for prose.
PRIMARIES9 = [
    ("dm-sans", "DM Sans", [(400, "normal"), (600, "normal"), (400, "italic")]),
    ("ibm-plex-mono", "IBM Plex Mono", [(400, "normal"), (500, "normal")]),
]
SUBSETS = ["latin-ext", "latin"]


class FontSet(NamedTuple):
    """One generated set: its primaries, its fallback subsets, its stylesheet, its manifest and the stylesheet that
    declares its stacks."""
    primaries: list
    fallbacks: list
    css: Path
    manifest: str
    stacks: Path


SETS = {
    "phase8": FontSet(PRIMARIES, FALLBACKS, CSS, "manifest.json", SITE / "src" / "styles" / "base.css"),
    "phase9": FontSet(PRIMARIES9, FALLBACKS9, CSS9, "manifest-v9.json", SITE / "src" / "styles" / "v9" / "tokens.css"),
}


def rel(css: Path, target: Path) -> str:
    """target's URL relative to the stylesheet css."""
    return Path(os.path.relpath(target, css.parent)).as_posix()


def ranges(codepoints: list[int]) -> str:
    """unicode-range text, consecutive codepoints merged."""
    cps, out = sorted(set(codepoints)), []
    i = 0
    while i < len(cps):
        j = i
        while j + 1 < len(cps) and cps[j + 1] == cps[j] + 1:
            j += 1
        out.append(f"U+{cps[i]:04X}" if i == j else f"U+{cps[i]:04X}-{cps[j]:04X}")
        i = j + 1
    return ", ".join(out)


def source(url: str, sha: str) -> Path:
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / "-".join(url.split("/")[-2:])                     # e.g. arimo-OFL.txt: every family's licence is OFL.txt
    if not path.exists():
        path.write_bytes(urllib.request.urlopen(url).read())
    if hashlib.sha256(path.read_bytes()).hexdigest() != sha:
        raise SystemExit(f"{url}: sha256 differs from the pinned value")
    return path


def primary_faces(fs: FontSet = SETS["phase8"]) -> list[str]:
    rules = []
    for pkg, family, faces in fs.primaries:
        for weight, style in faces:
            css = (SITE / "node_modules" / "@fontsource" / pkg / f"{weight}{'-italic' if style == 'italic' else ''}.css").read_text(encoding="utf-8")
            for sub in SUBSETS:
                m = re.search(rf"/\* {pkg}-{sub}-{weight}-{style} \*/\s*@font-face \{{(.*?)\}}", css, re.S)
                if not m:
                    raise SystemExit(f"@fontsource/{pkg}: no {sub} {weight} {style} face")
                urange = re.search(r"unicode-range:\s*([^;]+);", m.group(1)).group(1)
                url = rel(fs.css, SITE / "node_modules" / "@fontsource" / pkg / "files" / f"{pkg}-{sub}-{weight}-{style}.woff2")
                rules.append(
                    f'@font-face {{\n  font-family: "{family}";\n  font-style: {style};\n  font-display: swap;\n  font-weight: {weight};\n'
                    f'  src: url("{url}") format("woff2");\n'
                    f"  unicode-range: {urange};\n}}")
    return rules


HEADERS = {
    "phase8": ("/* Generated by site/tools/fonts.py; do not edit by hand. The classic explorer's families (Barlow, Barlow\n"
               "   Semi Condensed, IBM Plex Mono) from the pinned @fontsource packages, Latin and Latin-ext; then the Greek-\n"
               "   and-symbol fallbacks cut from pinned full fonts (Phase 8, RESEARCH_LOG 2026-10-23). */\n\n"),
    "phase9": ("/* Generated by site/tools/fonts.py; do not edit by hand. Phase 9 (docs/revamp_plan.md §2.3): DM Sans and IBM\n"
               "   Plex Mono from the pinned @fontsource packages, Latin and Latin-ext; then Greek from Commissioner (behind\n"
               "   DM Sans) and Fira Mono (behind IBM Plex Mono), and the remaining signs, cut from pinned full fonts. */\n\n"),
}


def main() -> None:
    for name, fs in SETS.items():
        generate(name, fs)


def generate(name: str, fs: FontSet) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    manifest, rules = [], []
    for slug, family, weight, src_family, url, sha, wanted in fs.fallbacks:
        path = source(url, sha)
        cmap = TTFont(path).getBestCmap()
        keep = sorted(c for c in wanted if c in cmap)
        opts = subset.Options()
        opts.flavor = "woff"
        opts.layout_features = ["*"]
        opts.name_IDs = ["*"]                     # keep the copyright and licence records
        opts.notdef_outline = True
        font = TTFont(path, recalcTimestamp=False)      # keep the source's date: the output is reproducible
        sub = subset.Subsetter(opts)
        sub.populate(unicodes=keep)
        sub.subset(font)
        out = OUT_DIR / f"{slug}.woff"
        subset.save_font(font, str(out), opts)
        manifest.append({"file": out.name, "family": family, "weight": weight, "source_family": src_family,
                         "source": url, "sha256": sha, "license": "OFL-1.1", "codepoints": keep,
                         "missing": sorted(set(wanted) - set(keep))})
        rules.append(f'@font-face {{\n  font-family: "{family}";\n  font-style: normal;\n  font-display: swap;\n  font-weight: {weight};\n'
                     f'  src: url("{rel(fs.css, out)}") format("woff");\n  unicode-range: {ranges(keep)};\n}}')
        print(f"{out.name}: {len(keep)} characters from {src_family} {weight}; missing {ranges(manifest[-1]['missing']) or 'none'}")
    for e in manifest:
        slug, url, _ = LICENSES[e["source_family"]]
        e["license_file"], e["license_text"] = f"LICENSE-{slug}.txt", url
    (OUT_DIR / fs.manifest).write_text(json.dumps(manifest, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    written = set()
    for slug, family, weight, src_family, url, sha, wanted in fs.fallbacks:
        if src_family in written:
            continue
        written.add(src_family)
        text = licence_text(src_family, source(url, sha))
        (OUT_DIR / f"LICENSE-{LICENSES[src_family][0]}.txt").write_text(text, encoding="utf-8", newline="\n")
    fs.css.write_text(HEADERS[name] + "\n".join(primary_faces(fs) + rules) + "\n", encoding="utf-8")
    print(f"wrote {fs.css.relative_to(ROOT)} and {OUT_DIR.relative_to(ROOT)}/ ({name})")


if __name__ == "__main__":
    main()
