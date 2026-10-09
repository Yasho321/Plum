/**
 * OWNER    : Tanmay
 * DUE      : D1 14:00
 * TASK     :
 *   India NAQI PM2.5 bands (Good 0–30, Satisfactory 31–60, Moderate 61–90, Poor 91–120, Very Poor 121–250, Severe >250) -> colour (colour-blind checked), label.
 * DONE WHEN: -
 * GUIDE    : docs/team/TANMAY.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : DONE
 */
export const AQI_BANDS = [
  { min: 0, max: 30, label: 'Good', color: '#4ade80' },
  { min: 31, max: 60, label: 'Satisfactory', color: '#a3e635' },
  { min: 61, max: 90, label: 'Moderate', color: '#facc15' },
  { min: 91, max: 120, label: 'Poor', color: '#fb923c' },
  { min: 121, max: 250, label: 'Very Poor', color: '#ef4444' },
  { min: 251, max: 9999, label: 'Severe', color: '#b91c1c' },
];

export function getAqiBand(pm25) {
  if (pm25 == null) return null;
  const val = Math.round(pm25);
  return AQI_BANDS.find(b => val >= b.min && val <= b.max) || AQI_BANDS[AQI_BANDS.length - 1];
}

export function getAqiColor(pm25) {
  const band = getAqiBand(pm25);
  return band ? band.color : '#888888';
}
