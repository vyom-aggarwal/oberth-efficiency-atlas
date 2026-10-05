"""Flag numbers in a Markdown draft that match no value in the project's numbers JSON files.

Every numeric leaf of figures/*_numbers.json (or the files given with --json) is a candidate. A
written number matches a value v if v·s rounds to the written number at its written precision
(e.g. "0.0897" matches 0.089733). The scale s is 1, except:
- a number followed by "%" or "pp" may also match a fraction (s = 100);
- a number followed by a unit may match a JSON key carrying a unit suffix: km/s ↔ *_km_s (1) or
  *_m_s (10⁻³); m/s ↔ *_m_s (1) or *_km_s (10³); s, min, h, days ↔ *_s; t ↔ *_kg (10⁻³).
Numbers with one significant figure are too coarse to verify against hundreds of values; they are
listed as COARSE (not counted as matched) and checked only with --strict. --verbose prints the JSON
key that each number matched, so accidental matches can be audited.

Skipped: fenced and inline code, HTML comments, link targets, citation superscripts (<sup>…</sup>,
[^n]), list markers, years 1900–2100, arXiv identifiers, numbers attached to letters (J2, 48B,
3I/ATLAS, P6), references (Fig., Figure, Table, Section, §, Eq., Phase, row, rows, claim, Appendix,
v1/v2), exponents written as superscripts, integers with |n| ≤ 10 (unless --strict), any number in
--allow, and every line containing "<!-- nocheck -->".
Exit status 1 when any number is unmatched.
Run:  .venv/Scripts/python scripts/check_numbers.py draft.md [--json f.json ...] [--verbose] [--strict]
"""

from __future__ import annotations

import argparse
import json
import math
import re
import sys
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SUPERSCRIPT = str.maketrans("⁻⁰¹²³⁴⁵⁶⁷⁸⁹", "-0123456789")
REFERENCE_WORDS = r"(?:Fig\.?|Figs\.?|Figure|Figures|Table|Tables|Section|Sections|§|Eq\.?|Eqs\.?|Equation|Phase|Phases|row|rows|Row|Rows|claim|claims|Claim|Appendix|step|Step|version)"
NUMBER = re.compile(
    r"(?P<num>[-−+]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?|[-−+]?\.\d+)"
    r"(?P<exp>\s*[×x]\s*10(?P<sup>[⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+)|\s*[×x]\s*10\^\{?(?P<caret>[-−]?\d+)\}?|[eE](?P<e>[-+]?\d+))?"
    r"|(?<![\d.])10(?P<pow>[⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+)")


@dataclass
class Token:
    line: int
    text: str
    value: float
    tol: float
    sig: int = 3          # significant figures as written
    unit: str = ""        # unit text right after the number ("%", "km/s", ...)


UNIT = re.compile(r"\s*(%|pp\b|km/s|m/s(?!²)|kN|kg|min\b|h\b|days?\b|d\b|s\b|t\b)")


def unit_scales(unit: str, path: str) -> list[float]:
    """Allowed scales from the written unit and the JSON key's unit suffix."""
    p = path.lower()
    if unit in ("%", "pp"):
        return [1.0, 100.0]
    if unit == "km/s":
        return [1.0] if "km_s" in p else [1e-3] if p.endswith("m_s") or "_m_s" in p else [1.0]
    if unit == "m/s":
        return [1.0] if "_m_s" in p and "km_s" not in p else [1e3] if "km_s" in p else [1.0]
    if unit in ("s", "min", "h", "d", "day", "days") and (p.endswith("_s") or "_s." in p or "duration_s" in p):
        return [{"s": 1.0, "min": 1 / 60, "h": 1 / 3600}.get(unit, 1 / 86400)]
    if unit == "t" and "kg" in p:
        return [1e-3]
    return [1.0]


def significant_figures(num: str) -> int:
    digits = num.lstrip("+-−").replace(",", "")
    if "." in digits:
        return len(digits.replace(".", "").lstrip("0")) or 1
    return len(digits.lstrip("0").rstrip("0")) or 1


def numeric_leaves(obj, path=""):
    if isinstance(obj, bool):
        return
    if isinstance(obj, (int, float)):
        if math.isfinite(obj):
            yield path, float(obj)
    elif isinstance(obj, dict):
        for k, v in obj.items():
            yield from numeric_leaves(v, f"{path}.{k}" if path else str(k))
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            yield from numeric_leaves(v, f"{path}[{i}]")


def strip_markdown(text: str) -> list[str]:
    """Blank out the parts of each line that must not be checked, keeping line numbers."""
    text = re.sub(r"<!--(?!\s*nocheck).*?-->", lambda m: " " * len(m.group()), text, flags=re.S)
    out, fenced = [], False
    for raw in text.split("\n"):
        if raw.lstrip().startswith(("```", "~~~")):
            fenced = not fenced
            out.append("")
            continue
        if fenced or "<!-- nocheck -->" in raw:
            out.append("")
            continue
        s = re.sub(r"`[^`]*`", " ", raw)                                   # inline code
        s = re.sub(r"\]\([^)]*\)", "] ", s)                                  # link targets
        s = re.sub(r"<sup>.*?</sup>|\[\^[^\]]*\]", " ", s)                   # citations
        s = re.sub(r"https?://\S+", " ", s)
        s = re.sub(r"^\s*(?:[-*+]|\d+[.)])\s+", " ", s)                       # list markers
        s = re.sub(rf"{REFERENCE_WORDS}\s*\d+(?:[.–-]\d+)*[a-z]?", " ", s)    # references
        s = re.sub(r"\barXiv:\s*\d{4}\.\d{4,5}(?:v\d+)?|\b\d{4}\.\d{4,5}(?:v\d+)\b", " ", s)
        out.append(s)
    return out


