/**
 * OWNER    : Tanmay
 * DUE      : D2 16:00
 * TASK     :
 *   All drafts (filter by type/status), ActionCard + ActionPreview, optimistic approve.
 * DONE WHEN: -
 * GUIDE    : docs/team/TANMAY.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : DONE
 */
import { useState } from 'react';
import { useActions } from '../hooks/queries';
import ActionCard from '../components/approvals/ActionCard';

export default function ApprovalsPage() {
  const [statusFilter, setStatusFilter] = useState('draft');
  const { data: actions = [], isLoading } = useActions(statusFilter);

  // The hook returns all actions in our mock, filter here
  const filteredActions = Array.isArray(actions) ? actions.filter(a => a.status === statusFilter) : [];

  return (
    <div className="p-6 max-w-5xl mx-auto h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Action Approvals</h2>
        <div className="flex gap-2">
          {['draft', 'approved', 'rejected', 'completed'].map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium capitalize transition-colors ${
                statusFilter === status 
                  ? 'bg-primary text-primary-foreground shadow-sm' 
                  : 'bg-muted hover:bg-muted/80 text-muted-foreground'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>
      
      <div className="flex-1 overflow-auto pr-2 flex flex-col gap-4">
        {isLoading ? (
          <div className="text-muted-foreground text-center py-10 animate-pulse">Loading actions...</div>
        ) : filteredActions.length === 0 ? (
          <div className="text-muted-foreground text-center py-10">No actions found in this status.</div>
        ) : (
          filteredActions.map(action => (
            <ActionCard key={action.action_id} action={action} />
          ))
        )}
      </div>
    </div>
  );
}
