/**
 * OWNER    : Yasho2
 * DUE      : D2 12:00
 * TASK     :
 *   Real implementations: summary.json from S3 (latest pointer outputs/latest.json), Forecast via GSI byRun filtered by valid_hour + bbox -> H3 polygons GeoJSON (h3-js cellToBoundary), StationForecast query, Attribution query, trajectories.geojson filtered by station, outputs/skill/latest.json. Cache S3 reads 60 s in-memory.
 * DONE WHEN: Responses validate against contracts (api/tests/contract.test.js).
 * GUIDE    : docs/team/YASHO2.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : WIP   (mock path done D1; real S3/DynamoDB path lands D2)
 */
import env from '../libs/env.js';
import * as mock from '../libs/mockStore.js';
import asyncHandler from '../middlewares/asyncHandler.js';
import { AppError } from '../middlewares/error.middlewares.js';

const notYet = () => {
  throw new AppError(501, 'not_implemented', 'Real data path lands D2 (CHECKPOINT 1). Run with MOCK_MODE=1.');
};

/* --------- service functions (reused by agent/tools/shared.tools.js) -------- */
export const svcSummary = async () => (env.MOCK_MODE ? mock.getSummary() : notYet());
export const svcForecast = async (opts) => (env.MOCK_MODE ? mock.getForecastGeoJSON(opts) : notYet());
export const svcStation = async (id) => (env.MOCK_MODE ? mock.getStationSeries(id) : notYet());
export const svcAttribution = async (date) => (env.MOCK_MODE ? mock.getAttribution(date) : notYet());
export const svcTrajectories = async (station) => (env.MOCK_MODE ? mock.getTrajectories(station) : notYet());
export const svcSkill = async (days) => (env.MOCK_MODE ? mock.getSkill(days) : notYet());

/* ------------------------------- handlers --------------------------------- */
export const getLatestRun = asyncHandler(async (_req, res) => {
  res.json(await svcSummary());
});

export const getForecast = asyncHandler(async (req, res) => {
  const { run_id, valid_hour, bbox } = req.validatedQuery || {};
  res.json(await svcForecast({ run_id, valid_hour, bbox }));
});

export const getStationForecast = asyncHandler(async (req, res) => {
  const series = await svcStation(req.params.id);
  if (!series) throw new AppError(404, 'not_found', `No forecast for station ${req.params.id}`);
  res.json(series);
});

export const getAttribution = asyncHandler(async (req, res) => {
  const { date } = req.validatedQuery || {};
  res.json(await svcAttribution(date));
});

export const getTrajectories = asyncHandler(async (req, res) => {
  res.json(await svcTrajectories(req.query.station));
});

export const getSkill = asyncHandler(async (req, res) => {
  const { days } = req.validatedQuery || { days: 7 };
  res.json(await svcSkill(days));
});
