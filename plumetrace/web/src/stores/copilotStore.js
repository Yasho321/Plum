/**
 * OWNER    : Tanmay
 * DUE      : D2 10:00
 * TASK     :
 *   Zustand: messages[], streaming, tool steps; send(prompt) uses lib/sse.js.
 * DONE WHEN: -
 * GUIDE    : docs/team/TANMAY.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : DONE
 */
import { create } from 'zustand';
import { streamChat } from '../lib/sse';

export const useCopilotStore = create((set, get) => ({
  messages: [],
  streaming: false,
  
  sendMessage: async (content) => {
    const userMsg = { role: 'user', content };
    set(state => ({ 
      messages: [...state.messages, userMsg],
      streaming: true
    }));

    try {
      const iterator = streamChat(get().messages);
      let assistantMsg = { role: 'assistant', content: '', tools: [] };
      
      set(state => ({
        messages: [...state.messages, assistantMsg]
      }));

      for await (const event of iterator) {
        set(state => {
          const newMessages = [...state.messages];
          const lastMsg = newMessages[newMessages.length - 1];
          
          if (event.type === 'text') {
            lastMsg.content += event.content || '';
          } else if (event.type === 'tool_call') {
            lastMsg.tools = lastMsg.tools || [];
            lastMsg.tools.push({ id: event.id, name: event.name, args: event.args, status: 'running' });
          } else if (event.type === 'tool_result') {
            const tool = lastMsg.tools?.find(t => t.id === event.id);
            if (tool) {
              tool.result = event.result;
              tool.status = 'done';
            }
          } else if (event.type === 'action_drafted') {
            lastMsg.draftId = event.draft_id;
          }
          
          return { messages: newMessages };
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      set({ streaming: false });
    }
  },
  
  clear: () => set({ messages: [], streaming: false })
}));
