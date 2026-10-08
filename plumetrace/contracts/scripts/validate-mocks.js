/**
 * OWNER    : Yasho2
 * DUE      : D1 12:00
 * TASK     :
 *   Validate every file in contracts/mocks/ against its schema (mapping table at top of file). Exit 1 on failure. Run in CI.
 * DONE WHEN: CI job `contracts` is green.
 * GUIDE    : docs/team/YASHO2.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : DONE
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { z } from 'zod';
import {
  RunSummary, ForecastFeatureCollection, StationSeries, AttributionResponse,
  TrajectoryFeatureCollection, FireFeatureCollection, SkillResponse,
  FleetExposure, ActionList, ChatStreamEvent,
} from '../src/index.js';
import { ForecastPublishedEvent } from '../src/events.js';

const here = dirname(fileURLToPath(import.meta.url));
const mocks = join(here, '..', 'mocks');

/** station_forecast.json holds a map of 3 stations; validate each value. */
const StationSeriesBundle = z.record(z.string(), StationSeries);

/**
 * mapping: mock file -> { schema, jsonl? }
 * jsonl files are validated line-by-line against `schema`.
 */
const MAP = {
  'summary.json': { schema: RunSummary },
  'forecast_published.event.json': { schema: ForecastPublishedEvent },
  'attribution.json': { schema: AttributionResponse },
  'station_forecast.json': { schema: StationSeriesBundle },
  'skill.json': { schema: SkillResponse },
  'fleet_exposure.json': { schema: FleetExposure },
  'actions.json': { schema: ActionList },
  'forecast_h3.geojson': { schema: ForecastFeatureCollection },
  'trajectories.geojson': { schema: TrajectoryFeatureCollection },
  'fires_48h.geojson': { schema: FireFeatureCollection },
  'chat_stream.jsonl': { schema: ChatStreamEvent, jsonl: true },
};

let failures = 0;
let checked = 0;

for (const [file, { schema, jsonl }] of Object.entries(MAP)) {
  const path = join(mocks, file);
  let raw;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (err) {
    console.error(`✗ ${file}: cannot read (${err.message})`);
    failures++;
    continue;
  }

  if (jsonl) {
    const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
    let bad = 0;
    lines.forEach((line, i) => {
      const parsed = schema.safeParse(JSON.parse(line));
      if (!parsed.success) {
        bad++;
        console.error(`✗ ${file}:${i + 1}\n${z.prettifyError(parsed.error)}`);
      }
    });
    checked++;
    if (bad === 0) console.log(`✓ ${file} (${lines.length} events)`);
    else failures++;
    continue;
  }

  const data = JSON.parse(raw);
  const parsed = schema.safeParse(data);
  checked++;
  if (parsed.success) {
    console.log(`✓ ${file}`);
  } else {
    failures++;
    console.error(`✗ ${file}\n${z.prettifyError(parsed.error)}`);
  }
}

console.log(`\n${checked - failures}/${checked} mocks valid.`);
if (failures > 0) {
  console.error(`FAILED: ${failures} mock(s) did not validate.`);
  process.exit(1);
}
console.log('All mocks valid. Contracts are consistent.');
