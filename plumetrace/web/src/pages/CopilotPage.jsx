/**
 * OWNER    : Tanmay
 * DUE      : D2 14:00
 * TASK     :
 *   Full-screen CopilotPanel.
 * DONE WHEN: -
 * GUIDE    : docs/team/TANMAY.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : DONE
 */
import { Sparkles, Eraser } from 'lucide-react';
import CopilotPanel from '../components/copilot/CopilotPanel';
import { useCopilotStore } from '../stores/copilotStore';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';

export default function CopilotPage() {
  const { messages, clear, streaming } = useCopilotStore();
  return (
    <div className="h-full w-full max-w-3xl mx-auto flex flex-col">
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2.5">
          <span className="grid place-items-center w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-lg shadow-primary/20">
            <Sparkles size={16} aria-hidden />
          </span>
          <div>
            <h1 className="text-base font-bold tracking-tight leading-none">Copilot</h1>
            <p className="text-[11px] text-muted-foreground mt-1">Drafts actions for your approval — never sends them.</p>
          </div>
          <Badge tone="brand" size="sm" className="ml-1">Human-approved</Badge>
        </div>
        {messages.length > 0 && (
          <Button variant="ghost" size="sm" onClick={clear} disabled={streaming}>
            <Eraser size={14} aria-hidden /> Clear
          </Button>
        )}
      </div>
      <div className="flex-1 min-h-0">
        <CopilotPanel />
      </div>
    </div>
  );
}
