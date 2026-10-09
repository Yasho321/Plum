/**
 * OWNER    : Tanmay
 * DUE      : D3 12:00
 * TASK     :
 *   US5/AC3/AC4: forecast vs actual line charts per station with p10–p90 band (recharts), metrics table by lead bucket, backtest vs live tabs, persistence baseline.
 * DONE WHEN: -
 * GUIDE    : docs/team/TANMAY.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : DONE
 */
import { useState } from 'react';
import { ComposedChart, Area, Line, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useSkill, useStation, useLatestRun } from '../hooks/queries';

const STATION_ID = '1420'; // Anand Vihar

export default function SkillPage() {
  const [mode, setMode] = useState('live');
  const { data: skill } = useSkill(7);
  const { data: run } = useLatestRun();
  const { data: station } = useStation(STATION_ID, run?.run_id);

  // Chart: station forecast series (p10–p90 band, median, observed).
  const chartData = (station?.series || []).map((p) => ({
    time: p.lead_h,
    p50: p.pm25_p50,
    range: [p.pm25_p10, p.pm25_p90],
    actual: p.obs_pm25 ?? null,
  }));

  const buckets = (skill?.[mode] || []);

  const pct = (x) => (x == null ? '—' : `${Math.round(x * 100)}%`);
  const signed = (x) => (x == null ? '—' : `${x >= 0 ? '+' : ''}${Math.round(x * 100)}%`);

  return (
    <div className="p-6 max-w-6xl mx-auto h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Forecast Skill</h2>
        <div className="flex gap-2 bg-muted p-1 rounded-md">
          <button
            onClick={() => setMode('backtest')}
            className={`px-3 py-1 text-sm rounded transition-colors ${mode === 'backtest' ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Backtest
          </button>
          <button
            onClick={() => setMode('live')}
            className={`px-3 py-1 text-sm rounded transition-colors ${mode === 'live' ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Live
          </button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground mb-6 bg-muted/50 p-2 rounded inline-block self-start border border-border">
        Caveat: {mode === 'backtest' ? 'Backtest uses reanalysis weather (optimistic)' : 'Live uses GFS forecasts'}.
      </p>

      <div className="bg-card border border-border p-4 rounded-lg shadow-sm mb-6 h-[400px]">
        <h3 className="font-semibold mb-4">Station Forecast vs Actual — {station?.station_name || STATION_ID} (PM2.5)</h3>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" opacity={0.2} />
            <XAxis dataKey="time" label={{ value: 'Lead (h)', position: 'insideBottom', offset: -4 }} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Area type="monotone" dataKey="range" fill="#8884d8" fillOpacity={0.2} stroke="none" name="10th-90th Percentile" />
            <Line type="monotone" dataKey="p50" stroke="#8884d8" strokeWidth={2} dot={false} name="Median Forecast" />
            <Scatter dataKey="actual" fill="#ff7300" name="Observed" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-card border border-border p-4 rounded-lg shadow-sm">
        <h3 className="font-semibold mb-4">Metrics by Lead Time ({mode})</h3>
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="pb-2">Lead Time</th>
              <th className="pb-2">MAE</th>
              <th className="pb-2">RMSE</th>
              <th className="pb-2">Coverage (p10-p90)</th>
              <th className="pb-2">Skill vs Persistence</th>
              <th className="pb-2">Severe Hit Rate</th>
            </tr>
          </thead>
          <tbody>
            {buckets.length === 0 ? (
              <tr><td colSpan={6} className="py-4 text-muted-foreground text-center">No skill data yet.</td></tr>
            ) : (
              buckets.map((b) => (
                <tr key={b.lead_bucket} className="border-b border-border/50">
                  <td className="py-2">{b.lead_bucket}h</td>
                  <td className="py-2">{b.mae}</td>
                  <td className="py-2">{b.rmse}</td>
                  <td className="py-2">{pct(b.coverage_p10_p90)}</td>
                  <td className={`py-2 ${b.skill_vs_persistence >= 0 ? 'text-green-500' : 'text-destructive'}`}>{signed(b.skill_vs_persistence)}</td>
                  <td className="py-2">{pct(b.severe_hit_rate)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
