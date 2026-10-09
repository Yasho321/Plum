/**
 * OWNER    : Yasho2
 * DUE      : D2 14:00
 * TASK     :
 *   Query Shifts for fleet+date, join Riders, return dose % of budget (never raw health data).
 * DONE WHEN: -
 * GUIDE    : docs/team/YASHO2.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : WIP   (mock path tested D1; real Shifts/Riders join verifies at CP1 D2)
 */
import env from '../libs/env.js';
import * as mock from '../libs/mockStore.js';
import { getDocClient, getDdbCommands } from '../libs/aws.js';
import asyncHandler from '../middlewares/asyncHandler.js';

const nowIso = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

/**
 * Per-rider forecast/actual dose as % of budget. NEVER reads RiderHealth or
 * returns conditions — only the budget % (brief §15, playbook §9).
 */
export const svcFleetExposure = async (fleetId, date) => {
  if (env.MOCK_MODE) return mock.getFleetExposure(fleetId, date);

  const doc = await getDocClient();
  const { QueryCommand, BatchGetCommand } = await getDdbCommands();

  const { Items: shifts = [] } = await doc.send(new QueryCommand({
    TableName: env.TABLE_SHIFTS,
    KeyConditionExpression: 'pk = :pk',
    ExpressionAttributeValues: { ':pk': `fleet#${fleetId}#date#${date}` },
  }));

  // Join Riders (budget, name, home) — NOT RiderHealth.
  const riderIds = [...new Set(shifts.map((s) => s.rider_id))];
  const ridersById = {};
  for (let i = 0; i < riderIds.length; i += 100) {
    const keys = riderIds.slice(i, i + 100).map((id) => ({ pk: `rider#${id}` }));
    if (!keys.length) break;
    const resp = await doc.send(new BatchGetCommand({ RequestItems: { [env.TABLE_RIDERS]: { Keys: keys } } }));
    for (const r of resp.Responses?.[env.TABLE_RIDERS] || []) ridersById[r.rider_id] = r;
  }

  const riders = shifts.map((s) => {
    const r = ridersById[s.rider_id] || {};
    const budget = r.dose_budget_ug || 0;
    const fPct = budget ? (s.forecast_dose_ug / budget) * 100 : 0;
    const aPct = s.actual_dose_ug != null && budget ? (s.actual_dose_ug / budget) * 100 : null;
    return {
      rider_id: s.rider_id,
      name: r.name ?? s.rider_id,
      home_h3: r.home_h3 ?? '8000000000000ff',
      shift_hours: r.shift_hours ?? 9,
      budget_ug: budget,
      forecast_dose_ug: s.forecast_dose_ug,
      forecast_dose_pct: Math.round(fPct * 10) / 10,
      actual_dose_ug: s.actual_dose_ug ?? null,
      actual_dose_pct: aPct == null ? null : Math.round(aPct * 10) / 10,
      over_budget: fPct > 100,
    };
  });

  const over = riders.filter((r) => r.over_budget).length;
  const worst = riders.reduce((m, r) => Math.max(m, r.forecast_dose_pct), 0);
  return {
    fleet_id: fleetId,
    date,
    generated_at: nowIso(),
    simulated: true,
    summary: { riders_total: riders.length, riders_over_budget: over, worst_rider_pct: worst },
    riders,
  };
};

export const getFleetExposure = asyncHandler(async (req, res) => {
  const { date } = req.validatedQuery || {};
  res.json(await svcFleetExposure(req.params.id, date));
});
