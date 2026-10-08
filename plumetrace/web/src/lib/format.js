/**
 * OWNER    : Tanmay
 * DUE      : D1 14:00
 * TASK     :
 *   Brief §7: pm25 integer, shares '31 % (22–40 %)', UTC -> IST display.
 * DONE WHEN: -
 * GUIDE    : docs/team/TANMAY.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : DONE
 */
export function formatPm25(val) {
  if (val == null) return '--';
  return Math.round(val).toString();
}

export function formatShare(p50, p10, p90) {
  if (p50 == null) return '-- %';
  const main = Math.round(p50 * 100);
  const low = Math.round((p10 || 0) * 100);
  const high = Math.round((p90 || 0) * 100);
  return `${main} % (${low}–${high} %)`;
}

export function formatIst(dateString) {
  if (!dateString) return '';
  const d = new Date(dateString);
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZoneName: 'short'
  }).format(d);
}
