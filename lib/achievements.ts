import { Match } from "@/types";

export interface Achievement {
  id: string;
  title: string;
  description: string;
  category: "performance" | "mental" | "consistency";
  icon: string;
  unlocked: boolean;
  unlockedAt?: string;
  progress: number;       // 0–100
  progressText: string;
}

export function computeAchievements(matches: Match[]): Achievement[] {
  // Sort oldest → newest for streak detection
  const sorted = [...matches].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  // ── Max win streak ────────────────────────────────────────────────
  let maxStreak = 0;
  let cur = 0;
  let streakDate: string | undefined;
  for (const m of sorted) {
    if (m.result === "win") {
      cur++;
      if (cur > maxStreak) { maxStreak = cur; streakDate = m.createdAt; }
    } else {
      cur = 0;
    }
  }

  // ── Win after losing first set ────────────────────────────────────
  const comebacks = sorted.filter(m => {
    if (m.result !== "win") return false;
    const s1 = m.score.sets[0];
    return s1.player !== null && s1.opponent !== null && s1.player < s1.opponent;
  });

  // ── Clutch wins (3rd set, or any tiebreak) ────────────────────────
  const clutchWins = sorted.filter(m => {
    if (m.result !== "win") return false;
    const played = m.score.sets.filter(s => s.player !== null && s.opponent !== null);
    if (played.length === 3) return true;
    return played.some(s => s.tiebreak && s.tiebreak.player !== null && s.tiebreak.opponent !== null);
  });

  // ── High emotional control (≥ 8) ─────────────────────────────────
  const highEmoCtrl = sorted.filter(m => (m.reflection?.emotionalControl ?? 0) >= 8);

  // ── Win with low mental (≤ 5) ─────────────────────────────────────
  const gritWins = sorted.filter(
    m => m.result === "win" && (m.reflection?.composite ?? 10) <= 5
  );

  // ── High execution (≥ 8) ─────────────────────────────────────────
  const highExec = sorted.filter(m => (m.reflection?.executionScore ?? 0) >= 8);

  // ── Stuck to plan ─────────────────────────────────────────────────
  const stuckToPlan = sorted.filter(m => m.reflection?.stuckToPlan === true);

  return [
    {
      id: "streak_5",
      title: "On a Roll",
      description: "Win 5 matches in a row.",
      category: "performance",
      icon: "🔥",
      unlocked: maxStreak >= 5,
      unlockedAt: maxStreak >= 5 ? streakDate : undefined,
      progress: Math.min(Math.round((Math.min(maxStreak, 5) / 5) * 100), 100),
      progressText: `${Math.min(maxStreak, 5)} / 5 win streak`,
    },
    {
      id: "streak_10",
      title: "Unstoppable",
      description: "Win 10 matches in a row.",
      category: "performance",
      icon: "⚡",
      unlocked: maxStreak >= 10,
      unlockedAt: maxStreak >= 10 ? streakDate : undefined,
      progress: Math.min(Math.round((Math.min(maxStreak, 10) / 10) * 100), 100),
      progressText: `${Math.min(maxStreak, 10)} / 10 win streak`,
    },
    {
      id: "comeback",
      title: "Comeback King",
      description: "Win a match after dropping the first set.",
      category: "performance",
      icon: "🥊",
      unlocked: comebacks.length > 0,
      unlockedAt: comebacks[0]?.createdAt,
      progress: comebacks.length > 0 ? 100 : 0,
      progressText: comebacks.length > 0 ? "Unlocked!" : "Not yet",
    },
    {
      id: "clutch_3",
      title: "Clutch Player",
      description: "Win 3 clutch matches (decided by tiebreak or 3rd set).",
      category: "performance",
      icon: "🏆",
      unlocked: clutchWins.length >= 3,
      unlockedAt: clutchWins[2]?.createdAt,
      progress: Math.min(Math.round((Math.min(clutchWins.length, 3) / 3) * 100), 100),
      progressText: `${Math.min(clutchWins.length, 3)} / 3 clutch wins`,
    },
    {
      id: "mental_control_5",
      title: "Ice in the Veins",
      description: "Log 5 matches with Emotional Control ≥ 8.",
      category: "mental",
      icon: "🧊",
      unlocked: highEmoCtrl.length >= 5,
      unlockedAt: highEmoCtrl[4]?.createdAt,
      progress: Math.min(Math.round((Math.min(highEmoCtrl.length, 5) / 5) * 100), 100),
      progressText: `${Math.min(highEmoCtrl.length, 5)} / 5 matches`,
    },
    {
      id: "grit_win",
      title: "Mind Over Matter",
      description: "Win a match with a Mental Score ≤ 5.",
      category: "mental",
      icon: "💪",
      unlocked: gritWins.length > 0,
      unlockedAt: gritWins[0]?.createdAt,
      progress: gritWins.length > 0 ? 100 : 0,
      progressText: gritWins.length > 0 ? "Unlocked!" : "Win with Mental ≤ 5",
    },
    {
      id: "execution_3",
      title: "Precision Player",
      description: "Log 3 matches with Execution Score ≥ 8.",
      category: "consistency",
      icon: "🎯",
      unlocked: highExec.length >= 3,
      unlockedAt: highExec[2]?.createdAt,
      progress: Math.min(Math.round((Math.min(highExec.length, 3) / 3) * 100), 100),
      progressText: `${Math.min(highExec.length, 3)} / 3 matches`,
    },
    {
      id: "plan_5",
      title: "Disciplined Tactician",
      description: "Stick to your game plan in 5 different matches.",
      category: "consistency",
      icon: "📋",
      unlocked: stuckToPlan.length >= 5,
      unlockedAt: stuckToPlan[4]?.createdAt,
      progress: Math.min(Math.round((Math.min(stuckToPlan.length, 5) / 5) * 100), 100),
      progressText: `${Math.min(stuckToPlan.length, 5)} / 5 matches`,
    },
  ];
}
