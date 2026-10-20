"""The JSON rule of scripts/repro_audit.py: which site-data stamps the audit ignores and which it still compares
(RESEARCH_LOG 2026-10-19, the audit of 6cd1e6e)."""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import repro_audit as A  # noqa: E402


def site_data(git="abc1234", parquet="11", config="22", link="def5678", url="https://github.com/o/r"):
    return {"provenance": {"git": git, "generated_by": "scripts/export_site_data.py",
                           "sources": {"results/sweep_nd.parquet": parquet, "configs/atlas/presets.yaml": config}},
            "repo": {"url": url, "tag": "v1.0-analysis"},
            "source_links": {"src/oberth_atlas/theory.py": "v1.0-analysis", "scripts/fig_hero.py": link},
            "runtime_s": 3.0}


def same(x, y):
    return A.drop_wall_clock(x) == A.drop_wall_clock(y)


def test_stamps_are_ignored():
    # The commit stamp, the hash of a rebuilt output, and the commit (clean or dirty) a source link points at.
    assert same(site_data(), site_data(git="9999999-dirty", parquet="33", link="0d212e1-dirty"))


def test_hashes_of_sources_that_git_stores_are_compared():
    assert not same(site_data(), site_data(config="33"))


def test_whether_a_link_points_at_the_tag_is_compared():
    assert not same(site_data(), site_data(link="v1.0-analysis"))


def test_the_repository_url_is_compared():
    assert not same(site_data(), site_data(url="C:/Users/someone/clone"))


def test_sources_outside_provenance_are_values():
    assert not same({"sources": {"results/a.parquet": 1}}, {"sources": {"results/a.parquet": 2}})
