"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Match } from "@/types";
import { supabase } from "@/lib/supabase";
import BottomNav from "@/components/BottomNav";
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

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/auth"); return; }
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

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0c0c0e] flex items-center justify-center">
        <p className="text-white/30 text-sm">Loading…</p>
      </main>
    );
  }

  const record  = getRecord(matches);
  const streak  = getCurrentStreak(matches);
  const last5   = matches.slice(0, 5);
  const l5rec   = getRecord(last5);
  const mentalAvg = getMentalAverage(last5);
  const execAvg   = getExecutionAverage(last5);
  const strength  = getBiggestStrength(matches);
  const weakness  = getBiggestWeakness(matches);
  const focus     = getRecommendedFocus(matches);

  const streakStr = streak === 0 ? "—" : streak > 0 ? `+${streak}W` : `${Math.abs(streak)}L`;
  const streakColor = streak > 0 ? "text-lime-400" : streak < 0 ? "text-red-400" : "text-white/40";

  return (
    <main className="min-h-screen bg-[#0c0c0e] max-w-sm mx-auto pb-24">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-white/[0.06]">
        <p className="text-white/30 text-xs font-bold tracking-widest uppercase">Matchbook</p>
        <h1 className="text-2xl font-black text-white mt-0.5">Dashboard</h1>
        <p className="text-white/30 text-sm mt-0.5">{record.wins}W – {record.losses}L overall</p>
      </div>

      <div className="px-5 py-5 space-y-5">

        {matches.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center space-y-3">
            <p className="text-4xl">🎾</p>
            <p className="text-white font-bold">No matches yet</p>
            <p className="text-white/40 text-sm">Log your first match to unlock your dashboard.</p>
            <Link href="/log" className="inline-block mt-2 bg-lime-400 text-black px-5 py-2.5 rounded-2xl text-sm font-black hover:bg-lime-300 transition-all">
              + Log a Match
            </Link>
          </div>
        ) : (
          <>
            {/* Current Status */}
            <section className="space-y-3">
              <p className="text-xs font-black tracking-widest uppercase text-white/30">Current Status</p>
              <div className="flex gap-3">
                <StatCard label="Streak" value={streakStr} color={streakColor} />
                <StatCard label="Last 5" value={`${l5rec.wins}–${l5rec.losses}`} sub={`${getWinRate(last5)}%`} />
                <StatCard
                  label="Mental"
                  value={mentalAvg !== null ? `${mentalAvg}` : "—"}
                  sub={mentalAvg !== null ? "avg score" : "no data yet"}
                  color={mentalAvg !== null ? (mentalAvg >= 7 ? "text-lime-400" : mentalAvg >= 5 ? "text-amber-400" : "text-red-400") : "text-white/40"}
                />
              </div>
              {execAvg !== null && (
                <div className="rounded-2xl bg-white/[0.03] border border-white/10 px-4 py-3 flex items-center justify-between">
                  <p className="text-sm text-white/50">Avg Execution (last 5)</p>
                  <p className={`text-lg font-black ${execAvg >= 7 ? "text-lime-400" : execAvg >= 5 ? "text-amber-400" : "text-red-400"}`}>{execAvg}/10</p>
                </div>
              )}
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
            </div>
          </>
        )}
      </div>

      <BottomNav active="dashboard" />
    </main>
  );
}
