/**
 * OWNER    : Tanmay
 * DUE      : D2 12:00
 * TASK     :
 *   Collapsible step: tool name, input JSON, result summary, spinner while running.
 * DONE WHEN: -
 * GUIDE    : docs/team/TANMAY.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : DONE
 */
import { useState } from 'react';
import { ChevronRight, Loader2, Wrench, Check } from 'lucide-react';

export default function ToolCallStep({ tool }) {
  const [open, setOpen] = useState(false);
  const running = tool.status === 'running';

  return (
    <div className="border border-border rounded-[var(--radius)] my-2 overflow-hidden bg-background/40">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary/50 transition-colors"
      >
        <ChevronRight size={14} className={`text-muted-foreground transition-transform ${open ? 'rotate-90' : ''}`} aria-hidden />
        {running ? (
          <Loader2 size={14} className="animate-spin text-primary" aria-hidden />
        ) : (
          <Wrench size={13} className="text-muted-foreground" aria-hidden />
        )}
        <span className="font-mono text-xs font-medium">{tool.name}</span>
        <span className={`ml-auto inline-flex items-center gap-1 text-[11px] ${running ? 'text-primary' : 'text-success'}`}>
          {running ? 'running' : <><Check size={12} aria-hidden /> done</>}
        </span>
      </button>
      {open && (
        <div className="px-3 py-2 border-t border-border font-mono text-[11px] overflow-x-auto bg-background/60">
          <div className="text-muted-foreground mb-1">Input</div>
          <pre className="text-foreground/90">{JSON.stringify(tool.args, null, 2)}</pre>
          {tool.result != null && (
            <>
              <div className="text-muted-foreground mt-2 mb-1">Result</div>
              <pre className="text-foreground/90">{JSON.stringify(tool.result, null, 2)}</pre>
            </>
          )}
        </div>
      )}
    </div>
  );
}
