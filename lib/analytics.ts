import { Match, Surface } from "@/types";

// ─── Core Stats ───────────────────────────────────────────────────────────────

export function getWinRate(matches: Match[]): number {
  if (matches.length === 0) return 0;
  return Math.round((matches.filter(m => m.result === "win").length / matches.length) * 100);
}

export function getRecord(matches: Match[]): { wins: number; losses: number } {
  return {
    wins: matches.filter(m => m.result === "win").length,
    losses: matches.filter(m => m.result === "loss").length,
  };
}

/** Returns positive number for win streak, negative for loss streak, 0 for no matches. */
export function getCurrentStreak(matches: Match[]): number {
  if (matches.length === 0) return 0;
  // matches assumed sorted newest-first
  const first = matches[0].result;
  let n = 0;
  for (const m of matches) {
    if (m.result === first) n++;
    else break;
  }
  return first === "win" ? n : -n;
}

export function getSurfaceWinRates(
  matches: Match[]
): Partial<Record<Surface, { wins: number; total: number; rate: number }>> {
  const map: Partial<Record<Surface, { wins: number; total: number }>> = {};
  for (const m of matches) {
    if (!map[m.surface]) map[m.surface] = { wins: 0, total: 0 };
    map[m.surface]!.total++;
    if (m.result === "win") map[m.surface]!.wins++;
  }
  const result: Partial<Record<Surface, { wins: number; total: number; rate: number }>> = {};
  for (const [s, d] of Object.entries(map) as [Surface, { wins: number; total: number }][]) {
    result[s] = { ...d, rate: Math.round((d.wins / d.total) * 100) };
  }
  return result;
}

// ─── Averages ─────────────────────────────────────────────────────────────────

export function getMentalAverage(matches: Match[]): number | null {
  const vals = matches.map(m => m.reflection?.composite).filter((v): v is number => v !== undefined);
  if (vals.length === 0) return null;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
}

export function getExecutionAverage(matches: Match[]): number | null {
  const vals = matches.map(m => m.reflection?.executionScore).filter((v): v is number => v !== undefined);
  if (vals.length === 0) return null;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
}

// ─── Grade System ─────────────────────────────────────────────────────────────

export function grade(value: number, max = 10): "A" | "B" | "C" | "D" | "F" {
  const pct = (value / max) * 100;
  if (pct >= 80) return "A";
  if (pct >= 60) return "B";
  if (pct >= 40) return "C";
  if (pct >= 20) return "D";
  return "F";
}

export function gradeColor(g: string): string {
  if (g === "A") return "text-lime-400";
  if (g === "B") return "text-blue-400";
  if (g === "C") return "text-amber-400";
  if (g === "D") return "text-orange-400";
  return "text-red-400";
}

export function gradeBg(g: string): string {
  if (g === "A") return "bg-lime-400/10 border-lime-400/30";
  if (g === "B") return "bg-blue-400/10 border-blue-400/30";
  if (g === "C") return "bg-amber-400/10 border-amber-400/30";
  if (g === "D") return "bg-orange-400/10 border-orange-400/30";
  return "bg-red-400/10 border-red-400/30";
}

// ─── Insights ─────────────────────────────────────────────────────────────────

export interface Insight {
  type: "strength" | "weakness";
  text: string;
}

