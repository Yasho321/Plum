/**
 * OWNER    : Yasho2
 * DUE      : D3 12:00
 * TASK     :
 *   DELETE /riders/:id/data (DPDP erase) — fleet/admin only; POST /riders/:id/consent.
 * DONE WHEN: -
 * GUIDE    : docs/team/YASHO2.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : DONE
 */
import { Router } from 'express';
import { requireGroup } from '../middlewares/auth.middlewares.js';
import * as c from '../controllers/riders.controllers.js';

const router = Router();

router.delete('/riders/:id/data', requireGroup('fleet'), c.eraseRiderData);
router.post('/riders/:id/consent', requireGroup('fleet'), c.setConsent);

export default router;
