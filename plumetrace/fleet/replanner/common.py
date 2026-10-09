"""
OWNER    : Yasho2
TASK     :
  Shared re-planner model + plan evaluation used by greedy.py and cpsat_model.py.
  Dependency-injected dose/concentration/travel functions so the solver is
  decoupled from Khare's fleet/dose + fleet/common/forecast_lookup (same
  signatures; handler.py wires the real ones). Safe defaults let it run offline.
STATUS   : DONE
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Callable, Optional

import h3

IST = timezone(timedelta(hours=5, minutes=30))
UTC = timezone.utc


@dataclass
class Order:
    order_id: str
    pickup_h3: str
    drop_h3: str
    orig_rider: str
    orig_slot: int          # slot index in the grid
    flexible: bool
    window_slots: int = 0   # how many slots forward a flexible order may move
    service_min: float = 12.0


@dataclass
class Rider:
    rider_id: str
    home_h3: str
    budget_ug: float
    shift_hours: float = 9.0


class SlotGrid:
    """30-min slots over 06:00–23:00 IST on a given IST calendar date."""

    def __init__(self, date: str = "2026-10-10", start_ist: float = 6.0, end_ist: float = 23.0, minutes: int = 30):
        self.date = date
        self.minutes = minutes
        y, m, d = (int(x) for x in date.split("-"))
        # 00:00 IST of the plan date, in UTC
        base_ist = datetime(y, m, d, 0, 0, tzinfo=IST)
        self._starts: list[datetime] = []
        step = timedelta(minutes=minutes)
        t = base_ist + timedelta(hours=start_ist)
        end = base_ist + timedelta(hours=end_ist)
        while t < end:
            self._starts.append(t.astimezone(UTC))
            t += step

    @property
    def n(self) -> int:
        return len(self._starts)

    def slot_utc(self, i: int) -> datetime:
        return self._starts[max(0, min(i, self.n - 1))]

    def slot_ist_hour(self, i: int) -> float:
        t = self.slot_utc(i).astimezone(IST)
        return t.hour + t.minute / 60.0

    def is_morning_peak(self, i: int) -> bool:
        """06:00–10:00 IST peak (brief §13.3 greedy)."""
        return 6.0 <= self.slot_ist_hour(i) < 10.0


# ---- default injected functions (overridable; Khare's are the real ones) ----

def default_segment_dose_ug(c_pm25: float, minutes: float, ve: float = 1.4, traffic_mult: float = 1.3) -> float:
    """Mirror of dose.segment_dose_ug (§13.2): c × traffic_mult × (min/60) × VE."""
    return c_pm25 * traffic_mult * (minutes / 60.0) * ve


def haversine_km(a: str, b: str) -> float:
    la, lo = h3.cell_to_latlng(a)
    lb, lob = h3.cell_to_latlng(b)
    r = 6371.0
    dlat = math.radians(lb - la)
    dlon = math.radians(lob - lo)
    x = math.sin(dlat / 2) ** 2 + math.cos(math.radians(la)) * math.cos(math.radians(lb)) * math.sin(dlon / 2) ** 2
    return 2 * r * math.asin(math.sqrt(x))


def default_travel_min(a: str, b: str, kmph: float = 22.0) -> float:
    """Haversine / 22 km/h fallback when Amazon Location is unavailable (§13.3)."""
    if a == b:
        return 2.0
    return haversine_km(a, b) / kmph * 60.0


@dataclass
class Context:
    grid: SlotGrid
    # conc(h3, utc_datetime) -> µg/m³ (Khare's ConcLookup.pm25, adapted to datetime)
    conc: Callable[[str, datetime], float]
    segment_dose: Callable[[float, float], float] = default_segment_dose_ug
    travel_min: Callable[[str, str], float] = default_travel_min

    def order_dose(self, order: Order, rider: Rider, slot: int) -> float:
        """Inhaled dose (µg) if `rider` serves `order` in `slot` (home→pickup→drop)."""
        t = self.grid.slot_utc(slot)
        leg1 = self.travel_min(rider.home_h3, order.pickup_h3)
        leg2 = self.travel_min(order.pickup_h3, order.drop_h3)
        return (
            self.segment_dose(self.conc(order.pickup_h3, t), leg1)
            + self.segment_dose(self.conc(order.drop_h3, t), leg2 + order.service_min)
        )

    def order_minutes(self, order: Order, rider: Rider) -> float:
        return self.travel_min(rider.home_h3, order.pickup_h3) + self.travel_min(order.pickup_h3, order.drop_h3) + order.service_min


# assignment: order_id -> (rider_id, slot_idx)
Assignment = dict


def baseline_assignment(orders: list[Order]) -> Assignment:
    return {o.order_id: (o.orig_rider, o.orig_slot) for o in orders}


def rider_doses(assign: Assignment, orders: dict, riders: dict, ctx: Context) -> dict:
    doses = {rid: 0.0 for rid in riders}
    for oid, (rid, slot) in assign.items():
        doses[rid] = doses.get(rid, 0.0) + ctx.order_dose(orders[oid], riders[rid], slot)
    return doses


def rider_pcts(doses: dict, riders: dict) -> dict:
    return {rid: (doses[rid] / riders[rid].budget_ug * 100.0 if riders[rid].budget_ug else 0.0) for rid in doses}


@dataclass
class ReplanMetrics:
    solver: str
    riders_changed: int
    dose_reduction_pct: dict          # {fleet_total, worst_rider}
    extra_minutes: dict               # {average, total}
    worst_pct_before: float
    worst_pct_after: float
    over_budget_before: int
    over_budget_after: int


def evaluate(before: Assignment, after: Assignment, orders: dict, riders: dict, ctx: Context, solver: str) -> ReplanMetrics:
    db = rider_doses(before, orders, riders, ctx)
    da = rider_doses(after, orders, riders, ctx)
    pb = rider_pcts(db, riders)
    pa = rider_pcts(da, riders)

    fleet_before = sum(db.values()) or 1e-9
    fleet_after = sum(da.values())
    worst_before = max(pb.values(), default=0.0)
    worst_after = max(pa.values(), default=0.0)

    # extra minutes vs the original plan = added TRAVEL/work time only.
    # A flexible order moving to a cleaner slot costs no extra minutes (that is
    # the point); only re-assigning to a farther rider adds travel time.
    total_extra = 0.0
    changed = set()
    for oid, (rid, slot) in after.items():
        brid, bslot = before[oid]
        if (rid, slot) != (brid, bslot):
            changed.add(rid)
            changed.add(brid)
        mins_after = ctx.order_minutes(orders[oid], riders[rid])
        mins_before = ctx.order_minutes(orders[oid], riders[brid])
        total_extra += max(0.0, mins_after - mins_before)

    riders_changed = len(changed)
    return ReplanMetrics(
        solver=solver,
        riders_changed=riders_changed,
        dose_reduction_pct={
            "fleet_total": round((fleet_before - fleet_after) / fleet_before * 100.0, 1),
            "worst_rider": round((worst_before - worst_after) / worst_before * 100.0, 1) if worst_before else 0.0,
        },
        extra_minutes={
            "average": round(total_extra / riders_changed, 1) if riders_changed else 0.0,
            "total": round(total_extra, 1),
        },
        worst_pct_before=round(worst_before, 1),
        worst_pct_after=round(worst_after, 1),
        over_budget_before=sum(1 for p in pb.values() if p > 100.0),
        over_budget_after=sum(1 for p in pa.values() if p > 100.0),
    )