export function generateInsights(matches: Match[]): Insight[] {
  const insights: Insight[] = [];
  if (matches.length < 3) return insights;

  // Mental score correlation
  const withMental = matches.filter(m => m.reflection?.composite !== undefined);
  if (withMental.length >= 4) {
    const high = withMental.filter(m => m.reflection!.composite! >= 7);
    const low  = withMental.filter(m => m.reflection!.composite! <  7);
    if (high.length >= 2 && low.length >= 2) {
      const hiRate  = Math.round((high.filter(m => m.result === "win").length / high.length) * 100);
      const loRate  = Math.round((low.filter(m => m.result === "win").length  / low.length)  * 100);
      if (hiRate - loRate >= 20) {
        insights.push({ type: "strength", text: `You win ${hiRate}% of matches when your Mental Score ≥ 7 (vs ${loRate}% below).` });
      }
    }
  }

  // Energy correlation
  const withEnergy = matches.filter(m => m.reflection?.energy !== undefined);
  if (withEnergy.length >= 4) {
    const lowE = withEnergy.filter(m => (m.reflection!.energy!) < 6);
    if (lowE.length >= 2) {
      const loseRate = Math.round((lowE.filter(m => m.result === "loss").length / lowE.length) * 100);
      if (loseRate >= 60) {
        insights.push({ type: "weakness", text: `Energy below 6 correlates with ${loseRate}% loss rate.` });
      }
    }
  }

  // Execution correlation
  const withExec = matches.filter(m => m.reflection?.executionScore !== undefined);
  if (withExec.length >= 4) {
    const hiEx = withExec.filter(m => m.reflection!.executionScore! >= 7);
    const loEx = withExec.filter(m => m.reflection!.executionScore! <  7);
    if (hiEx.length >= 2 && loEx.length >= 2) {
      const hiRate = Math.round((hiEx.filter(m => m.result === "win").length / hiEx.length) * 100);
      const loRate = Math.round((loEx.filter(m => m.result === "win").length / loEx.length) * 100);
      if (hiRate - loRate >= 20) {
        insights.push({ type: "strength", text: `Execution score ≥ 7 correlates with ${hiRate}% win rate (vs ${loRate}% below).` });
      } else if (loRate - hiRate >= 20) {
        insights.push({ type: "weakness", text: `Execution score below 7 correlates with ${100 - loRate}% loss rate.` });
      }
    }
  }

  // Surface best
  const surfRates = getSurfaceWinRates(matches);
  let bestSurface: Surface | null = null;
  let bestRate = 0;
  for (const [s, d] of Object.entries(surfRates) as [Surface, { wins: number; total: number; rate: number }][]) {
    if (d.total >= 2 && d.rate > bestRate) { bestRate = d.rate; bestSurface = s; }
  }
  if (bestSurface && bestRate >= 60) {
    const label = bestSurface.charAt(0).toUpperCase() + bestSurface.slice(1);
    insights.push({ type: "strength", text: `Your best surface is ${label} (${bestRate}% win rate).` });
  }

  // 3-set match record
  const threeSet = matches.filter(m => m.score.sets.filter(s => s.player !== null && s.opponent !== null).length === 3);
  if (threeSet.length >= 3) {
    const rate = Math.round((threeSet.filter(m => m.result === "win").length / threeSet.length) * 100);
    if (rate < 40) {
      insights.push({ type: "weakness", text: `You lose ${100 - rate}% of 3-set matches.` });
    } else if (rate >= 65) {
      insights.push({ type: "strength", text: `You win ${rate}% of 3-set battles — strong in long matches.` });
    }
  }

  return insights;
}

export function getBiggestStrength(matches: Match[]): string | null {
  const insights = generateInsights(matches);
  return insights.find(i => i.type === "strength")?.text ?? null;
}

export function getBiggestWeakness(matches: Match[]): string | null {
  const insights = generateInsights(matches);
  return insights.find(i => i.type === "weakness")?.text ?? null;
}

export function getRecommendedFocus(matches: Match[]): string {
  if (matches.length === 0) return "Start logging matches to unlock personalized recommendations.";
  const recent = matches.slice(0, 5);

  const mentalAvg = getMentalAverage(recent);
  const execAvg   = getExecutionAverage(recent);
  const winRate   = getWinRate(recent);

  if (mentalAvg !== null && mentalAvg < 6) {
    return "Prioritize your pre-match mental routine. Mental scores are trending low.";
  }
  if (execAvg !== null && execAvg < 6) {
    return "Simplify your game plans for the next 3 matches. Focus on 1–2 key tactics only.";
  }
  if (winRate <= 40) {
    return "Focus on high-percentage patterns. Keep it simple and trust your instincts.";
  }
  if (winRate >= 80) {
    return "You're on a roll — maintain consistency and keep trusting your game plan.";
  }
  return "Stay process-oriented. Log reflections after each match to unlock deeper insights.";
}

// ─── Match Summary Generator ──────────────────────────────────────────────────

