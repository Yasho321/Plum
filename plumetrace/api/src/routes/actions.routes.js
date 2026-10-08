/**
 * OWNER    : Yasho2
 * DUE      : D1 15:00
 * TASK     :
 *   GET /actions?status=, POST /actions/:id/approve, POST /actions/:id/reject. Approve gated by group: district_report/farmer_alert -> gov; shift_plan/rider_notify -> fleet.
 * DONE WHEN: -
 * GUIDE    : docs/team/YASHO2.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : DONE
 */
import { Router } from 'express';
import { validate } from '../middlewares/validate.middlewares.js';
import { requireGroup } from '../middlewares/auth.middlewares.js';
import { ActionsQuery } from '@plumetrace/contracts';
import * as c from '../controllers/actions.controllers.js';

const router = Router();

router.get('/actions', validate(ActionsQuery, 'query'), c.listActions);
// Per-action-type group gating is enforced in the controller (needs the item's type);
// requireGroup here keeps out users with no gov/fleet/admin group at all.
router.post('/actions/:id/approve', requireGroup('gov', 'fleet'), c.approveAction);
router.post('/actions/:id/reject', requireGroup('gov', 'fleet'), c.rejectAction);

export default router;
