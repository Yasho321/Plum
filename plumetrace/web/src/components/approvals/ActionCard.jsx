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
import { Check, X, FileText, Bell, Users, MessageSquare } from 'lucide-react';

const typeIcons = {
  district_report: <FileText size={18} />,
  farmer_alert: <Bell size={18} />,
  shift_plan: <Users size={18} />,
  rider_notify: <MessageSquare size={18} />
};

export default function ActionCard({ action }) {
  const { groups } = useAuthStore();
  const approve = useApprove();
  const reject = useReject();

  const isGov = groups.includes('gov') || groups.includes('admin');
  const isFleet = groups.includes('fleet') || groups.includes('admin');
  
  const canApprove = 
    (action.type === 'district_report' && isGov) ||
    (action.type === 'farmer_alert' && isGov) ||
    (action.type === 'shift_plan' && isFleet) ||
    (action.type === 'rider_notify' && isFleet);

  const p = action.payload || {};
  const title = {
    district_report: `District report${p.district ? `: ${p.district}` : ''}`,
    farmer_alert: `Farmer alert${p.districts ? `: ${p.districts.join(', ')}` : ''}${p.language ? ` (${p.language})` : ''}`,
    shift_plan: `Shift plan${p.fleet_id ? `: ${p.fleet_id}` : ''}`,
    rider_notify: 'Rider notifications',
  }[action.type] || action.type;

  const handleApprove = () => {
    approve.mutate(action.action_id, {
      onSuccess: () => toast.success('Action approved successfully')
    });
  };

  const handleReject = () => {
    reject.mutate(action.action_id, {
      onSuccess: () => toast.success('Action rejected')
    });
  };

  return (
    <div className="pt-card p-4 flex flex-col pt-fade-in">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-secondary text-secondary-foreground rounded-full flex-shrink-0">
            {typeIcons[action.type] || <FileText size={18} />}
          </div>
          <div>
            <h3 className="font-semibold leading-tight">{title}</h3>
            <div className="text-xs text-muted-foreground mt-1 flex gap-2 items-center flex-wrap">
              <span className="uppercase font-medium px-1.5 py-0.5 rounded bg-muted">
                {action.status}
              </span>
              <span>•</span>
              <span>Created: {new Date(action.created_at).toLocaleString()}</span>
              {action.approved_by && (
                <>
                  <span>•</span>
                  <span>By: {action.approved_by}</span>
                </>
              )}
            </div>
          </div>
        </div>
        
        {action.status === 'draft' && canApprove && (
          <div className="flex gap-2 ml-4 shrink-0">
            <button
              onClick={handleReject}
              disabled={reject.isPending || approve.isPending}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-destructive bg-destructive/10 hover:bg-destructive/20 rounded-md disabled:opacity-50 transition-colors"
            >
              <X size={14} /> Reject
            </button>
            <button
              onClick={handleApprove}
              disabled={approve.isPending || reject.isPending}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-primary text-primary-foreground hover:brightness-110 rounded-md disabled:opacity-50 transition-colors shadow-lg shadow-primary/20"
            >
              <Check size={14} /> Approve
            </button>
          </div>
        )}
      </div>
      
      <ActionPreview action={action} />
    </div>
  );
}
