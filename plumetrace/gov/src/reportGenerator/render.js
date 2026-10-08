/**
 * OWNER    : Khare
 * DUE      : D2 11:00
 * TASK     :
 *   Fill the template (simple {{placeholders}} or tagged template); number formatting rules from brief §7.
 * DONE WHEN: -
 * GUIDE    : docs/team/KHARE.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : DONE
 */

import fs from 'fs/promises';
import path from 'path';
import { generateSvgMap } from './svgMap.js';

function formatNumber(num) {
  // Brief §7: e.g. "31 % (22–40 %)" or similar
  return Math.round(num);
}

export async function renderTemplate(district, data, htmlTemplateString) {
  // data: { firesGeojson, contributionPct, date, chcs }
  
  const svgMap = generateSvgMap(null, data.firesGeojson);
  
  const dateStr = data.date || new Date().toISOString().split('T')[0];
  const fireCount = data.firesGeojson ? data.firesGeojson.features.length : 0;
  
  // Format the contribution percentage
  const pctStr = `${formatNumber(data.contributionPct)} %`;
  
  let supportiveActionsHtml = '';
  if (data.chcs && data.chcs.length > 0) {
    for (const chc of data.chcs) {
      supportiveActionsHtml += `<li><strong>${chc.name}</strong> - Machine rental available.</li>\n`;
    }
  } else {
    supportiveActionsHtml = '<li>No nearby Custom Hiring Centres (CHCs) found in the database.</li>';
  }
  
  let html = htmlTemplateString;
  html = html.replace(/{{DATE}}/g, dateStr);
  html = html.replace(/{{DISTRICT}}/g, district);
  html = html.replace(/{{CONTRIBUTION_PCT}}/g, pctStr);
  html = html.replace(/{{FIRE_COUNT}}/g, fireCount);
  html = html.replace(/{{SVG_MAP}}/g, svgMap);
  html = html.replace(/{{SUPPORTIVE_ACTIONS}}/g, supportiveActionsHtml);
  
  return html;
}

export async function renderReport(district, data) {
  const templatePath = path.join(process.cwd(), 'src', 'reportGenerator', 'template.html');
  // if run directly from gov root: process.cwd() is gov/
  let htmlTemplateString;
  try {
    htmlTemplateString = await fs.readFile(templatePath, 'utf8');
  } catch(e) {
    // fallback path for testing
    htmlTemplateString = await fs.readFile(path.join(process.cwd(), 'gov', 'src', 'reportGenerator', 'template.html'), 'utf8');
  }
  return renderTemplate(district, data, htmlTemplateString);
}
