"""
OWNER    : Yasho2
DUE      : D2 20:00
TASK     :
  Small instance (5 riders, 40 orders): solution keeps non-flexible orders on time, no rider >100 % when feasible, greedy fallback returns valid plan.
DONE WHEN: -
GUIDE    : docs/team/YASHO2.md  |  brief: docs/PROJECT_BRIEF.md
STATUS   : DONE
"""
import time

import pytest

from fleet.replanner.common import baseline_assignment, rider_doses, rider_pcts
from fleet.replanner.cpsat_model import replan_cpsat
from fleet.replanner.greedy import replan_greedy
from fleet.replanner.handler import build_demo_instance, run_replan


@pytest.fixture
def small():
    # 5 riders, 40 orders — the mandated small instance.
    return build_demo_instance(n_riders=5, n_orders=40, seed=1)


def _assert_valid_plan(assign, orders, riders):
    rider_ids = {r.rider_id for r in riders}
    order_ids = {o.order_id for o in orders}
    assert set(assign) == order_ids, "every order assigned exactly once"
    by_id = {o.order_id: o for o in orders}
    for oid, (rid, slot) in assign.items():
        assert rid in rider_ids
        assert 0 <= slot
        o = by_id[oid]
        if not o.flexible:
            assert slot == o.orig_slot, "non-flexible orders stay on time"


def test_greedy_returns_valid_plan_fast(small):
    orders, riders, ctx = small
    t0 = time.time()
    assign, metrics = replan_greedy(orders, riders, ctx)
    assert time.time() - t0 < 5.0
    _assert_valid_plan(assign, orders, riders)
    assert metrics.solver == "greedy"
    # greedy never makes the worst rider worse
    assert metrics.worst_pct_after <= metrics.worst_pct_before + 1e-6


def test_cpsat_small_instance(small):
    orders, riders, ctx = small
    assign, metrics = replan_cpsat(orders, riders, ctx, time_limit_s=10.0)
    _assert_valid_plan(assign, orders, riders)
    assert metrics.solver == "cpsat"
    # the optimiser reduces (or holds) the worst rider and never adds over-budget riders
    assert metrics.worst_pct_after <= metrics.worst_pct_before + 1e-6
    assert metrics.over_budget_after <= metrics.over_budget_before


def test_baseline_has_over_budget_riders(small):
    # the scenario is meaningful only if someone is over budget to begin with
    orders, riders, ctx = small
    base = baseline_assignment(orders)
    pcts = rider_pcts(rider_doses(base, {o.order_id: o for o in orders}, {r.rider_id: r for r in riders}, ctx),
                      {r.rider_id: r for r in riders})
    assert max(pcts.values()) > 100.0


def test_run_replan_output_shape(small):
    out = run_replan({"fleet_id": "fleet_demo", "date": "2026-10-10"}, instance=small, time_limit_s=10.0)
    assert set(out) == {"action_id", "riders_changed", "dose_reduction_pct", "extra_minutes", "solver"}
    assert set(out["dose_reduction_pct"]) == {"fleet_total", "worst_rider"}
    assert set(out["extra_minutes"]) == {"average", "total"}
    assert out["solver"] in {"cpsat", "greedy"}


@pytest.mark.slow
def test_ac7_fifty_riders_under_60s():
    """AC7: re-planner for 50 riders returns a dose reduction + extra-minutes in < 60 s."""
    orders, riders, ctx = build_demo_instance(n_riders=50, n_orders=600, seed=7)
    t0 = time.time()
    out = run_replan({"fleet_id": "fleet_demo", "date": "2026-10-10"}, instance=(orders, riders, ctx), time_limit_s=30.0)
    elapsed = time.time() - t0
    assert elapsed < 60.0, f"took {elapsed:.1f}s"
    assert out["dose_reduction_pct"]["worst_rider"] >= 0.0
