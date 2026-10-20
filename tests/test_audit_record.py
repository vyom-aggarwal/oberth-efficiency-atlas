"""Every committed fresh-clone audit summary (docs/audit/<date>/summary.json, scripts/audit_record.py) agrees with the
comparison it summarizes, so the counts the methods section quotes can be traced to the per-file results."""

import json
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
AUDITS = sorted((ROOT / "docs" / "audit").glob("*/summary.json"))


@pytest.mark.parametrize("summary", AUDITS, ids=lambda p: p.parent.name)
def test_summary_counts_match_the_comparison(summary):
    s = json.loads(summary.read_text(encoding="utf-8"))
    entries = json.loads((summary.parent / s["comparison"]).read_text(encoding="utf-8"))
    assert s["outputs"] == len(entries)
    assert s["identical"] == sum(e["identical"] for e in entries)
    assert s["different"] == [e["file"] for e in entries if not e["identical"]]


def test_an_audit_is_committed():
    assert AUDITS, "no docs/audit/<date>/summary.json"
