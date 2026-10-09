/**
 * OWNER    : Tanmay
 * DUE      : D1 16:00
 * TASK     :
 *   'SIMULATED FLEET' badge (required on every fleet screen).
 * DONE WHEN: -
 * GUIDE    : docs/team/TANMAY.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : DONE
 */
import { FlaskConical } from 'lucide-react';
import { Badge } from './ui/Badge';

export default function SimulatedBadge({ size = 'md' }) {
  return (
    <Badge tone="warning" size={size} icon={FlaskConical} className="uppercase tracking-wide">
      Simulated fleet
    </Badge>
  );
}
