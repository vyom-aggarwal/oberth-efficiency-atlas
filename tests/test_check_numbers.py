"""The draft number checker: matches at written precision and unit scale, skips references and code."""

import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import check_numbers as C  # noqa: E402

NUMBERS = {"reference": {"dv_loss_m_s": 0.0897328, "loss_rel": 1.0730541e-05, "dv_rocket_m_s": 8362.3755},
           "missions": {"n_valid": 5895, "share": 0.7148}, "thresholds": {"Pi": 0.9757}}


@pytest.fixture
def jfile(tmp_path):
    f = tmp_path / "x_numbers.json"
    f.write_text(json.dumps(NUMBERS), encoding="utf-8")
    return f


def run(tmp_path, jfile, text, *extra):
    d = tmp_path / "draft.md"
    d.write_text(text, encoding="utf-8")
    return C.main([str(d), "--json", str(jfile), *extra])


def test_matches_at_written_precision_and_unit_scale(tmp_path, jfile, capsys):
    text = ("The loss is 0.0897 m/s (1.07×10⁻⁵ of Δv, i.e. 1.073e-5), the burn gives 8.36 km/s,\n"
            "71.5% of samples and 5,895 runs; Π ≈ 0.976.\n")
    assert run(tmp_path, jfile, text) == 0
    assert "0 unmatched" in capsys.readouterr().out


def test_flags_unmatched_and_wrong_precision(tmp_path, jfile, capsys):
    assert run(tmp_path, jfile, "The loss is 0.0898 m/s and 42.7 is invented.\n") == 1
    out = capsys.readouterr().out
    assert "0.0898 m/s  NO MATCH" in out and "42.7  NO MATCH" in out


def test_range_start_inherits_the_unit(tmp_path, jfile, capsys):
    # "71.5–71.5%": both ends are percentages of the fraction 0.7148.
    assert run(tmp_path, jfile, "between 71.5–71.5% of samples\n") == 0


def test_skips_references_identifiers_code_and_citations(tmp_path, jfile, capsys):
    text = ("As in Fig. 3, Table 2 and Phase 4 (rows 19–25), J2 and STAR 48B and 3I/ATLAS and claim P6,\n"
            "Hibberd et al. 2026<sup>17</sup> [link](https://x.org/123.45) `code 99.9` arXiv:2601.02533.\n"
            "```\n77.7 inside a fence\n```\n"
            "This 55.5 is exempt <!-- nocheck -->\n"
            "1. a list item with small 3 and 7\n")
    assert run(tmp_path, jfile, text) == 0
    assert "0 numbers checked" in capsys.readouterr().out


def test_no_hidden_unit_scaling(tmp_path, jfile, capsys):
    """Regression: blanket ×10^±6 scales let '0.28' match 2.8e-7. Scaling now needs an explicit unit."""
    f = tmp_path / "y_numbers.json"
    f.write_text(json.dumps({"tiny": 2.8e-7, "speed_m_s": 8362.3755}), encoding="utf-8")
    assert run(tmp_path, f, "a fraction of 0.28 here\n") == 1
    assert run(tmp_path, f, "a speed of 8.36 km/s and 8362 m/s\n") == 0


def test_coarse_numbers_are_listed_not_verified(tmp_path, jfile, capsys):
    assert run(tmp_path, jfile, "about 0.3 of them and 40 more\n") == 0
    assert "2 with one significant figure not verified" in capsys.readouterr().out
    assert run(tmp_path, jfile, "about 0.3 of them\n", "--strict") == 1


def test_allow_and_strict(tmp_path, jfile, capsys):
    assert run(tmp_path, jfile, "loss ≈ Π²/96 for Π ≤ 1\n", "--allow", "96") == 0
    assert run(tmp_path, jfile, "loss ≈ Π²/96\n") == 1          # 96 is not in the JSON and not allowed
    assert run(tmp_path, jfile, "exactly 7 cases\n", "--strict") == 1
