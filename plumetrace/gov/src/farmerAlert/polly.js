/**
 * OWNER    : Khare
 * DUE      : D2 15:00
 * TASK     :
 *   Amazon Polly MP3. VERIFY on D1 whether Polly has a Punjabi voice (DescribeVoices LanguageCode). If not: audio in Hindi (hi-IN, Kajal neural / Aditi standard) + Punjabi text. Target 20–30 s.
 * DONE WHEN: -
 * GUIDE    : docs/team/KHARE.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : DONE
 */

import { PollyClient, SynthesizeSpeechCommand } from '@aws-sdk/client-polly';

const isMock = process.env.MOCK_MODE === '1' || process.env.PT_LOCAL === '1';
const pollyClient = new PollyClient({ region: process.env.AWS_REGION || 'us-east-1' });

export async function synthesizeAudio(text) {
  if (isMock) {
    // Return a dummy buffer
    return Buffer.from('mock_audio_data');
  }
  
  try {
    const cmd = new SynthesizeSpeechCommand({
      OutputFormat: 'mp3',
      Text: text,
      VoiceId: 'Aditi', // standard Hindi voice, as per D-15
      LanguageCode: 'hi-IN'
    });
    const response = await pollyClient.send(cmd);
    const chunks = [];
    for await (const chunk of response.AudioStream) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  } catch (err) {
    console.error('Polly synthesis failed:', err);
    throw err;
  }
}