export function generateMatchSummary(match: Match): string[] {
  const paragraphs: string[] = [];
  const win  = match.result === "win";
  const surfaceLabel = { hard: "hard court", clay: "clay", grass: "grass" }[match.surface];
  const sets = match.score.sets.filter(s => s.player !== null && s.opponent !== null);
  const isThreeSet = sets.length === 3;

  // P1: Outcome
  if (win) {
    paragraphs.push(
      `${isThreeSet ? "Hard-fought" : "Solid"} victory over ${match.opponentName} on ${surfaceLabel}. ` +
      `${isThreeSet ? "Battling through three sets shows real resilience." : "A clean result to build on."}`
    );
  } else {
    paragraphs.push(
      `Went down to ${match.opponentName} on ${surfaceLabel}${isThreeSet ? " in a closely-contested three-setter" : ""}. ` +
      `Every match is data — the key is what you take forward.`
    );
  }

  // P2: Tactical
  const exec  = match.reflection?.executionScore;
  const mental = match.reflection?.composite;
  const plan  = match.plan?.strategy;
  const stuck = match.reflection?.stuckToPlan;
  const tactical: string[] = [];

  if (plan) tactical.push(`the game plan centred on "${plan}"`);
  if (exec !== undefined) {
    if      (exec >= 8) tactical.push(`execution was excellent (${exec}/10)`);
    else if (exec >= 6) tactical.push(`execution was solid (${exec}/10)`);
    else if (exec <= 4) tactical.push(`execution was inconsistent (${exec}/10)`);
    else tactical.push(`execution was mixed (${exec}/10)`);
  }
  if (stuck === false) tactical.push("the game plan wasn't fully followed at key moments");
  if (mental !== undefined) {
    if      (mental >= 8) tactical.push(`mental composure was excellent (${mental}/10)`);
    else if (mental <= 5) tactical.push(`mental performance was a challenge (${mental}/10)`);
  }
  if (tactical.length > 0) {
    paragraphs.push(`Tactically, ${tactical.join("; ")}. ${match.scouting?.keyToWin ? `Key reminder: ${match.scouting.keyToWin}` : ""}`);
  } else if (match.scouting?.keyToWin) {
    paragraphs.push(`Key reminder for the rematch: ${match.scouting.keyToWin}`);
  }

  // P3: Recommendation
  const energy = match.reflection?.energy;
  const emoCtrl = match.reflection?.emotionalControl;

  if (!win && exec !== undefined && exec < 6) {
    paragraphs.push("Recommendation: Simplify your approach. Pick 1–2 core patterns and commit to them completely. Clarity under pressure beats complexity.");
  } else if (mental !== undefined && mental < 6) {
    paragraphs.push("Recommendation: Focus on your pre-match mental routine. A short centering ritual — breathing, a focus word, physical activation — can raise your mental floor.");
  } else if (energy !== undefined && energy < 6) {
    paragraphs.push("Recommendation: Recovery was a limiting factor today. Prioritise sleep, hydration, and physical preparation before your next match.");
  } else if (emoCtrl !== undefined && emoCtrl < 6) {
    paragraphs.push("Recommendation: Work on emotional anchoring between points. A single reset word or physical cue can keep you tactically sharp after errors.");
  } else if (win && exec !== undefined && exec >= 8) {
    paragraphs.push("Takeaway: Excellent execution today — this is the standard. Replicate the same game plan focus next match.");
  } else if (win) {
    paragraphs.push("Takeaway: Build on this result. Log your reflection to track what's driving the wins.");
  } else {
    paragraphs.push("Takeaway: Use this match as data. Identify one specific breakdown and address it in your next session.");
  }

  return paragraphs;
}

// ─── Chart Series ─────────────────────────────────────────────────────────────

export interface ChartPoint { label: string; value: number }

/** Rolling 5-match win % at each match point (newest first → reverse for display). */
export function getWinRateSeries(matches: Match[]): ChartPoint[] {
  const sorted = [...matches].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
  return sorted.map((m, i) => {
    const window = sorted.slice(Math.max(0, i - 4), i + 1);
    const rate   = Math.round((window.filter(w => w.result === "win").length / window.length) * 100);
    return { label: new Date(m.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }), value: rate };
  });
}

export function getMentalSeries(matches: Match[]): ChartPoint[] {
  return [...matches]
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .filter(m => m.reflection?.composite !== undefined)
    .map(m => ({
      label: new Date(m.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      value: m.reflection!.composite!,
    }));
}

export function getExecutionSeries(matches: Match[]): ChartPoint[] {
  return [...matches]
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .filter(m => m.reflection?.executionScore !== undefined)
    .map(m => ({
      label: new Date(m.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      value: m.reflection!.executionScore!,
    }));
}
