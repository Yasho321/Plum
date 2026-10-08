/**
 * OWNER    : Yasho2
 * DUE      : D1 14:00  ← unblocks Tanmay
 * TASK     :
 *   When MOCK_MODE=1, every controller returns data from contracts/mocks (approve/reject mutate an in-memory copy; /agent/chat replays mocks/chat_stream.jsonl as SSE with small delays).
 * DONE WHEN: Tanmay builds every view against the deployed mock API on D1.
 * GUIDE    : docs/team/YASHO2.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : DONE
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { canTransition } from '@plumetrace/contracts';

const here = dirname(fileURLToPath(import.meta.url));
const MOCKS = join(here, '..', '..', '..', 'contracts', 'mocks');

const readJson = (name) => JSON.parse(readFileSync(join(MOCKS, name), 'utf8'));
const nowIso = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

// Loaded once at boot. Treat as immutable except the actions copy below.
const summary = readJson('summary.json');
const forecastGeo = readJson('forecast_h3.geojson');
const stationBundle = readJson('station_forecast.json');
const attribution = readJson('attribution.json');
const trajectories = readJson('trajectories.geojson');
const skill = readJson('skill.json');
const fleetExposure = readJson('fleet_exposure.json');
const chatEvents = readFileSync(join(MOCKS, 'chat_stream.jsonl'), 'utf8')
  .split('\n')
  .map((l) => l.trim())
  .filter(Boolean)
  .map((l) => JSON.parse(l));

// Mutable in-memory actions (approve/reject change these for the session).
let actions = readJson('actions.json').actions.map((a) => ({ ...a }));

/* ------------------------------ reads -------------------------------- */
export const getSummary = () => summary;

export function getForecastGeoJSON({ valid_hour, bbox } = {}) {
  let features = forecastGeo.features;
  if (bbox) {
    const [w, s, e, n] = bbox.split(',').map(Number);
    features = features.filter((f) => {
      const ring = f.geometry.coordinates[0] || [];
      return ring.some(([lon, lat]) => lon >= w && lon <= e && lat >= s && lat <= n);
    });
  }
  return {
    type: 'FeatureCollection',
    run_id: forecastGeo.run_id,
    valid_hour: valid_hour || forecastGeo.valid_hour,
    features,
  };
}

export function getStationSeries(stationId) {
  // bundle is { station_id: StationSeries }; fall back to the first station.
  return stationBundle[stationId] || Object.values(stationBundle)[0];
}

export const getAttribution = (/* date */) => attribution;

export function getTrajectories(stationId) {
  if (!stationId) return trajectories;
  return {
    type: 'FeatureCollection',
    run_id: trajectories.run_id,
    features: trajectories.features.filter((f) => f.properties.station_id === stationId),
  };
}

export const getSkill = (/* days */) => skill;
export const getFleetExposure = (/* fleetId, date */) => fleetExposure;

export const getChatEvents = () => chatEvents;

/* ----------------------------- actions ------------------------------- */
export function listActions(status) {
  const items = status ? actions.filter((a) => a.status === status) : actions;
  return { count: items.length, actions: items };
}

export const getAction = (id) => actions.find((a) => a.action_id === id || a.pk === `action#${id}`);

/** draft -> approved (or rejected). Returns {item} or {error}. */
function transition(id, to, extra) {
  const item = getAction(id);
  if (!item) return { error: 'not_found' };
  if (!canTransition(item.status, to)) return { error: 'conflict', item };
  Object.assign(item, extra, { status: to, updated_at: nowIso() });
  return { item };
}

export const approveAction = (id, sub) => transition(id, 'approved', { approved_by: sub });
export const rejectAction = (id, sub) => transition(id, 'rejected', { approved_by: sub });

/* ----------------------------- riders -------------------------------- */
export function eraseRider(id) {
  // Nothing persistent in mock mode; report what a real erase would remove.
  return { rider_id: id, erased: true, erased_at: nowIso() };
}

export function setConsent(id, consent) {
  return { rider_id: id, consent_health: !!consent, consent_ts: nowIso() };
}

/** Reset mutable state (used by tests / demo_reset). */
export function resetActions() {
  actions = readJson('actions.json').actions.map((a) => ({ ...a }));
}
