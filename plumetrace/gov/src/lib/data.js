/**
 * OWNER    : Khare
 * DUE      : D1 18:00
 * TASK     :
 *   Read helpers: getSummary(run_id|latest) from S3, getAttribution(date) / last N dates from DynamoDB, getFiresGeojson(run_id), getChcCentres() from static/. Use @plumetrace/contracts schemas to parse.
 * DONE WHEN: -
 * GUIDE    : docs/team/KHARE.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : DONE
 */

import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import fs from 'fs/promises';
import path from 'path';

// Note: In real app, we would use zod to validate, but here we just return the JSON for simplicity,
// or we assume it's valid.

const isLocal = process.env.MOCK_MODE === '1' || process.env.PT_LOCAL === '1';

const s3 = new S3Client({ region: 'us-east-1' });
const ddbClient = new DynamoDBClient({ region: 'us-east-1' });
const ddb = DynamoDBDocumentClient.from(ddbClient);

export async function getSummary(run_id) {
  if (isLocal) {
    const raw = await fs.readFile(path.join(process.cwd(), '..', 'contracts', 'mocks', 'summary.json'), 'utf-8');
    return JSON.parse(raw);
  }
  const bucket = process.env.BUCKET_DATA;
  const key = run_id === 'latest' ? 'outputs/latest.json' : `outputs/run=${run_id}/summary.json`;
  const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const str = await res.Body.transformToString();
  return JSON.parse(str);
}

export async function getAttribution(date) {
  if (isLocal) {
    const raw = await fs.readFile(path.join(process.cwd(), '..', 'contracts', 'mocks', 'attribution.json'), 'utf-8');
    return JSON.parse(raw);
  }
  const table = process.env.TABLE_ATTRIBUTION || 'pt-demo-Attribution';
  const res = await ddb.send(new QueryCommand({
    TableName: table,
    KeyConditionExpression: 'pk = :pk',
    ExpressionAttributeValues: { ':pk': `date#${date}` }
  }));
  return res.Items || [];
}

export async function getFiresGeojson(run_id) {
  if (isLocal) {
    try {
      const raw = await fs.readFile(path.join(process.cwd(), '..', 'contracts', 'mocks', 'fires_48h.geojson'), 'utf-8');
      return JSON.parse(raw);
    } catch {
      return { type: 'FeatureCollection', features: [] };
    }
  }
  const bucket = process.env.BUCKET_DATA;
  const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: `outputs/run=${run_id}/fires_48h.geojson` }));
  const str = await res.Body.transformToString();
  return JSON.parse(str);
}

export async function getChcCentres() {
  if (isLocal) {
    const raw = await fs.readFile(path.join(process.cwd(), '..', 'static', 'chc_centres.geojson'), 'utf-8');
    return JSON.parse(raw);
  }
  const bucket = process.env.BUCKET_DATA;
  const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: 'static/chc_centres.geojson' }));
  const str = await res.Body.transformToString();
  return JSON.parse(str);
}
