/**
 * OWNER    : Tanmay
 * DUE      : D2 16:00
 * TASK     :
 *   Card per action: type icon, status, summary, created/approved by; Approve / Reject (role-gated).
 * DONE WHEN: -
 * GUIDE    : docs/team/TANMAY.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : DONE
 */
import { useAuthStore } from '../../stores/authStore';
import { useApprove, useReject } from '../../hooks/queries';
import { toast } from 'sonner';
import ActionPreview from './ActionPreview';
import { Check, X, FileText, Bell, Users, MessageSquare, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { formatIst } from '../../lib/format';

const typeMeta = {
  district_report: { icon: FileText, label: 'District report' },
  farmer_alert: { icon: Bell, label: 'Farmer alert' },
  shift_plan: { icon: Users, label: 'Shift plan' },
  rider_notify: { icon: MessageSquare, label: 'Rider notifications' },
};

const statusMeta = {
  draft: { tone: 'warning', icon: Clock, label: 'Draft' },
  approved: { tone: 'success', icon: CheckCircle2, label: 'Approved' },
  rejected: { tone: 'danger', icon: XCircle, label: 'Rejected' },
  completed: { tone: 'brand', icon: CheckCircle2, label: 'Completed' },
};

export default function ActionCard({ action, onDecision }) {
  const { groups } = useAuthStore();
  const approve = useApprove();
  const reject = useReject();

  const isGov = groups.includes('gov') || groups.includes('admin');
  const isFleet = groups.includes('fleet') || groups.includes('admin');
  const canApprove =
    ((action.type === 'district_report' || action.type === 'farmer_alert') && isGov) ||
    ((action.type === 'shift_plan' || action.type === 'rider_notify') && isFleet);

  const meta = typeMeta[action.type] || { icon: FileText, label: action.type };
  const Icon = meta.icon;
  const s = statusMeta[action.status] || statusMeta.draft;

  const p = action.payload || {};
  const title = {
    district_report: `District report${p.district ? `: ${p.district}` : ''}`,
    farmer_alert: `Farmer alert${p.districts ? `: ${p.districts.join(', ')}` : ''}${p.language ? ` (${p.language})` : ''}`,
    shift_plan: `Shift plan${p.fleet_id ? `: ${p.fleet_id}` : ''}`,
    rider_notify: 'Rider notifications',
  }[action.type] || meta.label;

  const decide = (mutation, status, msg) =>
    mutation.mutate(action.action_id, {
      onSuccess: () => { onDecision?.(action.action_id, status); toast.success(msg); },
      onError: () => toast.error('Could not update the action'),
    });

  return (
    <div className="pt-card p-4 sm:p-5 pt-fade-in">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="grid place-items-center w-10 h-10 rounded-lg bg-primary/12 text-primary border border-primary/20 shrink-0">
            <Icon size={18} aria-hidden />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold leading-tight truncate">{title}</h3>
            <div className="text-xs text-muted-foreground mt-1 flex gap-2 items-center flex-wrap">
              <Badge tone={s.tone} size="sm" icon={s.icon}>{s.label}</Badge>
              <span className="tnum">{action.created_at ? formatIst(action.created_at) : ''}</span>
              {action.approved_by && <span>· by {action.approved_by}</span>}
            </div>
          </div>
        </div>

        {action.status === 'draft' && canApprove && (
          <div className="flex gap-2 shrink-0">
            <Button variant="danger" size="sm" onClick={() => decide(reject, 'rejected', 'Action rejected')} disabled={approve.isPending || reject.isPending}>
              <X size={14} aria-hidden /> Reject
            </Button>
            <Button size="sm" onClick={() => decide(approve, 'approved', 'Action approved')} loading={approve.isPending} disabled={reject.isPending}>
              <Check size={14} aria-hidden /> Approve
            </Button>
          </div>
        )}
      </div>

      <ActionPreview action={action} />
    </div>
  );
}
