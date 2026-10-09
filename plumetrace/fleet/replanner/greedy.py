"""
OWNER    : Yasho2
DUE      : D2 16:00
TASK     :
  Fallback heuristic (build FIRST, it guarantees a demo): move flexible orders out of 06–10 IST peak, rotate most-exposed riders to cleaner-zone stores; iterate until no rider > 100 % or no improvement.
DONE WHEN: Always returns a plan in < 5 s.
GUIDE    : docs/team/YASHO2.md  |  brief: docs/PROJECT_BRIEF.md
STATUS   : DONE
"""
from __future__ import annotations

from .common import (
    Assignment, Context, Order, Rider, ReplanMetrics,
    baseline_assignment, evaluate, rider_doses,
)


def replan_greedy(
    orders: list[Order],
    riders: list[Rider],
    ctx: Context,
    candidates_k: int = 8,
    max_iter: int = 5000,
) -> tuple[Assignment, ReplanMetrics]:
    order_by = {o.order_id: o for o in orders}
    rider_by = {r.rider_id: r for r in riders}
    rider_ids = list(rider_by)

    # candidate riders per order: the k nearest home bases to the pickup.
    cand = {}
    for o in orders:
        ranked = sorted(rider_ids, key=lambda rid: ctx.travel_min(rider_by[rid].home_h3, o.pickup_h3))
        cand[o.order_id] = ranked[:candidates_k]

    assign: Assignment = dict(baseline_assignment(orders))
    doses = rider_doses(assign, order_by, rider_by, ctx)

    def pct(rid: str) -> float:
        b = rider_by[rid].budget_ug
        return doses[rid] / b * 100.0 if b else 0.0

    def worst() -> tuple[str, float]:
        rid = max(doses, key=pct)
        return rid, pct(rid)

    for _ in range(max_iter):
        wrid, wpct = worst()
        if wpct <= 100.0:
            break

        orders_on = [oid for oid, (r, _s) in assign.items() if r == wrid]
        best = None  # (new_worst, oid, nr, ns, old_dose, new_dose)
        best_worst = wpct

        for oid in orders_on:
            o = order_by[oid]
            r, s = assign[oid]
            old_dose = ctx.order_dose(o, rider_by[r], s)

            slot_opts = [s]
            if o.flexible:
                slot_opts += [s + k for k in range(1, o.window_slots + 1) if s + k < ctx.grid.n]
            rider_opts = [r] + [c for c in cand[oid] if c != r]

            for nr in rider_opts:
                for ns in slot_opts:
                    if (nr, ns) == (r, s):
                        continue
                    new_dose = ctx.order_dose(o, rider_by[nr], ns)
                    # incremental: r loses old_dose, nr gains new_dose
                    dr = (doses[r] - old_dose) / rider_by[r].budget_ug * 100.0 if rider_by[r].budget_ug else 0.0
                    dnr = (doses[nr] + new_dose) / rider_by[nr].budget_ug * 100.0 if rider_by[nr].budget_ug else 0.0
                    # new worst = max of the changed riders and all others unchanged
                    others = max((pct(x) for x in doses if x not in (r, nr)), default=0.0)
                    new_worst = max(dr, dnr, others)
                    if new_worst < best_worst - 1e-6:
                        best_worst = new_worst
                        best = (new_worst, oid, nr, ns, old_dose, new_dose)

        if best is None:
            break  # no improving move
        _, oid, nr, ns, old_dose, new_dose = best
        r, _s = assign[oid]
        doses[r] -= old_dose
        doses[nr] += new_dose
        assign[oid] = (nr, ns)

    metrics = evaluate(baseline_assignment(orders), assign, order_by, rider_by, ctx, solver="greedy")
    return assign, metrics
