/**
 * OWNER    : Yasho2
 * DUE      : D1 15:00
 * TASK     :
 *   GET /fleet/:id/exposure (group fleet).
 * DONE WHEN: -
 * GUIDE    : docs/team/YASHO2.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : DONE
 */
import { Router } from 'express';
import { validate } from '../middlewares/validate.middlewares.js';
import { requireGroup } from '../middlewares/auth.middlewares.js';
import { FleetExposureQuery } from '@plumetrace/contracts';
import * as c from '../controllers/fleet.controllers.js';

const router = Router();

router.get('/fleet/:id/exposure', requireGroup('fleet'), validate(FleetExposureQuery, 'query'), c.getFleetExposure);

export default router;
