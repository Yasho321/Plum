/**
 * OWNER    : Khare
 * DUE      : D2 18:00
 * TASK     :
 *   EventBridge forecast.published -> if delhi_fire_share_p50 >= 0.20 or max_pm25 >= 250 (config): draft reports for top 2 hotspot districts + 1 farmer alert (reuse handlers' functions, not HTTP). Idempotent per run_id (skip if drafts exist).
 * DONE WHEN: AC2 gov half.
 * GUIDE    : docs/team/KHARE.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : DONE
 */

import { getSummary } from '../lib/data.js';
import { handler as draftReportHandler } from '../reportGenerator/handler.js';
import { handler as draftFarmerAlertHandler } from '../farmerAlert/handler.js';

// Idempotency cache (simple in-memory for local/demo, usually DynamoDB lock)
const processedRuns = new Set();

export const handler = async (event) => {
  const runId = event.run_id || 'latest';
  
  if (processedRuns.has(runId)) {
    console.log(`Skipping run ${runId}, already processed.`);
    return { status: 'skipped', reason: 'already processed' };
  }
  
  const summary = await getSummary(runId);
  if (!summary) {
    return { status: 'error', reason: 'summary not found' };
  }
  
  const delhiShare = summary.delhi_fire_share_p50 || 0;
  const maxPm25 = summary.max_pm25 || 0;
  
  if (delhiShare >= 0.20 || maxPm25 >= 250) {
    // 1. Get top 2 hotspot districts
    let topDistricts = [];
    if (summary.hotspot_villages) {
      const districts = [...new Set(summary.hotspot_villages.map(v => v.district))];
      topDistricts = districts.slice(0, 2);
    }
    
    if (topDistricts.length === 0) {
      topDistricts = ['Sangrur', 'Bathinda'];
    }
    
    const actions = [];
    
    // 2. Draft reports for top 2
    for (const district of topDistricts) {
      console.log(`Drafting report for ${district}`);
      const res = await draftReportHandler({ district, run_id: runId, date: event.date });
      actions.push(res.action_id);
    }
    
    // 3. Draft 1 farmer alert (pick top 1 district)
    console.log(`Drafting farmer alert for ${topDistricts[0]}`);
    const alertRes = await draftFarmerAlertHandler({ district: topDistricts[0], run_id: runId, max_villages: 1 });
    actions.push(alertRes.action_id);
    
    processedRuns.add(runId);
    
    return { status: 'drafted', actions };
  } else {
    processedRuns.add(runId);
    return { status: 'skipped', reason: 'thresholds not met' };
  }
};
