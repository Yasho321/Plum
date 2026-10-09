/**
 * OWNER    : Khare
 * DUE      : D2 14:00
 * TASK     :
 *   Amazon Translate en -> pa / hi. Cache by hash. Native speaker (team) must review the final pa text before demo.
 * DONE WHEN: -
 * GUIDE    : docs/team/KHARE.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : DONE
 */

import { TranslateClient, TranslateTextCommand } from '@aws-sdk/client-translate';
import crypto from 'crypto';

const isMock = process.env.MOCK_MODE === '1' || process.env.PT_LOCAL === '1';
const translateClient = new TranslateClient({ region: process.env.AWS_REGION || 'us-east-1' });

// In-memory cache for simplicity. Real implementation could use DynamoDB.
const cache = new Map();

export async function translateText(text, targetLang = 'pa') {
  const isMock = process.env.MOCK_MODE === '1' || process.env.PT_LOCAL === '1';
  const hash = crypto.createHash('md5').update(text + targetLang).digest('hex');
  if (cache.has(hash)) {
    return cache.get(hash);
  }
  
  if (isMock) {
    // Return a mocked translation to avoid calling AWS if credentials aren't set
    const mockRes = `[Mock ${targetLang} Translation] ${text}`;
    cache.set(hash, mockRes);
    return mockRes;
  }
  
  try {
    const cmd = new TranslateTextCommand({
      SourceLanguageCode: 'en',
      TargetLanguageCode: targetLang,
      Text: text
    });
    const response = await translateClient.send(cmd);
    const translatedText = response.TranslatedText;
    cache.set(hash, translatedText);
    return translatedText;
  } catch (err) {
    console.error('Translation failed:', err);
    throw err;
  }
}
