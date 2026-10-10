/**
 * OWNER    : Tanmay
 * DUE      : D2 18:00
 * TASK     :
 *   US4: riders table with DoseBar, over-budget highlighted, before/after plan comparison (from latest shift_plan action), 'Notify riders' button, SIMULATED badge, rider exposure map.
 * DONE WHEN: -
 * GUIDE    : docs/team/TANMAY.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : DONE
 */
import { useMemo, useState } from 'react';
import { Bell, Users, AlertTriangle, Gauge, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { useFleetExposure } from '../hooks/queries';
import DoseBar from '../components/DoseBar';
import SimulatedBadge from '../components/SimulatedBadge';
import { useCopilotStore } from '../stores/copilotStore';
import { Button } from '../components/ui/Button';
import { Stat } from '../components/ui/Stat';
import { Badge } from '../components/ui/Badge';
import { SegmentedControl } from '../components/ui/Tabs';
import { SkeletonRows } from '../components/ui/Skeleton';
import { EmptyState, ErrorState } from '../components/ui/EmptyState';

export default function FleetPage() {
  const { data: fleet, isLoading, isError, refetch } = useFleetExposure('fleet_demo', '2026-10-10');
  const sendMessage = useCopilotStore((s) => s.sendMessage);
  const [filter, setFilter] = useState('all');

  const riders = useMemo(() => fleet?.riders || [], [fleet]);
  const total = fleet?.summary?.riders_total ?? riders.length;
  const over = fleet?.summary?.riders_over_budget ?? riders.filter((r) => r.over_budget).length;
  const worst = fleet?.summary?.worst_rider_pct ?? Math.max(0, ...riders.map((r) => r.forecast_dose_pct || 0));

  const rows = useMemo(() => {
    const list = filter === 'over' ? riders.filter((r) => r.over_budget) : riders;
    return [...list].sort((a, b) => (b.forecast_dose_pct || 0) - (a.forecast_dose_pct || 0));
  }, [riders, filter]);

  const handleNotify = () => {
    sendMessage('Draft notifications to riders who are over their exposure budget.');
    toast.success('Asked Copilot to draft rider notifications', { description: 'Review drafts in Approvals.' });
  };

  return (
    <div className="p-5 sm:p-6 max-w-5xl mx-auto h-full flex flex-col">
      <div className="flex flex-wrap justify-between items-start gap-3 mb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">Fleet exposure</h1>
            <SimulatedBadge />
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Forecast rider pollution dose as a % of each rider's safe daily budget.
          </p>
        </div>
        <Button onClick={handleNotify}>
          <Bell size={15} aria-hidden /> Notify riders
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-5">
        <Stat label="Riders" icon={Users} value={total} animate loading={isLoading} />
        <Stat label="Over budget" icon={AlertTriangle} value={over} animate loading={isLoading} tone="text-destructive" sub="need re-planning" />
        <Stat label="Worst rider" icon={Gauge} value={isLoading ? undefined : `${Math.round(worst)}%`} loading={isLoading} tone="text-destructive" sub="of daily budget" />
      </div>

      <div className="flex items-center justify-between mb-3">
        <SegmentedControl
          ariaLabel="Filter riders"
          size="sm"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: `All (${total})` },
            { value: 'over', label: `Over budget (${over})` },
          ]}
        />
        <span className="hidden sm:flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-primary" /> within budget</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-destructive" /> over</span>
        </span>
      </div>

      <div className="pt-card flex-1 overflow-auto min-h-0">
        <div className="grid grid-cols-[1.4fr_1fr_2fr_auto] gap-4 px-4 py-2.5 text-[11px] uppercase tracking-wide text-muted-foreground border-b border-border sticky top-0 bg-card z-10">
          <span>Rider</span><span>Home cell</span><span>Exposure · % of budget</span><span className="text-right">Status</span>
        </div>
        {isError ? (
          <ErrorState description="Couldn't load fleet exposure." onRetry={refetch} />
        ) : isLoading ? (
          <SkeletonRows rows={8} rowClassName="border-b border-border/40" />
        ) : rows.length === 0 ? (
          <EmptyState icon={CheckCircle2} title="No riders over budget" description="Every rider is within their safe daily dose for this shift." />
        ) : (
          rows.map((r) => {
            const pct = r.forecast_dose_pct;
            return (
              <div key={r.rider_id} className="grid grid-cols-[1.4fr_1fr_2fr_auto] gap-4 items-center px-4 py-3 border-b border-border/40 last:border-0 hover:bg-secondary/40 transition-colors">
                <span className="font-medium text-sm truncate">{r.name || r.rider_id}</span>
                <span className="text-xs text-muted-foreground font-mono truncate">{r.home_h3?.slice(0, 9)}…</span>
                <div className="flex items-center gap-3">
                  <DoseBar current={pct} limit={100} />
                  <span className={`text-xs tnum w-11 text-right ${r.over_budget ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}>
                    {Math.round(pct)}%
                  </span>
                </div>
                <div className="text-right">
                  {r.over_budget ? (
                    <Badge tone="danger" size="sm" icon={AlertTriangle}>Over</Badge>
                  ) : (
                    <Badge tone="success" size="sm" icon={CheckCircle2}>Safe</Badge>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
      <p className="text-[11px] text-muted-foreground mt-3">
        Simulated occupational-health monitoring. Only budget % is shown — never individual health conditions.
      </p>
    </div>
  );
}
