"""
OWNER    : Yasho2
DUE      : D2 20:00
TASK     :
  OR-Tools CP-SAT per §13.3: decision vars rider x slot (30-min slots) per order, start shift for flexible orders within window. Hard: non-flexible on time, shift ≤ 10 h, dose ≤ 100 % (soft w/ big penalty). Objective: max_rider_dose_pct*1000 + total_dose + 2*extra_minutes. Dose coefficients precomputed via fleet/dose + ConcLookup. 30 s limit, 8 workers.
DONE WHEN: AC7: 50 riders solved < 60 s end-to-end.
GUIDE    : docs/team/YASHO2.md  |  brief: docs/PROJECT_BRIEF.md
STATUS   : DONE
"""
from __future__ import annotations

from .common import (
    Assignment, Context, Order, Rider, ReplanMetrics,
    baseline_assignment, evaluate,
)

DOSE_SCALE = 10          # integer units of 0.1 µg
OVER_PENALTY = 1_000_000  # soft 100 % budget penalty (brief §13.3)


class CpInfeasible(RuntimeError):
    pass


def replan_cpsat(
    orders: list[Order],
    riders: list[Rider],
    ctx: Context,
    candidates_k: int = 8,
    time_limit_s: float = 30.0,
    workers: int = 8,
) -> tuple[Assignment, ReplanMetrics]:
    from ortools.sat.python import cp_model

    order_by = {o.order_id: o for o in orders}
    rider_by = {r.rider_id: r for r in riders}
    rider_ids = list(rider_by)

    model = cp_model.CpModel()

    # Candidate (rider, slot) options per order + precomputed dose/extra coeffs.
    x = {}                       # (oid, rid, s) -> BoolVar
    dose_terms = {rid: [] for rid in rider_ids}   # list of (coef_scaled, var)
    pct_terms = {rid: [] for rid in rider_ids}    # list of (pct_int, var)
    total_dose_terms = []
    extra_terms = []

    for o in orders:
        ranked = sorted(rider_ids, key=lambda rid: ctx.travel_min(rider_by[rid].home_h3, o.pickup_h3))
        cands = ranked[:candidates_k]
        if o.orig_rider not in cands:
            cands = cands[:-1] + [o.orig_rider] if cands else [o.orig_rider]
        slots = [o.orig_slot] if not o.flexible else [
            o.orig_slot + k for k in range(0, o.window_slots + 1) if 0 <= o.orig_slot + k < ctx.grid.n
        ]
        base_minutes = ctx.order_minutes(o, rider_by[o.orig_rider])

        order_vars = []
        for rid in cands:
            r = rider_by[rid]
            for s in slots:
                var = model.NewBoolVar(f"x_{o.order_id}_{rid}_{s}")
                x[(o.order_id, rid, s)] = var
                order_vars.append(var)

                dose = ctx.order_dose(o, r, s)
                coef = max(0, round(dose * DOSE_SCALE))
                dose_terms[rid].append((coef, var))
                total_dose_terms.append((coef, var))
                pct = round(dose * 100.0 / r.budget_ug) if r.budget_ug else 0
                pct_terms[rid].append((pct, var))

                # extra = added travel/work minutes only (slot shifts are free)
                extra = max(0, round(ctx.order_minutes(o, r) - base_minutes))
                extra_terms.append((extra, var))

        # each order assigned exactly once
        model.Add(sum(order_vars) == 1)

    # capacity: at most one order per rider per slot (approximation, §13.3)
    bucket = {}
    for (oid, rid, s), var in x.items():
        bucket.setdefault((rid, s), []).append(var)
    for vars_ in bucket.values():
        if len(vars_) > 1:
            model.Add(sum(vars_) <= 1)

    # per-rider dose, soft 100 % budget, and the max-pct objective term
    max_pct = model.NewIntVar(0, 100_000, "max_pct")
    over_terms = []
    for rid in rider_ids:
        r = rider_by[rid]
        if pct_terms[rid]:
            rider_pct = model.NewIntVar(0, 100_000, f"pct_{rid}")
            model.Add(rider_pct == sum(p * v for p, v in pct_terms[rid]))
            model.Add(max_pct >= rider_pct)

            dose_scaled = sum(c * v for c, v in dose_terms[rid])
            budget_scaled = max(0, round(r.budget_ug * DOSE_SCALE))
            over = model.NewIntVar(0, 10_000_000, f"over_{rid}")
            model.Add(over >= dose_scaled - budget_scaled)
            over_terms.append(over)

    total_dose = sum(c * v for c, v in total_dose_terms)
    total_extra = sum(e * v for e, v in extra_terms)

    model.Minimize(1000 * max_pct + total_dose + 2 * total_extra + OVER_PENALTY * sum(over_terms))

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = time_limit_s
    solver.parameters.num_search_workers = workers
    status = solver.Solve(model)

    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        raise CpInfeasible(f"CP-SAT returned status {solver.StatusName(status)}")

    assign: Assignment = {}
    for (oid, rid, s), var in x.items():
        if solver.Value(var) == 1:
            assign[oid] = (rid, s)

    metrics = evaluate(baseline_assignment(orders), assign, order_by, rider_by, ctx, solver="cpsat")
    return assign, metrics
