import type {
  MatchSnapshot, MatchEvent, ShowProfile, ShowSession,
} from "@/lib/types/types";

const BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";

const ACCESS_KEY = "fss.access_token";
const REFRESH_KEY = "fss.refresh_token";

function isBrowser() {
  return typeof window !== "undefined";
}

let accessToken: string | null = isBrowser()
  ? sessionStorage.getItem(ACCESS_KEY)
  : null;
let refreshToken: string | null = isBrowser()
  ? sessionStorage.getItem(REFRESH_KEY)
  : null;

export function setTokens(access: string, refresh?: string) {
  accessToken = access;
  if (isBrowser()) sessionStorage.setItem(ACCESS_KEY, access);
  if (refresh !== undefined) {
    refreshToken = refresh;
    if (isBrowser()) sessionStorage.setItem(REFRESH_KEY, refresh);
  }
}

export function clearTokens() {
  accessToken = null;
  refreshToken = null;
  if (isBrowser()) {
    sessionStorage.removeItem(ACCESS_KEY);
    sessionStorage.removeItem(REFRESH_KEY);
  }
}

export function hasAccessToken() {
  return !!accessToken;
}

// --- request wrapper ---
class ApiError extends Error {
  constructor(public status: number, public body: unknown) {
    super(`API ${status}`);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

  const res = await fetch(`${BASE}/api/v1${path}`, {
    ...init,
    headers,
    credentials: "include",
  });

  if (res.status === 401 && refreshToken) {
    const ok = await tryRefresh();
    if (ok) return request<T>(path, init);
  }

  if (!res.ok) {
    let body: unknown = null;
    try { body = await res.json(); } catch { /* noop */ }
    throw new ApiError(res.status, body);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

async function tryRefresh(): Promise<boolean> {
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${BASE}/api/v1/auth/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh: refreshToken }),
    });
    if (!res.ok) { clearTokens(); return false; }
    const data = await res.json();
    setTokens(data.access);
    return true;
  } catch {
    clearTokens();
    return false;
  }
}

// --- types ---

export interface LoginResponse { access: string; refresh: string }

export interface Fixture {
  id: string;
  competition: string;
  leagueId: string;   // new — empty string for unknown
  home: TeamRef;
  away: TeamRef;
  kickoff: string;
  status: string;
  coverage: Record<string, boolean>;
}

export interface TeamRef {
  id: string;
  name: string;
  shortName: string;
  color: string;
  crestUrl?: string | null;
}

export interface OverlayState {
  session_id: string;
  /** League name, used to theme the graphics (optional). */
  competition?: string;
  /** Scene currently selected in the studio (optional). Lets a single OBS source follow scene changes. */
  scene_id?: string | null;
  /** Cards currently on air (optional). Lets OBS restore graphics after a reload / scene switch. */
  editorial_cards?: EditorialCard[];
  state: "configured" | "armed" | "live" | "paused" | "degraded" | "stopped";
  match_id: string;
  home: TeamRef;
  away: TeamRef;
  snapshot: {
    score: { home: number; away: number };
    period: string;
    minute: number;
    stats: Record<string, { home: number; away: number }>;
    providerUpdatedAt: string;
    receivedAt: string;
  } | null;
  events: Array<{
    eventId: string;
    type: string;
    teamId: string;
    playerName: string | null;
    minute: number;
    status: string;
  }>;
  active_commentary: {
    id: string;
    text: string;
    priority: string;
    expires_at: string;
  } | null;
}

export interface LogEntry {
  id: string;
  kind: "data" | "commentary" | "scene" | "override" | "error";
  severity: "info" | "warn" | "error";
  message: string;
  detail: Record<string, unknown>;
  created_at: string;
}

export interface CommentaryItem {
  id: string;
  trigger_event_id: string | null;
  mode: "suggestion" | "auto";
  status:
    | "pending_approval" | "approved" | "queued" | "playing"
    | "played" | "skipped" | "expired" | "cancelled" | "failed";
  text: string;
  language: string;
  priority: "low" | "normal" | "high";
  source_facts: Record<string, unknown>;
  model_version: string;
  expires_at: string;
  created_at: string;
}

export interface AutomationRule {
  id: string;
  show_profile_id: string;
  label: string;
  enabled: boolean;
  event_type: string;
  required_status: string;
  actions: Array<{ type: string; sceneId?: string; template?: string }>;
  deduplicate_event: boolean;
  require_fresh_match_state: boolean;
  cooldown_seconds: number;
  created_at: string;
  updated_at: string;
}

