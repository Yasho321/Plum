/**
 * OWNER    : Tanmay
 * DUE      : D1 15:00
 * TASK     :
 *   Zustand: runId, leadH 0..72, playing, speed; derived validHour.
 * DONE WHEN: -
 * GUIDE    : docs/team/TANMAY.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : DONE
 */
import { create } from 'zustand';

export const useTimeStore = create((set, get) => ({
  runId: null,
  leadH: 0,
  playing: false,
  speed: 1,
  setRunId: (runId) => set({ runId }),
  // Support both setLeadH(5) and setLeadH(prev => prev + 1) (the play loop uses the latter).
  setLeadH: (v) => set((s) => ({ leadH: typeof v === 'function' ? v(s.leadH) : v })),
  setPlaying: (playing) => set({ playing }),
  setSpeed: (speed) => set({ speed }),
  getValidHour: () => {
    const { runId, leadH } = get();
    if (!runId) return null;
    let d = new Date(runId.replace('Z', ':00:00Z')); 
    if (isNaN(d.getTime())) d = new Date(runId);
    if (isNaN(d.getTime())) return null;
    d.setUTCHours(d.getUTCHours() + leadH);
    // Contract valid_hour is minute-precision with Z: "2026-10-10T02:00Z".
    return d.toISOString().slice(0, 16) + 'Z';
  }
}));
