"""Run the project's checks in one command; exit status 1 if any check fails (author rule, 2026-10-18).

Failures went unnoticed three times in Phase 6: an unchecked audit comparison, pytest piped through tail, and
`npm test` broken from checkpoint 2 to 3. This script runs each check itself, keeps going after a failure so that
one run shows every failure, and judges each check by its own exit status. A missing tool (node, npx, the site's
node_modules) is a failure, not a skip.

Checks, in order:
  typecheck   npx tsc --noEmit                                   (in site/)
  vitest      npx vitest run                                     (in site/)
  numbers     scripts/check_numbers.py on every site/content/*.md, with --allow 96,24,12 (the theory constants
              in Π²/96 and its relatives, as documented in CLAUDE.md)
  site-data   pytest tests/test_site_data.py                     (--fast only)
  hooks       pytest tests/test_hooks.py                         (--fast only)
  pytest      the full Python suite, which includes the site-data and hook tests (default only)

  check-all   pytest tests/test_check_all.py (this script's own selection rules)   (--staged only)
  own-tests   pytest on the test files the changed files name (see own_tests)       (--staged only)

--fast runs the full set without the full Python suite: the site-data and hook tests replace it.
--staged is the pre-commit hook (.githooks/pre-commit, author rule 2026-10-19): only the checks that the staged
files can affect (see select_checks), so a prose commit costs seconds, not minutes. The full run (no flag) stays
the gate before pushing and in CI. Playwright is not run here: it runs in CI and with `npx playwright test`.

Run:  .venv/Scripts/python scripts/check_all.py [--fast | --staged | --paths P ...] [--dry-run] [--only name,name]
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "site"
ALLOW = "96,24,12"


def run(cmd: list[str], cwd: Path) -> int:
    print(f"$ {' '.join(cmd)}   (in {cwd.relative_to(ROOT) if cwd != ROOT else '.'})", flush=True)
    return subprocess.run(cmd, cwd=cwd).returncode


def npx(*args: str) -> int:
    exe = shutil.which("npx")
    if exe is None:
        print("npx not found: install Node (see site/package.json engines)", flush=True)
        return 1
    if not (SITE / "node_modules").is_dir():
        print("site/node_modules missing: run `npm ci` in site/", flush=True)
        return 1
    return run([exe, *args], SITE)


def pytest(*args: str) -> int:
    return run([sys.executable, "-m", "pytest", "-q", *args], ROOT)


def numbers() -> int:
    spec = importlib.util.spec_from_file_location("check_numbers", ROOT / "scripts" / "check_numbers.py")
    mod = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = mod                                  # its dataclasses look the module up there
    spec.loader.exec_module(mod)
    status = 0
    for md in sorted((SITE / "content").glob("*.md")):
        print(f"$ check_numbers {md.relative_to(ROOT)} --allow {ALLOW}", flush=True)
        status |= mod.main([str(md), "--allow", ALLOW])
    return status


def run_own_tests(files: list[str]) -> int:
    if not files:                                                 # never a silent pass
        print("own-tests: no test files given (they come from --staged or --paths)", flush=True)
        return 1
    return pytest(*files)


CHECKS = {
    "typecheck": lambda: npx("tsc", "--noEmit"),
    "vitest": lambda: npx("vitest", "run"),
    "numbers": numbers,
    "site-data": lambda: pytest("tests/test_site_data.py"),
    "hooks": lambda: pytest("tests/test_hooks.py"),
    "check-all": lambda: pytest("tests/test_check_all.py"),
    "workflow": lambda: pytest("tests/test_workflow.py"),
    "own-tests": lambda: run_own_tests([]),                       # main() passes the selected files
    "pytest": lambda: pytest(),
}
# Test files that a named check already runs; own-tests leaves them to it.
RUN_BY_CHECK = {"tests/test_site_data.py", "tests/test_hooks.py", "tests/test_check_all.py", "tests/test_workflow.py"}
FAST = ["typecheck", "vitest", "numbers", "site-data", "hooks"]
FULL = ["typecheck", "vitest", "numbers", "pytest"]


def data_sources() -> set[str]:
    """Every source file that the exported site data records in its provenance (their hashes are tested)."""
    out: set[str] = set()
    for f in (SITE / "public" / "data").glob("*.json"):
        try:
            out |= set(json.loads(f.read_text(encoding="utf-8")).get("provenance", {}).get("sources", {}))
        except (ValueError, OSError):
            pass
    return out


def own_tests(paths: list[str]) -> list[str]:
    """The test files that changes to `paths` name (author, 2026-10-20): a changed tests/test_*.py runs itself, and a
    changed scripts/<name>.py runs tests/test_<name>.py when that file exists. Deleted files and files that a named
    check already runs (RUN_BY_CHECK) are left out."""
    out: set[str] = set()
    for p in (q.replace("\\", "/") for q in paths):
        if re.fullmatch(r"tests/test_\w+\.py", p):
            t = p
        elif m := re.fullmatch(r"scripts/(\w+)\.py", p):
            t = f"tests/test_{m.group(1)}.py"
        else:
            continue
        if t not in RUN_BY_CHECK and (ROOT / t).is_file():
            out.add(t)
    return sorted(out)


def select_checks(paths: list[str], sources: set[str] | None = None) -> list[str]:
    """The checks that changes to `paths` (repository-relative, / separators) can affect, in CHECKS order.

    - site/content/*           → numbers (the author's prose and notes)
    - site/public/data/*       → site-data; other site/public files (images, fonts) → nothing
    - other site/ files        → typecheck and vitest (code, styles, pages, plugins, e2e specs, configs)
    - the exporter, check_numbers.py, tests/ (methods.json records the test count), or any provenance source of
      the site data           → site-data
    - scripts/check_numbers.py → numbers too
    - .claude/hooks/, .claude/settings.json, tests/test_hooks.py → hooks
    - scripts/check_all.py, .githooks/, tests/test_check_all.py   → check-all
    - .github/, tests/test_workflow.py                            → workflow (actions pinned to commit SHAs)
    - a test file, or a script with its own test file (own_tests) → own-tests
    Anything else (logs, docs that feed nothing) needs no check here; the full run covers everything.
    """
    sources = data_sources() if sources is None else sources
    want: set[str] = set()
    for p in (q.replace("\\", "/") for q in paths):
        if p.startswith("site/content/"):
            want.add("numbers")
        elif p.startswith("site/public/data/"):
            want.add("site-data")
        elif p.startswith("site/public/"):
            pass
        elif p.startswith("site/"):
            want |= {"typecheck", "vitest"}
        if p in ("scripts/export_site_data.py", "scripts/check_numbers.py") or p.startswith("tests/") or p in sources:
            want.add("site-data")
        if p == "scripts/check_numbers.py":
            want.add("numbers")
        if p.startswith(".claude/hooks/") or p in (".claude/settings.json", "tests/test_hooks.py"):
            want.add("hooks")
        if p in ("scripts/check_all.py", "tests/test_check_all.py") or p.startswith(".githooks/"):
            want.add("check-all")
        if p.startswith(".github/") or p == "tests/test_workflow.py":
            want.add("workflow")
    if own_tests(paths):
        want.add("own-tests")
    return [n for n in CHECKS if n in want]


def staged_paths() -> list[str]:
    out = subprocess.run(["git", "diff", "--cached", "--name-only", "--diff-filter=ACMRD"], cwd=ROOT,
                         capture_output=True, text=True, check=True).stdout
    return [line for line in out.splitlines() if line.strip()]


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    mode = ap.add_mutually_exclusive_group()
    mode.add_argument("--fast", action="store_true", help="every check except the full Python suite")
    mode.add_argument("--staged", action="store_true", help="only the checks the staged files can affect (pre-commit)")
    mode.add_argument("--paths", nargs="+", help="only the checks these paths can affect")
    ap.add_argument("--only", default="", help=f"comma-separated subset of: {', '.join(CHECKS)}")
    ap.add_argument("--dry-run", action="store_true", help="print the checks that would run, and run none")
    a = ap.parse_args(argv)
    checks = dict(CHECKS)
    if a.staged or a.paths:
        paths = staged_paths() if a.staged else a.paths
        names = select_checks(paths)
        files = own_tests(paths)
        checks["own-tests"] = lambda: run_own_tests(files)
        shown = [f"{n} ({', '.join(files)})" if n == "own-tests" else n for n in names]
        print(f"{len(paths)} changed path(s) -> checks: {', '.join(shown) or 'none needed'}", flush=True)
    else:
        names = [n.strip() for n in a.only.split(",") if n.strip()] or (FAST if a.fast else FULL)
    unknown = [n for n in names if n not in CHECKS]
    if unknown:
        ap.error(f"unknown check(s): {', '.join(unknown)}")
    if a.dry_run or not names:
        return 0

    results = []
    for name in names:
        print(f"\n=== {name} ===", flush=True)
        t0 = time.perf_counter()
        try:
            status = checks[name]()
        except Exception as e:                                    # a crash in a check is a failure, never a pass
            print(f"{name} raised {type(e).__name__}: {e}", flush=True)
            status = 1
        results.append((name, status, time.perf_counter() - t0))

    print("\n=== summary ===")
    for name, status, dt in results:
        print(f"{'ok  ' if status == 0 else 'FAIL'}  {name:<10} {dt:6.1f} s")
    failed = [n for n, s, _ in results if s != 0]
    print(f"{len(results) - len(failed)} of {len(results)} checks passed" + (f"; failed: {', '.join(failed)}" if failed else ""))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
