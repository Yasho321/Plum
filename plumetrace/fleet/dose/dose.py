"""
OWNER    : Khare
DUE      : D1 14:00  ← interface Yasho2 depends on
TASK     :
  Pure functions (§13.2), no I/O:
    segment_dose_ug(c_pm25, minutes, ve=1.4, traffic_mult=1.3) -> float
    route_dose_ug(stops, conc: ConcLookup, start_utc) -> float   # stops = planned_stops
    daily_budget_ug(shift_hours, budget_multiplier=1.0, standard=60, ve=1.4) -> float
    dose_pct(dose_ug, budget_ug) -> float
  Constants from env with defaults (VE, traffic mult).
DONE WHEN: tests/fleet/test_dose.py hand-calc passes.
GUIDE    : docs/team/KHARE.md  |  brief: docs/PROJECT_BRIEF.md
STATUS   : DONE
"""

import os
from typing import Any, Callable, List, Dict

VE_DEFAULT = float(os.environ.get("PLUMETRACE_VE_DEFAULT", "1.4"))
TRAFFIC_MULT_DEFAULT = float(os.environ.get("PLUMETRACE_TRAFFIC_MULT", "1.3"))

def segment_dose_ug(c_pm25: float, minutes: float, ve: float = VE_DEFAULT, traffic_mult: float = TRAFFIC_MULT_DEFAULT) -> float:
    """Calculate the inhaled PM2.5 dose (µg) for a single time segment."""
    return c_pm25 * traffic_mult * (minutes / 60.0) * ve

def route_dose_ug(stops: List[Dict[str, Any]], conc_lookup: Callable[[str, float], float], start_utc: float) -> float:
    """
    Calculate the total dose (µg) over a series of stops.
    stops: list of dicts with 'h3' and 'eta' (minutes from start_utc)
    conc_lookup: function(h3: str, time_utc: float) -> float (PM2.5 concentration in µg/m³)
    start_utc: unix timestamp of shift start
    """
    total_dose = 0.0
    current_time = start_utc
    current_minutes = 0.0
    
    for i in range(len(stops) - 1):
        start_stop = stops[i]
        end_stop = stops[i+1]
        
        # We assume the rider spends the time between eta[i] and eta[i+1] traveling/waiting in start_stop's H3 cell,
        # or we can take the average of concentrations. Using start_stop's cell for simplicity as per segment.
        h3 = start_stop['h3']
        minutes = end_stop['eta'] - start_stop['eta']
        time_utc = start_utc + (start_stop['eta'] * 60.0)
        
        c_pm25 = conc_lookup(h3, time_utc)
        total_dose += segment_dose_ug(c_pm25, minutes)
        
    return total_dose

def daily_budget_ug(shift_hours: float, budget_multiplier: float = 1.0, standard: float = 60.0, ve: float = VE_DEFAULT) -> float:
    """Calculate the daily PM2.5 dose budget (µg) for a rider."""
    return standard * ve * shift_hours * budget_multiplier

def dose_pct(dose_ug: float, budget_ug: float) -> float:
    """Calculate the dose as a percentage of the budget."""
    if budget_ug == 0.0:
        return 0.0
    return (dose_ug / budget_ug) * 100.0
