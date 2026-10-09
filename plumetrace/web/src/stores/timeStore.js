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
  setLeadH: (leadH) => set({ leadH }),
  setPlaying: (playing) => set({ playing }),
  setSpeed: (speed) => set({ speed }),
  getValidHour: () => {
    const { runId, leadH } = get();
    if (!runId) return null;
    let d = new Date(runId.replace('Z', ':00:00Z')); 
    if (isNaN(d.getTime())) d = new Date(runId);
    if (isNaN(d.getTime())) return null;
    d.setUTCHours(d.getUTCHours() + leadH);
    return d.toISOString();
  }
}));
