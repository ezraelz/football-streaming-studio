export type ShowMode = "human" | "automated";
export type SessionState =
  | "configured" | "armed" | "live" | "paused" | "degraded" | "stopped";
export type DataFreshness = "fresh" | "stale" | "disconnected";

export interface TeamRef {
  id: string;
  name: string;
  shortName: string;
  color: string;
  crestUrl?: string;
}

export interface MatchSnapshot {
  matchId: string;
  competition: string;
  home: TeamRef;
  away: TeamRef;
  score: { home: number; away: number };
  period: string;
  minute: number;
  status: "scheduled" | "live" | "ht" | "ft";
  stats: Record<string, { home: number; away: number }>;
  providerUpdatedAt: string;
  receivedAt: string;
  freshness: DataFreshness;
}

export type MatchEventType =
  | "goal" | "card" | "substitution" | "shot" | "other";

export interface MatchEvent {
  eventId: string;
  matchId: string;
  type: MatchEventType;
  teamId: string;
  playerId: string | null;
  playerName: string | null;
  minute: number;
  status: "confirmed" | "provisional" | "corrected";
  sourceUpdatedAt: string;
  receivedAt: string;
  detail?: string;
}

export interface Fixture {
  id: string;
  competition: string;
  home: TeamRef;
  away: TeamRef;
  kickoff: string;
  status: "scheduled" | "live" | "ft";
  coverage: {
    lineups: boolean;
    events: boolean;
    stats: boolean;
    coordinates: boolean;
  };
}

export type CommentaryStatus =
  | "pending_approval" | "approved" | "queued" | "playing"
  | "played" | "skipped" | "expired" | "cancelled" | "failed";

export interface CommentaryItem {
  id: string;
  matchId: string;
  triggerEventId: string | null;
  mode: "suggestion" | "auto";
  status: CommentaryStatus;
  text: string;
  language: string;
  priority: "low" | "normal" | "high";
  expiresAt: string;
  sourceFacts: Record<string, unknown>;
  createdAt: string;
}

export interface ShowProfile {
  id: string;
  name: string;
  mode: ShowMode;
  theme_config: Record<string, unknown>;
  commentary_config: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface ShowSession {
  id: string;
  show_profile_id: string;
  match_id: string;
  mode: ShowMode;
  state: SessionState;
  started_at: string | null;
  stopped_at: string | null;
  overlay_token: string;
  created_at: string;
}

export interface ShowLogEntry {
  id: string;
  sessionId: string;
  kind: "data" | "commentary" | "scene" | "override" | "error";
  message: string;
  timestamp: string;
}

export type LogKind = "data" | "commentary" | "scene" | "override" | "error";

export interface ShowLogEntry {
  id: string;
  sessionId: string;
  kind: LogKind;
  severity: "info" | "warn" | "error";
  message: string;
  detail?: Record<string, unknown>;
  timestamp: string;
}

