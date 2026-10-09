/**
 * OWNER    : Tanmay
 * DUE      : D2 14:00
 * TASK     :
 *   Chat UI (react-markdown), streaming text, ToolCallStep list, drafted actions rendered as cards with 'Review in Approvals' link. Suggested prompt: 'Tomorrow morning looks severe. What should we do?'
 * DONE WHEN: Mock chat_stream replays nicely.
 * GUIDE    : docs/team/TANMAY.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : DONE
 */
import { useState, useRef, useEffect } from 'react';
import { useCopilotStore } from '../../stores/copilotStore';
import ToolCallStep from './ToolCallStep';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Link } from 'react-router-dom';
import { Sparkles, ArrowUp, ArrowRight, FileText } from 'lucide-react';
import { cn } from '../../lib/cn';

const SUGGESTIONS = [
  'Tomorrow morning looks severe. What should we do?',
  'Generate a district report for the latest run.',
  'Which riders are over budget, and how do we fix it?',
];

export default function CopilotPanel() {
  const { messages, streaming, sendMessage } = useCopilotStore();
  const [input, setInput] = useState('');
  const endRef = useRef(null);
  const taRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streaming]);

  const submit = () => {
    const v = input.trim();
    if (!v || streaming) return;
    sendMessage(v);
    setInput('');
    if (taRef.current) taRef.current.style.height = 'auto';
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto p-4 sm:p-5 flex flex-col gap-4" aria-live="polite" aria-busy={streaming}>
        {messages.length === 0 && (
          <div className="m-auto max-w-md text-center flex flex-col items-center gap-5 pt-fade-in">
            <div className="grid place-items-center w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-lg shadow-primary/20">
              <Sparkles size={24} aria-hidden />
            </div>
            <div>
              <p className="font-semibold">Ask about the forecast</p>
              <p className="text-sm text-muted-foreground mt-1">Draft reports, farmer alerts or a shift plan — you approve before anything is sent.</p>
            </div>
            <div className="flex flex-col gap-2 w-full">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="group text-left text-sm rounded-[var(--radius)] border border-border bg-card px-4 py-3 hover:border-primary/50 transition-colors flex items-center justify-between gap-3"
                >
                  <span>{s}</span>
                  <ArrowRight size={15} className="text-muted-foreground group-hover:text-primary transition-colors shrink-0" aria-hidden />
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={cn('flex flex-col max-w-[88%] pt-fade-in', m.role === 'user' ? 'ml-auto items-end' : 'mr-auto items-start')}>
            <div
              className={cn(
                'px-4 py-3 rounded-2xl text-sm',
                m.role === 'user'
                  ? 'bg-primary text-primary-foreground rounded-br-sm'
                  : 'pt-card rounded-bl-sm w-full'
              )}
            >
              {m.content && (
                <div className="prose-copilot [&>p]:mb-2 [&>p:last-child]:mb-0 [&>ul]:list-disc [&>ul]:pl-5 [&>ul]:space-y-1 [&>ol]:list-decimal [&>ol]:pl-5 [&>h3]:font-bold [&>h3]:mt-2 [&_strong]:font-semibold [&_code]:text-xs [&_code]:bg-secondary [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                </div>
              )}
              {m.tools?.map((tool, idx) => <ToolCallStep key={idx} tool={tool} />)}
              {m.draftId && (
                <div className="mt-3 p-3 rounded-[var(--radius)] bg-secondary border border-border">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <FileText size={15} className="text-primary" aria-hidden /> Action drafted
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 mb-2.5 font-mono">{m.draftId}</p>
                  <Link to="/approvals" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-strong">
                    Review in Approvals <ArrowRight size={13} aria-hidden />
                  </Link>
                </div>
              )}
            </div>
          </div>
        ))}

        {streaming && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground mr-auto" aria-label="Copilot is responding">
            <span className="flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-primary pt-pulse-dot" />
              <span className="w-1.5 h-1.5 rounded-full bg-primary pt-pulse-dot" style={{ animationDelay: '0.3s' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-primary pt-pulse-dot" style={{ animationDelay: '0.6s' }} />
            </span>
            Thinking…
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="p-3 sm:p-4 border-t border-border">
        <div className="relative flex items-end gap-2 rounded-[var(--radius-lg)] border border-border bg-card focus-within:border-primary/50 transition-colors p-2">
          <textarea
            ref={taRef}
            rows={1}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
            }}
            onKeyDown={onKeyDown}
            placeholder="Ask Copilot… (Enter to send, Shift+Enter for a new line)"
            disabled={streaming}
            aria-label="Message to Copilot"
            className="flex-1 resize-none bg-transparent px-2 py-1.5 text-sm focus:outline-none disabled:opacity-50 max-h-40"
          />
          <button
            onClick={submit}
            disabled={!input.trim() || streaming}
            aria-label="Send message"
            className="grid place-items-center w-9 h-9 shrink-0 rounded-[var(--radius)] bg-primary text-primary-foreground hover:bg-primary-strong disabled:opacity-40 transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
          >
            <ArrowUp size={17} aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}
