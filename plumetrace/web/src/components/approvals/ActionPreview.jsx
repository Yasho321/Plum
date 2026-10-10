/**
 * OWNER    : Tanmay
 * DUE      : D2 16:00
 * TASK     :
 *   Preview per type: report iframe (presigned HTML) + PDF link, farmer alert text + <audio>, shift plan diff table, rider messages list. Shows verification block when present.
 * DONE WHEN: -
 * GUIDE    : docs/team/TANMAY.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : DONE
 */
import { Download, Activity } from 'lucide-react';

function Row({ label, value, tone }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`tnum font-medium ${tone || ''}`}>{value}</span>
    </div>
  );
}

export default function ActionPreview({ action }) {
  if (!action?.payload) return null;
  const p = action.payload;

  return (
    <div className="mt-4 border-t border-border pt-4">
      {action.verification && (
        <div className="mb-4 flex items-start gap-2 p-3 rounded-[var(--radius)] bg-success/10 text-success border border-success/25 text-sm">
          <Activity size={15} className="mt-0.5 shrink-0" aria-hidden />
          <div>
            <span className="font-semibold">Early signal:</span> <span className="text-foreground/90">{action.verification.status}</span>
            <div className="text-xs text-success/70 mt-0.5">Early signal, not causal proof.</div>
          </div>
        </div>
      )}

      {action.type === 'district_report' && (
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <span className="font-semibold text-sm">Report preview</span>
            {p.pdf_url && (
              <a href={p.pdf_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:text-primary-strong text-sm">
                <Download size={14} aria-hidden /> PDF
              </a>
            )}
          </div>
          <iframe src={p.preview_url || 'about:blank'} className="w-full h-64 border border-border rounded-[var(--radius)] bg-background" title="Report preview" />
        </div>
      )}

      {action.type === 'farmer_alert' && (
        <div className="flex flex-col gap-2">
          <span className="font-semibold text-sm">Alert preview</span>
          <div className="p-3 rounded-[var(--radius)] bg-secondary border border-border text-sm whitespace-pre-wrap leading-relaxed">
            {p.text || p.message_text}
          </div>
          <p className="text-[11px] text-muted-foreground">Supportive guidance — never blaming, and no individual is named.</p>
          {p.audio_url && <audio controls className="w-full mt-1" src={p.audio_url}>Your browser does not support audio.</audio>}
        </div>
      )}

      {action.type === 'shift_plan' && (
        <div className="flex flex-col gap-1">
          <span className="font-semibold text-sm mb-1">Plan impact {p.solver ? <span className="text-muted-foreground font-normal">({p.solver})</span> : ''}</span>
          <Row label="Worst-rider dose reduction" value={`−${p.dose_reduction_pct?.worst_rider}%`} tone="text-success" />
          <Row label="Fleet dose reduction" value={`−${p.dose_reduction_pct?.fleet_total}%`} tone="text-success" />
          <Row label="Extra minutes (avg / total)" value={`+${p.extra_minutes?.average} / ${p.extra_minutes?.total} min`} />
          <Row label="Riders changed" value={p.riders_changed} />
        </div>
      )}

      {action.type === 'rider_notify' && (
        <div className="flex flex-col gap-2">
          <span className="font-semibold text-sm">Messages</span>
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {Array.isArray(p.messages) && p.messages.length > 0 ? (
              p.messages.map((m, i) => (
                <div key={i} className="p-2.5 rounded-[var(--radius)] border border-border bg-secondary text-sm">
                  <div className="text-[11px] font-semibold text-muted-foreground mb-1">To {m.rider_id}</div>
                  <div>{m.text}</div>
                </div>
              ))
            ) : (
              <div className="text-sm text-muted-foreground">{p.messages_count ?? 0} rider notification(s) drafted.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
