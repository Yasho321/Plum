/**
 * OWNER    : Tanmay
 * DUE      : D2 18:00
 * TASK     :
 *   US4: riders table with DoseBar, over-budget highlighted, before/after plan comparison (from latest shift_plan action), 'Notify riders' button, SIMULATED badge, rider exposure map.
 * DONE WHEN: -
 * GUIDE    : docs/team/TANMAY.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : DONE
 */
import { Bell, Users, AlertTriangle, Gauge } from 'lucide-react';
import { useFleetExposure } from '../hooks/queries';
import DoseBar from '../components/DoseBar';
import SimulatedBadge from '../components/SimulatedBadge';
import { useCopilotStore } from '../stores/copilotStore';

export default function FleetPage() {
  const { data: fleet, isLoading } = useFleetExposure('fleet_demo', '2026-10-10');
  const sendMessage = useCopilotStore(s => s.sendMessage);

  const riders = fleet?.riders || [];
  const total = fleet?.summary?.riders_total ?? riders.length;
  const over = fleet?.summary?.riders_over_budget ?? riders.filter(r => r.over_budget).length;
  const worst = fleet?.summary?.worst_rider_pct ?? Math.max(0, ...riders.map(r => r.forecast_dose_pct || 0));

  const handleNotify = () => sendMessage('Draft notifications to riders who are over their exposure budget.');

  const Stat = ({ icon, label, value, tone }) => (
    <div className="pt-card p-4">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon}{label}</div>
      {isLoading ? <div className="pt-skeleton h-8 w-16 mt-2" /> : <div className={`mt-1 text-3xl font-extrabold ${tone || ''}`}>{value}</div>}
    </div>
  );

  return (
    <div className="p-6 max-w-5xl mx-auto h-full flex flex-col">
      <div className="flex justify-between items-start mb-5">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold">Fleet Exposure</h2>
            <SimulatedBadge />
          </div>
          <p className="text-sm text-muted-foreground mt-1">Forecast rider pollution dose as a % of each rider's safe daily budget.</p>
        </div>
        <button onClick={handleNotify} className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-md hover:brightness-110 transition shadow-lg shadow-primary/20">
          <Bell size={15} /> Notify Riders
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-5">
        <Stat icon={<Users size={13} />} label="Riders" value={total} />
        <Stat icon={<AlertTriangle size={13} />} label="Over budget" value={over} tone="text-destructive" />
        <Stat icon={<Gauge size={13} />} label="Worst rider" value={`${Math.round(worst)}%`} tone="text-destructive" />
      </div>

      <div className="pt-card flex-1 overflow-auto">
        <div className="grid grid-cols-[1.4fr_1fr_2fr_auto] gap-4 px-4 py-2.5 text-[11px] uppercase tracking-wide text-muted-foreground border-b border-border sticky top-0 bg-card z-10">
          <span>Rider</span><span>Home cell</span><span>Exposure % of budget</span><span className="text-right">Status</span>
        </div>
        {isLoading ? (
          [...Array(8)].map((_, i) => <div key={i} className="px-4 py-3.5"><div className="pt-skeleton h-4 w-full" /></div>)
        ) : riders.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">No rider exposure data.</div>
        ) : (
          riders.map(r => {
            const pct = r.forecast_dose_pct;
            return (
              <div key={r.rider_id} className="grid grid-cols-[1.4fr_1fr_2fr_auto] gap-4 items-center px-4 py-3 border-b border-border/40 last:border-0 hover:bg-secondary/40 transition-colors">
                <span className="font-medium text-sm truncate">{r.name || r.rider_id}</span>
                <span className="text-xs text-muted-foreground font-mono">{r.home_h3?.slice(0, 9)}…</span>
                <div className="flex items-center gap-3">
                  <DoseBar current={pct} limit={100} />
                  <span className={`text-xs tabular-nums w-12 text-right ${pct > 100 ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}>{Math.round(pct)}%</span>
                </div>
                <div className="text-right">
                  {r.over_budget
                    ? <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-destructive/15 text-destructive">Over</span>
                    : <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-success/15 text-success">Safe</span>}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
