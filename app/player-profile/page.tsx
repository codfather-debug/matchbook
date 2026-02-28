"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Match, PlayStyle } from "@/types";
import { supabase } from "@/lib/supabase";
import BottomNav from "@/components/BottomNav";
import { PLAY_STYLES } from "@/components/MatchEntry";
import { upsertProfile } from "@/lib/profile";
import {
  getRecord, getCurrentStreak, getWinRate,
  getMentalAverage, getExecutionAverage,
  getSurfaceWinRates, grade, gradeColor, gradeBg,
} from "@/lib/analytics";

function GradeCard({ label, value, note }: { label: string; value: string | null; note?: string }) {
  const g = gradeColor(value ?? "F");
  const bg = gradeBg(value ?? "F");
  return (
    <div className={`rounded-2xl border p-4 flex items-center justify-between ${value ? bg : "border-white/10 bg-white/[0.02]"}`}>
      <div>
        <p className="text-sm font-bold text-white/70">{label}</p>
        {note && <p className="text-xs text-white/30 mt-0.5">{note}</p>}
      </div>
      <span className={`text-3xl font-black ${value ? g : "text-white/20"}`}>{value ?? "—"}</span>
    </div>
  );
}

export default function PlayerProfilePage() {
  const router = useRouter();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [shareStats, setShareStats] = useState(true);
  const [shareHistory, setShareHistory] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/auth"); return; }
      setEmail(user.email?.split("@")[0] ?? "Player");
      setUserId(user.id);
      await upsertProfile(user);

      // Load profile settings
      const { data: profile } = await supabase
        .from("profiles").select("share_stats, share_history, display_name").eq("id", user.id).single();
      if (profile) {
        setShareStats(profile.share_stats ?? true);
        setShareHistory(profile.share_history ?? true);
        if (profile.display_name) {
          setDisplayName(profile.display_name);
          const parts = profile.display_name.split(" ");
          setFirstName(parts[0] ?? "");
          setLastName(parts.slice(1).join(" ") ?? "");
        }
      }

      const { data } = await supabase
        .from("matches")
        .select("id, created_at, data")
        .order("created_at", { ascending: false });
      if (data) {
        setMatches(data.map(row => ({
          ...(row.data as Omit<Match, "id" | "createdAt">),
          id: row.id, createdAt: row.created_at,
        })));
      }
      setLoading(false);
    }
    load();
  }, [router]);

  async function saveName() {
    const full = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
    if (!full) return;
    setSavingName(true);
    await supabase.from("profiles").update({ display_name: full }).eq("id", userId);
    setDisplayName(full);
    setSavingName(false);
  }

  async function updatePrivacy(field: "share_stats" | "share_history", value: boolean) {
    if (field === "share_stats") setShareStats(value);
    else setShareHistory(value);
    await supabase.from("profiles").update({ [field]: value }).eq("id", userId);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#1e1e2a] flex items-center justify-center">
        <p className="text-white/30 text-sm">Loading…</p>
      </main>
    );
  }

  const record  = getRecord(matches);
  const streak  = getCurrentStreak(matches);
  const winRate = getWinRate(matches);
  const last10  = matches.slice(0, 10);
  const last5   = matches.slice(0, 5);

  // ── Performance Grades (last 10) ─────────────────────────────────────────
  // Consistency: % of last 10 where execution ≥ 7 or stuckToPlan=true (if data present)
  const withExec = last10.filter(m => m.reflection?.executionScore !== undefined);
  const consistGrade = withExec.length >= 3
    ? grade(Math.round((withExec.filter(m => (m.reflection!.executionScore!) >= 7).length / withExec.length) * 100), 100)
    : null;
  const consistNote = withExec.length >= 3 ? `${withExec.filter(m => (m.reflection!.executionScore!) >= 7).length}/${withExec.length} matches exec ≥ 7` : "Need 3+ matches with reflection";

  // Clutch: win % in 3-set matches
  const clutchMatches = last10.filter(m => m.score.sets.filter(s => s.player !== null && s.opponent !== null).length === 3);
  const clutchGrade = clutchMatches.length >= 2
    ? grade(getWinRate(clutchMatches), 100)
    : null;
  const clutchNote = clutchMatches.length >= 2 ? `${clutchMatches.filter(m => m.result === "win").length}W of ${clutchMatches.length} 3-set matches` : "Need 2+ 3-set matches";

  // Mental: avg composite
  const mentalAvg = getMentalAverage(last10);
  const mentalGrade = mentalAvg !== null ? grade(mentalAvg) : null;
  const mentalNote = mentalAvg !== null ? `${mentalAvg}/10 avg` : "No mental data yet";

  // Execution: avg execution score
  const execAvg = getExecutionAverage(last10);
  const execGrade = execAvg !== null ? grade(execAvg) : null;
  const execNote = execAvg !== null ? `${execAvg}/10 avg` : "No execution data yet";

  // Momentum: win % of last 5
  const momentumGrade = last5.length >= 3 ? grade(getWinRate(last5), 100) : null;
  const momentumNote = last5.length >= 3 ? `${last5.filter(m => m.result === "win").length}W of last ${last5.length}` : "Need 3+ matches";

  // ── Identity Snapshot ─────────────────────────────────────────────────────
  // Most common opponent style tag
  const styleCounts: Partial<Record<PlayStyle, number>> = {};
  for (const m of matches) {
    for (const s of m.opponentStyle) styleCounts[s] = (styleCounts[s] ?? 0) + 1;
  }
  const topStyle = Object.entries(styleCounts).sort(([,a],[,b]) => b-a)[0]?.[0] as PlayStyle | undefined;

  // Best surface
  const surfRates = getSurfaceWinRates(matches);
  let bestSurface: string | null = null, bestSurfRate = 0;
  for (const [s, d] of Object.entries(surfRates)) {
    if (d.total >= 2 && d.rate > bestSurfRate) { bestSurfRate = d.rate; bestSurface = s; }
  }

  // Most common loss pattern
  const losses = matches.filter(m => m.result === "loss");
  const lostAfterFirst = losses.filter(m => {
    const s1 = m.score.sets[0];
    return s1.player !== null && s1.opponent !== null && s1.player > s1.opponent;
  });
  const lostIn3 = losses.filter(m => m.score.sets.filter(s => s.player !== null && s.opponent !== null).length === 3);
  let lossPattern: string | null = null;
  if (losses.length >= 3) {
    if (lostAfterFirst.length / losses.length >= 0.5) lossPattern = "Often loses after winning the first set";
    else if (lostIn3.length / losses.length >= 0.5) lossPattern = "Often drops close 3-set matches";
    else lossPattern = "Tends to lose in straight sets";
  }

  const surfEmoji: Record<string, string> = { hard: "🟦", clay: "🟫", grass: "🟩" };

  return (
    <main className="min-h-screen bg-[#1e1e2a] max-w-sm mx-auto pb-24">
      {/* Header */}
      <div className="px-5 pt-5 pb-5 border-b border-white/[0.06]">
        <p className="text-white/30 text-xs font-bold tracking-widest uppercase mb-3">Player Profile</p>
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-black text-white">{displayName || email}</h1>
            <p className="text-white/40 text-sm mt-0.5">{record.wins}W – {record.losses}L · {winRate}% win rate</p>
            <p className="text-white/30 text-xs mt-0.5">{matches.length} matches logged</p>
          </div>
          <div className={`text-right`}>
            {streak !== 0 && (
              <div className={`text-2xl font-black ${streak > 0 ? "text-lime-400" : "text-red-400"}`}>
                {streak > 0 ? `+${streak}W` : `${Math.abs(streak)}L`}
              </div>
            )}
            {streak !== 0 && <p className="text-xs text-white/30">current streak</p>}
          </div>
        </div>
      </div>

      <div className="px-5 py-5 space-y-6">

        {/* Performance Grades */}
        <section className="space-y-3">
          <p className="text-xs font-black tracking-widest uppercase text-white/30">Performance Grades</p>
          <p className="text-xs text-white/20">Based on last 10 matches</p>
          <div className="space-y-2">
            <GradeCard label="Consistency"  value={consistGrade}  note={consistNote} />
            <GradeCard label="Clutch"       value={clutchGrade}   note={clutchNote} />
            <GradeCard label="Mental"       value={mentalGrade}   note={mentalNote} />
            <GradeCard label="Execution"    value={execGrade}     note={execNote} />
            <GradeCard label="Momentum"     value={momentumGrade} note={momentumNote} />
          </div>
        </section>

        {/* Identity Snapshot */}
        {matches.length >= 3 && (
          <section className="space-y-3">
            <p className="text-xs font-black tracking-widest uppercase text-white/30">Identity Snapshot</p>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
              {topStyle && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-white/50">Most common opponent type</p>
                  <span className="px-2.5 py-0.5 rounded-full bg-white/10 text-white/70 text-xs font-semibold">
                    {PLAY_STYLES.find(p => p.value === topStyle)?.label ?? topStyle}
                  </span>
                </div>
              )}
              {bestSurface && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-white/50">Best surface</p>
                  <span className="text-sm font-bold text-lime-400">
                    {surfEmoji[bestSurface]} {bestSurface.charAt(0).toUpperCase() + bestSurface.slice(1)} ({bestSurfRate}%)
                  </span>
                </div>
              )}
              {lossPattern && (
                <div className="flex items-start justify-between gap-4">
                  <p className="text-sm text-white/50">Loss pattern</p>
                  <p className="text-sm text-red-400/80 font-medium text-right">{lossPattern}</p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Achievements link */}
        <Link href="/achievements"
          className="flex items-center justify-between p-4 rounded-2xl border border-white/10 bg-white/[0.03] hover:border-white/20 transition-all active:scale-[0.98]">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏅</span>
            <div>
              <p className="text-sm font-bold text-white">Achievements</p>
              <p className="text-xs text-white/30">View your badges & progress</p>
            </div>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-white/30">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </Link>

        {/* Friends link */}
        <Link href="/friends"
          className="flex items-center justify-between p-4 rounded-2xl border border-white/10 bg-white/[0.03] hover:border-white/20 transition-all active:scale-[0.98]">
          <div className="flex items-center gap-3">
            <span className="text-2xl">👥</span>
            <div>
              <p className="text-sm font-bold text-white">Friends</p>
              <p className="text-xs text-white/30">Find players & view their stats</p>
            </div>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-white/30">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </Link>

        {/* Name */}
        <section className="space-y-3">
          <p className="text-xs font-black tracking-widest uppercase text-white/30">Your Name</p>
          <p className="text-xs text-white/20">Shown to friends when they search for you</p>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="First"
              value={firstName}
              onChange={e => setFirstName(e.target.value)}
              className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm placeholder:text-white/25 outline-none focus:ring-2 focus:ring-lime-400/50 focus:border-lime-400/30 transition-all"
            />
            <input
              type="text"
              placeholder="Last"
              value={lastName}
              onChange={e => setLastName(e.target.value)}
              className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm placeholder:text-white/25 outline-none focus:ring-2 focus:ring-lime-400/50 focus:border-lime-400/30 transition-all"
            />
          </div>
          <button
            onClick={saveName}
            disabled={savingName || !firstName.trim()}
            className="w-full py-3 rounded-2xl bg-lime-400 text-black text-sm font-black hover:bg-lime-300 transition-all active:scale-[0.98] disabled:opacity-40"
          >
            {savingName ? "Saving…" : "Save Name"}
          </button>
        </section>

        {/* Privacy Settings */}
        <section className="space-y-3">
          <p className="text-xs font-black tracking-widest uppercase text-white/30">Privacy</p>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] divide-y divide-white/[0.06]">
            <div className="flex items-center justify-between px-4 py-3.5">
              <div>
                <p className="text-sm font-semibold text-white/80">Share my stats</p>
                <p className="text-xs text-white/30 mt-0.5">Friends can see your grades & record</p>
              </div>
              <button
                onClick={() => updatePrivacy("share_stats", !shareStats)}
                className={`relative w-12 h-6 rounded-full transition-colors ${shareStats ? "bg-lime-400" : "bg-white/20"}`}
              >
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${shareStats ? "translate-x-7" : "translate-x-1"}`} />
              </button>
            </div>
            <div className="flex items-center justify-between px-4 py-3.5">
              <div>
                <p className="text-sm font-semibold text-white/80">Share my match history</p>
                <p className="text-xs text-white/30 mt-0.5">Friends can see your match feed</p>
              </div>
              <button
                onClick={() => updatePrivacy("share_history", !shareHistory)}
                className={`relative w-12 h-6 rounded-full transition-colors ${shareHistory ? "bg-lime-400" : "bg-white/20"}`}
              >
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${shareHistory ? "translate-x-7" : "translate-x-1"}`} />
              </button>
            </div>
          </div>
        </section>

      </div>

      <BottomNav active="profile" />
    </main>
  );
}
