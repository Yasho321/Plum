/**
 * OWNER    : Yasho2
 * DUE      : D2 14:00
 * TASK     :
 *   draftDistrictReport -> Lambda invoke FN_REPORT (Khare), draftFarmerAlert -> FN_FARMER_ALERT (Khare), checkFireTrend -> FN_FIRE_TREND (Khare). Payloads = contracts/agentTools. In MOCK_MODE return mock drafts.
 * DONE WHEN: -
 * GUIDE    : docs/team/YASHO2.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : DONE   (mock drafts now; real Lambda invoke enabled once Khare's FNs exist)
 */
import env from '../../libs/env.js';
import * as mock from '../../libs/mockStore.js';
import { invokeLambda } from '../../libs/aws.js';
import { AppError } from '../../middlewares/error.middlewares.js';

const requireFn = (name) => {
  if (!env[name]) throw new AppError(503, 'tool_unavailable', `${name} is not configured yet`);
  return env[name];
};

export const govTools = {
  draftDistrictReport: {
    run: async (input) => {
      if (env.MOCK_MODE) {
        const a = mock.addDraft('district_report', { district: input.district, date: input.date });
        return { action_id: a.action_id, preview_url: `https://example.invalid/reports/${a.action_id}.html` };
      }
      return invokeLambda(requireFn('FN_REPORT'), input);
    },
  },

  draftFarmerAlert: {
    run: async (input) => {
      if (env.MOCK_MODE) {
        const a = mock.addDraft('farmer_alert', {
          districts: input.districts, language: input.language, max_villages: input.max_villages,
        });
        return {
          action_id: a.action_id,
          text: 'ਆਉਣ ਵਾਲੇ 2 ਦਿਨ ਧੂੰਆਂ ਵਧੇਗਾ। ਨੇੜਲਾ CRM ਮਸ਼ੀਨ ਕੇਂਦਰ 6 ਕਿ.ਮੀ.। ਸਬਸਿਡੀ ਹੈਲਪਲਾਈਨ 1800-180-1551।',
          audio_url: `https://example.invalid/audio/${a.action_id}.mp3`,
        };
      }
      return invokeLambda(requireFn('FN_FARMER_ALERT'), input);
    },
  },

  checkFireTrend: {
    run: async (input) => {
      if (env.MOCK_MODE) {
        const days = input.days ?? 7;
        const daily = Array.from({ length: days }, (_, i) => ({
          date: `2026-10-${String(2 + i).padStart(2, '0')}`,
          fire_count: 40 + i * 12,
          frp_sum_mw: 500 + i * 150,
        }));
        return { district: input.district, days, daily, trend_pct: 0.34 };
      }
      return invokeLambda(requireFn('FN_FIRE_TREND'), input);
    },
  },
};
