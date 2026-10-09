import assert from 'assert';
import test from 'node:test';
import { composeAlertEnglish } from '../src/farmerAlert/compose.js';
import { translateText } from '../src/farmerAlert/translate.js';

process.env.MOCK_MODE = '1';

test('composeAlertEnglish generates message under 300 chars', () => {
  const msg = composeAlertEnglish('Rohini CHC', 5.2);
  assert.ok(msg.length > 0);
  assert.ok(msg.length < 300, `Message length ${msg.length} exceeds 300`);
  assert.ok(msg.includes('Rohini CHC'));
  assert.ok(msg.includes('5.2'));
  assert.ok(msg.includes('1800-180-1551'));
});

test('translateText mocks translation in local mode', async () => {
  const source = 'Hello';
  const result = await translateText(source, 'pa');
  assert.strictEqual(result, '[Mock pa Translation] Hello');
  
  // Test cache
  const result2 = await translateText(source, 'pa');
  assert.strictEqual(result2, '[Mock pa Translation] Hello');
});
