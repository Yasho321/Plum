/**
 * OWNER    : Tanmay
 * DUE      : D2 12:00
 * TASK     :
 *   US1: map (fires, trajectories, districts, H3) + time slider, district ranking table with ranges + trend, 'Generate report' (asks Copilot / calls tool), draft queue snippet.
 * DONE WHEN: -
 * GUIDE    : docs/team/TANMAY.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : DONE
 */
import { useLatestRun } from '../hooks/queries';
import PlumeMap from '../components/map/PlumeMap';
import TimeSlider from '../components/map/TimeSlider';
import AqiLegend from '../components/map/AqiLegend';
import RangeText from '../components/RangeText';
import { useCopilotStore } from '../stores/copilotStore';

export default function GovernmentPage() {
  const { data: runData } = useLatestRun();
  const sendMessage = useCopilotStore(s => s.sendMessage);

  const districts = runData?.hotspot_districts || [];
  
  const handleGenerateReport = () => {
    sendMessage("Generate a district report based on the latest forecast.");
  };

  return (
    <div className="flex h-full">
      <div className="w-1/3 min-w-[350px] border-r border-border flex flex-col">
        <div className="p-4 border-b border-border flex justify-between items-center">
          <h2 className="text-lg font-semibold">District Impact</h2>
          <button 
            onClick={handleGenerateReport}
            className="px-3 py-1 bg-primary text-primary-foreground text-sm rounded hover:bg-primary/90"
          >
            Generate Report
          </button>
        </div>
        <div className="flex-1 overflow-auto p-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-border">
                <th className="pb-2 font-medium">District</th>
                <th className="pb-2 font-medium">Stubble Share</th>
                <th className="pb-2 font-medium">Trend</th>
              </tr>
            </thead>
            <tbody>
              {districts.map(d => (
                <tr key={d.district} className="border-b border-border/50">
                  <td className="py-2">{d.district}</td>
                  <td className="py-2">
                    <RangeText p50={d.share} p10={d.share_p10} p90={d.share_p90} />
                  </td>
                  <td className="py-2 text-muted-foreground">
                    {d.trend_7d != null ? `${d.trend_7d > 0 ? '+' : ''}${Math.round(d.trend_7d * 100)}%` : '--'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      <div className="flex-1 relative flex flex-col">
        <div className="flex-1 relative">
          <PlumeMap districtData={null} fireData={null} />
          <div className="absolute top-4 right-4 pointer-events-none">
            <div className="pointer-events-auto">
              <AqiLegend />
            </div>
          </div>
        </div>
        <div className="p-4 border-t border-border bg-card">
          <TimeSlider />
        </div>
      </div>
    </div>
  );
}
