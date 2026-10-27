"""The site workflow (.github/workflows/site.yml): every action pinned to a full commit SHA with its tag in a comment
(author, 2026-10-19), every job on a pinned runner image (author, 2026-10-26), deployment only on a manual run, and the
gates the author set."""

import re
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
WF = ROOT / ".github" / "workflows" / "site.yml"


def load():
    return yaml.safe_load(WF.read_text(encoding="utf-8"))


def test_every_action_is_pinned_to_a_full_commit_sha_with_its_tag():
    lines = [l for l in WF.read_text(encoding="utf-8").splitlines() if re.match(r"\s*(- )?uses:", l)]
    assert lines
    for line in lines:
        assert re.search(r"uses: [\w.-]+/[\w.-]+@[0-9a-f]{40} # v\d+\.\d+\.\d+$", line), line


def test_every_job_runs_on_the_pinned_runner_image():
    # Author, 2026-10-26: ubuntu-latest moves to Ubuntu 26 (GitHub's notice of 2026-10-19); the checks, Playwright and
    # Lighthouse were validated on Ubuntu 24.04, so every job names it, and no "-latest" label is used anywhere.
    jobs = load()["jobs"]
    assert jobs
    for name, job in jobs.items():
        assert job["runs-on"] == "ubuntu-24.04", name
    assert "-latest" not in WF.read_text(encoding="utf-8")


def test_deploy_runs_only_by_hand_and_after_every_check():
    jobs = load()["jobs"]
    assert jobs["deploy"]["if"] == "github.event_name == 'workflow_dispatch'"
    assert set(jobs["deploy"]["needs"]) == {"check", "lighthouse", "build"}
    on = load()[True]                              # YAML reads the bare key "on" as true
    assert "workflow_dispatch" in on and "push" in on


def test_tests_build_and_lighthouse_run_on_every_push():
    jobs = load()["jobs"]
    for name in ("check", "lighthouse", "build"):
        assert "if" not in jobs[name], name
    steps = "\n".join(str(s.get("run", "")) for s in jobs["check"]["steps"])
    assert "scripts/check_all.py" in steps and "playwright test" in steps
    assert any("npm run lighthouse" in str(s.get("run", "")) for s in jobs["lighthouse"]["steps"])


def test_playwright_runs_against_the_test_production_and_placeholder_builds():
    # Phase 7 (author, 2026-10-21): the production build checks links under the base path and the fold with the slots
    # empty; the placeholder build checks the fold with a written headline and the headline budget.
    (step,) = [s for s in load()["jobs"]["check"]["steps"] if "playwright test" in str(s.get("run", ""))]
    run = step["run"]
    assert "--outDir dist-prod" in run and "--outDir dist-ph" in run and "SITE_PLACEHOLDERS=1" in run
    assert "SITE_DIST=dist-test SITE_DIST_PROD=dist-prod SITE_DIST_PH=dist-ph npx playwright test" in run


def test_hero_frame_time_is_report_only_in_ci():
    # Author, 2026-10-20: the 16 ms p95 target holds on the development laptop, not on shared runners.
    (step,) = [s for s in load()["jobs"]["check"]["steps"] if "playwright test" in str(s.get("run", ""))]
    assert step["env"]["HERO_FRAME_TIME"] == "report"
    assert "HERO_P95_MS" not in step["env"]
    spec = (ROOT / "site" / "e2e" / "hero.spec.ts").read_text(encoding="utf-8")
    assert 'process.env.HERO_FRAME_TIME === "report"' in spec and "GITHUB_STEP_SUMMARY" in spec
