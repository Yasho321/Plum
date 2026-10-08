/**
 * OWNER    : Tanmay
 * DUE      : D1 13:00
 * TASK     :
 *   Zustand: tokens, user, groups, login/logout.
 * DONE WHEN: -
 * GUIDE    : docs/team/TANMAY.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : DONE
 */
import { create } from 'zustand';

export const useAuthStore = create((set) => ({
  tokens: null,
  user: null,
  groups: [],
  login: (tokens, user, groups) => set({ tokens, user, groups }),
  logout: () => set({ tokens: null, user: null, groups: [] }),
}));
