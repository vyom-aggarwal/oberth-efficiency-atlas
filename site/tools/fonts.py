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

Run (repository root): .venv/Scripts/python site/tools/fonts.py   (downloads into runs/fonts-cache/ once)
"""

from __future__ import annotations

import hashlib
import json
import re
import urllib.request
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[2]
SITE = ROOT / "site"
OUT_DIR = SITE / "src" / "fonts" / "fallback"
CSS = SITE / "src" / "styles" / "fonts.css"
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
SUBSETS = ["latin-ext", "latin"]


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


def primary_faces() -> list[str]:
    rules = []
    for pkg, family, faces in PRIMARIES:
        for weight, style in faces:
            css = (SITE / "node_modules" / "@fontsource" / pkg / f"{weight}{'-italic' if style == 'italic' else ''}.css").read_text(encoding="utf-8")
            for sub in SUBSETS:
                m = re.search(rf"/\* {pkg}-{sub}-{weight}-{style} \*/\s*@font-face \{{(.*?)\}}", css, re.S)
                if not m:
                    raise SystemExit(f"@fontsource/{pkg}: no {sub} {weight} {style} face")
                urange = re.search(r"unicode-range:\s*([^;]+);", m.group(1)).group(1)
                rules.append(
                    f'@font-face {{\n  font-family: "{family}";\n  font-style: {style};\n  font-display: swap;\n  font-weight: {weight};\n'
                    f'  src: url("../../node_modules/@fontsource/{pkg}/files/{pkg}-{sub}-{weight}-{style}.woff2") format("woff2");\n'
                    f"  unicode-range: {urange};\n}}")
    return rules


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    manifest, rules = [], []
    for slug, family, weight, src_family, url, sha, wanted in FALLBACKS:
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
                     f'  src: url("../fonts/fallback/{out.name}") format("woff");\n  unicode-range: {ranges(keep)};\n}}')
        print(f"{out.name}: {len(keep)} characters from {src_family} {weight}; missing {ranges(manifest[-1]['missing']) or 'none'}")
    for e in manifest:
        slug, url, _ = LICENSES[e["source_family"]]
        e["license_file"], e["license_text"] = f"LICENSE-{slug}.txt", url
    (OUT_DIR / "manifest.json").write_text(json.dumps(manifest, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    written = set()
    for slug, family, weight, src_family, url, sha, wanted in FALLBACKS:
        if src_family in written:
            continue
        written.add(src_family)
        text = licence_text(src_family, source(url, sha))
        (OUT_DIR / f"LICENSE-{LICENSES[src_family][0]}.txt").write_text(text, encoding="utf-8", newline="\n")
    header = ("/* Generated by site/tools/fonts.py; do not edit by hand. The classic explorer's families (Barlow, Barlow\n"
              "   Semi Condensed, IBM Plex Mono) from the pinned @fontsource packages, Latin and Latin-ext; then the Greek-\n"
              "   and-symbol fallbacks cut from pinned full fonts (Phase 8, RESEARCH_LOG 2026-10-23). */\n\n")
    CSS.write_text(header + "\n".join(primary_faces() + rules) + "\n", encoding="utf-8")
    print(f"wrote {CSS.relative_to(ROOT)} and {OUT_DIR.relative_to(ROOT)}/")


if __name__ == "__main__":
    main()
