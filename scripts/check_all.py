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

--fast is the pre-commit subset (.githooks/pre-commit): the full Python suite is replaced by the site-data and
hook tests. Playwright is not run here: it runs in CI and locally with `npx playwright test` (see CLAUDE.md).

Run:  .venv/Scripts/python scripts/check_all.py [--fast] [--only name,name]
"""

from __future__ import annotations

import argparse
import importlib.util
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


CHECKS = {
    "typecheck": lambda: npx("tsc", "--noEmit"),
    "vitest": lambda: npx("vitest", "run"),
    "numbers": numbers,
    "site-data": lambda: pytest("tests/test_site_data.py"),
    "hooks": lambda: pytest("tests/test_hooks.py"),
    "pytest": lambda: pytest(),
}
FAST = ["typecheck", "vitest", "numbers", "site-data", "hooks"]
FULL = ["typecheck", "vitest", "numbers", "pytest"]


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--fast", action="store_true", help="the pre-commit subset (no full Python suite)")
    ap.add_argument("--only", default="", help=f"comma-separated subset of: {', '.join(CHECKS)}")
    a = ap.parse_args(argv)
    names = [n.strip() for n in a.only.split(",") if n.strip()] or (FAST if a.fast else FULL)
    unknown = [n for n in names if n not in CHECKS]
    if unknown:
        ap.error(f"unknown check(s): {', '.join(unknown)}")

    results = []
    for name in names:
        print(f"\n=== {name} ===", flush=True)
        t0 = time.perf_counter()
        try:
            status = CHECKS[name]()
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
