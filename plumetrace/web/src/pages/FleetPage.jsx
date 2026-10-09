/**
 * OWNER    : Tanmay
 * DUE      : D2 18:00
 * TASK     :
 *   US4: riders table with DoseBar, over-budget highlighted, before/after plan comparison (from latest shift_plan action), 'Notify riders' button, SIMULATED badge, rider exposure map.
 * DONE WHEN: -
 * GUIDE    : docs/team/TANMAY.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : DONE
 */
import { useLatestRun, useActions } from '../hooks/queries';
import DoseBar from '../components/DoseBar';
import SimulatedBadge from '../components/SimulatedBadge';
import { useCopilotStore } from '../stores/copilotStore';

export default function FleetPage() {
  const { data: runData } = useLatestRun();
  const { data: actions = [] } = useActions('draft');
  const sendMessage = useCopilotStore(s => s.sendMessage);

  const riders = runData?.riders || [];
  
  // Find the latest shift_plan action
  const latestShiftPlan = Array.isArray(actions) ? actions.find(a => a.type === 'shift_plan') : null;
  const newPlanRiders = latestShiftPlan?.payload?.after?.riders || [];
  
  const budget = 200; // example limit

  const handleNotify = () => {
    sendMessage("Draft notifications to riders who are over their exposure budget.");
  };

  return (
    <div className="p-6 max-w-5xl mx-auto h-full flex flex-col relative">
      <div className="absolute top-4 right-4">
        <SimulatedBadge />
      </div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Fleet Exposure (Daily Budget: {budget} µg·h/m³)</h2>
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
              <th className="pb-2 font-medium">Rider ID</th>
              <th className="pb-2 font-medium">Route</th>
              <th className="pb-2 font-medium w-1/2">Exposure % of Budget</th>
              <th className="pb-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {riders.map(rider => {
              const currentExposure = rider.dose_72h;
              const proposedRider = newPlanRiders.find(r => r.rider_id === rider.id);
              const proposedExposure = proposedRider ? proposedRider.dose_72h : undefined;
              
              const isOver = currentExposure > budget;
              const willBeOver = proposedExposure !== undefined ? proposedExposure > budget : isOver;

              return (
                <tr key={rider.id} className="border-b border-border/50">
                  <td className="py-3 font-medium">{rider.id}</td>
                  <td className="py-3 text-muted-foreground">{rider.route_id}</td>
                  <td className="py-3 pr-4">
                    <DoseBar current={currentExposure} proposed={proposedExposure} limit={budget} />
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>{Math.round((currentExposure / budget) * 100)}% current</span>
                      {proposedExposure !== undefined && (
                        <span>{Math.round((proposedExposure / budget) * 100)}% proposed</span>
                      )}
                    </div>
                  </td>
                  <td className="py-3">
                    {willBeOver ? (
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
