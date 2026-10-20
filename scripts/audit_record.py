"""Record a fresh-clone audit under docs/audit/<date>_<audited commit>/ (Phase 6, checkpoint 6).

Given the reference checkout (this repository) and a fresh clone in which scripts/rebuild_all.py has run, this
runs scripts/repro_audit.py's comparison and writes:
  comparison.json      one entry per output: file, identical, note (repro_audit.py --json)
  rebuild_timings.json the clone's runs/rebuild_timings.json (wall times are indicative)
  summary.json         what the site's methods section quotes, every count computed here from the files above:
                       the audited commit, outputs compared and identical, the files that differ, the test result
                       of the rebuild's first step, and whether the clone's packages equal requirements-lock.txt
The audit's prose account goes in docs/repro.md.

Run:  .venv/Scripts/python scripts/audit_record.py CLONE_DIR --log REBUILD_LOG [--date YYYY-MM-DD]
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def git(repo: Path, *args: str) -> str:
    return subprocess.run(["git", *args], cwd=repo, capture_output=True, text=True, check=True).stdout.strip()


def norm(name: str) -> str:
    return name.lower().replace("_", "-")


def main(argv=None) -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("clone", type=Path)
    ap.add_argument("--log", type=Path, required=True, help="the rebuild_all.py output of the clone")
    ap.add_argument("--date", default=dt.date.today().isoformat())
    a = ap.parse_args(argv)
    audited = git(a.clone, "rev-parse", "--short", "HEAD")
    out = ROOT / "docs" / "audit" / f"{a.date}_{audited}"
    out.mkdir(parents=True, exist_ok=True)

    comparison = out / "comparison.json"
    r = subprocess.run([sys.executable, str(ROOT / "scripts" / "repro_audit.py"), str(ROOT), str(a.clone), "--json", str(comparison)],
                       capture_output=True, text=True, encoding="utf-8")
    print(r.stdout[-400:])
    entries = json.loads(comparison.read_text(encoding="utf-8"))
    shutil.copyfile(a.clone / "runs" / "rebuild_timings.json", out / "rebuild_timings.json")
    timings = json.loads((out / "rebuild_timings.json").read_text(encoding="utf-8"))

    log = a.log.read_text(encoding="utf-8", errors="replace")
    tests = re.search(r"(\d+) passed(?:, (\d+) skipped)?(?:, \d+ warnings?)? in", log)
    py = next(p for p in (a.clone / ".venv" / "Scripts" / "python.exe", a.clone / ".venv" / "bin" / "python") if p.exists())
    freeze = subprocess.run([str(py), "-m", "pip", "freeze"], capture_output=True, text=True, check=True).stdout
    installed = {norm(l) for l in freeze.splitlines() if "==" in l and not l.startswith("-e") and "oberth" not in l}
    locked = {norm(l.strip()) for l in (a.clone / "requirements-lock.txt").read_text(encoding="utf-8").splitlines()
              if l.strip() and not l.startswith("#")}

    summary = {
        "date": a.date,
        "audited_commit": audited,
        "reference_commit": git(ROOT, "rev-parse", "--short", "HEAD"),
        "outputs": len(entries),
        "identical": sum(e["identical"] for e in entries),
        "different": [e["file"] for e in entries if not e["identical"]],
        "tests_passed": int(tests.group(1)) if tests else None,
        "tests_skipped": int(tests.group(2)) if tests and tests.group(2) else 0,
        "rebuild_steps": len(timings.get("steps", {})),
        "rebuild_all_ok": all(s["returncode"] == 0 for s in timings.get("steps", {}).values()) and "total_minutes" in timings,
        "packages_locked": len(locked),
        "packages_match_lock": installed == locked,
        "python": timings.get("python"),
        "comparison": "comparison.json",
    }
    (out / "summary.json").write_text(json.dumps(summary, indent=1), encoding="utf-8")
    print(json.dumps(summary, indent=1))
    return 0 if r.returncode == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
