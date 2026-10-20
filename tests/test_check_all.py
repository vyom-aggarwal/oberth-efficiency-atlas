"""The pre-commit selection of scripts/check_all.py (author rule, 2026-10-19): only the checks that the staged files
can affect, so a prose commit skips the slow ones."""

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import check_all as C  # noqa: E402

SOURCES = {"configs/phase4/hibberd_som.yaml", "docs/paper_outline.md", "src/oberth_atlas/theory.py"}


def test_content_only_runs_only_check_numbers():
    assert C.select_checks(["site/content/regimes.md", "site/content/hero.md"], SOURCES) == ["numbers"]


def test_site_code_runs_the_type_check_and_vitest():
    assert C.select_checks(["site/src/charts/atlas.ts"], SOURCES) == ["typecheck", "vitest"]
    assert C.select_checks(["site/e2e/hero.spec.ts", "site/vite.config.ts"], SOURCES) == ["typecheck", "vitest"]


def test_exporter_data_tests_and_provenance_sources_run_the_site_data_tests():
    for p in ("scripts/export_site_data.py", "site/public/data/atlas.json", "tests/test_anim.py",
              "configs/phase4/hibberd_som.yaml", "docs/paper_outline.md", "src/oberth_atlas/theory.py"):
        assert C.select_checks([p], SOURCES) == ["site-data"], p


def test_hook_scripts_run_the_hook_tests():
    assert C.select_checks([".claude/hooks/shell-guard.mjs"], SOURCES) == ["hooks"]
    assert C.select_checks(["tests/test_hooks.py"], SOURCES) == ["site-data", "hooks"]   # tests/ also: methods.json


def test_logs_and_unrelated_files_need_no_check_and_assets_none():
    assert C.select_checks(["RESEARCH_LOG.md", "docs/ai_use_log.md", "site/public/og-image.png"], SOURCES) == []


def test_the_real_provenance_sources_are_read_from_the_site_data():
    assert "configs/phase4/hibberd_som.yaml" in C.data_sources()


def test_a_content_only_commit_skips_the_slow_checks_end_to_end():
    """The command the hook runs, given a content-only change: only check_numbers, nothing slow."""
    out = subprocess.run([sys.executable, str(ROOT / "scripts" / "check_all.py"), "--paths", "site/content/regimes.md",
                          "--dry-run"], capture_output=True, text=True, cwd=ROOT, check=True).stdout
    assert "checks: numbers" in out
    for slow in ("typecheck", "vitest", "site-data", "pytest"):
        assert slow not in out
