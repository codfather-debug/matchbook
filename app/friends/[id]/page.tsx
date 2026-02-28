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

function Initials({ name }: { name: string }) {
  const parts = name.trim().split(" ");
  const letters = parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
  return <>{letters}</>;
}

function WinRateArc({ pct }: { pct: number }) {
  const r = 36;
  const circ = 2 * Math.PI * r;
  const fill = (pct / 100) * circ;
  const color = pct >= 60 ? "#a3e635" : pct >= 40 ? "#fbbf24" : "#f87171";
  return (
    <svg width="96" height="96" viewBox="0 0 96 96" className="rotate-[-90deg]">
      <circle cx="48" cy="48" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="7" />
      <circle
        cx="48" cy="48" r={r} fill="none"
        stroke={color} strokeWidth="7"
        strokeDasharray={`${fill} ${circ}`}
        strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 6px ${color})` }}
      />
    </svg>
  );
}

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

      const { data: profile } = await supabase
        .from("profiles").select("username, display_name, share_stats, share_history").eq("id", friendId).single();
      if (!profile) { setError("Player not found."); setLoading(false); return; }
      setUsername(profile.username);
      setDisplayName(profile.display_name ?? "");
      setShareStats(profile.share_stats ?? false);
      setShareHistory(profile.share_history ?? false);

      const { data: friendships } = await supabase
        .from("friendships").select("id, status")
        .or(`and(requester_id.eq.${user.id},addressee_id.eq.${friendId}),and(requester_id.eq.${friendId},addressee_id.eq.${user.id})`);
      const accepted = (friendships ?? []).some(f => f.status === "accepted");
      setIsFriend(accepted);

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
      <main className="min-h-screen bg-white flex items-center justify-center">
        <div className="space-y-3 text-center">
          <div className="w-12 h-12 rounded-full border-2 border-gray-200 border-t-lime-400 animate-spin mx-auto" />
          <p className="text-gray-300 text-xs">Loading profile…</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-white flex flex-col items-center justify-center gap-4">
        <p className="text-gray-500">{error}</p>
        <Link href="/friends" className="text-lime-700 text-sm font-semibold">← Back to friends</Link>
      </main>
    );
  }

  const displayLabel = displayName || `@${username}`;

  if (!isFriend) {
    return (
      <main className="min-h-screen bg-white max-w-sm mx-auto flex flex-col">
        <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-xl border-b border-gray-200 px-5">
          <div className="flex items-center h-14">
            <Link href="/friends" className="text-gray-500 text-sm font-medium hover:text-gray-800 transition-colors">← Back</Link>
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-white/5 border border-gray-200 flex items-center justify-center">
              <span className="text-3xl">🔒</span>
            </div>
          </div>
          <div>
            <p className="text-gray-900 font-black text-lg">{displayLabel}</p>
            {displayName && <p className="text-gray-400 text-xs mt-0.5">@{username}</p>}
            <p className="text-gray-400 text-sm mt-2">You need to be friends to view this profile.</p>
          </div>
        </div>
      </main>
    );
  }

  const neitherShared = !shareStats && !shareHistory;
  const record   = getRecord(matches);
  const winRate  = getWinRate(matches);
  const streak   = getCurrentStreak(matches);
  const last10   = matches.slice(0, 10);

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
  const streakPos = streak > 0;
  const streakColor = streakPos ? "text-lime-700" : "text-red-600";
  const streakGlow  = streakPos ? "shadow-lime-400/30" : "shadow-red-400/30";

  // Pick spotlight color based on win rate
  const spotlightColor = winRate >= 60
    ? "rgba(132,204,22,0.12)"
    : winRate >= 40
    ? "rgba(251,191,36,0.10)"
    : "rgba(248,113,113,0.10)";

  return (
    <main className="min-h-screen bg-white max-w-sm mx-auto pb-10">

      {/* Back nav — floats over hero */}
      <div className="sticky top-0 z-20 px-5">
        <div className="flex items-center h-14">
          <Link href="/friends" className="flex items-center gap-1.5 text-gray-500 text-sm font-medium hover:text-gray-800 transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            Friends
          </Link>
        </div>
      </div>

      {/* ─── SPOTLIGHT HERO ─────────────────────────────────────────────────── */}
      <div className="relative -mt-14 px-5 pt-14 pb-8 overflow-hidden">
        {/* Radial spotlight glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse 80% 60% at 50% 0%, ${spotlightColor} 0%, transparent 70%)`,
          }}
        />
        {/* Subtle grid lines */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.03]"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        <div className="relative flex flex-col items-center gap-5 pt-6">
          {/* Avatar ring */}
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-white/10 to-white/5 border border-gray-200 flex items-center justify-center shadow-xl"
              style={{ boxShadow: `0 0 40px ${spotlightColor}, 0 0 0 1px rgba(255,255,255,0.08)` }}>
              <span className="text-2xl font-black text-gray-800 tracking-tight">
                <Initials name={displayLabel} />
              </span>
            </div>
            {streak !== 0 && (
              <div className={`absolute -bottom-1 -right-1 px-2 py-0.5 rounded-full text-[10px] font-black shadow-lg ${streakGlow} ${streakPos ? "bg-lime-400 text-black" : "bg-red-400 text-black"}`}
                style={{ boxShadow: streakPos ? "0 0 12px rgba(132,204,22,0.6)" : "0 0 12px rgba(248,113,113,0.6)" }}>
                {streakPos ? `+${streak}W` : `${Math.abs(streak)}L`}
              </div>
            )}
          </div>

          {/* Name */}
          <div className="text-center">
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">{displayLabel}</h1>
            {displayName && <p className="text-gray-400 text-xs mt-0.5">@{username}</p>}
            <p className="text-gray-400 text-xs mt-1">{matches.length} matches logged</p>
          </div>

          {/* Win rate arc + record */}
          {shareStats && matches.length > 0 && (
            <div className="flex items-center gap-8">
              {/* Arc */}
              <div className="relative flex items-center justify-center">
                <WinRateArc pct={winRate} />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xl font-black text-gray-900">{winRate}%</span>
                  <span className="text-[9px] text-gray-400 uppercase tracking-widest">win rate</span>
                </div>
              </div>
              {/* Record */}
              <div className="space-y-2">
                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-widest">Overall</p>
                  <p className="text-2xl font-black text-gray-900">{record.wins}<span className="text-gray-300 font-normal">–</span>{record.losses}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-widest">Last 5</p>
                  <p className="text-base font-black text-gray-700">
                    {last5.filter(m => m.result === "win").length}<span className="text-gray-300 font-normal">–</span>{last5.filter(m => m.result !== "win").length}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── CONTENT ────────────────────────────────────────────────────────── */}
      <div className="px-5 space-y-5">

        {neitherShared ? (
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-8 text-center space-y-2">
            <p className="text-3xl">🔒</p>
            <p className="text-gray-900 font-bold">Private profile</p>
            <p className="text-gray-500 text-sm">This player keeps their stats private.</p>
          </div>
        ) : (
          <>
            {/* Tab switcher */}
            {showTabs && (
              <div className="flex gap-2 p-1 rounded-2xl bg-gray-50 border border-gray-200">
                {(["stats", "history"] as Tab[]).map(t => (
                  <button key={t} onClick={() => setTab(t)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold capitalize transition-all ${tab === t ? "bg-lime-400 text-black shadow" : "text-gray-500 hover:text-gray-700"}`}>
                    {t}
                  </button>
                ))}
              </div>
            )}

            {/* ── Stats view ── */}
            {shareStats && (!showTabs || tab === "stats") && (
              <div className="space-y-5">
                {matches.length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-4">No matches logged yet.</p>
                ) : (
                  <>
                    {/* Performance Grades */}
                    {(consistGrade || clutchGrade || mentalGrade || execGrade || momentumGrade) && (
                      <section className="space-y-3">
                        <p className="text-xs font-black tracking-widest uppercase text-gray-400">Performance Grades</p>
                        <p className="text-xs text-gray-300">Based on last 10 matches</p>
                        <div className="space-y-2">
                          {([
                            { label: "Consistency", g: consistGrade },
                            { label: "Clutch",       g: clutchGrade },
                            { label: "Mental",       g: mentalGrade },
                            { label: "Execution",    g: execGrade },
                            { label: "Momentum",     g: momentumGrade },
                          ] as { label: string; g: string | null }[]).filter(r => r.g).map(({ label, g }) => (
                            <div key={label} className={`rounded-2xl border p-4 flex items-center justify-between ${gradeBg(g!)}`}>
                              <p className="text-sm font-bold text-gray-700">{label}</p>
                              <span className={`text-3xl font-black ${gradeColor(g!)}`}
                                style={{ textShadow: `0 0 20px currentColor` }}>
                                {g}
                              </span>
                            </div>
                          ))}
                        </div>
                      </section>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ── History view ── */}
            {shareHistory && (!showTabs || tab === "history") && (
              <div className="space-y-3">
                <p className="text-xs font-black tracking-widest uppercase text-gray-400">Match History</p>
                {matches.length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-4">No matches logged yet.</p>
                ) : (
                  <div className="space-y-2">
                    {matches.map(m => {
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
                        <div key={m.id}
                          className={`rounded-2xl border p-4 relative overflow-hidden ${win ? "border-lime-400/20 bg-lime-400/[0.04]" : "border-red-500/20 bg-red-500/[0.04]"}`}>
                          {/* Subtle glow edge */}
                          <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl ${win ? "bg-lime-400" : "bg-red-400"}`}
                            style={{ boxShadow: win ? "2px 0 12px rgba(132,204,22,0.4)" : "2px 0 12px rgba(248,113,113,0.4)" }} />
                          <div className="pl-3">
                            <div className="flex items-center justify-between">
                              <span className="text-gray-900 font-black text-base">{m.opponentName}</span>
                              <span className={`text-xs font-black px-2.5 py-1 rounded-full ${win ? "bg-lime-100 text-lime-700" : "bg-red-50 text-red-600"}`}>
                                {win ? "W" : "L"}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">{SURFACE_EMOJI[m.surface]} {scoreSets}</p>
                            <p className="text-[10px] text-gray-300 mt-0.5">
                              {new Date(m.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