def tokens(lines: list[str]) -> list[Token]:
    found = []
    for i, s in enumerate(lines, 1):
        line_toks = []
        for m in NUMBER.finditer(s):
            a, b = m.span()
            before, after = s[a - 1:a] if a else "", s[b:b + 1]
            if before.isalpha() or before in "_#§^" or (after.isalpha() and after not in "eE"):
                continue                                                    # identifiers: J2, 48B, P6
            if before and before in "⁰¹²³⁴⁵⁶⁷⁸⁹⁻":
                continue
            um = UNIT.match(s, b)
            unit = um.group(1) if um else ""
            if m.group("pow"):
                e = int(m.group("pow").translate(SUPERSCRIPT))
                line_toks.append((a, b, Token(i, m.group(), 10.0**e, 0.5 * 10.0**e, 1, unit)))
                continue
            num = m.group("num").replace("−", "-").replace(",", "")
            if num.startswith("-") and before and (before.isalnum() or before in ")]"):
                num = num[1:]                                              # "0.3-0.4" is a range, not −0.4
            dec = len(num.split(".")[1]) if "." in num else 0
            exp = 0
            if m.group("sup"):
                exp = int(m.group("sup").translate(SUPERSCRIPT))
            elif m.group("caret"):
                exp = int(m.group("caret").replace("−", "-"))
            elif m.group("e"):
                exp = int(m.group("e"))
            value = float(num) * 10.0**exp
            line_toks.append((a, b, Token(i, m.group().strip(), value, 0.5 * 10.0 ** (exp - dec),
                                          significant_figures(num), unit)))
        # In a range ("73–92%", "3 to 5 km/s") the first number takes the unit written after the second.
        for (a1, b1, t1), (a2, _, t2) in zip(line_toks, line_toks[1:]):
            if not t1.unit and t2.unit and re.fullmatch(r"\s*(?:[–—-]|to)\s*", s[b1:a2]):
                t1.unit = t2.unit
        found += [t for *_, t in line_toks]
    return found


def skip(tok: Token, allow: set[float], strict: bool) -> bool:
    v = tok.value
    if any(abs(v - a) <= 1e-12 * max(1.0, abs(a)) for a in allow):
        return True
    if v == int(v) and tok.tol >= 0.5:
        if 1900 <= v <= 2100:
            return True                                                    # years
        if not strict and abs(v) <= 10:
            return True
    return False


def match(tok: Token, leaves: list[tuple[str, float]]):
    w, tol = tok.value, tok.tol * (1 + 1e-9)
    for path, v in leaves:
        for s in unit_scales(tok.unit, path):
            if abs(v * s - w) <= tol:
                return path, v, s
    return None


def main(argv=None) -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("draft", type=Path)
    ap.add_argument("--json", type=Path, nargs="*")
    ap.add_argument("--allow", default="", help="comma-separated numbers never flagged (e.g. 96,24,12)")
    ap.add_argument("--strict", action="store_true", help="also check integers with |n| ≤ 10")
    ap.add_argument("--verbose", action="store_true")
    a = ap.parse_args(argv)
    files = a.json or sorted((ROOT / "figures").glob("*numbers*.json"))
    leaves = []
    for f in files:
        data = json.loads(Path(f).read_text(encoding="utf-8"))
        leaves += [(f"{Path(f).name}:{p}", v) for p, v in numeric_leaves(data)]
    allow = {float(x) for x in a.allow.split(",") if x.strip()}
    toks = [t for t in tokens(strip_markdown(Path(a.draft).read_text(encoding="utf-8"))) if not skip(t, allow, a.strict)]
    bad = coarse = 0
    for t in toks:
        unit = f" {t.unit}" if t.unit else ""
        if t.sig < 2 and not a.strict:
            coarse += 1
            if a.verbose:
                print(f"{a.draft}:{t.line}: {t.text}{unit}  COARSE (one significant figure; not verified)")
            continue
        m = match(t, leaves)
        if m is None:
            bad += 1
            print(f"{a.draft}:{t.line}: {t.text}{unit}  NO MATCH")
        elif a.verbose:
            path, v, s = m
            scale = "" if s == 1 else f" ×{s:g}"
            print(f"{a.draft}:{t.line}: {t.text}{unit}  = {path} ({v:.6g}{scale})")
    print(f"{len(toks) - coarse} numbers checked against {len(leaves)} values in {len(files)} files: {bad} unmatched"
          f" ({coarse} with one significant figure not verified; use --strict to check them)")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
