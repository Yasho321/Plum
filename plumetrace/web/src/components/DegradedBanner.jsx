/**
 * OWNER    : Tanmay
 * DUE      : D2 12:00
 * TASK     :
 *   Warning when summary.degraded is non-empty (e.g. FIRMS down).
 * DONE WHEN: -
 * GUIDE    : docs/team/TANMAY.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : DONE
 */
import { useLatestRun } from '../hooks/queries';

export default function DegradedBanner() {
  const { data } = useLatestRun();
  if (!data || !data.degraded || data.degraded.length === 0) return null;

  return (
    <div className="bg-destructive text-destructive-foreground p-2 text-sm text-center font-medium">
      Warning: Data degraded. {data.degraded.join(', ')}
    </div>
  );
}
