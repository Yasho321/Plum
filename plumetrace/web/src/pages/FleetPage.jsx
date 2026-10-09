/**
 * OWNER    : Tanmay
 * DUE      : D2 18:00
 * TASK     :
 *   US4: riders table with DoseBar, over-budget highlighted, before/after plan comparison (from latest shift_plan action), 'Notify riders' button, SIMULATED badge, rider exposure map.
 * DONE WHEN: -
 * GUIDE    : docs/team/TANMAY.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : DONE
 */
import { useFleetExposure } from '../hooks/queries';
import DoseBar from '../components/DoseBar';
import SimulatedBadge from '../components/SimulatedBadge';
import { useCopilotStore } from '../stores/copilotStore';

export default function FleetPage() {
  const { data: fleet } = useFleetExposure('fleet_demo', '2026-10-10');
  const sendMessage = useCopilotStore(s => s.sendMessage);

  const riders = fleet?.riders || [];
  const overCount = fleet?.summary?.riders_over_budget ?? riders.filter(r => r.over_budget).length;

  const handleNotify = () => {
    sendMessage("Draft notifications to riders who are over their exposure budget.");
  };

  return (
    <div className="p-6 max-w-5xl mx-auto h-full flex flex-col relative">
      <div className="absolute top-4 right-4">
        <SimulatedBadge />
      </div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">
          Fleet Exposure <span className="text-base font-normal text-muted-foreground">({overCount} of {riders.length} riders over budget)</span>
        </h2>
        <button
          onClick={handleNotify}
          className="px-4 py-2 bg-primary text-primary-foreground text-sm rounded-md hover:bg-primary/90"
        >
          Notify Riders
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground border-b border-border">
              <th className="pb-2 font-medium">Rider</th>
              <th className="pb-2 font-medium">Home cell</th>
              <th className="pb-2 font-medium w-1/2">Exposure % of Budget</th>
              <th className="pb-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {riders.map(rider => {
              const pct = rider.forecast_dose_pct;   // already % of budget
              return (
                <tr key={rider.rider_id} className="border-b border-border/50">
                  <td className="py-3 font-medium">{rider.name || rider.rider_id}</td>
                  <td className="py-3 text-muted-foreground font-mono text-xs">{rider.home_h3?.slice(0, 8)}…</td>
                  <td className="py-3 pr-4">
                    <DoseBar current={pct} limit={100} />
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>{Math.round(pct)}% of safe budget</span>
                    </div>
                  </td>
                  <td className="py-3">
                    {rider.over_budget ? (
                      <span className="text-destructive font-medium">Over Budget</span>
                    ) : (
                      <span className="text-green-500 font-medium">Safe</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
