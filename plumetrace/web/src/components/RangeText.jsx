/**
 * OWNER    : Tanmay
 * DUE      : D1 16:00
 * TASK     :
 *   Renders 'X % (A–B %)' consistently everywhere.
 * DONE WHEN: -
 * GUIDE    : docs/team/TANMAY.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : DONE
 */
import { formatShare } from '../lib/format';

export default function RangeText({ p50, p10, p90, className = '' }) {
  return (
    <span className={className}>
      {formatShare(p50, p10, p90)}
    </span>
  );
}
