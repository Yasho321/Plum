/**
 * OWNER    : Tanmay
 * DUE      : D2 12:00
 * TASK     :
 *   US1: map (fires, trajectories, districts, H3) + time slider, district ranking table with ranges + trend, 'Generate report' (asks Copilot / calls tool), draft queue snippet.
 * DONE WHEN: -
 * GUIDE    : docs/team/TANMAY.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : DONE
 */
import { FileText, TrendingUp, TrendingDown, Wind, Factory } from 'lucide-react';
import { useLatestRun } from '../hooks/queries';
import PlumeMap from '../components/map/PlumeMap';
import TimeSlider from '../components/map/TimeSlider';
import AqiLegend from '../components/map/AqiLegend';
import RangeText from '../components/RangeText';
import { useCopilotStore } from '../stores/copilotStore';
import { getAqiColor } from '../lib/aqi';

export default function GovernmentPage() {
  const { data: runData, isLoading } = useLatestRun();
  const sendMessage = useCopilotStore(s => s.sendMessage);

  const districts = runData?.hotspot_districts || [];
  const firePct = runData ? Math.round(runData.delhi_fire_share_p50 * 100) : null;
  const firePctLo = runData ? Math.round(runData.delhi_fire_share_p10 * 100) : null;
  const firePctHi = runData ? Math.round(runData.delhi_fire_share_p90 * 100) : null;

  const handleGenerateReport = () => sendMessage('Generate a district report based on the latest forecast.');

  return (
    <div className="flex h-full min-h-0">
      {/* Left rail */}
      <aside className="w-[380px] min-w-[340px] border-r border-border flex flex-col overflow-auto">
        <div className="p-5 pb-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">District Impact</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Estimated crop-fire contribution to Delhi-NCR PM2.5</p>
          </div>
          <button
            onClick={handleGenerateReport}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded-md hover:brightness-110 transition shadow-lg shadow-primary/20"
          >
            <FileText size={14} /> Report
          </button>
        </div>

        {/* Headline stats */}
        <div className="grid grid-cols-2 gap-3 px-5 pb-4">
          <div className="pt-card p-3.5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Wind size={13} /> Peak PM2.5</div>
            {isLoading ? <div className="pt-skeleton h-7 w-20 mt-1.5" /> : (
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-2xl font-extrabold" style={{ color: getAqiColor(runData?.max_pm25) }}>{runData?.max_pm25 ?? '—'}</span>
                <span className="text-xs text-muted-foreground">µg/m³</span>
              </div>
            )}
            {runData && <div className="text-[11px] text-muted-foreground mt-0.5">{runData.max_pm25_p10}–{runData.max_pm25_p90} band</div>}
          </div>
          <div className="pt-card p-3.5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Factory size={13} /> Crop-fire share</div>
            {isLoading ? <div className="pt-skeleton h-7 w-20 mt-1.5" /> : (
              <div className="mt-1 text-2xl font-extrabold text-primary">{firePct != null ? `${firePct}%` : '—'}</div>
            )}
            {firePct != null && <div className="text-[11px] text-muted-foreground mt-0.5">{firePctLo}–{firePctHi}% range</div>}
          </div>
        </div>

        {/* District ranking */}
        <div className="flex-1 px-5 pb-5">
          <div className="pt-card overflow-hidden">
            <div className="grid grid-cols-[1fr_auto_auto] gap-3 px-4 py-2.5 text-[11px] uppercase tracking-wide text-muted-foreground border-b border-border">
              <span>District</span><span>Stubble Share</span><span className="text-right">Trend 7d</span>
            </div>
            {isLoading ? (
              [...Array(5)].map((_, i) => <div key={i} className="px-4 py-3"><div className="pt-skeleton h-4 w-full" /></div>)
            ) : districts.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">No district data.</div>
            ) : (
              districts.map((d, i) => (
                <div key={d.district} className="grid grid-cols-[1fr_auto_auto] gap-3 items-center px-4 py-3 border-b border-border/40 last:border-0 hover:bg-secondary/40 transition-colors pt-fade-in">
                  <div className="flex items-center gap-2.5">
                    <span className="grid place-items-center w-5 h-5 rounded text-[10px] font-bold bg-secondary text-muted-foreground">{i + 1}</span>
                    <span className="font-medium text-sm">{d.district}</span>
                  </div>
                  <RangeText className="text-sm tabular-nums" p50={d.share} p10={d.share_p10} p90={d.share_p90} />
                  <span className={`text-right text-sm font-medium inline-flex items-center gap-0.5 justify-end ${d.trend_7d > 0 ? 'text-destructive' : 'text-success'}`}>
                    {d.trend_7d > 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                    {d.trend_7d != null ? `${d.trend_7d > 0 ? '+' : ''}${Math.round(d.trend_7d * 100)}%` : '—'}
                  </span>
                </div>
              ))
            )}
          </div>
          <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed">
            Estimates are model-based with a p10–p90 range — not a verdict. Source: FIRMS · GFS · OpenAQ.
          </p>
        </div>
      </aside>

      {/* Map */}
      <div className="flex-1 relative flex flex-col min-h-0">
        <div className="flex-1 relative min-h-0">
          <PlumeMap districtData={null} fireData={null} />
          <div className="absolute top-4 right-4 z-10 pointer-events-auto">
            <AqiLegend />
          </div>
        </div>
        <div className="p-4 border-t border-border shrink-0">
          <TimeSlider />
        </div>
      </div>
    </div>
  );
}
