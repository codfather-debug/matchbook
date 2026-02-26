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
  tiebreak?: { player: number | null; opponent: number | null };
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

// ─── Plan & Reflection ────────────────────────────────────────────────────────

export interface PlanData {
  strategy?: string;        // Primary strategy text
  targetWeakness?: string;  // Opponent weakness to target
  focusWord?: string;       // Single focus word
  confidence?: number;      // 1–10 pre-match confidence
}

export interface ReflectionData {
  energy?: number;            // 1–10
  focus?: number;             // 1–10
  emotionalControl?: number;  // 1–10
  confidence?: number;        // 1–10 (post-match)
  composite?: number;         // Auto-calculated avg of above 4
  executionScore?: number;    // 1–10 game plan execution
  stuckToPlan?: boolean;
  notes?: string;
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
  plan?: PlanData;
  reflection?: ReflectionData;
  // Doubles — second opponent
  opponent2Name?: string;
  opponentStyle2?: PlayStyle[];
  scouting2?: ScoutingNotes;
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
