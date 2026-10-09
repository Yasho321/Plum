/**
 * OWNER    : Yasho2
 * DUE      : D2 20:00
 * TASK     :
 *   bun test: hit every route in MOCK_MODE and (if API_URL set) against dev; validate responses with contracts schemas.
 * DONE WHEN: Mandatory test 'every API response validates against contracts/' passes.
 * GUIDE    : docs/team/YASHO2.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : DONE
 */
process.env.MOCK_MODE = '1';
process.env.NODE_ENV = 'test';

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import {
  RunSummary, ForecastFeatureCollection, StationSeries, AttributionResponse,
  TrajectoryFeatureCollection, SkillResponse, FleetExposure, ActionList,
  ActionResponse, RiderEraseResponse, ChatStreamEvent,
} from '@plumetrace/contracts';

const app = (await import('../src/app.js')).default;

let server;
let base;
// If API_URL is set, test the deployed dev API instead of a local instance.
const external = process.env.API_URL;

beforeAll(async () => {
  if (external) {
    base = external.replace(/\/$/, '');
    return;
  }
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});

afterAll(() => server?.close());

const get = (path, headers) => fetch(`${base}${path}`, { headers });
const expectValid = (schema, data) => {
  const r = schema.safeParse(data);
  if (!r.success) throw new Error(JSON.stringify(r.error.issues, null, 2));
  expect(r.success).toBe(true);
};

describe('read routes validate against contracts/', () => {
  it('GET /health', async () => {
    const res = await get('/health');
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
  });

  it('GET /runs/latest -> RunSummary', async () => {
    const res = await get('/runs/latest');
    expect(res.status).toBe(200);
    expectValid(RunSummary, await res.json());
  });

  it('GET /forecast -> ForecastFeatureCollection (+ bbox)', async () => {
    expectValid(ForecastFeatureCollection, await (await get('/forecast')).json());
    const bboxed = await (await get('/forecast?bbox=76.9,28.4,77.5,28.9')).json();
    expectValid(ForecastFeatureCollection, bboxed);
  });

  it('GET /stations/:id/forecast -> StationSeries', async () => {
    expectValid(StationSeries, await (await get('/stations/1420/forecast')).json());
  });

  it('GET /attribution?date= -> AttributionResponse', async () => {
    expectValid(AttributionResponse, await (await get('/attribution?date=2026-10-09')).json());
  });

  it('GET /trajectories -> TrajectoryFeatureCollection (+ station filter)', async () => {
    expectValid(TrajectoryFeatureCollection, await (await get('/trajectories')).json());
    const filtered = await (await get('/trajectories?station=1420')).json();
    expectValid(TrajectoryFeatureCollection, filtered);
    expect(filtered.features.every((f) => f.properties.station_id === '1420')).toBe(true);
  });

  it('GET /skill?days= -> SkillResponse', async () => {
    expectValid(SkillResponse, await (await get('/skill?days=7')).json());
  });

  it('GET /fleet/:id/exposure -> FleetExposure (never exposes health)', async () => {
    const data = await (await get('/fleet/fleet_demo/exposure?date=2026-10-10')).json();
    expectValid(FleetExposure, data);
    expect(JSON.stringify(data)).not.toContain('asthma');
    expect(JSON.stringify(data)).not.toContain('conditions');
  });

  it('GET /actions?status=draft -> ActionList', async () => {
    expectValid(ActionList, await (await get('/actions?status=draft')).json());
  });
});

describe('approval flow + group gating', () => {
  it('fleet user is 403 approving a district_report', async () => {
    const list = await (await get('/actions?status=draft')).json();
    const report = list.actions.find((a) => a.type === 'district_report');
    const res = await fetch(`${base}/actions/${report.action_id}/approve`, {
      method: 'POST',
      headers: { 'x-mock-group': 'fleet' },
    });
    expect(res.status).toBe(403);
  });

  it('gov user approves a district_report -> ActionResponse(approved), double approve -> 409', async () => {
    const list = await (await get('/actions?status=draft')).json();
    const report = list.actions.find((a) => a.type === 'district_report');
    const res = await fetch(`${base}/actions/${report.action_id}/approve`, {
      method: 'POST',
      headers: { 'x-mock-group': 'gov' },
    });
    expect(res.status).toBe(200);
    const item = await res.json();
    expectValid(ActionResponse, item);
    expect(item.status).toBe('approved');
    expect(item.approved_by).toBeDefined();

    const again = await fetch(`${base}/actions/${report.action_id}/approve`, {
      method: 'POST',
      headers: { 'x-mock-group': 'gov' },
    });
    expect(again.status).toBe(409);
  });

  it('rejects a farmer_alert', async () => {
    const list = await (await get('/actions?status=draft')).json();
    const alert = list.actions.find((a) => a.type === 'farmer_alert');
    const res = await fetch(`${base}/actions/${alert.action_id}/reject`, {
      method: 'POST',
      headers: { 'x-mock-group': 'gov' },
    });
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe('rejected');
  });
});

describe('riders + agent SSE', () => {
  it('DELETE /riders/:id/data -> RiderEraseResponse', async () => {
    const res = await fetch(`${base}/riders/r001/data`, {
      method: 'DELETE',
      headers: { 'x-mock-group': 'fleet' },
    });
    expect(res.status).toBe(200);
    expectValid(RiderEraseResponse, await res.json());
  });

  it('POST /agent/chat streams valid ChatStreamEvents incl. drafts + done (AC5 shape)', async () => {
    // (mock replay streams with small delays; allow headroom)
    const res = await fetch(`${base}/agent/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Tomorrow morning looks severe. What should we do?' }),
    });
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    const text = await res.text();
    const events = text
      .split('\n\n')
      .map((b) => b.split('\n').find((l) => l.startsWith('data: ')))
      .filter(Boolean)
      .map((l) => JSON.parse(l.slice(6)));

    expect(events.length).toBeGreaterThan(5);
    for (const e of events) expectValid(ChatStreamEvent, e);

    const drafted = events.filter((e) => e.type === 'action_drafted');
    const types = new Set(drafted.map((e) => e.action_type));
    expect(types.has('district_report') || types.has('farmer_alert')).toBe(true); // >=1 gov draft
    expect(types.has('shift_plan') || types.has('rider_notify')).toBe(true); // >=1 fleet draft
    expect(events.some((e) => e.type === 'done')).toBe(true);
  }, 15000);
});
