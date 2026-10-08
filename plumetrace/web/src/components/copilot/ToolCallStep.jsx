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
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react';

export default function ToolCallStep({ tool }) {
  const [open, setOpen] = useState(false);
  const isRunning = tool.status === 'running';

  return (
    <div className="border border-border rounded-md my-2 overflow-hidden text-sm">
      <button 
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 p-2 bg-muted hover:bg-muted/80 transition-colors"
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        {isRunning ? <Loader2 size={14} className="animate-spin" /> : null}
        <span className="font-mono font-medium">{tool.name}</span>
        <span className="text-muted-foreground ml-auto">{tool.status}</span>
      </button>
      {open && (
        <div className="p-2 bg-card border-t border-border font-mono text-xs overflow-x-auto">
          <div className="mb-1 text-muted-foreground">Input:</div>
          <pre>{JSON.stringify(tool.args, null, 2)}</pre>
          {tool.result && (
            <>
              <div className="mt-2 mb-1 text-muted-foreground">Result:</div>
              <pre>{JSON.stringify(tool.result, null, 2)}</pre>
            </>
          )}
        </div>
      )}
    </div>
  );
}
