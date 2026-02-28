"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Match } from "@/types";
import { supabase } from "@/lib/supabase";
import { getRecord, getWinRate, getMentalAverage, getExecutionAverage, getSurfaceWinRates } from "@/lib/analytics";

const SURFACE_EMOJI: Record<string, string> = { hard: "🟦", clay: "🟫", grass: "🟩" };
const SURFACES = ["hard", "clay", "grass"] as const;

function WinRateArc({ rate }: { rate: number }) {
  const R = 40;
  const C = 2 * Math.PI * R;
  const dash = (rate / 100) * C;
  const color = rate >= 60 ? "#a3e635" : rate >= 40 ? "#f59e0b" : "#ef4444";
  return (
    <div className="relative w-24 h-24 flex items-center justify-center">
      <svg width="96" height="96" viewBox="0 0 96 96" className="absolute inset-0 -rotate-90">
        <circle cx="48" cy="48" r={R} fill="none" stroke="white" strokeOpacity="0.06" strokeWidth="8" />
        <circle
          cx="48" cy="48" r={R} fill="none"
          stroke={color} strokeWidth="8"
          strokeDasharray={`${dash} ${C}`}
          strokeLinecap="round"
        />
      </svg>
      <div className="text-center z-10">
        <p className="text-xl font-black text-gray-900 leading-none">{rate}%</p>
        <p className="text-[10px] text-gray-400 font-bold">WIN</p>
      </div>
    </div>
  );
}

