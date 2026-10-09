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
import { Link } from 'react-router-dom';

export default function CopilotPanel() {
  const { messages, streaming, sendMessage } = useCopilotStore();
  const [input, setInput] = useState('');
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streaming]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim() || streaming) return;
    sendMessage(input.trim());
    setInput('');
  };

  return (
    <div className="flex flex-col h-full bg-background border-l border-border">
      <div className="flex-1 overflow-auto p-4 flex flex-col gap-4">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground my-auto flex flex-col items-center">
            <p className="mb-4">How can I help you today?</p>
            <button 
              onClick={() => sendMessage("Tomorrow morning looks severe. What should we do?")}
              className="text-sm bg-secondary text-secondary-foreground px-4 py-2 rounded-md hover:bg-secondary/80 transition-colors max-w-xs"
            >
              "Tomorrow morning looks severe. What should we do?"
            </button>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex flex-col max-w-[90%] ${m.role === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'}`}>
            <div className={`p-3 rounded-lg ${m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
              <ReactMarkdown className="text-sm [&>p]:mb-2 [&>ul]:list-disc [&>ul]:pl-5 [&>h3]:font-bold [&>h3]:mt-2">
                {m.content}
              </ReactMarkdown>
              {m.tools?.map((tool, idx) => (
                <ToolCallStep key={idx} tool={tool} />
              ))}
              {m.draftId && (
                <div className="mt-3 p-3 bg-card border border-border rounded-md shadow-sm text-card-foreground">
                  <p className="font-semibold text-sm mb-2">Action Drafted: {m.draftId}</p>
                  <Link 
                    to="/approvals" 
                    className="text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded hover:opacity-90 inline-block font-medium"
                  >
                    Review in Approvals
                  </Link>
                </div>
              )}
            </div>
          </div>
        ))}
        {streaming && (
          <div className="text-muted-foreground text-sm flex items-center gap-2">
            <span className="animate-pulse">●</span> Copilot is thinking...
          </div>
        )}
        <div ref={endRef} />
      </div>
      
      <form onSubmit={handleSubmit} className="p-4 border-t border-border flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask Copilot..."
          disabled={streaming}
          className="flex-1 px-3 py-2 border border-input rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
        />
        <button 
          type="submit" 
          disabled={!input.trim() || streaming}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md disabled:opacity-50 hover:bg-primary/90 transition-colors"
        >
          Send
        </button>
      </form>
    </div>
  );
}
