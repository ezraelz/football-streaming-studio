import { create } from "zustand";
import { api, type EditorialCard } from "@/lib/api/client";
import { isTickerCard, zoneOf, type Zone } from "@/lib/overlay/zones";
import { STAGES } from "@/lib/overlay/stage";
import { formatPref } from "@/lib/prefs";
import { useShowStore } from "@/lib/stores/show-store";

/**
 * The rundown: every graphic for the show in one ordered list, switched with one click or key.
 * "Taking" a card puts it on air and takes the previous card in the SAME screen zone off, so the
 * picture never fills up with half-height cards. The ticker is independent (it runs along the bottom).
 */
export type BuiltInKey = "timeline" | "tactical" | "player";

interface RundownState {
  sessionId: string | null;
  cards: EditorialCard[];
  /** Index (into `items()`) the next/prev buttons move from. */
  cue: number;
  loading: boolean;
  error: string | null;
  autoOn: boolean;
  autoSec: number;
  loop: boolean;

  load: (sessionId: string) => Promise<void>;
  refresh: () => Promise<void>;
  take: (id: string) => Promise<void>;
  hide: (id: string) => Promise<void>;
  clear: () => Promise<void>;
  next: () => Promise<void>;
  prev: () => Promise<void>;
  takeAt: (index: number) => Promise<void>;
  takeBuiltIn: (key: BuiltInKey) => Promise<void>;
  remove: (id: string) => Promise<void>;
  move: (id: string, zone: Zone | "auto") => Promise<void>;
  setAuto: (patch: Partial<Pick<RundownState, "autoOn" | "autoSec" | "loop">>) => void;
  setError: (e: string | null) => void;
}

/** Cards that take turns on the main screen (the ticker is a separate always-on strip). */
export const rundownItems = (cards: EditorialCard[]) => cards.filter((c) => !isTickerCard(c));

/** The zone a card really lands in on the current output format (narrow formats have one column). */
export function effectiveZone(card: EditorialCard): Zone {
  const stage = STAGES[formatPref.read()];
  const z = zoneOf(card);
  return stage.compactBug && z !== "ticker" ? "main" : z;
}

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export const useRundown = create<RundownState>((set, get) => {
  const sid = () => {
    const id = get().sessionId;
    if (!id) throw new Error("no session");
    return id;
  };
  const patchLocal = (fn: (c: EditorialCard) => EditorialCard) =>
    set((s) => ({ cards: s.cards.map(fn) }));
  /** Run an action; on any failure re-read the truth from the server so the UI never lies. */
  const guarded = async (fn: () => Promise<unknown>) => {
    try {
      set({ error: null });
      await fn();
    } catch (e) {
      set({ error: errMsg(e) });
      await get().refresh();
    }
  };
  const resetTakeover = () => {
    const { activeScene, setScene } = useShowStore.getState();
    if (activeScene !== "scoreboard") {
      setScene("scoreboard");
      void api.setScene(get().sessionId!, "scoreboard").catch(() => {});
    }
  };

  return {
    sessionId: null, cards: [], cue: -1, loading: false, error: null,
    autoOn: false, autoSec: 8, loop: true,

    load: async (sessionId) => {
      set({ sessionId, loading: true, error: null });
      try {
        const cards = await api.listEditorialCards(sessionId);
        set({ cards, loading: false });
      } catch (e) {
        set({ loading: false, error: errMsg(e) });
      }
    },

    refresh: async () => {
      const id = get().sessionId;
      if (!id) return;
      try { set({ cards: await api.listEditorialCards(id) }); } catch { /* keep what we have */ }
    },

    take: async (id) => {
      const { cards } = get();
      const card = cards.find((c) => c.id === id);
      if (!card) return;
      if (card.visible) return get().hide(id); // clicking the card on air takes it off
      const zone = effectiveZone(card);
      const displaced = cards.filter((c) => c.visible && c.id !== id && effectiveZone(c) === zone);
      const idx = rundownItems(cards).findIndex((c) => c.id === id);
      // Optimistic: the tile turns red immediately, the server confirms in the background.
      patchLocal((c) => (c.id === id ? { ...c, visible: true } : displaced.some((d) => d.id === c.id) ? { ...c, visible: false } : c));
      if (idx >= 0) set({ cue: idx });
      if (zone === "main") resetTakeover();
      await guarded(async () => {
        const s = sid();
        await Promise.all([
          ...displaced.map((d) => api.updateEditorialCard(s, d.id, { visible: false })),
          api.broadcastEditorialCard(s, id),
        ]);
      });
    },

    hide: async (id) => {
      patchLocal((c) => (c.id === id ? { ...c, visible: false } : c));
      await guarded(() => api.updateEditorialCard(sid(), id, { visible: false }));
    },

    clear: async () => {
      patchLocal((c) => ({ ...c, visible: false }));
      set({ cue: -1 });
      resetTakeover();
      await guarded(() => api.hideAllEditorial(sid()));
    },

    takeAt: async (index) => {
      const item = rundownItems(get().cards)[index];
      if (item) await get().take(item.id);
    },

    next: async () => {
      const items = rundownItems(get().cards);
      if (!items.length) return;
      const onAir = items.findIndex((c) => c.visible);
      const from = onAir >= 0 ? onAir : get().cue;
      let i = from + 1;
      if (i >= items.length) {
        if (!get().loop) return;
        i = 0;
      }
      await get().take(items[i].id);
    },

    prev: async () => {
      const items = rundownItems(get().cards);
      if (!items.length) return;
      const onAir = items.findIndex((c) => c.visible);
      const from = onAir >= 0 ? onAir : get().cue;
      let i = from - 1;
      if (i < 0) i = get().loop ? items.length - 1 : 0;
      await get().take(items[i].id);
    },

    takeBuiltIn: async (key) => {
      const { activeScene, setScene } = useShowStore.getState();
      const on = activeScene === key;
      const next = on ? "scoreboard" : key;
      if (!on) {
        // A full-screen view owns the main area: take main-zone cards off first.
        const mains = get().cards.filter((c) => c.visible && effectiveZone(c) === "main");
        patchLocal((c) => (mains.some((m) => m.id === c.id) ? { ...c, visible: false } : c));
        void Promise.all(mains.map((m) => api.updateEditorialCard(sid(), m.id, { visible: false }))).catch(() => {});
      }
      setScene(next);
      await guarded(() => api.setScene(sid(), next));
    },

    remove: async (id) => {
      set((s) => ({ cards: s.cards.filter((c) => c.id !== id) }));
      await guarded(() => api.deleteEditorialCard(sid(), id));
    },

    move: async (id, zone) => {
      const c = get().cards.find((x) => x.id === id);
      if (!c) return;
      const { zone: _old, ...rest } = c.payload as Record<string, unknown>;
      const payload = zone === "auto" ? rest : { ...rest, zone };
      patchLocal((x) => (x.id === id ? { ...x, payload } : x));
      await guarded(() => api.updateEditorialCard(sid(), id, { payload }));
    },

    setAuto: (patch) => set(patch),
    setError: (e) => set({ error: e }),
  };
});
