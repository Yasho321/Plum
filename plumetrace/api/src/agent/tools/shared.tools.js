/**
 * OWNER    : Yasho2
 * DUE      : D1 22:00
 * TASK     :
 *   getForecastSummary, getStationForecast, getAttribution, getForecastSkill -> reuse forecast controllers' service functions (mock-aware).
 * DONE WHEN: -
 * GUIDE    : docs/team/YASHO2.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : DONE
 */
import {
  svcSummary, svcStation, svcAttribution, svcSkill,
} from '../../controllers/forecast.controllers.js';

/** Read-only tools. Each run(input, ctx) returns data that is mock-aware
 *  (the service functions already branch on MOCK_MODE). */
export const sharedTools = {
  getForecastSummary: { run: async (/* input */) => svcSummary() },
  getStationForecast: { run: async (input) => svcStation(input.station_id) },
  getAttribution: { run: async (input) => svcAttribution(input.date) },
  getForecastSkill: { run: async (input) => svcSkill(input.days ?? 7) },
};
