/**
 * OWNER    : Yasho2
 * DUE      : D1 22:00
 * TASK     :
 *   Tool registry: {name, description, inputSchema (zod from contracts/agentTools), run(input, ctx)}; toToolConfig() converts to Bedrock toolSpec via z.toJSONSchema.
 * DONE WHEN: -
 * GUIDE    : docs/team/YASHO2.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : DONE
 */
import { z } from 'zod';
import { AGENT_TOOLS } from '@plumetrace/contracts';
import { sharedTools } from './shared.tools.js';
import { govTools } from './gov.tools.js';
import { fleetTools } from './fleet.tools.js';

const runners = { ...sharedTools, ...govTools, ...fleetTools };

/** Draft tools return an action_id -> the loop emits an `action_drafted` event. */
const DRAFT_TOOL_TYPES = {
  draftDistrictReport: 'district_report',
  draftFarmerAlert: 'farmer_alert',
  draftShiftPlan: 'shift_plan',
  draftRiderNotifications: 'rider_notify',
};

/** name -> { description, input, output, run, actionType? } */
export const registry = Object.fromEntries(
  Object.entries(AGENT_TOOLS).map(([name, spec]) => {
    if (!runners[name]) throw new Error(`Agent tool '${name}' has a contract but no run() implementation`);
    return [name, { ...spec, run: runners[name].run, actionType: DRAFT_TOOL_TYPES[name] }];
  }),
);

export const getTool = (name) => registry[name];

/** Bedrock ConverseStream toolConfig. inputSchema.json is JSON Schema from zod. */
export function toToolConfig() {
  return {
    tools: Object.entries(registry).map(([name, t]) => ({
      toolSpec: {
        name,
        description: t.description,
        inputSchema: { json: z.toJSONSchema(t.input, { target: 'draft-2020-12' }) },
      },
    })),
  };
}

/**
 * Anthropic Messages API tool definitions (Option A). Same registry, same zod
 * JSON Schema — just the `{ name, description, input_schema }` shape the
 * Anthropic SDK expects. `runTool` still validates every input with zod.
 */
export function toAnthropicTools() {
  return Object.entries(registry).map(([name, t]) => ({
    name,
    description: t.description,
    input_schema: z.toJSONSchema(t.input, { target: 'draft-2020-12' }),
  }));
}

/**
 * Validate input with the contract schema, run the tool, validate output.
 * Returns { output, actionType, actionId } so the loop can emit events.
 */
export async function runTool(name, rawInput, ctx = {}) {
  const tool = getTool(name);
  if (!tool) throw new Error(`Unknown tool: ${name}`);

  const parsedIn = tool.input.safeParse(rawInput ?? {});
  if (!parsedIn.success) {
    const err = new Error(`Invalid input for ${name}: ${z.prettifyError(parsedIn.error)}`);
    err.name = 'ToolInputError';
    throw err;
  }

  const output = await tool.run(parsedIn.data, ctx);

  // Validate output in dev; never let a bad tool result crash the stream in prod.
  const parsedOut = tool.output.safeParse(output);
  if (!parsedOut.success && ctx.strict) {
    const err = new Error(`Invalid output from ${name}: ${z.prettifyError(parsedOut.error)}`);
    err.name = 'ToolOutputError';
    throw err;
  }

  return {
    output: parsedOut.success ? parsedOut.data : output,
    actionType: tool.actionType,
    actionId: output?.action_id,
  };
}
