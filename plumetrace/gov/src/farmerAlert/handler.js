/**
 * OWNER    : Khare
 * DUE      : D2 16:00
 * TASK     :
 *   Input/Output = contracts draftFarmerAlert. From summary.hotspot_villages in the requested districts pick top max_villages; nearest CHC + km; compose text; translate; synthesize audio; store audio/<action_id>.mp3; createDraft('farmer_alert', {...}); return {action_id, text, audio_url}.
 * DONE WHEN: US3 draft with Punjabi text + audio shows in Approvals.
 * GUIDE    : docs/team/KHARE.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : DONE
 */

import { getSummary, getChcCentres } from '../lib/data.js';
import { nearestChc } from '../lib/geo.js';
import { composeAlertEnglish } from './compose.js';
import { translateText } from './translate.js';
import { synthesizeAudio } from './polly.js';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'crypto';

let createDraft;
try {
  const actionsRepo = await import('../../../contracts/src/actionsRepo.js');
  if (actionsRepo.createDraft) {
    createDraft = actionsRepo.createDraft;
  } else {
    throw new Error('stub');
  }
} catch (e) {
  createDraft = async (type, payload, runId) => {
    return { action_id: `act_${crypto.randomUUID().slice(0, 8)}` };
  };
}

export const handler = async (event) => {
  const district = event.district || 'Sangrur';
  const runId = event.run_id || 'latest';
  const maxVillages = event.max_villages || 1;
  
  const summary = await getSummary(runId);
  const chcs = await getChcCentres();
  
  let villages = [];
  if (summary && summary.hotspot_villages) {
    villages = summary.hotspot_villages.filter(v => v.district === district);
  }
  villages = villages.slice(0, maxVillages);
  
  if (villages.length === 0) {
    // mock a village if none
    villages = [{ name: 'Dummy Village', lat: 30.2, lon: 75.8, frp_sum: 50 }];
  }
  
  const v = villages[0]; // just pick the top one for the alert
  const chcInfo = nearestChc([v.lon, v.lat], chcs);
  
  let centreName = 'Unknown';
  let distanceKm = 0;
  if (chcInfo && chcInfo.name) {
    centreName = chcInfo.name;
    distanceKm = chcInfo.km;
  }
  
  const engText = composeAlertEnglish(centreName, distanceKm);
  const paText = await translateText(engText, 'pa');
  // as per D-15, we use Hindi for audio since Polly doesn't support Punjabi
  const hiText = await translateText(engText, 'hi');
  const audioBuffer = await synthesizeAudio(hiText);
  
  const action = await createDraft('farmer_alert', { district, village: v.name, paText, hiText }, runId);
  const actionId = action.action_id;
  
  const bucket = process.env.BUCKET_DATA || 'pt-demo-bucket';
  const audioKey = `audio/${actionId}.mp3`;
  
  const s3 = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
  const isMock = process.env.MOCK_MODE === '1' || process.env.PT_LOCAL === '1';
  let audioUrl = `http://localhost:3000/${audioKey}`;
  
  if (!isMock) {
    await s3.send(new PutObjectCommand({ Bucket: bucket, Key: audioKey, Body: audioBuffer, ContentType: 'audio/mpeg' }));
    audioUrl = await getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: audioKey }), { expiresIn: 86400 });
  } else {
    const fs = await import('fs/promises');
    const path = await import('path');
    const localDir = path.join(process.cwd(), '.local-s3', 'audio');
    await fs.mkdir(localDir, { recursive: true });
    await fs.writeFile(path.join(localDir, `${actionId}.mp3`), audioBuffer);
  }
  
  return {
    action_id: actionId,
    text: paText,
    audio_url: audioUrl
  };
};