export interface SpeechJob {
  id: string;
  commentary_id: string;
  status: "queued" | "synthesized" | "played" | "failed" | "expired";
  provider: string;
  audio_url: string;
  duration_seconds: number | null;
  created_at: string;
  played_at: string | null;
}

export interface EditorialCard {
  id: string;
  session_id: string;
  card_type:
    | "fixture_intro" | "lineups" | "standings" | "form"
    | "head_to_head" | "top_scorers" | "match_summary"
    | "countdown" | "custom";
  title: string;
  payload: Record<string, unknown>;
  visible: boolean;
  created_at: string;
  updated_at: string;
}

export interface H2HMeeting {
  date: string;
  home_team: string;
  away_team: string;
  score: string;
  competition: string;
}

export interface TeamFixture {
  match_id: string;
  competition: string;
  home_short: string;
  away_short: string;
  home_name: string;
  away_name: string;
  kickoff: string;
  venue: string | null;
}

export interface Prediction {
  match_id: string;
  team_a: string;
  team_b: string;
  probabilities: { home_win: number; draw: number; away_win: number } | null;
  sample_size: number;
  raw_counts?: { wins_a: number; draws: number; wins_b: number };
  model_version: string;
  timestamp: string;
  reason?: string;
}

// --- typed surface ---

