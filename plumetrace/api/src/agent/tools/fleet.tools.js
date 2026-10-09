/**
 * OWNER    : Yasho2
 * DUE      : D2 18:00
 * TASK     :
 *   getFleetExposure (service), draftShiftPlan -> FN_REPLANNER (Yasho2 Python), draftRiderNotifications -> FN_RIDER_NOTIFY (Khare).
 * DONE WHEN: -
 * GUIDE    : docs/team/YASHO2.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : DONE   (mock drafts now; real Lambda invoke enabled once FNs exist)
 */
import env from '../../libs/env.js';
import * as mock from '../../libs/mockStore.js';
import { invokeLambda } from '../../libs/aws.js';
import { svcFleetExposure } from '../../controllers/fleet.controllers.js';
import { AppError } from '../../middlewares/error.middlewares.js';

const requireFn = (name) => {
  if (!env[name]) throw new AppError(503, 'tool_unavailable', `${name} is not configured yet`);
  return env[name];
};

export const fleetTools = {
  getFleetExposure: {
    run: async (input) => svcFleetExposure(input.fleet_id, input.date),
  },

  draftShiftPlan: {
    run: async (input) => {
      if (env.MOCK_MODE) {
        const payload = {
          fleet_id: input.fleet_id,
          date: input.date,
          riders_changed: 8,
          dose_reduction_pct: { fleet_total: 18.5, worst_rider: 34.0 },
          extra_minutes: { average: 6.0, total: 48.0 },
          solver: 'cpsat',
        };
        const a = mock.addDraft('shift_plan', payload);
        return { action_id: a.action_id, ...payload };
      }
      return invokeLambda(requireFn('FN_REPLANNER'), input);
    },
  },

  draftRiderNotifications: {
    run: async (input) => {
      if (env.MOCK_MODE) {
        const a = mock.addDraft('rider_notify', { plan_action_id: input.plan_action_id });
        return {
          action_id: a.action_id,
          messages: [
            {
              rider_id: 'r001',
              text: 'Tomorrow, 2026-10-10: your 07:00-09:00 slot moved to 11:00-13:00. Expected exposure 92% of your safe budget (was 134%). Wear an N95 between 07:00-10:00.',
            },
          ],
        };
      }
      return invokeLambda(requireFn('FN_RIDER_NOTIFY'), input);
    },
  },
};
