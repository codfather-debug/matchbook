"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Match } from "@/types";
import { supabase } from "@/lib/supabase";
import BottomNav from "@/components/BottomNav";
import Onboarding from "@/components/Onboarding";
import {
  getRecord, getCurrentStreak, getWinRate,
  getMentalAverage, getExecutionAverage,
  getBiggestStrength, getBiggestWeakness, getRecommendedFocus,
  generateInsights,
} from "@/lib/analytics";

function StatCard({ label, value, sub, color = "white" }: {
  label: string; value: string; sub?: string; color?: string;
}) {
  return (
    <div className="flex-1 rounded-2xl bg-white/[0.03] border border-white/10 p-4 text-center">
      <p className="text-xs font-bold text-white/30 uppercase tracking-widest mb-1">{label}</p>
      <p className={`text-2xl font-black ${color}`}>{value}</p>
      {sub && <p className="text-xs text-white/30 mt-0.5">{sub}</p>}
    </div>
  );
}

function InsightCard({ icon, label, text, type }: {
  icon: string; label: string; text: string; type: "strength" | "weakness" | "focus";
}) {
  const border = type === "strength" ? "border-lime-400/20 bg-lime-400/[0.04]"
               : type === "weakness" ? "border-red-500/20 bg-red-500/[0.04]"
               : "border-white/10 bg-white/[0.03]";
  const labelColor = type === "strength" ? "text-lime-400"
                   : type === "weakness" ? "text-red-400"
                   : "text-white/40";
  return (
    <div className={`rounded-2xl border p-4 space-y-1.5 ${border}`}>
      <p className={`text-xs font-black uppercase tracking-widest ${labelColor}`}>{icon} {label}</p>
      <p className="text-sm text-white/80 leading-relaxed">{text}</p>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/auth"); return; }
      const { data } = await supabase
        .from("matches")
        .select("id, created_at, data")
        .order("created_at", { ascending: false });
      if (data) {
        const loaded = data.map(row => ({
          ...(row.data as Omit<Match, "id" | "createdAt">),
          id: row.id, createdAt: row.created_at,
        }));
        setMatches(loaded);
        if (loaded.length === 0 && !localStorage.getItem("mb_onboarded")) {
          setShowOnboarding(true);
        }
      }
      setLoading(false);
    }
    load();
  }, [router]);

  function dismissOnboarding() {
    localStorage.setItem("mb_onboarded", "1");
    setShowOnboarding(false);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0c0c0e] flex items-center justify-center">
        <p className="text-white/30 text-sm">Loading…</p>
      </main>
    );
  }

  const record  = getRecord(matches);
  const winRate = getWinRate(matches);
  const streak  = getCurrentStreak(matches);
  const last5   = matches.slice(0, 5);
  const l5rec   = getRecord(last5);
  const mentalAvg = getMentalAverage(last5);
  const execAvg   = getExecutionAverage(last5);
  const strength  = getBiggestStrength(matches);
  const weakness  = getBiggestWeakness(matches);
  const focus     = getRecommendedFocus(matches);

  const streakStr = streak === 0 ? "—" : streak > 0 ? `+${streak}W` : `${Math.abs(streak)}L`;

  // Arc geometry
  const R = 56; const C = 2 * Math.PI * R;
  const arcColor = winRate >= 60 ? "#a3e635" : winRate >= 40 ? "#f59e0b" : "#ef4444";
  const glowColor = winRate >= 60 ? "rgba(163,230,53,0.55)" : winRate >= 40 ? "rgba(245,158,11,0.55)" : "rgba(239,68,68,0.55)";
  const bgGlowColor = winRate >= 60 ? "#a3e635" : winRate >= 40 ? "#f59e0b" : "#ef4444";

  return (
    <>
      {showOnboarding && <Onboarding onDismiss={dismissOnboarding} />}
    <main className="min-h-screen bg-[#0c0c0e] max-w-sm mx-auto pb-24 relative z-10">

      <div className="px-5 py-5 space-y-5">

        {matches.length === 0 ? (
          <>
            {/* Empty hero */}
            <div className="pt-6 pb-2 flex flex-col items-center text-center space-y-1">
              <p className="text-white/20 text-xs font-black tracking-[0.3em] uppercase">Matchbook</p>
              <h1 className="text-2xl font-black text-white mt-1">Dashboard</h1>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center space-y-3">
              <p className="text-4xl">🎾</p>
              <p className="text-white font-bold">No matches yet</p>
              <p className="text-white/40 text-sm">Log your first match to unlock your dashboard.</p>
              <Link href="/log" className="inline-block mt-2 bg-lime-400 text-black px-5 py-2.5 rounded-2xl text-sm font-black hover:bg-lime-300 transition-all">
                + Log a Match
              </Link>
            </div>
          </>
        ) : (
          <>
            {/* ── Hero ── */}
            <div className="relative flex flex-col items-center pt-4 pb-2 overflow-hidden">
              {/* Background glow blob */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-56 h-56 rounded-full blur-[70px] opacity-25 pointer-events-none"
                style={{ background: bgGlowColor }} />

              <p className="text-white/20 text-[10px] font-black tracking-[0.35em] uppercase mb-5 z-10">Matchbook</p>

              {/* Win rate arc */}
              <div className="relative w-36 h-36 flex items-center justify-center z-10">
                <svg width="144" height="144" viewBox="0 0 144 144" className="absolute inset-0 -rotate-90">
                  <circle cx="72" cy="72" r={R} fill="none" stroke="white" strokeOpacity="0.06" strokeWidth="10" />
                  <circle
                    cx="72" cy="72" r={R} fill="none"
                    stroke={arcColor} strokeWidth="10" strokeLinecap="round"
                    strokeDasharray={`${(winRate / 100) * C} ${C}`}
                    style={{ filter: `drop-shadow(0 0 10px ${glowColor})` }}
                  />
                </svg>
                <div className="text-center z-10">
                  <p className="text-[2.6rem] font-black text-white leading-none tracking-tight">
                    {winRate}<span className="text-xl text-white/30 ml-0.5">%</span>
                  </p>
                  <p className="text-[9px] font-black tracking-[0.2em] uppercase text-white/25 mt-1">Win Rate</p>
                </div>
              </div>

              {/* Record + streak */}
              <div className="flex items-center gap-3 mt-4 z-10">
                <span className="text-white/40 text-sm font-bold">{record.wins}W – {record.losses}L</span>
                {streak !== 0 && (
                  <span className={`text-xs font-black px-2.5 py-0.5 rounded-full ${streak > 0 ? "bg-lime-400/15 text-lime-400" : "bg-red-500/15 text-red-400"}`}>
                    {streakStr}
                  </span>
                )}
              </div>
            </div>

            {/* ── Quick stats ── */}
            <section className="space-y-3">
              <div className="flex gap-3">
                <StatCard label="Last 5" value={`${l5rec.wins}–${l5rec.losses}`} sub={`${getWinRate(last5)}%`} />
                <StatCard
                  label="Mental"
                  value={mentalAvg !== null ? `${mentalAvg}` : "—"}
                  sub={mentalAvg !== null ? "avg score" : "no data yet"}
                  color={mentalAvg !== null ? (mentalAvg >= 7 ? "text-lime-400" : mentalAvg >= 5 ? "text-amber-400" : "text-red-400") : "text-white/40"}
                />
                {execAvg !== null ? (
                  <StatCard
                    label="Execution"
                    value={`${execAvg}`}
                    sub="/10 avg"
                    color={execAvg >= 7 ? "text-lime-400" : execAvg >= 5 ? "text-amber-400" : "text-red-400"}
                  />
                ) : (
                  <StatCard label="Matches" value={`${matches.length}`} sub="logged" />
                )}
              </div>
            </section>

            {/* Biggest Strength */}
            {strength && (
              <InsightCard icon="💪" label="Biggest Strength" text={strength} type="strength" />
            )}

            {/* Biggest Weakness */}
            {weakness && (
              <InsightCard icon="⚠️" label="Biggest Weakness" text={weakness} type="weakness" />
            )}

            {/* Recommended Focus */}
            <InsightCard icon="🎯" label="Recommended Focus" text={focus} type="focus" />

            {/* Quick Links */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <Link href="/history"
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center hover:border-white/20 transition-all active:scale-[0.98]">
                <p className="text-2xl mb-1">📋</p>
                <p className="text-sm font-bold text-white">History</p>
                <p className="text-xs text-white/30">All your matches</p>
              </Link>
              <Link href="/playbook"
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center hover:border-white/20 transition-all active:scale-[0.98]">
                <p className="text-2xl mb-1">📖</p>
                <p className="text-sm font-bold text-white">Playbook</p>
                <p className="text-xs text-white/30">Strategy guides</p>
              </Link>
              <Link href="/analytics"
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center hover:border-white/20 transition-all active:scale-[0.98]">
                <p className="text-2xl mb-1">📊</p>
                <p className="text-sm font-bold text-white">Analytics</p>
                <p className="text-xs text-white/30">Trends & charts</p>
              </Link>
              <Link href="/player-profile"
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center hover:border-white/20 transition-all active:scale-[0.98]">
                <p className="text-2xl mb-1">👤</p>
                <p className="text-sm font-bold text-white">Profile</p>
                <p className="text-xs text-white/30">Grades & identity</p>
              </Link>
              <Link href="/friends"
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center hover:border-white/20 transition-all active:scale-[0.98]">
                <p className="text-2xl mb-1">👥</p>
                <p className="text-sm font-bold text-white">Friends</p>
                <p className="text-xs text-white/30">Find & view players</p>
              </Link>
              <Link href="/achievements"
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center hover:border-white/20 transition-all active:scale-[0.98]">
                <p className="text-2xl mb-1">🏅</p>
                <p className="text-sm font-bold text-white">Achievements</p>
                <p className="text-xs text-white/30">Badges & progress</p>
              </Link>
            </div>
          </>
        )}
      </div>

      <BottomNav active="dashboard" />
    </main>
    </>
  );
}
