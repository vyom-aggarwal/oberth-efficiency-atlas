"""Quoted literature values and configured inputs, for scripts/check_numbers.py → figures/literature_numbers.json.

These are inputs and quotations, not results. Each value carries its source (RELATED_WORK.md section or
config file). Configured inputs are read from the config files so they stay in sync with the runs.
Run:  .venv/Scripts/python scripts/literature_numbers.py
"""

from __future__ import annotations

import json
from pathlib import Path

import yaml

from oberth_atlas.constants import AU, JUPITER

ROOT = Path(__file__).resolve().parents[1]

# Quoted from the sources as recorded in RELATED_WORK.md (section in the "source" field).
LITERATURE = {
    "confraria2020_robbins_overestimate_pct": (125.0, "RELATED_WORK §3: Confraria (2020), Robbins overestimates by ~125%"),
    "hibberd2026_c3_km2_s2": (130.2, "RELATED_WORK §5: Hibberd et al. (2026) Table 1, 50-yr row"),
    "hibberd2026_som_dv_km_s": (8.355, "RELATED_WORK §5: Table 1"),
    "hibberd2026_som_dv_table2_km_s": (8.36, "RELATED_WORK §5: Table 2 caption"),
    "hibberd2026_speed_at_som_km_s": (352.0, "RELATED_WORK §5: Table 1 'heliocentric speed at SOM'"),
    "hibberd2026_intercept_distance_au": (732.0, "RELATED_WORK §5: Table 1"),
    "hibberd2026_flight_years": (50.0, "RELATED_WORK §5: Table 1"),
    "hibberd2026_encounter_speed_km_s": (16.0, "RELATED_WORK §5: Table 1"),
    "hibberd2026_total_mass_kg": (17754.0, "RELATED_WORK §5: Table 1 / Table 2 row m"),
    "maraqten2026_payload_kg": (3083.0, "RELATED_WORK §6: Maraqten et al. (2026) Table 5"),
    "maraqten2026_flight_years": (24.97, "RELATED_WORK §6: Table 5"),
    "maraqten2026_power_rsom_kW": (1954.9, "configs/phase4/hibberd_som.yaml; Table 5"),
    "maraqten2026_energy_gain_factor": (3.0, "RELATED_WORK §6: 'threefold increase'"),
}


def main() -> None:
    cfg = yaml.safe_load((ROOT / "configs" / "phase4" / "hibberd_som.yaml").read_text(encoding="utf-8"))
    sep = cfg["sep_maraqten2026"]
    inputs = {
        "som_r_p_over_R_sun": cfg["som"]["r_p_over_R_sun"],
        "som_delta_v_km_s": cfg["som"]["delta_v_km_s"],
        "arrival_aphelion_au": JUPITER.sma / AU,
        "payload_kg": cfg["payload_kg"],
        **{f"stage{i + 1}_{k}": s[k] for i, s in enumerate(cfg["stages"])
           for k in ("total_kg", "dry_kg", "exhaust_velocity_km_s", "burn_time_s", "max_thrust_lbf", "avg_thrust_lbf")},
        **{f"sep_{k}": v for k, v in sep.items() if isinstance(v, (int, float))},
        "nuclear_thermal_isp_s": cfg["nuclear_thermal"]["isp_s"],
        "nuclear_thermal_a0_m_s2": cfg["nuclear_thermal"]["a0_m_s2"],
    }
    out = {"inputs": inputs, "literature": {k: v for k, (v, _) in LITERATURE.items()},
           "sources": {k: src for k, (_, src) in LITERATURE.items()}}
    (ROOT / "figures" / "literature_numbers.json").write_text(json.dumps(out, indent=1, ensure_ascii=False),
                                                              encoding="utf-8")
    print(f"wrote figures/literature_numbers.json ({len(inputs)} inputs, {len(LITERATURE)} quoted values)")


if __name__ == "__main__":
    main()
