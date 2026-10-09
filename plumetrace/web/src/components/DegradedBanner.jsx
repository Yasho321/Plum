/**
 * OWNER    : Tanmay
 * DUE      : D2 12:00
 * TASK     :
 *   Warning when summary.degraded is non-empty (e.g. FIRMS down).
 * DONE WHEN: -
 * GUIDE    : docs/team/TANMAY.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : DONE
 */
import { AlertTriangle } from 'lucide-react';
import { useLatestRun } from '../hooks/queries';

const SOURCE_LABELS = { firms: 'FIRMS fire detections', gfs: 'GFS weather', openaq: 'OpenAQ stations' };

export default function DegradedBanner() {
  const { data } = useLatestRun();
  if (!data?.degraded?.length) return null;

  const names = data.degraded.map((s) => SOURCE_LABELS[s] || s).join(', ');

  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium
                 bg-warning/12 text-warning border-b border-warning/25"
    >
      <AlertTriangle size={14} strokeWidth={2.2} aria-hidden />
      <span className="text-foreground/90">
        Running in degraded mode — <span className="font-semibold text-warning">{names}</span>{' '}
        unavailable. Estimates use fallbacks and carry wider ranges.
      </span>
    </div>
  );
}
