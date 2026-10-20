"""The site workflow (.github/workflows/site.yml): every action pinned to a full commit SHA with its tag in a comment
(author, 2026-10-19), deployment only on a manual run, and the gates the author set."""

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
