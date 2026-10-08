/**
 * OWNER    : Yasho2
 * Agent tool registry + runTool (MOCK_MODE). Proves the Copilot tooling works
 * without Bedrock: toolConfig shape, mock-aware reads, and draft tools that
 * register an action and report the right action_type.
 */
process.env.MOCK_MODE = '1';
process.env.NODE_ENV = 'test';

import { describe, it, expect } from 'bun:test';
import { AGENT_TOOLS, RunSummary, DraftShiftPlanOutput } from '@plumetrace/contracts';

const { toToolConfig, runTool, registry } = await import('../src/agent/tools/index.js');
const mock = await import('../src/libs/mockStore.js');

describe('agent tool registry', () => {
  it('every contract tool has a runner', () => {
    expect(Object.keys(registry).sort()).toEqual(Object.keys(AGENT_TOOLS).sort());
  });

  it('toToolConfig() emits a valid Bedrock toolSpec per tool', () => {
    const cfg = toToolConfig();
    expect(cfg.tools.length).toBe(Object.keys(AGENT_TOOLS).length);
    for (const t of cfg.tools) {
      expect(typeof t.toolSpec.name).toBe('string');
      expect(t.toolSpec.description.length).toBeGreaterThan(10);
      expect(t.toolSpec.inputSchema.json.type).toBe('object');
    }
  });
});

describe('runTool (MOCK_MODE)', () => {
  it('getForecastSummary returns a contract-valid RunSummary', async () => {
    const { output } = await runTool('getForecastSummary', {});
    expect(RunSummary.safeParse(output).success).toBe(true);
  });

  it('draftShiftPlan registers a draft and reports action_type', async () => {
    const before = mock.listActions('draft').count;
    const { output, actionType, actionId } = await runTool('draftShiftPlan', {
      fleet_id: 'fleet_demo',
      date: '2026-10-10',
    });
    expect(DraftShiftPlanOutput.safeParse(output).success).toBe(true);
    expect(actionType).toBe('shift_plan');
    expect(actionId).toBe(output.action_id);
    expect(mock.listActions('draft').count).toBe(before + 1);
    expect(mock.getAction(actionId).type).toBe('shift_plan');
  });

  it('rejects invalid tool input', async () => {
    await expect(runTool('getAttribution', { date: 'not-a-date' })).rejects.toThrow('Invalid input');
  });
});
