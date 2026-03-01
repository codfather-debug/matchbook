"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Match } from "@/types";
import { supabase } from "@/lib/supabase";
import BottomNav from "@/components/BottomNav";
import Onboarding from "@/components/Onboarding";

interface DashChallenge {
  id: string;
  type: "team" | "group";
  contextName: string;
  challengerId: string;
  opponentId: string;
  challengerName: string;
  opponentName: string;
  status: string;
  isReceived: boolean;
}
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
    <div className="flex-1 rounded-2xl bg-gray-50 border border-gray-200 p-4 text-center">
      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">{label}</p>
      <p className={`text-2xl font-black ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function InsightCard({ icon, label, text, type }: {
  icon: string; label: string; text: string; type: "strength" | "weakness" | "focus";
}) {
  const border = type === "strength" ? "border-lime-400/20 bg-lime-400/[0.04]"
               : type === "weakness" ? "border-red-500/20 bg-red-500/[0.04]"
               : "border-gray-200 bg-gray-50";
  const labelColor = type === "strength" ? "text-lime-700"
                   : type === "weakness" ? "text-red-600"
                   : "text-gray-500";
  return (
    <div className={`rounded-2xl border p-4 space-y-1.5 ${border}`}>
      <p className={`text-xs font-black uppercase tracking-widest ${labelColor}`}>{icon} {label}</p>
      <p className="text-sm text-gray-800 leading-relaxed">{text}</p>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [dashChallenges, setDashChallenges] = useState<DashChallenge[]>([]);
  const [challengeBusy, setChallengeBusy] = useState<Set<string>>(new Set());
  const [dismissedChallengeIds, setDismissedChallengeIds] = useState<Set<string>>(new Set());
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const [profileSetupName, setProfileSetupName] = useState("");
  const [profileSetupBusy, setProfileSetupBusy] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/auth"); return; }
      const uid = user.id;

      const [matchRes, teamChalRes, grpChalRes, profileRes] = await Promise.all([
        supabase.from("matches").select("id, created_at, data").order("created_at", { ascending: false }),
        supabase.from("challenges")
          .select("id, challenger_id, opponent_id, status, created_at, team_id")
          .or(`challenger_id.eq.${uid},opponent_id.eq.${uid}`)
          .in("status", ["pending", "accepted"])
          .order("created_at", { ascending: false }),
        supabase.from("group_challenges")
          .select("id, challenger_id, opponent_id, status, created_at, group_id")
          .or(`challenger_id.eq.${uid},opponent_id.eq.${uid}`)
          .in("status", ["pending", "accepted"])
          .order("created_at", { ascending: false }),
        supabase.from("profiles").select("display_name").eq("id", uid).maybeSingle(),
      ]);

      // Show name setup if this is a new user or they haven't set a display name
      if (!profileRes.data?.display_name) {
        const username = user.email?.split("@")[0] ?? uid;
        await supabase.from("profiles").upsert({ id: uid, username }, { onConflict: "id", ignoreDuplicates: true });
        setShowProfileSetup(true);
      }

      if (matchRes.data) {
        const loaded = matchRes.data.map(row => ({
          ...(row.data as Omit<Match, "id" | "createdAt">),
          id: row.id, createdAt: row.created_at,
        }));
        setMatches(loaded);
        if (loaded.length === 0 && !localStorage.getItem("mb_onboarded")) {
          setShowOnboarding(true);
        }
      }

      // Resolve challenge names
      const allChalRows = [
        ...(teamChalRes.data ?? []).map(r => ({ ...r, type: "team" as const })),
        ...(grpChalRes.data ?? []).map(r => ({ ...r, type: "group" as const })),
      ];
      if (allChalRows.length > 0) {
        const userIds = [...new Set(allChalRows.flatMap(r => [r.challenger_id, r.opponent_id]))];
        const teamIds = [...new Set((teamChalRes.data ?? []).map(r => r.team_id))];
        const groupIds = [...new Set((grpChalRes.data ?? []).map(r => r.group_id))];
        const [profRes, teamsRes, groupsRes] = await Promise.all([
          supabase.from("profiles").select("id, username, display_name").in("id", userIds),
          teamIds.length > 0 ? supabase.from("teams").select("id, name").in("id", teamIds) : Promise.resolve({ data: [] }),
          groupIds.length > 0 ? supabase.from("friend_groups").select("id, name").in("id", groupIds) : Promise.resolve({ data: [] }),
        ]);
        type P = { id: string; username: string; display_name?: string };
        type N = { id: string; name: string };
        const pMap = Object.fromEntries(((profRes.data ?? []) as P[]).map(p => [p.id, p]));
        const tMap = Object.fromEntries(((teamsRes.data ?? []) as N[]).map(t => [t.id, t.name]));
        const gMap = Object.fromEntries(((groupsRes.data ?? []) as N[]).map(g => [g.id, g.name]));
        const getName = (id: string) => { const p = pMap[id]; return p ? (p.display_name || `@${p.username}`) : id; };
        setDashChallenges(allChalRows.map(r => ({
          id: r.id, type: r.type,
          contextName: r.type === "team" ? (tMap[(r as { team_id: string }).team_id] ?? "Team") : (gMap[(r as { group_id: string }).group_id] ?? "Group"),
          challengerId: r.challenger_id, opponentId: r.opponent_id,
          challengerName: getName(r.challenger_id), opponentName: getName(r.opponent_id),
          status: r.status, isReceived: r.opponent_id === uid,
        })));
      }

      setLoading(false);
    }
    load();
  }, [router]);

  async function acceptChallenge(c: DashChallenge) {
    setChallengeBusy(s => new Set(s).add(c.id));
    const table = c.type === "team" ? "challenges" : "group_challenges";
    await supabase.from(table).update({ status: "accepted" }).eq("id", c.id);
    setDashChallenges(prev => prev.map(ch => ch.id === c.id ? { ...ch, status: "accepted" } : ch));
    setChallengeBusy(s => { const n = new Set(s); n.delete(c.id); return n; });
  }

  async function declineChallenge(c: DashChallenge) {
    setChallengeBusy(s => new Set(s).add(c.id));
    const table = c.type === "team" ? "challenges" : "group_challenges";
    await supabase.from(table).delete().eq("id", c.id);
    setDashChallenges(prev => prev.filter(ch => ch.id !== c.id));
    setChallengeBusy(s => { const n = new Set(s); n.delete(c.id); return n; });
  }

  async function saveDisplayName() {
    if (!profileSetupName.trim()) return;
    setProfileSetupBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) await supabase.from("profiles").update({ display_name: profileSetupName.trim() }).eq("id", user.id);
    setShowProfileSetup(false);
    setProfileSetupBusy(false);
  }

  function dismissOnboarding() {
    localStorage.setItem("mb_onboarded", "1");
    setShowOnboarding(false);
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/auth");
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{background:"radial-gradient(ellipse 140% 40% at 50% 0%, rgba(163,230,53,0.15) 0%, transparent 65%), #ffffff"}}>
        <p className="text-gray-400 text-sm">Loading…</p>
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
  const noMatches = matches.length === 0;
  const arcColor = noMatches ? "#d1d5db" : winRate >= 60 ? "#a3e635" : winRate >= 40 ? "#f59e0b" : "#ef4444";
  const glowColor = noMatches ? "rgba(0,0,0,0)" : winRate >= 60 ? "rgba(163,230,53,0.55)" : winRate >= 40 ? "rgba(245,158,11,0.55)" : "rgba(239,68,68,0.55)";
  const bgGlowColor = noMatches ? "transparent" : winRate >= 60 ? "#a3e635" : winRate >= 40 ? "#f59e0b" : "#ef4444";

  return (
    <>
      {showOnboarding && <Onboarding onDismiss={dismissOnboarding} />}

      {/* Profile setup modal — shown to new users who haven't set a display name */}
      {showProfileSetup && (
        <div className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-sm flex items-end justify-center">
          <div className="bg-[#141416] border border-gray-200 rounded-t-3xl w-full max-w-sm p-6 space-y-5">
            <div className="space-y-1">
              <h2 className="text-xl font-black text-gray-900">Welcome to Matchbook!</h2>
              <p className="text-sm text-gray-500">Add your name so teammates and friends can find you.</p>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black tracking-widest uppercase text-gray-400">Display Name</label>
              <input
                autoFocus
                type="text"
                placeholder="e.g. John Smith or John S."
                value={profileSetupName}
                onChange={e => setProfileSetupName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") saveDisplayName(); }}
                className="w-full bg-white/5 border border-gray-200 rounded-2xl px-4 py-3 text-gray-900 text-sm placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-lime-400/50 focus:border-lime-400/30 transition-all"
              />
              <p className="text-[10px] text-gray-300">This is how you appear in teams, groups, and challenges.</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowProfileSetup(false)}
                className="flex-1 text-sm font-bold text-gray-500 bg-white/5 border border-gray-200 py-3 rounded-2xl hover:text-gray-600 transition-all"
              >
                Skip for now
              </button>
              <button
                onClick={saveDisplayName}
                disabled={profileSetupBusy || !profileSetupName.trim()}
                className="flex-1 text-sm font-black text-black bg-lime-400 py-3 rounded-2xl hover:bg-lime-300 transition-all active:scale-95 disabled:opacity-40"
              >
                {profileSetupBusy ? "Saving…" : "Save Name"}
              </button>
            </div>
          </div>
        </div>
      )}
    <main className="min-h-screen max-w-sm mx-auto pb-24 relative z-10" style={{background:"radial-gradient(ellipse 140% 40% at 50% 0%, rgba(163,230,53,0.15) 0%, transparent 65%), #ffffff"}}>

      <div className="px-5 py-5 space-y-5">

        <>
            {/* ── Hero ── */}
            <div className="relative flex flex-col items-center pt-4 pb-2 overflow-hidden">
              {/* Background glow blob — only when there's data */}
              {!noMatches && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-56 h-56 rounded-full blur-[70px] opacity-25 pointer-events-none"
                  style={{ background: bgGlowColor }} />
              )}

              <p className="text-gray-300 text-[10px] font-black tracking-[0.35em] uppercase mb-5 z-10">Matchbook</p>

              {/* Win rate arc */}
              <div className="relative w-36 h-36 flex items-center justify-center z-10">
                <svg width="144" height="144" viewBox="0 0 144 144" className="absolute inset-0 -rotate-90">
                  <circle cx="72" cy="72" r={R} fill="none" stroke="#e5e7eb" strokeWidth="10" />
                  <circle
                    cx="72" cy="72" r={R} fill="none"
                    stroke={arcColor} strokeWidth="10" strokeLinecap="round"
                    strokeDasharray={`${(winRate / 100) * C} ${C}`}
                    style={{ filter: noMatches ? "none" : `drop-shadow(0 0 10px ${glowColor})` }}
                  />
                </svg>
                <div className="text-center z-10">
                  <p className="text-[2.6rem] font-black text-gray-900 leading-none tracking-tight">
                    {winRate}<span className="text-xl text-gray-400 ml-0.5">%</span>
                  </p>
                  <p className="text-[9px] font-black tracking-[0.2em] uppercase text-gray-400 mt-1">Win Rate</p>
                </div>
              </div>

              {/* Record + streak */}
              <div className="flex items-center gap-3 mt-4 z-10">
                <span className="text-gray-500 text-sm font-bold">{record.wins}W – {record.losses}L</span>
                {streak !== 0 && (
                  <span className={`text-xs font-black px-2.5 py-0.5 rounded-full ${streak > 0 ? "bg-lime-100 text-lime-700" : "bg-red-50 text-red-600"}`}>
                    {streakStr}
                  </span>
                )}
              </div>
            </div>

            {/* New-user nudge */}
            {noMatches && (
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-lime-200 bg-lime-50 px-4 py-3">
                <p className="text-sm font-semibold text-lime-800">Log your first match to fill in your stats!</p>
                <Link href="/log" className="flex-shrink-0 text-sm font-black text-black bg-lime-400 px-4 py-2 rounded-xl hover:bg-lime-300 transition-all active:scale-95">
                  + Log
                </Link>
              </div>
            )}

            {/* ── Challenges ── */}
            {dashChallenges.filter(c => !dismissedChallengeIds.has(c.id)).length > 0 && (
              <section className="space-y-3">
                <p className="text-xs font-black tracking-widest uppercase text-gray-400">
                  Challenges <span className="text-lime-700">({dashChallenges.filter(c => !dismissedChallengeIds.has(c.id)).length})</span>
                </p>
                <div className="rounded-2xl border border-gray-200 bg-gray-50 divide-y divide-gray-100">
                  {dashChallenges.filter(c => !dismissedChallengeIds.has(c.id)).map(c => (
                    <div key={c.id} className="px-4 py-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-gray-800">
                            {c.isReceived ? `${c.challengerName} challenged you` : `vs ${c.opponentName}`}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {c.type === "team" ? "Team" : "Group"}: {c.contextName}
                          </p>
                        </div>
                        {c.status === "pending" && c.isReceived && (
                          <div className="flex gap-2 flex-shrink-0">
                            <button
                              onClick={() => declineChallenge(c)}
                              disabled={challengeBusy.has(c.id)}
                              className="text-xs font-bold text-gray-500 bg-white/5 border border-gray-200 px-3 py-1.5 rounded-xl hover:text-red-600/70 hover:border-red-400/20 transition-all active:scale-95 disabled:opacity-40"
                            >
                              Decline
                            </button>
                            <button
                              onClick={() => acceptChallenge(c)}
                              disabled={challengeBusy.has(c.id)}
                              className="text-xs font-black text-lime-700 bg-lime-50 px-3 py-1.5 rounded-xl hover:bg-lime-100 transition-all active:scale-95 disabled:opacity-40"
                            >
                              Accept
                            </button>
                          </div>
                        )}
                        {c.status === "pending" && !c.isReceived && (
                          <span className="text-[10px] font-black px-2 py-1 rounded-lg text-gray-400 bg-gray-100 flex-shrink-0">
                            Pending
                          </span>
                        )}
                      </div>
                      {c.status === "accepted" && (
                        <div className="rounded-xl border border-lime-300 bg-lime-50 px-3 py-2.5 space-y-2">
                          <p className="text-xs font-bold text-lime-800">Challenge accepted! Log your result — both players log separately.</p>
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/log?opponent=${encodeURIComponent(c.isReceived ? c.challengerName : c.opponentName)}&challengeId=${c.id}&challengeType=${c.type}`}
                              className="flex-1 text-center text-xs font-black text-black bg-lime-400 py-2 rounded-lg hover:bg-lime-300 transition-all active:scale-95"
                            >
                              Log My Match →
                            </Link>
                            <button
                              onClick={() => setDismissedChallengeIds(s => new Set(s).add(c.id))}
                              className="text-xs font-bold text-gray-400 hover:text-gray-600 transition-colors px-1"
                            >
                              Dismiss
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ── Quick stats ── */}
            <section className="space-y-3">
              <div className="flex gap-3">
                <StatCard label="Last 5" value={`${l5rec.wins}–${l5rec.losses}`} sub={`${getWinRate(last5)}%`} />
                <StatCard
                  label="Mental"
                  value={mentalAvg !== null ? `${mentalAvg}` : "—"}
                  sub={mentalAvg !== null ? "avg score" : "no data yet"}
                  color={mentalAvg !== null ? (mentalAvg >= 7 ? "text-lime-700" : mentalAvg >= 5 ? "text-amber-400" : "text-red-600") : "text-gray-500"}
                />
                {execAvg !== null ? (
                  <StatCard
                    label="Execution"
                    value={`${execAvg}`}
                    sub="/10 avg"
                    color={execAvg >= 7 ? "text-lime-700" : execAvg >= 5 ? "text-amber-400" : "text-red-600"}
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
            {focus && <InsightCard icon="🎯" label="Recommended Focus" text={focus} type="focus" />}

            {/* Quick Links */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <Link href="/history"
                className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-center hover:border-gray-200 transition-all active:scale-[0.98]">
                <p className="text-2xl mb-1">📋</p>
                <p className="text-sm font-bold text-gray-900">History</p>
                <p className="text-xs text-gray-400">All your matches</p>
              </Link>
              <Link href="/playbook"
                className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-center hover:border-gray-200 transition-all active:scale-[0.98]">
                <p className="text-2xl mb-1">📖</p>
                <p className="text-sm font-bold text-gray-900">Playbook</p>
                <p className="text-xs text-gray-400">Strategy guides</p>
              </Link>
              <Link href="/analytics"
                className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-center hover:border-gray-200 transition-all active:scale-[0.98]">
                <p className="text-2xl mb-1">📊</p>
                <p className="text-sm font-bold text-gray-900">Analytics</p>
                <p className="text-xs text-gray-400">Trends & charts</p>
              </Link>
              <Link href="/player-profile"
                className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-center hover:border-gray-200 transition-all active:scale-[0.98]">
                <p className="text-2xl mb-1">👤</p>
                <p className="text-sm font-bold text-gray-900">Profile</p>
                <p className="text-xs text-gray-400">Grades & identity</p>
              </Link>
              <Link href="/friends"
                className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-center hover:border-gray-200 transition-all active:scale-[0.98]">
                <p className="text-2xl mb-1">👥</p>
                <p className="text-sm font-bold text-gray-900">Friends</p>
                <p className="text-xs text-gray-400">Find & view players</p>
              </Link>
              <Link href="/friends?tab=challenges"
                className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-center hover:border-gray-200 transition-all active:scale-[0.98] relative">
                <p className="text-2xl mb-1">⚔️</p>
                <p className="text-sm font-bold text-gray-900">Challenges</p>
                <p className="text-xs text-gray-400">Teams & groups</p>
                {dashChallenges.length > 0 && (
                  <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-lime-400 text-black text-[9px] font-black flex items-center justify-center">
                    {dashChallenges.length}
                  </span>
                )}
              </Link>
              <Link href="/achievements"
                className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-center hover:border-gray-200 transition-all active:scale-[0.98]">
                <p className="text-2xl mb-1">🏅</p>
                <p className="text-sm font-bold text-gray-900">Achievements</p>
                <p className="text-xs text-gray-400">Badges & progress</p>
              </Link>
            </div>

            {/* Sign Out */}
            <button
              onClick={signOut}
              className="w-full py-3 rounded-2xl border border-red-200 text-red-500 text-sm font-bold hover:bg-red-50 hover:border-red-300 transition-all active:scale-[0.98]"
            >
              Sign Out
            </button>
          </>
      </div>

      <BottomNav active="dashboard" />
    </main>
    </>
  );
}
