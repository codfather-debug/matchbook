"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Match } from "@/types";
import { supabase } from "@/lib/supabase";
import {
  getRecord, getWinRate, getCurrentStreak,
  getMentalAverage, getExecutionAverage,
  grade, gradeColor, gradeBg,
} from "@/lib/analytics";

const SURFACE_EMOJI: Record<string, string> = { hard: "🟦", clay: "🟫", grass: "🟩" };

type Tab = "stats" | "history";

export default function FriendProfilePage() {
  const { id: friendId } = useParams<{ id: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [shareStats, setShareStats] = useState(false);
  const [shareHistory, setShareHistory] = useState(false);
  const [isFriend, setIsFriend] = useState(false);
  const [matches, setMatches] = useState<Match[]>([]);
  const [tab, setTab] = useState<Tab>("stats");
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/auth"); return; }

      // Load their profile
      const { data: profile } = await supabase
        .from("profiles").select("username, display_name, share_stats, share_history").eq("id", friendId).single();
      if (!profile) { setError("Player not found."); setLoading(false); return; }
      setUsername(profile.username);
      setDisplayName(profile.display_name ?? "");
      setShareStats(profile.share_stats ?? false);
      setShareHistory(profile.share_history ?? false);

      // Check friendship status
      const { data: friendships } = await supabase
        .from("friendships").select("id, status")
        .or(
          `and(requester_id.eq.${user.id},addressee_id.eq.${friendId}),and(requester_id.eq.${friendId},addressee_id.eq.${user.id})`
        );
      const accepted = (friendships ?? []).some(f => f.status === "accepted");
      setIsFriend(accepted);

      // Load matches via RPC if they're a friend and share either setting
      if (accepted && (profile.share_stats || profile.share_history)) {
        const { data: matchRows, error: rpcError } = await supabase
          .rpc("get_friend_matches", { friend_uid: friendId });
        if (!rpcError && matchRows) {
          setMatches(matchRows.map((row: { data: unknown; id: string; created_at: string }) => ({
            ...(row.data as Omit<Match, "id" | "createdAt">),
            id: row.id,
            createdAt: row.created_at,
          })));
        }
      }

      setLoading(false);
    }
    load();
  }, [friendId, router]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0c0c0e] flex items-center justify-center">
        <p className="text-white/30 text-sm">Loading…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-[#0c0c0e] flex flex-col items-center justify-center gap-4">
        <p className="text-white/50">{error}</p>
        <Link href="/friends" className="text-lime-400 text-sm font-semibold">← Back to friends</Link>
      </main>
    );
  }

  if (!isFriend) {
    return (
      <main className="min-h-screen bg-[#0c0c0e] max-w-sm mx-auto flex flex-col">
        <div className="sticky top-0 z-10 bg-[#0c0c0e]/90 backdrop-blur-xl border-b border-white/[0.06] px-5">
          <div className="flex items-center gap-3 h-14">
            <Link href="/friends" className="text-white/40 text-sm font-medium hover:text-white/80 transition-colors">← Back</Link>
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
          <p className="text-4xl">🔒</p>
          <p className="text-white font-bold">{displayName || `@${username}`}</p>
          {displayName && <p className="text-white/40 text-xs">@{username}</p>}
          <p className="text-white/40 text-sm">You need to be friends to view this profile.</p>
        </div>
      </main>
    );
  }

  const neitherShared = !shareStats && !shareHistory;
  const record   = getRecord(matches);
  const winRate  = getWinRate(matches);
  const streak   = getCurrentStreak(matches);
  const last10   = matches.slice(0, 10);

  // Grades (same logic as player-profile)
  const withExec = last10.filter(m => m.reflection?.executionScore !== undefined);
  const consistGrade = withExec.length >= 3
    ? grade(Math.round((withExec.filter(m => (m.reflection!.executionScore!) >= 7).length / withExec.length) * 100), 100) : null;
  const clutchMatches = last10.filter(m => m.score.sets.filter(s => s.player !== null && s.opponent !== null).length === 3);
  const clutchGrade = clutchMatches.length >= 2 ? grade(getWinRate(clutchMatches), 100) : null;
  const mentalAvg = getMentalAverage(last10);
  const mentalGrade = mentalAvg !== null ? grade(mentalAvg) : null;
  const execAvg = getExecutionAverage(last10);
  const execGrade = execAvg !== null ? grade(execAvg) : null;
  const last5 = matches.slice(0, 5);
  const momentumGrade = last5.length >= 3 ? grade(getWinRate(last5), 100) : null;

  const showTabs = shareStats && shareHistory && matches.length > 0;

  return (
    <main className="min-h-screen bg-[#0c0c0e] max-w-sm mx-auto pb-10">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0c0c0e]/90 backdrop-blur-xl border-b border-white/[0.06] px-5">
        <div className="flex items-center justify-between h-14">
          <Link href="/friends" className="text-white/40 text-sm font-medium hover:text-white/80 transition-colors">← Friends</Link>
          <span className="text-xs font-bold tracking-[0.2em] uppercase text-white/30">Profile</span>
          <div className="w-14" />
        </div>
      </div>

      <div className="px-5 py-5 space-y-5">
        {/* Identity header */}
        <div className="border-b border-white/[0.06] pb-5">
          <h1 className="text-2xl font-black text-white">{displayName || `@${username}`}</h1>
          {displayName && <p className="text-white/30 text-xs mt-0.5">@{username}</p>}
          {shareStats && matches.length > 0 && (
            <>
              <p className="text-white/40 text-sm mt-0.5">{record.wins}W – {record.losses}L · {winRate}% win rate</p>
              {streak !== 0 && (
                <p className={`text-sm font-black mt-1 ${streak > 0 ? "text-lime-400" : "text-red-400"}`}>
                  {streak > 0 ? `+${streak}W` : `${Math.abs(streak)}L`} streak
                </p>
              )}
            </>
          )}
        </div>

        {neitherShared ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center space-y-2">
            <p className="text-3xl">🔒</p>
            <p className="text-white font-bold">Private profile</p>
            <p className="text-white/40 text-sm">This player keeps their stats private.</p>
          </div>
        ) : (
          <>
            {/* Tab switcher (only when both are available) */}
            {showTabs && (
              <div className="flex gap-2 p-1 rounded-2xl bg-white/[0.04] border border-white/10">
                {(["stats", "history"] as Tab[]).map(t => (
                  <button key={t} onClick={() => setTab(t)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold capitalize transition-all ${tab === t ? "bg-lime-400 text-black shadow" : "text-white/40 hover:text-white/70"}`}>
                    {t}
                  </button>
                ))}
              </div>
            )}

            {/* Stats view */}
            {shareStats && (!showTabs || tab === "stats") && (
              <div className="space-y-5">
                {matches.length === 0 ? (
                  <p className="text-white/30 text-sm text-center py-4">No matches logged yet.</p>
                ) : (
                  <>
                    {/* Quick stats */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-3 text-center">
                        <p className="text-xs text-white/30 font-bold uppercase tracking-widest">Record</p>
                        <p className="text-xl font-black text-white mt-0.5">{record.wins}–{record.losses}</p>
                      </div>
                      <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-3 text-center">
                        <p className="text-xs text-white/30 font-bold uppercase tracking-widest">Win %</p>
                        <p className={`text-xl font-black mt-0.5 ${winRate >= 60 ? "text-lime-400" : winRate >= 40 ? "text-amber-400" : "text-red-400"}`}>{winRate}%</p>
                      </div>
                      <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-3 text-center">
                        <p className="text-xs text-white/30 font-bold uppercase tracking-widest">Matches</p>
                        <p className="text-xl font-black text-white mt-0.5">{matches.length}</p>
                      </div>
                    </div>

                    {/* Performance Grades */}
                    {(consistGrade || clutchGrade || mentalGrade || execGrade || momentumGrade) && (
                      <section className="space-y-3">
                        <p className="text-xs font-black tracking-widest uppercase text-white/30">Performance Grades</p>
                        <p className="text-xs text-white/20">Based on last 10 matches</p>
                        <div className="space-y-2">
                          {([
                            { label: "Consistency", g: consistGrade },
                            { label: "Clutch",       g: clutchGrade },
                            { label: "Mental",       g: mentalGrade },
                            { label: "Execution",    g: execGrade },
                            { label: "Momentum",     g: momentumGrade },
                          ] as { label: string; g: string | null }[]).filter(r => r.g).map(({ label, g }) => (
                            <div key={label} className={`rounded-2xl border p-4 flex items-center justify-between ${gradeBg(g!)}`}>
                              <p className="text-sm font-bold text-white/70">{label}</p>
                              <span className={`text-3xl font-black ${gradeColor(g!)}`}>{g}</span>
                            </div>
                          ))}
                        </div>
                      </section>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Match history view */}
            {shareHistory && (!showTabs || tab === "history") && (
              <div className="space-y-3">
                <p className="text-xs font-black tracking-widest uppercase text-white/30">Match History</p>
                {matches.length === 0 ? (
                  <p className="text-white/30 text-sm text-center py-4">No matches logged yet.</p>
                ) : (
                  matches.map(m => {
                    const win = m.result === "win";
                    const scoreSets = m.score.sets
                      .filter(s => s.player !== null && s.opponent !== null)
                      .map(s => {
                        const base = `${s.player}-${s.opponent}`;
                        if (s.tiebreak?.player !== null && s.tiebreak?.opponent !== null && s.tiebreak)
                          return `${base}(${Math.min(s.tiebreak.player!, s.tiebreak.opponent!)})`;
                        return base;
                      }).join(", ");
                    return (
                      <div key={m.id} className={`rounded-2xl border p-4 space-y-1 ${win ? "border-lime-400/20 bg-lime-400/5" : "border-red-500/20 bg-red-500/5"}`}>
                        <div className="flex items-center justify-between">
                          <span className="text-white font-black text-base">{m.opponentName}</span>
                          <span className={`text-sm font-black px-3 py-1 rounded-full ${win ? "bg-lime-400/15 text-lime-400" : "bg-red-500/15 text-red-400"}`}>
                            {win ? "W" : "L"}
                          </span>
                        </div>
                        <p className="text-xs text-white/40">{SURFACE_EMOJI[m.surface]} {scoreSets}</p>
                        <p className="text-[10px] text-white/20">{new Date(m.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
