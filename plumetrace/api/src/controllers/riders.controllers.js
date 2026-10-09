/**
 * OWNER    : Yasho2
 * DUE      : D3 12:00
 * TASK     :
 *   Erase rider: delete Riders, RiderHealth, Shifts rows for rider; return counts. Consent: store consent_health + consent_ts.
 * DONE WHEN: -
 * GUIDE    : docs/team/YASHO2.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : WIP   (mock path tested D1; real multi-table delete verifies D3)
 */
import env from '../libs/env.js';
import * as mock from '../libs/mockStore.js';
import { getDocClient, getDdbCommands } from '../libs/aws.js';
import asyncHandler from '../middlewares/asyncHandler.js';

const nowIso = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

/** DPDP "erase my data": remove the rider from Riders, RiderHealth and Shifts. */
export const eraseRiderData = asyncHandler(async (req, res) => {
  const id = req.params.id;
  if (env.MOCK_MODE) return res.json(mock.eraseRider(id));

  const doc = await getDocClient();
  const { DeleteCommand, ScanCommand } = await getDdbCommands();
  const counts = { riders: 0, rider_health: 0, shifts: 0 };

  await doc.send(new DeleteCommand({ TableName: env.TABLE_RIDERS, Key: { pk: `rider#${id}` } }));
  counts.riders = 1;
  await doc.send(new DeleteCommand({ TableName: env.TABLE_RIDER_HEALTH, Key: { pk: `rider#${id}` } }));
  counts.rider_health = 1;

  // Shifts are keyed by fleet/date (pk) + rider (sk); find this rider's rows.
  const { Items = [] } = await doc.send(new ScanCommand({
    TableName: env.TABLE_SHIFTS,
    FilterExpression: 'sk = :sk',
    ExpressionAttributeValues: { ':sk': `rider#${id}` },
  }));
  for (const it of Items) {
    await doc.send(new DeleteCommand({ TableName: env.TABLE_SHIFTS, Key: { pk: it.pk, sk: it.sk } }));
    counts.shifts += 1;
  }

  res.json({ rider_id: id, erased: true, erased_at: nowIso(), deleted: counts });
});

/** Record consent (purpose/retention handled on the UI consent screen, §15). */
export const setConsent = asyncHandler(async (req, res) => {
  const id = req.params.id;
  const consent = req.body?.consent_health ?? true;
  if (env.MOCK_MODE) return res.json(mock.setConsent(id, consent));

  const doc = await getDocClient();
  const { UpdateCommand } = await getDdbCommands();
  const ts = nowIso();
  await doc.send(new UpdateCommand({
    TableName: env.TABLE_RIDERS,
    Key: { pk: `rider#${id}` },
    UpdateExpression: 'SET consent_health = :c, consent_ts = :t',
    ExpressionAttributeValues: { ':c': !!consent, ':t': ts },
  }));
  res.json({ rider_id: id, consent_health: !!consent, consent_ts: ts });
});
