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

export default function Home() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/auth"); return; }
      upsertProfile(user); // fire-and-forget — ensures profile row exists

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
  }, [router]);

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/auth");
  }

  return (
    <main className="min-h-screen bg-[#0c0c0e] max-w-sm mx-auto pb-24">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-white/[0.06]">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-white/30 text-xs font-bold tracking-widest uppercase">Matchbook</p>
            <h1 className="text-2xl font-black text-white mt-0.5">Match History</h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={signOut}
              className="text-white/30 text-xs font-medium hover:text-white/60 transition-colors"
            >
              Sign out
            </button>
            <Link
              href="/log"
              className="bg-lime-400 text-black px-4 py-2.5 rounded-2xl text-sm font-black shadow-lg shadow-lime-400/20 hover:bg-lime-300 transition-all active:scale-95"
            >
              + Log
            </Link>
          </div>
        </div>
      </div>

      {/* Feed */}
      <div className="px-5 py-4 space-y-3">
        {loading ? (
          <p className="text-white/30 text-center py-16">Loading…</p>
        ) : matches.length === 0 ? (
          <p className="text-white/30 text-center py-16">No matches yet. Log your first one!</p>
        ) : (
          matches.map((m) => {
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
            return (
              <Link
                key={m.id}
                href={`/match/${m.id}`}
                className={`block rounded-2xl border p-4 space-y-2 transition-all active:scale-[0.98] hover:brightness-110 ${
                  win ? "border-lime-400/20 bg-lime-400/5" : "border-red-500/20 bg-red-500/5"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-white font-black text-base">{m.opponentName}</span>
                    <span className="ml-2 text-white/40 text-sm">
                      {SURFACE_EMOJI[m.surface]} {scoreSets}
                    </span>
                  </div>
                  <span
                    className={`text-sm font-black px-3 py-1 rounded-full ${
                      win ? "bg-lime-400/15 text-lime-400" : "bg-red-500/15 text-red-400"
                    }`}
                  >
                    {win ? "W" : "L"}
                  </span>
                </div>
                {m.opponentStyle.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {m.opponentStyle.map((s) => (
                      <span
                        key={s}
                        className="text-xs px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/50 font-medium"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                )}
                {m.scouting.keyToWin && (
                  <p className="text-xs text-white/30 italic">🔑 {m.scouting.keyToWin}</p>
                )}
              </Link>
            );
          })
        )}
      </div>

      <BottomNav active="home" />
    </main>
  );
}
