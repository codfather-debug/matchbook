"use client";
import { useEffect, useState } from "react";
import { Match } from "@/types";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import { upsertProfile } from "@/lib/profile";

const SURFACE_EMOJI: Record<string, string> = {
  hard: "🟦",
  clay: "🟫",
  grass: "🟩",
};

type SurfaceFilter = "all" | "hard" | "clay" | "grass";
type ResultFilter = "all" | "win" | "loss";

export default function HistoryPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [surfaceFilter, setSurfaceFilter] = useState<SurfaceFilter>("all");
  const [resultFilter, setResultFilter] = useState<ResultFilter>("all");
  const router = useRouter();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/auth"); return; }
      upsertProfile(user);

      const { data } = await supabase
        .from("matches")
        .select("id, created_at, data")
        .order("created_at", { ascending: false });

      if (data) {
        setMatches(
          data.map((row) => ({
            ...(row.data as Omit<Match, "id" | "createdAt">),
            id: row.id,
            createdAt: row.created_at,
          }))
        );
      }
      setLoading(false);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/auth");
  }

  const visible = matches.filter(m => {
    if (surfaceFilter !== "all" && m.surface !== surfaceFilter) return false;
    if (resultFilter !== "all" && m.result !== resultFilter) return false;
    return true;
  });

  return (
    <main className="min-h-screen bg-white max-w-sm mx-auto pb-24">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-gray-200">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-gray-400 text-xs font-bold tracking-widest uppercase">Matchbook</p>
            <h1 className="text-2xl font-black text-gray-900 mt-0.5">Match History</h1>
          </div>
          <button
            onClick={signOut}
            className="text-gray-400 text-xs font-medium hover:text-gray-600 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>

      {/* Filters */}
      {!loading && matches.length > 0 && (
        <div className="px-5 pt-3 pb-1 space-y-2">
          {/* Surface filter */}
          <div className="flex gap-1.5">
            {(["all", "hard", "clay", "grass"] as SurfaceFilter[]).map(f => (
              <button
                key={f}
                onClick={() => setSurfaceFilter(f)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  surfaceFilter === f
                    ? "bg-lime-400 text-black"
                    : "bg-gray-100 text-gray-500 hover:text-gray-700"
                }`}
              >
                {f === "all" ? "All Surfaces" : `${SURFACE_EMOJI[f]} ${f.charAt(0).toUpperCase() + f.slice(1)}`}
              </button>
            ))}
          </div>
          {/* Result filter */}
          <div className="flex gap-1.5">
            {(["all", "win", "loss"] as ResultFilter[]).map(f => (
              <button
                key={f}
                onClick={() => setResultFilter(f)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  resultFilter === f
                    ? f === "win" ? "bg-lime-400 text-black"
                    : f === "loss" ? "bg-red-500 text-gray-900"
                    : "bg-lime-400 text-black"
                    : "bg-gray-100 text-gray-500 hover:text-gray-700"
                }`}
              >
                {f === "all" ? "All Results" : f === "win" ? "Wins" : "Losses"}
              </button>
            ))}
          </div>
          {(surfaceFilter !== "all" || resultFilter !== "all") && (
            <p className="text-xs text-gray-400 pb-1">{visible.length} match{visible.length !== 1 ? "es" : ""} shown</p>
          )}
        </div>
      )}

      {/* Feed */}
      <div className="px-5 py-4 space-y-3">
        {loading ? (
          <p className="text-gray-400 text-center py-16">Loading…</p>
        ) : matches.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <p className="text-gray-400">No matches yet.</p>
            <Link href="/log" className="inline-block bg-lime-400 text-black px-5 py-2.5 rounded-2xl text-sm font-black hover:bg-lime-300 transition-all">
              + Log your first match
            </Link>
          </div>
        ) : visible.length === 0 ? (
          <div className="text-center py-12 space-y-2">
            <p className="text-gray-400">No matches match the current filters.</p>
            <button
              onClick={() => { setSurfaceFilter("all"); setResultFilter("all"); }}
              className="text-lime-700 text-sm font-semibold"
            >
              Clear filters
            </button>
          </div>
        ) : (
          visible.map((m) => {
            const win = m.result === "win";
            const scoreSets = m.score.sets
              .filter((s) => s.player !== null && s.opponent !== null)
              .map((s) => {
                const base = `${s.player}-${s.opponent}`;
                if (s.tiebreak?.player !== null && s.tiebreak?.opponent !== null && s.tiebreak) {
                  return `${base}(${Math.min(s.tiebreak.player!, s.tiebreak.opponent!)})`;
                }
                return base;
              })
              .join(", ");
            const date = new Date(m.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
            return (
              <Link
                key={m.id}
                href={`/match/${m.id}`}
                className="flex rounded-2xl overflow-hidden bg-gray-50 border border-gray-200 transition-all active:scale-[0.98] hover:bg-gray-100"
              >
                {/* Left accent bar */}
                <div className={`w-1 flex-shrink-0 ${win ? "bg-lime-400" : "bg-red-500"}`} />

                <div className="flex-1 p-4 space-y-2 min-w-0">
                  {/* Top row */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link
                        href={`/opponent/${encodeURIComponent(m.opponentName)}`}
                        onClick={e => e.stopPropagation()}
                        className="text-gray-900 font-black text-base leading-tight hover:text-lime-700 transition-colors block truncate"
                      >
                        {m.opponentName}
                      </Link>
                      <p className="text-gray-400 text-xs mt-0.5">
                        {SURFACE_EMOJI[m.surface]} {scoreSets}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className={`text-sm font-black px-2.5 py-0.5 rounded-full ${
                        win ? "bg-lime-100 text-lime-700" : "bg-red-50 text-red-600"
                      }`}>
                        {win ? "W" : "L"}
                      </span>
                      <span className="text-[10px] text-gray-300 font-medium">{date}</span>
                    </div>
                  </div>

                  {/* Style tags */}
                  {m.opponentStyle.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {m.opponentStyle.map((s) => (
                        <span key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">
                          {s}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Key to win */}
                  {m.scouting.keyToWin && (
                    <p className="text-xs text-gray-400 italic truncate">🔑 {m.scouting.keyToWin}</p>
                  )}
                </div>
              </Link>
            );
          })
        )}
      </div>

      <BottomNav active="history" />
    </main>
  );
}
