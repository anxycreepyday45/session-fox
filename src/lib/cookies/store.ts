import { create } from "zustand";
import { persist } from "zustand/middleware";
import { parseCookieText } from "./parse";
import { slugName } from "./health";
import type { SavedSession } from "./types";

type SessionState = {
  sessions: SavedSession[];
  selectedId: string | null;
  hydrated: boolean;
  setHydrated: () => void;
  select: (id: string | null) => void;
  addFromText: (text: string, fileName: string) => SavedSession;
  rename: (id: string, name: string) => void;
  remove: (id: string) => void;
  clearAll: () => void;
};

function newId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      sessions: [],
      selectedId: null,
      hydrated: false,
      setHydrated: () => set({ hydrated: true }),
      select: (id) => set({ selectedId: id }),
      addFromText: (text, fileName) => {
        const parsed = parseCookieText(text);
        const session: SavedSession = {
          id: newId(),
          name: slugName(fileName),
          fileName,
          rawText: text,
          cookies: parsed.cookies,
          format: parsed.format,
          warnings: parsed.warnings,
          addedAt: Date.now(),
        };
        set({
          sessions: [session, ...get().sessions],
          selectedId: session.id,
        });
        return session;
      },
      rename: (id, name) =>
        set({
          sessions: get().sessions.map((s) =>
            s.id === id ? { ...s, name: name.trim() || s.name } : s,
          ),
        }),
      remove: (id) => {
        const next = get().sessions.filter((s) => s.id !== id);
        const selectedId =
          get().selectedId === id ? (next[0]?.id ?? null) : get().selectedId;
        set({ sessions: next, selectedId });
      },
      clearAll: () => set({ sessions: [], selectedId: null }),
    }),
    {
      name: "sessionfox-v1",
      skipHydration: true,
      partialize: (s) => ({
        sessions: s.sessions,
        selectedId: s.selectedId,
      }),
    },
  ),
);