export const api = {
  async login(username: string, password: string): Promise<LoginResponse> {
    const res = await fetch(`${BASE}/api/v1/auth/token/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) throw new ApiError(res.status, await res.text());
    const data = await res.json();
    setTokens(data.access, data.refresh);
    return data;
  },

  fixtures: () => request<Fixture[]>("/fixtures"),
  match: (id: string) => request<MatchSnapshot>(`/matches/${id}`),
  events: (id: string) => request<MatchEvent[]>(`/matches/${id}/events`),
  lineups: (id: string) => request<unknown[]>(`/matches/${id}/lineups`),

  listProfiles: () => request<ShowProfile[]>("/shows"),
  createProfile: (body: Omit<ShowProfile, "id">) =>
    request<ShowProfile>("/shows", { method: "POST", body: JSON.stringify(body) }),
  getProfile: (id: string) => request<ShowProfile>(`/shows/${id}`),
  updateProfile: (id: string, patch: Partial<ShowProfile>) =>
    request<ShowProfile>(`/shows/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteProfile: (id: string) =>
    request<void>(`/shows/${id}`, { method: "DELETE" }),

  createSession: (showProfileId: string, matchId: string) =>
    request<ShowSession>("/show-sessions", {
      method: "POST",
      body: JSON.stringify({ show_profile_id: showProfileId, match_id: matchId }),
    }),
  getSession: (id: string) => request<ShowSession>(`/show-sessions/${id}`),
  transition: (id: string, target: string) =>
    request<ShowSession>(`/show-sessions/${id}/${target}`, { method: "POST" }),
  rotateToken: (id: string) =>
    request<ShowSession>(`/show-sessions/${id}/rotate-token`, { method: "POST" }),

  overlayState: (token: string) => request<OverlayState>(`/overlay/${token}/state`),
  sessionLog: (sessionId: string, filters?: { kind?: string; severity?: string }) => {
  const params = new URLSearchParams();
    if (filters?.kind) params.set("kind", filters.kind);
    if (filters?.severity) params.set("severity", filters.severity);
    const qs = params.toString();
    return request<LogEntry[]>(`/show-sessions/${sessionId}/log${qs ? `?${qs}` : ""}`);
  },
  clearSessionLog: (sessionId: string) =>
    request<{ deleted: number }>(`/show-sessions/${sessionId}/log`, { method: "DELETE" }),

  listCommentary: (sessionId: string, status?: string) => {
  const qs = status ? `?status=${status}` : "";
    return request<CommentaryItem[]>(`/show-sessions/${sessionId}/commentary${qs}`);
  },
  approveCommentary: (id: string) =>
    request<CommentaryItem>(`/commentary/${id}/approve`, { method: "POST" }),
  skipCommentary: (id: string) =>
    request<CommentaryItem>(`/commentary/${id}/skip`, { method: "POST" }),
  regenerateCommentary: (id: string) =>
    request<CommentaryItem>(`/commentary/${id}/regenerate`, { method: "POST" }),
  updateCommentaryConfig: (profileId: string, config: Record<string, unknown>) =>
    request<ShowProfile>(`/shows/${profileId}`, {
      method: "PATCH",
      body: JSON.stringify({ commentary_config: config }),
    }),

  listAllCommentary: (sessionId: string) =>
    request<CommentaryItem[]>(`/show-sessions/${sessionId}/commentary`),

  listAutomationRules: (profileId: string) =>
    request<AutomationRule[]>(`/shows/${profileId}/automation-rules`),
  createAutomationRule: (profileId: string, body: Partial<AutomationRule>) =>
    request<AutomationRule>(`/shows/${profileId}/automation-rules`, {
      method: "POST", body: JSON.stringify(body),
    }),
  updateAutomationRule: (ruleId: string, patch: Partial<AutomationRule>) =>
    request<AutomationRule>(`/automation-rules/${ruleId}`, {
      method: "PATCH", body: JSON.stringify(patch),
    }),
  deleteAutomationRule: (ruleId: string) =>
    request<void>(`/automation-rules/${ruleId}`, { method: "DELETE" }),

  listSessions: (state?: string) => {
    const qs = state ? `?state=${encodeURIComponent(state)}` : "";
    return request<ShowSession[]>(`/show-sessions${qs}`);
  },

  // add to the api object:
  setScene: (sessionId: string, sceneId: string) =>
    request<{ scene_id: string; obs_scene: string; obs_ok: boolean }>(
      `/show-sessions/${sessionId}/set-scene`,
      { method: "POST", body: JSON.stringify({ scene_id: sceneId }) },
    ),

  provisionObs: (sessionId: string) =>
    request<{
      session_id: string;
      obs_connected: boolean;
      results: Array<{ scene_key: string; obs_scene: string; created_or_updated: boolean }>;
    }>(`/show-sessions/${sessionId}/provision-obs`, { method: "POST" }),

  obsStatus: () =>
    request<{ connected: boolean; current_scene: string | null }>("/obs/status"),

  obsReconnect: () =>
    request<{ connected: boolean; current_scene: string | null }>("/obs/status", {
      method: "POST",
    }),

  speakCommentary: (itemId: string) =>
    request<SpeechJob>(`/commentary/${itemId}/speak`, { method: "POST" }),
  markPlayed: (itemId: string) =>
    request<{ status: string }>(`/commentary/${itemId}/played`, { method: "POST" }),

  listEditorialCards: (sessionId: string) =>
  request<EditorialCard[]>(`/show-sessions/${sessionId}/editorial-cards`),
  createEditorialCard: (sessionId: string, body: Partial<EditorialCard>) =>
    request<EditorialCard>(`/show-sessions/${sessionId}/editorial-cards`, {
      method: "POST", body: JSON.stringify(body),
    }),
  updateEditorialCard: (sessionId: string, cardId: string, patch: Partial<EditorialCard>) =>
    request<EditorialCard>(`/show-sessions/${sessionId}/editorial-cards/${cardId}`, {
      method: "PATCH", body: JSON.stringify(patch),
    }),
  deleteEditorialCard: (sessionId: string, cardId: string) =>
    request<void>(`/show-sessions/${sessionId}/editorial-cards/${cardId}`, {
      method: "DELETE",
    }),
  broadcastEditorialCard: (sessionId: string, cardId: string) =>
    request<EditorialCard>(`/show-sessions/${sessionId}/editorial-cards/${cardId}/broadcast`, {
      method: "POST",
    }),
  hideAllEditorial: (sessionId: string) =>
    request<{ hidden: boolean }>(`/show-sessions/${sessionId}/editorial-cards/hide`, {
      method: "POST",
    }),
  seedEditorialCard: (sessionId: string, cardType: string) =>
    request<EditorialCard>(`/show-sessions/${sessionId}/editorial-cards/seed/${cardType}`, {
      method: "POST",
    }),

  h2h: (matchId: string) => request<H2HMeeting[]>(`/matches/${matchId}/h2h`),
  prediction: (matchId: string) => request<Prediction>(`/matches/${matchId}/prediction`),
  teamFixtures: (teamId: string) => request<TeamFixture[]>(`/teams/${teamId}/fixtures`),
};

