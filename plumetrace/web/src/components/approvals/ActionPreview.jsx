/**
 * OWNER    : Tanmay
 * DUE      : D2 16:00
 * TASK     :
 *   Preview per type: report iframe (presigned HTML) + PDF link, farmer alert text + <audio>, shift plan diff table, rider messages list. Shows verification block when present.
 * DONE WHEN: -
 * GUIDE    : docs/team/TANMAY.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : DONE
 */
export default function ActionPreview({ action }) {
  if (!action || !action.payload) return null;

  return (
    <div className="mt-4 border-t border-border pt-4">
      {action.verification && (
        <div className="mb-4 p-3 bg-accent/50 text-accent-foreground border border-accent rounded-md text-sm">
          <strong>Early Signal:</strong> {action.verification.status}
          <div className="text-xs opacity-80 mt-1">Note: Early signal, not causal proof</div>
        </div>
      )}
      
      {action.type === 'district_report' && (
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <span className="font-semibold text-sm">Report Preview</span>
            {action.payload.pdf_url && (
              <a href={action.payload.pdf_url} target="_blank" rel="noreferrer" className="text-primary hover:underline text-sm">
                Download PDF
              </a>
            )}
          </div>
          <iframe 
            src={action.payload.preview_url || 'about:blank'} 
            className="w-full h-64 border border-border rounded"
            title="Report Preview"
          />
        </div>
      )}

      {action.type === 'farmer_alert' && (
        <div className="flex flex-col gap-2">
          <span className="font-semibold text-sm">Alert Preview</span>
          <div className="p-3 bg-muted rounded-md text-sm whitespace-pre-wrap">
            {action.payload.text || action.payload.message_text}
          </div>
          {action.payload.audio_url && (
            <audio controls className="w-full mt-2" src={action.payload.audio_url}>
              Your browser does not support the audio element.
            </audio>
          )}
        </div>
      )}

      {action.type === 'shift_plan' && (
        <div className="flex flex-col gap-2">
          <span className="font-semibold text-sm">Plan Impact {action.payload.solver ? `(${action.payload.solver})` : ''}</span>
          <table className="w-full text-sm border-collapse">
            <tbody>
              <tr className="border-b border-border/50">
                <td className="py-1 text-muted-foreground">Worst-rider dose reduction</td>
                <td className="py-1 text-green-500 font-medium">−{action.payload.dose_reduction_pct?.worst_rider}%</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-1 text-muted-foreground">Fleet dose reduction</td>
                <td className="py-1 text-green-500 font-medium">−{action.payload.dose_reduction_pct?.fleet_total}%</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-1 text-muted-foreground">Extra minutes (avg / total)</td>
                <td className="py-1">+{action.payload.extra_minutes?.average} / {action.payload.extra_minutes?.total} min</td>
              </tr>
              <tr>
                <td className="py-1 text-muted-foreground">Riders changed</td>
                <td className="py-1">{action.payload.riders_changed}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {action.type === 'rider_notify' && (
        <div className="flex flex-col gap-2">
          <span className="font-semibold text-sm">Messages</span>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {Array.isArray(action.payload.messages) && action.payload.messages.length > 0 ? (
              action.payload.messages.map((m, i) => (
                <div key={i} className="p-2 border border-border rounded text-sm bg-muted">
                  <div className="font-semibold mb-1">To: {m.rider_id}</div>
                  <div>{m.text}</div>
                </div>
              ))
            ) : (
              <div className="text-sm text-muted-foreground">
                {action.payload.messages_count ?? 0} rider notification(s) drafted.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
