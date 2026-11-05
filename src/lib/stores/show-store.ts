"use client";
import { create } from "zustand";
import {
  ShowSession, MatchSnapshot, MatchEvent, CommentaryItem, DataFreshness,
  ShowLogEntry, LogKind, ShowProfile, 
} from "@/lib/types/types";
import { mockSnapshot, mockEvents, mockCommentary } from "@/lib/mock/fixtures";
import type { LogEntry } from "@/lib/api/client";

export type CommentaryMode = "off" | "suggest" | "approval" | "auto";
export type ControllerState =
  | "configured" | "armed" | "live" | "paused" | "degraded" | "stopped";

interface CommentaryConfig {
  mode?: CommentaryMode;
  voice?: string;
  language?: string;
}

export interface AutomationAction {
  type: "show_scene" | "update_scoreboard" | "generate_commentary" | "speak_if_enabled";
  sceneId?: string;
  template?: string;
}

export interface AppSettings {
  apiBase: string;
  providerName: string;
  staleThresholdSeconds: number;
  obsUrl: string;
  obsConnected: boolean;
}

export interface AutomationRule {
  ruleId: string;
  label: string;
  enabled: boolean;
  trigger: {
    eventType: "goal" | "card" | "substitution" | "half_time" | "full_time" | "feed_stale";
    requiredStatus?: "confirmed" | "provisional";
  };
  actions: AutomationAction[];
  guards: {
    deduplicateEvent: boolean;
    requireFreshMatchState: boolean;
    cooldownSeconds: number;
  };
}

interface ShowStore {
  session: ShowSession | null;
  snapshot: MatchSnapshot | null;
  events: MatchEvent[];
  suggestions: CommentaryItem[];
  transcript: CommentaryItem[];
  activeScene: string;
  overlayToken: string | null;

  commentaryMode: CommentaryMode;
  voice: string;
  language: string;

  settings: AppSettings;
  updateSettings: (patch: Partial<AppSettings>) => void;

  controllerState: ControllerState;
  rules: AutomationRule[];

  profiles: ShowProfile[];
  createProfile: (p: Omit<ShowProfile, "id">) => ShowProfile;
  updateProfile: (id: string, patch: Partial<ShowProfile>) => void;
  deleteProfile: (id: string) => void;

  logEntries: ShowLogEntry[];

  serverLog: LogEntry[];
  setServerLog: (entries: LogEntry[]) => void;
  prependServerLog: (entry: LogEntry) => void;

  setSession: (s: ShowSession) => void;
  loadMock: (profileId?: string) => void;
  applyEvent: (e: MatchEvent) => void;
  setFreshness: (f: DataFreshness) => void;
  setScene: (s: string) => void;
  approve: (id: string) => void;
  skip: (id: string) => void;
  regenerate: (id: string) => void;
  setCommentaryMode: (m: CommentaryMode) => void;
  setVoice: (v: string) => void;
  setLanguage: (l: string) => void;
  emergencyStop: () => void;

  setControllerState: (s: ControllerState) => void;
  toggleRule: (ruleId: string) => void;
  updateRule: (ruleId: string, patch: Partial<AutomationRule>) => void;
  addRule: (rule: AutomationRule) => void;
  removeRule: (ruleId: string) => void;

  log: (
    kind: LogKind,
    message: string,
    opts?: { severity?: "info" | "warn" | "error"; detail?: Record<string, unknown> }
  ) => void;
  clearLog: () => void;
}

