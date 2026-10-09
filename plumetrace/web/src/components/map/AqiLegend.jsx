/**
 * OWNER    : Tanmay
 * DUE      : D1 16:00
 * TASK     :
 *   Legend from lib/aqi.js.
 * DONE WHEN: -
 * GUIDE    : docs/team/TANMAY.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : DONE
 */
import { AQI_BANDS } from '../../lib/aqi';

export default function AqiLegend() {
  return (
    <div className="pt-glass rounded-xl p-3.5 text-sm shadow-xl w-48">
      <div className="font-semibold mb-2.5 text-xs uppercase tracking-wide text-muted-foreground">AQI · PM2.5 (µg/m³)</div>
      <div className="flex flex-col gap-1.5">
        {AQI_BANDS.map(band => (
          <div key={band.label} className="flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: band.color, boxShadow: `0 0 8px ${band.color}55` }} />
            <span className="text-muted-foreground tabular-nums w-14 text-xs">{band.min}–{band.max === 9999 ? '+' : band.max}</span>
            <span className="text-xs font-medium">{band.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
