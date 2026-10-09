/**
 * OWNER    : Yasho2
 * Unit test for contracts/src/actionsRepo.js (DONE WHEN: double-approve -> 409).
 * Uses a tiny fake DynamoDB document client that honours the ConditionExpression
 * on `status`, so we prove the conditional-write semantics without AWS.
 */
import { describe, it, expect } from 'bun:test';
import { makeActionsRepo, newActionItem, assertTransition } from '@plumetrace/contracts/actionsRepo';

class ConditionalCheckFailedException extends Error {
  constructor() {
    super('The conditional request failed');
    this.name = 'ConditionalCheckFailedException';
  }
}

// Minimal command wrappers (constructable with `new`) + fake doc client.
class Put { constructor(input) { return { _t: 'put', input }; } }
class Get { constructor(input) { return { _t: 'get', input }; } }
class Update { constructor(input) { return { _t: 'update', input }; } }

function fakeDoc() {
  const store = new Map();
  return {
    store,
    async send(cmd) {
      const { input } = cmd;
      if (cmd._t === 'put') {
        if (input.ConditionExpression?.includes('attribute_not_exists') && store.has(input.Item.pk)) {
          throw new ConditionalCheckFailedException();
        }
        store.set(input.Item.pk, { ...input.Item });
        return {};
      }
      if (cmd._t === 'get') return { Item: store.get(input.Key.pk) || undefined };
      if (cmd._t === 'update') {
        const item = store.get(input.Key.pk);
        // ConditionExpression '#s = :from'
        if (item?.status !== input.ExpressionAttributeValues[':from']) {
          throw new ConditionalCheckFailedException();
        }
        for (const [name, attr] of Object.entries(input.ExpressionAttributeNames)) {
          const valKey = Object.keys(input.ExpressionAttributeValues).find((k) => k === `:${name.slice(1)}`);
          if (valKey) item[attr] = input.ExpressionAttributeValues[valKey];
        }
        item.status = input.ExpressionAttributeValues[':to'];
        store.set(input.Key.pk, item);
        return { Attributes: { ...item } };
      }
      throw new Error('unknown command');
    },
  };
}

const makeRepo = (doc) =>
  makeActionsRepo({ doc, table: 'pt-test-Actions', PutCommand: Put, GetCommand: Get, UpdateCommand: Update });

describe('actionsRepo', () => {
  it('createDraft builds a valid draft ActionItem', async () => {
    const repo = makeRepo(fakeDoc());
    const item = await repo.createDraft('district_report', { district: 'Sangrur' }, '2026-10-09T00Z');
    expect(item.status).toBe('draft');
    expect(item.created_by).toBe('agent');
    expect(item.pk).toBe(`action#${item.action_id}`);
  });

  it('approve moves draft -> approved and records approved_by', async () => {
    const repo = makeRepo(fakeDoc());
    const draft = await repo.createDraft('farmer_alert', {}, null);
    const approved = await repo.transition(draft.action_id, 'draft', 'approved', { approved_by: 'cognito-sub-1' });
    expect(approved.status).toBe('approved');
    expect(approved.approved_by).toBe('cognito-sub-1');
  });

  it('double approve throws ConditionalCheckFailed (API -> 409)', async () => {
    const repo = makeRepo(fakeDoc());
    const draft = await repo.createDraft('shift_plan', {}, null);
    await repo.transition(draft.action_id, 'draft', 'approved', { approved_by: 's' });
    let caught;
    try {
      await repo.transition(draft.action_id, 'draft', 'approved', { approved_by: 's' });
    } catch (err) {
      caught = err;
    }
    // The API error middleware maps this exact error name to HTTP 409.
    expect(caught?.name).toBe('ConditionalCheckFailedException');
  });

  it('assertTransition rejects an illegal jump (draft -> executed)', () => {
    expect(() => assertTransition('draft', 'executed')).toThrow('Illegal action transition');
    expect(() => newActionItem('bogus_type', {})).toThrow(); // schema rejects bad type
  });
});