export const DEFAULT_RULES: AutomationRule[] = [
  {
    ruleId: "confirmed-goal",
    label: "Confirmed goal",
    enabled: true,
    trigger: { eventType: "goal", requiredStatus: "confirmed" },
    actions: [
      { type: "update_scoreboard" },
      { type: "show_scene", sceneId: "scoreboard" },
      { type: "generate_commentary", template: "goal_short" },
      { type: "speak_if_enabled" },
    ],
    guards: { deduplicateEvent: true, requireFreshMatchState: true, cooldownSeconds: 8 },
  },
  {
    ruleId: "half-time",
    label: "Half-time summary",
    enabled: true,
    trigger: { eventType: "half_time" },
    actions: [
      { type: "show_scene", sceneId: "stats" },
      { type: "generate_commentary", template: "first_half_summary" },
      { type: "speak_if_enabled" },
    ],
    guards: { deduplicateEvent: true, requireFreshMatchState: true, cooldownSeconds: 30 },
  },
  {
    ruleId: "substitution",
    label: "Substitution",
    enabled: true,
    trigger: { eventType: "substitution", requiredStatus: "confirmed" },
    actions: [
      { type: "show_scene", sceneId: "player" },
      { type: "generate_commentary", template: "substitution_line" },
    ],
    guards: { deduplicateEvent: true, requireFreshMatchState: true, cooldownSeconds: 20 },
  },
  {
    ruleId: "feed-stale",
    label: "Feed becomes stale",
    enabled: true,
    trigger: { eventType: "feed_stale" },
    actions: [{ type: "show_scene", sceneId: "scoreboard" }],
    guards: { deduplicateEvent: false, requireFreshMatchState: false, cooldownSeconds: 60 },
  },
];

