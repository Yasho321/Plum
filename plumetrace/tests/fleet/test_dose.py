"""
OWNER    : Khare
DUE      : D1 14:00
TASK     :
  Mandatory: constant 100 µg/m³ for 60 min, VE 1.4, traffic 1.3 -> 182 µg (hand calc); budget formula.
DONE WHEN: -
GUIDE    : docs/team/KHARE.md  |  brief: docs/PROJECT_BRIEF.md
STATUS   : DONE
"""

from fleet.dose.dose import segment_dose_ug, route_dose_ug, daily_budget_ug, dose_pct
import math

def test_segment_dose():
    # constant 100 µg/m³ for 60 min, VE 1.4, traffic 1.3 -> 182 µg
    dose = segment_dose_ug(c_pm25=100.0, minutes=60.0, ve=1.4, traffic_mult=1.3)
    assert math.isclose(dose, 182.0, rel_tol=1e-5), f"Expected 182.0, got {dose}"

def test_daily_budget():
    # 60 µg/m³ * 1.4 m³/h * 8 hours * 1.0 = 672.0 µg
    budget = daily_budget_ug(shift_hours=8.0, budget_multiplier=1.0, standard=60.0, ve=1.4)
    assert math.isclose(budget, 672.0, rel_tol=1e-5), f"Expected 672.0, got {budget}"
    
    # with health condition multiplier 0.7
    budget_health = daily_budget_ug(shift_hours=8.0, budget_multiplier=0.7)
    assert math.isclose(budget_health, 672.0 * 0.7, rel_tol=1e-5)

def test_dose_pct():
    assert dose_pct(182.0, 672.0) == (182.0 / 672.0) * 100.0
    assert dose_pct(100.0, 0.0) == 0.0

def test_route_dose():
    stops = [
        {'h3': '8739b61', 'eta': 0.0},
        {'h3': '8739b62', 'eta': 30.0},
        {'h3': '8739b63', 'eta': 60.0}
    ]
    def mock_conc_lookup(h3, time_utc):
        return 100.0
    
    # 2 segments of 30 mins each = 60 mins total at 100 µg/m³ -> 182 µg
    dose = route_dose_ug(stops, mock_conc_lookup, start_utc=1600000000)
    assert math.isclose(dose, 182.0, rel_tol=1e-5), f"Expected 182.0, got {dose}"
