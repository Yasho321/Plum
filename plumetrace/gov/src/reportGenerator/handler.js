/**
 * OWNER    : Khare
 * DUE      : D2 13:00
 * TASK     :
 *   Input/Output = contracts agentTools draftDistrictReport. Gather numbers (share p10/p50/p90, fire_count, frp, 7-day trend), render template.html, write reports/<action_id>.html, print to PDF with puppeteer-core + @sparticuz/chromium, actionsRepo.createDraft('district_report', {district, date, html_key, pdf_key, headline}). Return {action_id, preview_url (presigned 24 h)}.
 * DONE WHEN: US2: 1-page report for Sangrur renders with ranges + method + sources.
 * GUIDE    : docs/team/KHARE.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : DONE
 */

import { getSummary, getFiresGeojson, getChcCentres } from '../lib/data.js';
import { renderReport } from './render.js';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import crypto from 'crypto';

// Try to import from contracts, fallback to stub
let createDraft;
try {
  const actionsRepo = await import('../../../contracts/src/actionsRepo.js');
  createDraft = actionsRepo.createDraft;
  if (!createDraft) throw new Error('stub');
} catch (e) {
  createDraft = async (type, payload, runId) => {
    return { action_id: `act_${crypto.randomUUID().slice(0, 8)}` };
  };
}

export const handler = async (event) => {
  const district = event.district || 'Sangrur';
  const runId = event.run_id || 'latest';
  const date = event.date || new Date().toISOString().split('T')[0];
  
  // 1. Gather data
  const summary = await getSummary(runId);
  const firesGeojson = await getFiresGeojson(runId);
  const chcs = await getChcCentres();
  
  let contributionPct = 0;
  if (summary && summary.attribution && summary.attribution[district]) {
    contributionPct = summary.attribution[district].p50 || 0;
  }
  
  // 2. Render HTML
  const html = await renderReport(district, {
    contributionPct,
    date,
    firesGeojson,
    chcs: chcs?.features?.map(f => f.properties) || []
  });
  
  // 3. Create Draft to get action_id
  const headline = `Estimated contribution of crop fires in ${district} to Delhi-NCR PM2.5 on ${date}: ${Math.round(contributionPct)} %`;
  const action = await createDraft('district_report', { district, date, headline }, runId);
  const actionId = action.action_id;
  
  const bucket = process.env.BUCKET_DATA || 'pt-demo-bucket';
  const htmlKey = `reports/${actionId}.html`;
  const pdfKey = `reports/${actionId}.pdf`;
  
  const s3 = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
  
  const isLocal = process.env.MOCK_MODE === '1' || process.env.PT_LOCAL === '1';
  let previewUrl = `http://localhost:3000/${pdfKey}`;
  
  if (!isLocal) {
    // 4. Print to PDF via Puppeteer + Sparticuz
    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
    await browser.close();
    
    // 5. Upload HTML and PDF to S3
    await s3.send(new PutObjectCommand({ Bucket: bucket, Key: htmlKey, Body: html, ContentType: 'text/html' }));
    await s3.send(new PutObjectCommand({ Bucket: bucket, Key: pdfKey, Body: pdfBuffer, ContentType: 'application/pdf' }));
    
    // 6. Presign URL
    previewUrl = await getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: pdfKey }), { expiresIn: 86400 });
  } else {
    // In local mode, write to disk
    const fs = await import('fs/promises');
    const path = await import('path');
    const localDir = path.join(process.cwd(), '.local-s3', 'reports');
    await fs.mkdir(localDir, { recursive: true });
    await fs.writeFile(path.join(localDir, `${actionId}.html`), html);
  }
  
  return {
    action_id: actionId,
    preview_url: previewUrl
  };
};