export const useShowStore = create<ShowStore>((set, get) => ({
  session: null,
  snapshot: null,
  events: [],
  suggestions: [],
  transcript: [],
  activeScene: "scoreboard",
  overlayToken: null,
  commentaryMode: "approval",
  voice: "en-US-Neural-A",
  language: "en",
  controllerState: "configured",
  rules: DEFAULT_RULES,
  logEntries: [],

  profiles: [
    {
      id: "show-1",
      name: "Weekly PL Review",
      mode: "human",
      theme_config: { primary: "#10b981", accent: "#3b82f6", logo: null },
      commentary_config: { mode: "approval", voice: "en-US-Neural-A", language: "en" },
    },
    {
      id: "show-2",
      name: "Automated Matchday",
      mode: "automated",
      theme_config: { primary: "#f59e0b", accent: "#ef4444", logo: null },
      commentary_config: { mode: "auto", voice: "en-GB-Neural-B", language: "en" },
    },
  ],

  settings: {
    apiBase: "http://localhost:8000",
    providerName: "Sportmonks (mock)",
    staleThresholdSeconds: 30,
    obsUrl: "ws://localhost:4455",
    obsConnected: false,
  },

  setSession: (session) => set({ session }),

  loadMock: (profileId) => {
    const profile = profileId
      ? get().profiles.find((p) => p.id === profileId)
      : get().profiles[0];
    const now = new Date().toISOString();
    const seed: ShowLogEntry[] = [
      { id: "l0", sessionId: "sess-mock", kind: "data",       severity: "info", message: "Match provider connected",        timestamp: now },
      { id: "l1", sessionId: "sess-mock", kind: "scene",      severity: "info", message: "Scene → scoreboard",              timestamp: now },
      { id: "l2", sessionId: "sess-mock", kind: "commentary", severity: "info", message: "Generated: goal_short (ev-1)",    timestamp: now },
      { id: "l3", sessionId: "sess-mock", kind: "commentary", severity: "info", message: "Played: Saka opens the scoring",  timestamp: now },
      { id: "l4", sessionId: "sess-mock", kind: "data",       severity: "warn", message: "Provider freshness: stale (12s)", timestamp: now },
      { id: "l5", sessionId: "sess-mock", kind: "data",       severity: "info", message: "Provider freshness: fresh",       timestamp: now },
      { id: "l6", sessionId: "sess-mock", kind: "override",   severity: "info", message: "Operator skipped suggested line", timestamp: now },
      { id: "l7", sessionId: "sess-mock", kind: "commentary", severity: "info", message: "Generated: goal_short (ev-4)",    timestamp: now },
      { id: "l8", sessionId: "sess-mock", kind: "scene",      severity: "info", message: "Scene → scoreboard",              timestamp: now },
    ];

    const cc = (profile?.commentary_config ?? {}) as CommentaryConfig;

  set({
    session: {
      id: "sess-mock",
      show_profile_id: profile?.id ?? "show-1",
      match_id: "match-001",
      mode: profile?.mode ?? "human",
      state: "live",
      started_at: now,
      stopped_at: null,
      overlay_token: "mock-token-123",
      created_at: now,
    },
    snapshot: mockSnapshot,
    events: mockEvents,
    suggestions: mockCommentary(),
    activeScene: "scoreboard",
    overlayToken: "mock-token-123",
    controllerState: "live",
    logEntries: seed,
    commentaryMode: cc.mode ?? "approval",
    voice: cc.voice ?? "en-US-Neural-A",
    language: cc.language ?? "en",
  });
},

  applyEvent: (event) => set((s) => {
    if (s.events.some((e) => e.eventId === event.eventId)) return s;
    return { events: [...s.events, event] };
  }),

  setScene: (activeScene) => {
    set({ activeScene });
    get().log("scene", `Scene → ${activeScene}`);
  },

  approve: (id) => {
    const s = get();
    const item = s.suggestions.find((c) => c.id === id);
    if (!item) return;
    set({
      suggestions: s.suggestions.filter((c) => c.id !== id),
      transcript: [{ ...item, status: "played" }, ...s.transcript],
    });
    get().log(
      "commentary",
      `Played: ${item.text.slice(0, 70)}${item.text.length > 70 ? "…" : ""}`
    );
  },

  skip: (id) => {
    const s = get();
    const item = s.suggestions.find((c) => c.id === id);
    if (!item) return;
    set({
      suggestions: s.suggestions.filter((c) => c.id !== id),
      transcript: [{ ...item, status: "skipped" }, ...s.transcript],
    });
    get().log("override", "Operator skipped suggested line");
  },

  regenerate: (id) => set((s) => ({
    suggestions: s.suggestions.map((c) =>
      c.id === id
        ? { ...c, text: `${c.text} (regenerated)`, status: "pending_approval" }
        : c
    ),
  })),

  setCommentaryMode: (commentaryMode) => set({ commentaryMode }),
  setVoice: (voice) => set({ voice }),
  setLanguage: (language) => set({ language }),

  setFreshness: (freshness) => {
    set((s) => ({ snapshot: s.snapshot ? { ...s.snapshot, freshness } : null }));
    get().log("data", `Provider freshness: ${freshness}`, {
      severity: freshness === "fresh" ? "info" : "warn",
    });
  },

  setControllerState: (controllerState) => {
    set({ controllerState });
    get().log("override", `Controller → ${controllerState}`);
  },

  toggleRule: (ruleId) => set((s) => ({
    rules: s.rules.map((r) => r.ruleId === ruleId ? { ...r, enabled: !r.enabled } : r),
  })),

  updateRule: (ruleId, patch) => set((s) => ({
    rules: s.rules.map((r) => r.ruleId === ruleId ? { ...r, ...patch } : r),
  })),

  addRule: (rule) => set((s) => ({ rules: [...s.rules, rule] })),

  removeRule: (ruleId) => set((s) => ({
    rules: s.rules.filter((r) => r.ruleId !== ruleId),
  })),

  emergencyStop: () => {
    set((s) => ({
      session: s.session ? { ...s.session, state: "stopped" } : null,
      controllerState: "stopped",
      activeScene: "scoreboard",
      suggestions: [],
    }));
    get().log("override", "EMERGENCY STOP engaged", { severity: "error" });
  },

  log: (kind, message, opts) => set((s) => ({
    logEntries: [
      ...s.logEntries,
      {
        id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        sessionId: s.session?.id ?? "sess-mock",
        kind,
        severity: opts?.severity ?? "info",
        message,
        detail: opts?.detail,
        timestamp: new Date().toISOString(),
      },
    ],
  })),

  createProfile: (p) => {
    const id = `show-${Date.now()}`;
    const profile: ShowProfile = { id, ...p };
    set((s) => ({ profiles: [...s.profiles, profile] }));
    return profile;
  },

  updateProfile: (id, patch) => set((s) => ({
    profiles: s.profiles.map((p) => p.id === id ? { ...p, ...patch } : p),
  })),

  deleteProfile: (id) => set((s) => ({
    profiles: s.profiles.filter((p) => p.id !== id),
  })),

  updateSettings: (patch) => set((s) => ({
    settings: { ...s.settings, ...patch },
  })),

  clearLog: () => set({ logEntries: [] }),
  serverLog: [],
  setServerLog: (entries) => set({ serverLog: entries }),
  prependServerLog: (entry) => set((s) => ({
    serverLog: [entry, ...s.serverLog],
  })),
}));

