// ─── Core Enums ──────────────────────────────────────────────────────────────

export type Surface = "hard" | "clay" | "grass";

export type MatchType = "singles" | "doubles";

export type PlayStyle =
  | "pusher"
  | "big-hitter"
  | "serve-volley"
  | "counter-puncher"
  | "all-court"
  | "moonballer";

export type MatchResult = "win" | "loss" | "unfinished";

// ─── Score ────────────────────────────────────────────────────────────────────

export interface SetScore {
  player: number | null;
  opponent: number | null;
}

export interface MatchScore {
  sets: [SetScore, SetScore, SetScore]; // Always 3 slots; third is optional
}

// ─── Scouting Intel ───────────────────────────────────────────────────────────

export interface ScoutingNotes {
  weapon: string;       // "Their Weapon" — best shot
  hole: string;         // "Their Hole"   — weakness
  keyToWin: string;     // One-sentence strategy for next time
}

// ─── Match ────────────────────────────────────────────────────────────────────

export interface Match {
  id: string;
  createdAt: string;           // ISO 8601
  opponentId: string;
  opponentName: string;        // Denormalised for fast display
  surface: Surface;
  matchType: MatchType;
  score: MatchScore;
  result: MatchResult;         // Derived, but stored for fast querying
  opponentStyle: PlayStyle[];  // Multi-tag
  scouting: ScoutingNotes;
  notes?: string;              // Free-form post-match notes
}

// ─── Opponent ─────────────────────────────────────────────────────────────────

export interface Opponent {
  id: string;
  name: string;
  primaryStyle: PlayStyle;
  secondaryStyles?: PlayStyle[];
  matchIds: string[];          // Ordered chronologically
  record: {
    wins: number;
    losses: number;
  };
  scoutingSummary?: string;    // Aggregated AI/user summary of all keyToWin notes
  lastPlayed?: string;         // ISO 8601
}

// ─── App State ────────────────────────────────────────────────────────────────

export interface AppState {
  matches: Record<string, Match>;
  opponents: Record<string, Opponent>;
}

// ─── Form Types ───────────────────────────────────────────────────────────────

export type MatchFormData = Omit<Match, "id" | "createdAt" | "result" | "opponentId"> & {
  opponentId?: string; // Optional: undefined = new opponent
};

// ─── Utility ──────────────────────────────────────────────────────────────────

/**
 * Derive match result from score.
 * A player wins a set if their score is higher (standard tennis rules simplified).
 * Returns 'win' if player wins majority of sets, 'loss' otherwise.
 */
export function deriveResult(score: MatchScore): MatchResult {
  let playerSets = 0;
  let opponentSets = 0;

  for (const set of score.sets) {
    if (set.player === null || set.opponent === null) continue;
    if (set.player > set.opponent) playerSets++;
    else if (set.opponent > set.player) opponentSets++;
  }

  if (playerSets === 0 && opponentSets === 0) return "unfinished";
  return playerSets > opponentSets ? "win" : "loss";
}
