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
    <div className={`rounded-2xl border p-4 flex items-center justify-between ${value ? bg : "border-gray-200 bg-gray-50"}`}>
      <div>
        <p className="text-sm font-bold text-gray-700">{label}</p>
        {note && <p className="text-xs text-gray-400 mt-0.5">{note}</p>}
      </div>
      <span className={`text-3xl font-black ${value ? g : "text-gray-300"}`}>{value ?? "—"}</span>
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
  const [discoverable, setDiscoverable] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/auth"); return; }
      setEmail(user.email?.split("@")[0] ?? "Player");
      setUserId(user.id);
      await upsertProfile(user);

      // Load profile settings
      const { data: profile } = await supabase
        .from("profiles").select("share_stats, share_history, display_name, avatar_url, discoverable").eq("id", user.id).single();
      if (profile) {
        setShareStats(profile.share_stats ?? true);
        setShareHistory(profile.share_history ?? true);
        setDiscoverable(profile.discoverable ?? true);
        if (profile.avatar_url) setAvatarUrl(profile.avatar_url);
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

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/auth");
  }

  async function updatePrivacy(field: "share_stats" | "share_history" | "discoverable", value: boolean) {
    if (field === "share_stats") setShareStats(value);
    else if (field === "share_history") setShareHistory(value);
    else setDiscoverable(value);
    await supabase.from("profiles").update({ [field]: value }).eq("id", userId);
  }

  async function uploadAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    setUploadingAvatar(true);
    const { error } = await supabase.storage
      .from("avatars")
      .upload(userId, file, { upsert: true, contentType: file.type });
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(userId);
      await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("id", userId);
      setAvatarUrl(publicUrl);
    }
    setUploadingAvatar(false);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-gray-400 text-sm">Loading…</p>
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
    <main className="min-h-screen bg-white max-w-sm mx-auto pb-24">
      {/* Header */}
      <div className="px-5 pt-5 pb-5 border-b border-gray-200">
        <p className="text-gray-400 text-xs font-bold tracking-widest uppercase mb-4">Player Profile</p>
        <div className="flex items-center gap-4">
          {/* Avatar circle */}
          <label className="relative shrink-0 cursor-pointer group">
            <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-gray-200 bg-gray-100 flex items-center justify-center">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl font-black text-lime-600">
                  {(displayName || email)[0]?.toUpperCase() ?? "?"}
                </span>
              )}
            </div>
            {/* Upload overlay */}
            <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-lime-400 border-2 border-white flex items-center justify-center shadow-sm group-hover:bg-lime-300 transition-colors">
              {uploadingAvatar ? (
                <svg className="animate-spin" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="3">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/>
                </svg>
              ) : (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="3" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
              )}
            </div>
            <input type="file" accept="image/*" className="hidden" onChange={uploadAvatar} disabled={uploadingAvatar} />
          </label>

          {/* Name + stats */}
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-black text-gray-900 truncate">{displayName || email}</h1>
            <p className="text-gray-500 text-sm mt-0.5">{record.wins}W – {record.losses}L · {winRate}% win rate</p>
            <p className="text-gray-400 text-xs mt-0.5">{matches.length} matches logged</p>
          </div>

          {/* Streak */}
          {streak !== 0 && (
            <div className="text-right shrink-0">
              <div className={`text-2xl font-black ${streak > 0 ? "text-lime-700" : "text-red-600"}`}>
                {streak > 0 ? `+${streak}W` : `${Math.abs(streak)}L`}
              </div>
              <p className="text-xs text-gray-400">streak</p>
            </div>
          )}
        </div>
      </div>

      <div className="px-5 py-5 space-y-6">

        {/* Performance Grades */}
        <section className="space-y-3">
          <p className="text-xs font-black tracking-widest uppercase text-gray-400">Performance Grades</p>
          <p className="text-xs text-gray-300">Based on last 10 matches</p>
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
            <p className="text-xs font-black tracking-widest uppercase text-gray-400">Identity Snapshot</p>
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 space-y-3">
              {topStyle && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500">Most common opponent type</p>
                  <span className="px-2.5 py-0.5 rounded-full bg-white/10 text-gray-700 text-xs font-semibold">
                    {PLAY_STYLES.find(p => p.value === topStyle)?.label ?? topStyle}
                  </span>
                </div>
              )}
              {bestSurface && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500">Best surface</p>
                  <span className="text-sm font-bold text-lime-700">
                    {surfEmoji[bestSurface]} {bestSurface.charAt(0).toUpperCase() + bestSurface.slice(1)} ({bestSurfRate}%)
                  </span>
                </div>
              )}
              {lossPattern && (
                <div className="flex items-start justify-between gap-4">
                  <p className="text-sm text-gray-500">Loss pattern</p>
                  <p className="text-sm text-red-600/80 font-medium text-right">{lossPattern}</p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Achievements link */}
        <Link href="/achievements"
          className="flex items-center justify-between p-4 rounded-2xl border border-gray-200 bg-gray-50 hover:border-gray-200 transition-all active:scale-[0.98]">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏅</span>
            <div>
              <p className="text-sm font-bold text-gray-900">Achievements</p>
              <p className="text-xs text-gray-400">View your badges & progress</p>
            </div>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-gray-400">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </Link>

        {/* Friends link */}
        <Link href="/friends"
          className="flex items-center justify-between p-4 rounded-2xl border border-gray-200 bg-gray-50 hover:border-gray-200 transition-all active:scale-[0.98]">
          <div className="flex items-center gap-3">
            <span className="text-2xl">👥</span>
            <div>
              <p className="text-sm font-bold text-gray-900">Friends</p>
              <p className="text-xs text-gray-400">Find players & view their stats</p>
            </div>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-gray-400">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </Link>

        {/* Name */}
        <section className="space-y-3">
          <p className="text-xs font-black tracking-widest uppercase text-gray-400">Your Name</p>
          <p className="text-xs text-gray-300">Shown to friends when they search for you</p>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="First"
              value={firstName}
              onChange={e => setFirstName(e.target.value)}
              className="flex-1 bg-white/5 border border-gray-200 rounded-2xl px-4 py-3 text-gray-900 text-sm placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-lime-400/50 focus:border-lime-400/30 transition-all"
            />
            <input
              type="text"
              placeholder="Last"
              value={lastName}
              onChange={e => setLastName(e.target.value)}
              className="flex-1 bg-white/5 border border-gray-200 rounded-2xl px-4 py-3 text-gray-900 text-sm placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-lime-400/50 focus:border-lime-400/30 transition-all"
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
          <p className="text-xs font-black tracking-widest uppercase text-gray-400">Privacy</p>
          <div className="rounded-2xl border border-gray-200 bg-gray-50 divide-y divide-white/[0.06]">
            <div className="flex items-center justify-between px-4 py-3.5">
              <div>
                <p className="text-sm font-semibold text-gray-800">Share my stats</p>
                <p className="text-xs text-gray-400 mt-0.5">Friends can see your grades & record</p>
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
                <p className="text-sm font-semibold text-gray-800">Share my match history</p>
                <p className="text-xs text-gray-400 mt-0.5">Friends can see your match feed</p>
              </div>
              <button
                onClick={() => updatePrivacy("share_history", !shareHistory)}
                className={`relative w-12 h-6 rounded-full transition-colors ${shareHistory ? "bg-lime-400" : "bg-white/20"}`}
              >
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${shareHistory ? "translate-x-7" : "translate-x-1"}`} />
              </button>
            </div>
            <div className="flex items-center justify-between px-4 py-3.5">
              <div>
                <p className="text-sm font-semibold text-gray-800">Discoverable by others</p>
                <p className="text-xs text-gray-400 mt-0.5">Appear in player search results</p>
              </div>
              <button
                onClick={() => updatePrivacy("discoverable", !discoverable)}
                className={`relative w-12 h-6 rounded-full transition-colors ${discoverable ? "bg-lime-400" : "bg-white/20"}`}
              >
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${discoverable ? "translate-x-7" : "translate-x-1"}`} />
              </button>
            </div>
          </div>
        </section>

        {/* Sign Out */}
        <button
          onClick={signOut}
          className="w-full py-3 rounded-2xl border border-red-200 text-red-500 text-sm font-bold hover:bg-red-50 hover:border-red-300 transition-all active:scale-[0.98]"
        >
          Sign Out
        </button>

      </div>

      <BottomNav active="profile" />
    </main>
  );
}
