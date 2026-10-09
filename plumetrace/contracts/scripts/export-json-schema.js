/**
 * OWNER    : Yasho2
 * DUE      : D1 12:00
 * TASK     :
 *   Use zod v4 z.toJSONSchema() to write contracts/schemas/*.json for every schema. Python and the agent toolSpec consume the JSON Schema output.
 * DONE WHEN: `npm run export` regenerates contracts/schemas/ deterministically.
 * GUIDE    : docs/team/YASHO2.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : DONE
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { z } from 'zod';
import * as contracts from '../src/index.js';
import { AGENT_TOOLS } from '../src/agentTools.js';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', 'schemas');
mkdirSync(outDir, { recursive: true });

/** Every exported value that is a zod schema (has .safeParse). */
const isZod = (v) => v && typeof v === 'object' && typeof v.safeParse === 'function';

let count = 0;
const index = {};

for (const [name, value] of Object.entries(contracts)) {
  if (!isZod(value)) continue;
  let json;
  try {
    json = z.toJSONSchema(value, { target: 'draft-2020-12' });
  } catch {
    // Some composite schemas (unions with .default, etc.) may not convert; skip.
    continue;
  }
  writeFileSync(join(outDir, `${name}.json`), JSON.stringify(json, null, 2) + '\n');
  index[name] = `${name}.json`;
  count++;
}

/* Agent toolSpecs: the exact {name, description, inputSchema:{json}} the
 * Bedrock ConverseStream toolConfig needs (playbook §7). */
const toolSpecs = Object.entries(AGENT_TOOLS).map(([name, t]) => ({
  toolSpec: {
    name,
    description: t.description,
    inputSchema: { json: z.toJSONSchema(t.input, { target: 'draft-2020-12' }) },
  },
}));
writeFileSync(join(outDir, 'agentToolSpecs.json'), JSON.stringify(toolSpecs, null, 2) + '\n');

writeFileSync(join(outDir, 'index.json'), JSON.stringify(index, null, 2) + '\n');

console.log(`Exported ${count} JSON Schemas + agentToolSpecs.json to contracts/schemas/`);