export default function OpponentHistoryPage() {
  const { name } = useParams<{ name: string }>();
  const router = useRouter();
  const decodedName = decodeURIComponent(name);
  const [allMatches, setAllMatches] = useState<Match[]>([]);
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
        setAllMatches(
          data.map(row => ({
            ...(row.data as Omit<Match, "id" | "createdAt">),
            id: row.id,
            createdAt: row.created_at,
          }))
        );
      }
      setLoading(false);
    }
    load();
  }, [router]);

  if (loading) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-gray-400 text-sm">Loading…</p>
      </main>
    );
  }

  const matches = allMatches.filter(m => m.opponentName === decodedName);
  const record = getRecord(matches);
  const winRate = getWinRate(matches);
  const mentalAvg = getMentalAverage(matches);
  const execAvg = getExecutionAverage(matches);
  const surfRates = getSurfaceWinRates(matches);

  const initials = decodedName.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <main className="min-h-screen bg-white max-w-sm mx-auto pb-10">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-xl border-b border-gray-200 px-5">
        <div className="flex items-center justify-between h-14">
          <Link href="/history" className="text-gray-500 text-sm font-medium hover:text-gray-800 transition-colors">
            ← History
          </Link>
          <span className="text-xs font-bold tracking-[0.2em] uppercase text-gray-400">Opponent</span>
          <div className="w-12" />
        </div>
      </div>

      <div className="px-5 pt-6 pb-10 space-y-6">
        {matches.length === 0 ? (
          <div className="text-center py-16 space-y-2">
            <p className="text-gray-400">No matches found for {decodedName}.</p>
            <Link href="/history" className="text-lime-700 text-sm font-semibold">← Back to history</Link>
          </div>
        ) : (
          <>
            {/* Hero */}
            <div className="rounded-3xl border border-gray-200 bg-gray-50 p-6 flex items-center gap-5">
              {/* Avatar */}
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-white/10 to-white/5 border border-gray-200 flex items-center justify-center flex-shrink-0">
                <span className="text-xl font-black text-gray-600">{initials}</span>
              </div>
              {/* Name + record */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-black tracking-widest uppercase text-gray-400 mb-0.5">vs</p>
                <h1 className="text-xl font-black text-gray-900 truncate">{decodedName}</h1>
                <p className="text-sm text-gray-500 mt-0.5">{record.wins}W – {record.losses}L · {matches.length} match{matches.length !== 1 ? "es" : ""}</p>
              </div>
              {/* Win rate arc */}
              <WinRateArc rate={winRate} />
            </div>

            {/* Averages */}
            {(mentalAvg !== null || execAvg !== null) && (
              <div className="grid grid-cols-2 gap-2">
                {mentalAvg !== null && (
                  <div className="rounded-2xl bg-gray-50 border border-gray-200 p-3 text-center">
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Mental Avg</p>
                    <p className={`text-2xl font-black mt-0.5 ${mentalAvg >= 7 ? "text-lime-700" : mentalAvg >= 5 ? "text-amber-400" : "text-red-600"}`}>
                      {mentalAvg}
                    </p>
                  </div>
                )}
                {execAvg !== null && (
                  <div className="rounded-2xl bg-gray-50 border border-gray-200 p-3 text-center">
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Exec Avg</p>
                    <p className={`text-2xl font-black mt-0.5 ${execAvg >= 7 ? "text-lime-700" : execAvg >= 5 ? "text-amber-400" : "text-red-600"}`}>
                      {execAvg}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Surface Breakdown */}
            {Object.keys(surfRates).length > 0 && (
              <section className="space-y-2">
                <p className="text-xs font-black tracking-widest uppercase text-gray-400">By Surface</p>
                <div className="rounded-2xl border border-gray-200 bg-gray-50 divide-y divide-white/[0.06]">
                  {SURFACES.filter(s => surfRates[s]).map(surf => {
                    const d = surfRates[surf]!;
                    return (
                      <div key={surf} className="flex items-center justify-between px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span>{SURFACE_EMOJI[surf]}</span>
                          <span className="text-sm font-semibold text-gray-700 capitalize">{surf}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-400">{d.wins}W – {d.total - d.wins}L</span>
                          <span className={`text-sm font-black ${d.rate >= 60 ? "text-lime-700" : d.rate >= 40 ? "text-amber-400" : "text-red-600"}`}>
                            {d.rate}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Match History */}
            <section className="space-y-2">
              <p className="text-xs font-black tracking-widest uppercase text-gray-400">Match History</p>
              <div className="space-y-2">
                {matches.map(m => {
                  const win = m.result === "win";
                  const scoreSets = m.score.sets
                    .filter(s => s.player !== null && s.opponent !== null)
                    .map(s => {
                      const base = `${s.player}-${s.opponent}`;
                      if (s.tiebreak?.player !== null && s.tiebreak?.opponent !== null && s.tiebreak) {
                        return `${base}(${Math.min(s.tiebreak.player!, s.tiebreak.opponent!)})`;
                      }
                      return base;
                    })
                    .join(", ");
                  const date = new Date(m.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
                  return (
                    <Link
                      key={m.id}
                      href={`/match/${m.id}`}
                      className={`flex items-center gap-3 rounded-2xl border p-4 transition-all active:scale-[0.98] hover:brightness-110 ${
                        win ? "border-lime-400/20 bg-lime-400/[0.04]" : "border-red-500/20 bg-red-500/[0.04]"
                      }`}
                    >
                      <div className={`w-1 self-stretch rounded-full flex-shrink-0 ${win ? "bg-lime-400" : "bg-red-500"}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className={`text-sm font-black px-2.5 py-0.5 rounded-full ${win ? "bg-lime-100 text-lime-700" : "bg-red-50 text-red-600"}`}>
                            {win ? "W" : "L"}
                          </span>
                          <span className="text-xs text-gray-400">{date}</span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          {SURFACE_EMOJI[m.surface]} {scoreSets}
                        </p>
                        {m.scouting?.keyToWin && (
                          <p className="text-xs text-gray-400 italic mt-0.5 truncate">🔑 {m.scouting.keyToWin}</p>
                        )}
                      </div>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-gray-300 flex-shrink-0">
                        <polyline points="9 18 15 12 9 6"/>
                      </svg>
                    </Link>
                  );
                })}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
