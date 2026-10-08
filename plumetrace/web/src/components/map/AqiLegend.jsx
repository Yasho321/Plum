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
    <div className="bg-card/90 border border-border p-3 rounded-lg shadow-sm text-sm">
      <div className="font-semibold mb-2">AQI (PM2.5)</div>
      <div className="flex flex-col gap-1">
        {AQI_BANDS.map(band => (
          <div key={band.label} className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: band.color }} />
            <span className="text-muted-foreground w-12">{band.min}-{band.max === 9999 ? '...' : band.max}</span>
            <span>{band.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
