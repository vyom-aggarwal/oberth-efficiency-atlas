"""The Claude Code pre-tool hook .claude/hooks/shell-guard.mjs (CLAUDE.md working rules).

Guard 1 must block heredocs and PowerShell here-strings (file writes, tee, interpreter scripts) and still allow a
heredoc used only for a git commit message. Guard 2 must block a test run piped into tail, head or grep unless
the command sets pipefail first, and allow everything else. Each case runs the hook as Claude Code does: JSON on
stdin, exit 2 to block (reason on stderr), exit 0 to allow. Skipped when node is not installed.
"""

import json
import shutil
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
HOOK = ROOT / ".claude" / "hooks" / "shell-guard.mjs"
NODE = shutil.which("node")
pytestmark = pytest.mark.skipif(NODE is None, reason="node is not installed")


def run(command: str, tool: str = "Bash") -> subprocess.CompletedProcess:
    payload = json.dumps({"tool_name": tool, "tool_input": {"command": command}})
    return subprocess.run([NODE, str(HOOK)], input=payload, capture_output=True, text=True, timeout=30)


# ---------------------------------------------------------------- guard 1: heredocs

BLOCK = {
    "cat redirect": "cat > notes.md <<'EOF'\nline one\nline two\nEOF",
    "redirect after": "cat <<EOF > notes.md\nline\nEOF",
    "append": "cat >> RESEARCH_LOG.md <<'EOF'\nentry\nEOF",
    "tee": "tee notes.md >/dev/null <<'EOF'\nx\nEOF",
    "indented heredoc": "cat <<-EOF > f.txt\n\tx\n\tEOF",
    "python heredoc": "python - <<'PY'\nopen('f.ts', 'w').write('x')\nPY",
    "commit then write": "git commit -m \"$(cat <<'EOF'\nmsg\nEOF\n)\" && cat > f <<'X'\nbody\nX",
    "powershell set-content": "@'\nhello\n'@ | Set-Content notes.md",
}
ALLOW = {
    "commit via cat": "git commit -m \"$(cat <<'EOF'\nSubject line\n\nBody text.\nEOF\n)\"",
    "commit -F -": "git commit -q -F - <<'EOF'\nSubject\nEOF",
    "commit after cd": "cd site && git -C .. commit -F - <<EOF\nmsg\nEOF",
    "powershell commit": "git commit -m @'\nSubject\n'@",
    "literal << in quotes": 'grep -n "<<EOF" scripts/x.sh',
    "no heredoc": "ls -la && git status --short",
    "here-string (bash)": 'python -c "import sys" <<< "x"',
}


@pytest.mark.parametrize("name", BLOCK)
def test_blocks_heredoc_writes(name):
    tool = "PowerShell" if name.startswith("powershell") else "Bash"
    r = run(BLOCK[name], tool)
    assert r.returncode == 2, (name, r.stdout, r.stderr)
    assert "Edit or Write tool" in r.stderr


@pytest.mark.parametrize("name", ALLOW)
def test_allows_commit_messages_and_ordinary_commands(name):
    tool = "PowerShell" if name.startswith("powershell") else "Bash"
    r = run(ALLOW[name], tool)
    assert r.returncode == 0, (name, r.stderr)


# ---------------------------------------------------------------- guard 2: test exit status hidden by a pipe

PIPE_BLOCK = {
    "pytest into tail": ".venv/Scripts/python -m pytest -q | tail -1",
    "the Phase 6 slip": "pytest tests/test_site_data.py -q 2>&1 | tail -1 && git add site/public/data && git commit -m x",
    "playwright into grep": 'npx playwright test 2>&1 | grep -E "passed|failed"',
    "vitest into head": "cd site && npx vitest run | head -20",
    "npm test into tail": "npm test | tail -5",
    "npm run e2e into tail": "npm --prefix site run e2e | tail -3",
    "pipefail only afterwards": "pytest -q | tail -1; set -o pipefail",
}
PIPE_ALLOW = {
    "pipefail first": "set -o pipefail; .venv/Scripts/python -m pytest -q | tail -1",
    "set -euo pipefail": "set -euo pipefail\npytest | tail -3",
    "tests not piped": ".venv/Scripts/python -m pytest -q && git commit -m x",
    "non-test pipe": "git log --oneline | head -5",
    "pytest as an argument": "grep -n pytest CLAUDE.md | head",
    "pipe text in a commit message": 'git commit -m "never pipe pytest -q | tail -1"',
    "pipe text in a heredoc message": "git commit -F - <<'EOF'\nSubject\n\npytest -q | tail -1 hid a failure\nEOF",
}


@pytest.mark.parametrize("name", PIPE_BLOCK)
def test_blocks_test_output_piped_without_pipefail(name):
    r = run(PIPE_BLOCK[name])
    assert r.returncode == 2, (name, r.stdout, r.stderr)
    assert "pipefail" in r.stderr


@pytest.mark.parametrize("name", PIPE_ALLOW)
def test_allows_pipefail_and_unrelated_pipes(name):
    r = run(PIPE_ALLOW[name])
    assert r.returncode == 0, (name, r.stderr)


def test_other_tools_and_bad_input_pass_through():
    payload = json.dumps({"tool_name": "Write", "tool_input": {"file_path": "x", "content": "cat > f <<EOF\nEOF"}})
    assert subprocess.run([NODE, str(HOOK)], input=payload, capture_output=True, text=True).returncode == 0
    assert subprocess.run([NODE, str(HOOK)], input="not json", capture_output=True, text=True).returncode == 0


def test_hook_is_registered_in_project_settings():
    settings = json.loads((ROOT / ".claude" / "settings.json").read_text(encoding="utf-8"))
    entries = settings["hooks"]["PreToolUse"]
    hooked = [h["command"] for e in entries if set(e["matcher"].split("|")) >= {"Bash", "PowerShell"} for h in e["hooks"]]
    assert any("shell-guard.mjs" in c for c in hooked)
