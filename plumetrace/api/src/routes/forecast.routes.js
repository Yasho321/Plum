/**
 * OWNER    : Yasho2
 * DUE      : D1 15:00
 * TASK     :
 *   GET /runs/latest, /forecast, /stations/:id/forecast, /attribution, /trajectories, /skill -> forecast.controllers.js. Any authenticated group.
 * DONE WHEN: -
 * GUIDE    : docs/team/YASHO2.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : DONE
 */
import { Router } from 'express';
import { validate } from '../middlewares/validate.middlewares.js';
import { ForecastQuery, SkillQuery, AttributionQuery } from '@plumetrace/contracts';
import * as c from '../controllers/forecast.controllers.js';

const router = Router();

router.get('/runs/latest', c.getLatestRun);
router.get('/forecast', validate(ForecastQuery, 'query'), c.getForecast);
router.get('/stations/:id/forecast', c.getStationForecast);
router.get('/attribution', validate(AttributionQuery, 'query'), c.getAttribution);
router.get('/trajectories', c.getTrajectories);
router.get('/fires', c.getFires);
router.get('/skill', validate(SkillQuery, 'query'), c.getSkill);

export default router;
