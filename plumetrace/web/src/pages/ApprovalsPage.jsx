/**
 * OWNER    : Tanmay
 * DUE      : D2 16:00
 * TASK     :
 *   All drafts (filter by type/status), ActionCard + ActionPreview, optimistic approve.
 * DONE WHEN: -
 * GUIDE    : docs/team/TANMAY.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : DONE
 */
import { useMemo, useState } from 'react';
import { Inbox } from 'lucide-react';
import { useActions } from '../hooks/queries';
import ActionCard from '../components/approvals/ActionCard';
import { SegmentedControl } from '../components/ui/Tabs';
import { Badge } from '../components/ui/Badge';
import { EmptyState, ErrorState } from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';

const STATUSES = ['draft', 'approved', 'rejected', 'completed'];

export default function ApprovalsPage() {
  const [statusFilter, setStatusFilter] = useState('draft');
  const { data: actions = [], isLoading, isError, refetch } = useActions(statusFilter);
  // Session-optimistic overrides: {action_id: newStatus} so approve/reject feels instant
  // even when the mock API is a no-op. Real invalidation still runs underneath.
  const [overrides, setOverrides] = useState({});

  const onDecision = (id, status) => setOverrides((o) => ({ ...o, [id]: status }));

  const effective = (a) => overrides[a.action_id] || a.status;
  const all = Array.isArray(actions) ? actions : [];

  const counts = useMemo(() => {
    const c = Object.fromEntries(STATUSES.map((s) => [s, 0]));
    all.forEach((a) => { const s = effective(a); if (s in c) c[s] += 1; });
    return c;
  }, [all, overrides]);

  const filtered = all.filter((a) => effective(a) === statusFilter);

  return (
    <div className="p-5 sm:p-6 max-w-5xl mx-auto h-full flex flex-col">
      <div className="flex flex-wrap justify-between items-start gap-3 mb-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Action approvals</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            The agent drafts; a human approves. Nothing is sent until you approve it here.
          </p>
        </div>
        <Badge tone="brand">Human-in-the-loop</Badge>
      </div>

      <div className="my-4 overflow-x-auto">
        <SegmentedControl
          ariaLabel="Filter by status"
          value={statusFilter}
          onChange={setStatusFilter}
          options={STATUSES.map((s) => ({ value: s, label: `${s[0].toUpperCase()}${s.slice(1)} (${counts[s]})` }))}
        />
      </div>

      <div className="flex-1 overflow-auto pr-1 flex flex-col gap-4 min-h-0">
        {isError ? (
          <ErrorState description="Couldn't load the action queue." onRetry={refetch} />
        ) : isLoading ? (
          [...Array(3)].map((_, i) => (
            <div key={i} className="pt-card p-4 space-y-3">
              <div className="flex items-center gap-3"><Skeleton className="w-9 h-9 rounded-full" /><Skeleton className="h-4 w-48" /></div>
              <Skeleton className="h-24 w-full" />
            </div>
          ))
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title={`No ${statusFilter} actions`}
            description={statusFilter === 'draft' ? 'Ask the Copilot to draft a report, alert or shift plan.' : `Nothing in ${statusFilter} right now.`}
          />
        ) : (
          filtered.map((action) => (
            <ActionCard
              key={action.action_id}
              action={{ ...action, status: effective(action) }}
              onDecision={onDecision}
            />
          ))
        )}
      </div>
    </div>
  );
}
