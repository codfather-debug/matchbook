"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import BottomNav from "@/components/BottomNav";
import ProfileCard from "@/components/ProfileCard";

type SubTab = "leaderboard" | "feed" | "wall" | "challenges" | "manage";

interface MemberStat {
  userId: string;
  displayName: string;
  username: string;
  wins: number;
  losses: number;
  winPct: number;
}

interface FeedMatch {
  id: string;
  opponent_name: string;
  result: string;
  surface: string;
  created_at: string;
  player_name: string;
}

interface WallReply {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  display_name?: string;
  username?: string;
}

interface WallPost {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  display_name?: string;
  username?: string;
  replies: WallReply[];
}

interface ChallengeRow {
  id: string;
  challenger_id: string;
  opponent_id: string;
  status: string;
  created_at: string;
  match_id?: string;
  challenger_name?: string;
  opponent_name?: string;
}

interface ManagedMember {
  userId: string;
  displayName: string;
  username: string;
  role: string;
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function TeamPage() {
  const router = useRouter();
  const params = useParams();
  const teamId = params?.id as string;

  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState<SubTab>("leaderboard");
  const [copied, setCopied] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAssistant, setIsAssistant] = useState(false);
  const [leaveBusy, setLeaveBusy] = useState(false);

  // Team metadata
  const [teamName, setTeamName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [memberCount, setMemberCount] = useState(0);

  // Sub-tab data
  const [leaderboard, setLeaderboard] = useState<MemberStat[]>([]);
  const [feed, setFeed] = useState<FeedMatch[]>([]);
  const [posts, setPosts] = useState<WallPost[]>([]);
  const [postText, setPostText] = useState("");
  const [postBusy, setPostBusy] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [challenges, setChallenges] = useState<ChallengeRow[]>([]);
  const [challengeBusy, setChallengeBusy] = useState<Set<string>>(new Set());
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  // Manage tab
  const [managedMembers, setManagedMembers] = useState<ManagedMember[]>([]);
  const [manageSearchQuery, setManageSearchQuery] = useState("");
  const [manageSearchResults, setManageSearchResults] = useState<{id: string; display_name?: string; username: string}[]>([]);
  const [manageBusy, setManageBusy] = useState<Set<string>>(new Set());

  const loadLeaderboard = useCallback(async () => {
    const { data: members } = await supabase
      .from("team_members")
      .select("user_id, role")
      .eq("team_id", teamId);
    if (!members) return;

    const userIds = members.map(m => m.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, username, display_name")
      .in("id", userIds);

    const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]));

    const stats = await Promise.all(userIds.map(async uid => {
      const { data: matchRows } = await supabase
        .from("matches")
        .select("data")
        .eq("user_id", uid);
      const wins = (matchRows ?? []).filter(m => (m.data as { result?: string })?.result === "win").length;
      const losses = (matchRows ?? []).filter(m => (m.data as { result?: string })?.result === "loss").length;
      const total = wins + losses;
      return {
        userId: uid,
        displayName: profileMap[uid]?.display_name ?? "",
        username: profileMap[uid]?.username ?? uid,
        wins,
        losses,
        winPct: total > 0 ? Math.round((wins / total) * 100) : 0,
      };
    }));

    stats.sort((a, b) => b.winPct - a.winPct || b.wins - a.wins);
    setLeaderboard(stats);
  }, [teamId]);

  const loadFeed = useCallback(async () => {
    const { data: members } = await supabase
      .from("team_members")
      .select("user_id")
      .eq("team_id", teamId);
    if (!members) return;

    const userIds = members.map(m => m.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name, username")
      .in("id", userIds);
    const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]));

    const { data: matchRows } = await supabase
      .from("matches")
      .select("id, data, created_at, user_id")
      .in("user_id", userIds)
      .order("created_at", { ascending: false })
      .limit(30);

    type MD = { opponentName?: string; result?: string; surface?: string };
    setFeed(
      (matchRows ?? []).map(m => {
        const d = m.data as MD;
        return {
          id: m.id,
          opponent_name: d?.opponentName ?? "Unknown",
          result: d?.result ?? "unfinished",
          surface: d?.surface ?? "",
          created_at: m.created_at,
          player_name: profileMap[m.user_id]?.display_name ?? `@${profileMap[m.user_id]?.username ?? m.user_id}`,
        };
      })
    );
  }, [teamId]);

  const loadWall = useCallback(async () => {
    const { data: postRows } = await supabase
      .from("team_posts")
      .select("id, user_id, content, created_at, reply_to_id")
      .eq("team_id", teamId)
      .order("created_at", { ascending: true })
      .limit(200);
    if (!postRows || postRows.length === 0) { setPosts([]); return; }

    const uids = [...new Set(postRows.map(p => p.user_id))];
    const { data: profiles } = await supabase
      .from("profiles").select("id, display_name, username").in("id", uids);
    const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]));

    type RawPost = { id: string; user_id: string; content: string; created_at: string; reply_to_id?: string | null };
    const postMap: Record<string, WallPost> = {};
    const topLevel: WallPost[] = [];

    for (const p of postRows as RawPost[]) {
      if (!p.reply_to_id) {
        const wp: WallPost = {
          id: p.id, user_id: p.user_id, content: p.content, created_at: p.created_at,
          display_name: profileMap[p.user_id]?.display_name,
          username: profileMap[p.user_id]?.username ?? p.user_id,
          replies: [],
        };
        postMap[p.id] = wp;
        topLevel.push(wp);
      }
    }
    for (const p of postRows as RawPost[]) {
      if (p.reply_to_id && postMap[p.reply_to_id]) {
        postMap[p.reply_to_id].replies.push({
          id: p.id, user_id: p.user_id, content: p.content, created_at: p.created_at,
          display_name: profileMap[p.user_id]?.display_name,
          username: profileMap[p.user_id]?.username ?? p.user_id,
        });
      }
    }
    topLevel.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setPosts(topLevel);
  }, [teamId]);

  const loadChallenges = useCallback(async (uid: string) => {
    const { data: rows } = await supabase
      .from("challenges")
      .select("id, challenger_id, opponent_id, status, created_at, match_id")
      .eq("team_id", teamId)
      .or(`challenger_id.eq.${uid},opponent_id.eq.${uid}`)
      .order("created_at", { ascending: false });
    if (!rows || rows.length === 0) { setChallenges([]); return; }

    const uids = [...new Set(rows.flatMap(r => [r.challenger_id, r.opponent_id]))];
    const { data: profiles } = await supabase
      .from("profiles").select("id, display_name, username").in("id", uids);
    const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]));
    const name = (id: string) => profileMap[id]?.display_name ?? `@${profileMap[id]?.username ?? id}`;

    setChallenges(rows.map(r => ({
      ...r,
      challenger_name: name(r.challenger_id),
      opponent_name: name(r.opponent_id),
    })));
  }, [teamId]);

  const loadManagedMembers = useCallback(async () => {
    const { data: rows } = await supabase
      .from("team_members")
      .select("user_id, role")
      .eq("team_id", teamId);
    if (!rows || rows.length === 0) { setManagedMembers([]); return; }
    const uids = rows.map(r => r.user_id);
    const { data: profiles } = await supabase
      .from("profiles").select("id, display_name, username").in("id", uids);
    const pm = Object.fromEntries((profiles ?? []).map(p => [p.id, p]));
    setManagedMembers(rows.map(r => ({
      userId: r.user_id,
      role: r.role,
      displayName: pm[r.user_id]?.display_name ?? "",
      username: pm[r.user_id]?.username ?? r.user_id,
    })));
  }, [teamId]);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/auth"); return; }
      setUserId(user.id);

      // Load team meta
      const { data: team } = await supabase
        .from("teams").select("name, invite_code").eq("id", teamId).single();
      if (!team) { router.push("/friends"); return; }
      setTeamName(team.name);
      setInviteCode(team.invite_code);

      // Check membership + role
      const { data: membership } = await supabase
        .from("team_members").select("role").eq("team_id", teamId).eq("user_id", user.id).single();
      if (!membership) { router.push("/friends"); return; }
      setIsAdmin(membership.role === "admin");
      setIsAssistant(membership.role === "assistant");

      // Member count
      const { count } = await supabase
        .from("team_members").select("id", { count: "exact", head: true }).eq("team_id", teamId);
      setMemberCount(count ?? 0);

      await Promise.all([
        loadLeaderboard(),
        loadFeed(),
        loadWall(),
        loadChallenges(user.id),
        loadManagedMembers(),
      ]);
      setLoading(false);
    }
    init();
  }, [router, teamId, loadLeaderboard, loadFeed, loadWall, loadChallenges, loadManagedMembers]);

  // Refresh data when switching tabs so new matches/challenges appear immediately
  function switchTab(tab: SubTab) {
    setSubTab(tab);
    if (tab === "leaderboard") loadLeaderboard();
    else if (tab === "feed") loadFeed();
    else if (tab === "challenges" && userId) loadChallenges(userId);
    else if (tab === "manage") loadManagedMembers();
  }

  // Also refresh leaderboard + feed when the user returns to this page
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible" && userId) {
        loadLeaderboard();
        loadFeed();
      }
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [userId, loadLeaderboard, loadFeed]);

  async function submitPost() {
    if (!postText.trim()) return;
    setPostBusy(true);
    await supabase.from("team_posts").insert({ team_id: teamId, user_id: userId, content: postText.trim() });
    setPostText("");
    await loadWall();
    setPostBusy(false);
  }

  async function submitReply(postId: string) {
    if (!replyText.trim()) return;
    setPostBusy(true);
    await supabase.from("team_posts").insert({
      team_id: teamId, user_id: userId, content: replyText.trim(), reply_to_id: postId,
    });
    setReplyText("");
    setReplyingTo(null);
    await loadWall();
    setPostBusy(false);
  }

  async function deletePost(postId: string) {
    await supabase.from("team_posts").delete().eq("id", postId);
    await loadWall();
  }

  async function deleteReply(replyId: string) {
    await supabase.from("team_posts").delete().eq("id", replyId);
    await loadWall();
  }

  async function kickMember(uid: string) {
    setManageBusy(s => new Set(s).add(uid));
    await supabase.from("team_members").delete().eq("team_id", teamId).eq("user_id", uid);
    setMemberCount(c => Math.max(0, c - 1));
    await loadManagedMembers();
    await loadLeaderboard();
    setManageBusy(s => { const n = new Set(s); n.delete(uid); return n; });
  }

  async function changeTeamRole(uid: string, newRole: "admin" | "assistant" | "member") {
    setManageBusy(s => new Set(s).add(uid));
    const { error } = await supabase
      .from("team_members").update({ role: newRole }).eq("team_id", teamId).eq("user_id", uid);
    if (error) console.error("changeTeamRole:", error.message);
    await loadManagedMembers();
    setManageBusy(s => { const n = new Set(s); n.delete(uid); return n; });
  }

  async function searchToAdd(q: string) {
    setManageSearchQuery(q);
    if (q.trim().length < 2) { setManageSearchResults([]); return; }
    const existingIds = managedMembers.map(m => m.userId);
    const { data } = await supabase
      .from("profiles")
      .select("id, display_name, username")
      .or(`username.ilike.%${q.trim()}%,display_name.ilike.%${q.trim()}%`)
      .not("id", "in", `(${existingIds.join(",")})`)
      .limit(8);
    setManageSearchResults(data ?? []);
  }

  async function addTeamMember(uid: string) {
    setManageBusy(s => new Set(s).add(uid));
    await supabase.from("team_members").insert({ team_id: teamId, user_id: uid, role: "member" });
    setMemberCount(c => c + 1);
    setManageSearchResults(prev => prev.filter(r => r.id !== uid));
    await loadManagedMembers();
    await loadLeaderboard();
    setManageBusy(s => { const n = new Set(s); n.delete(uid); return n; });
  }

  async function sendChallenge(opponentId: string) {
    setChallengeBusy(s => new Set(s).add(opponentId));
    // Block if an active challenge already exists between these two users
    const [{ data: c1 }, { data: c2 }] = await Promise.all([
      supabase.from("challenges").select("id").eq("team_id", teamId)
        .eq("challenger_id", userId).eq("opponent_id", opponentId)
        .in("status", ["pending", "accepted"]).limit(1),
      supabase.from("challenges").select("id").eq("team_id", teamId)
        .eq("challenger_id", opponentId).eq("opponent_id", userId)
        .in("status", ["pending", "accepted"]).limit(1),
    ]);
    if ((c1 && c1.length > 0) || (c2 && c2.length > 0)) {
      alert("You already have an active challenge with this player. Complete it first.");
      setChallengeBusy(s => { const n = new Set(s); n.delete(opponentId); return n; });
      return;
    }
    await supabase.from("challenges").insert({
      team_id: teamId, challenger_id: userId, opponent_id: opponentId, status: "pending",
    });
    await loadChallenges(userId);
    setChallengeBusy(s => { const n = new Set(s); n.delete(opponentId); return n; });
  }

  async function respondChallenge(id: string, accept: boolean) {
    setChallengeBusy(s => new Set(s).add(id));
    if (accept) {
      await supabase.from("challenges").update({ status: "accepted" }).eq("id", id);
    } else {
      await supabase.from("challenges").delete().eq("id", id);
    }
    await loadChallenges(userId);
    setChallengeBusy(s => { const n = new Set(s); n.delete(id); return n; });
  }

  async function leaveTeam() {
    if (!confirm("Leave this team?")) return;
    setLeaveBusy(true);
    await supabase.from("team_members").delete().eq("team_id", teamId).eq("user_id", userId);
    router.push("/friends");
  }

  function copyCode() {
    navigator.clipboard.writeText(inviteCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0c0c0e] flex items-center justify-center">
        <p className="text-white/30 text-sm">Loading…</p>
      </main>
    );
  }

  const subTabs: SubTab[] = ["leaderboard", "feed", "wall", "challenges", "manage"];

  return (
    <main className="min-h-screen bg-[#0c0c0e] max-w-sm mx-auto pb-24">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-2 mb-1">
          <Link href="/friends" className="text-white/30 hover:text-white/60 transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </Link>
          <p className="text-white/30 text-xs font-bold tracking-widest uppercase">Teams</p>
        </div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-white leading-tight">{teamName}</h1>
            <p className="text-white/30 text-xs mt-0.5">{memberCount} member{memberCount !== 1 ? "s" : ""}</p>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <button
              onClick={copyCode}
              className="flex items-center gap-1.5 text-xs font-mono font-bold text-white/50 bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl hover:text-white/80 transition-all active:scale-95"
            >
              {inviteCode} {copied ? "✓" : <span className="text-white/25">copy</span>}
            </button>
            <button
              onClick={leaveTeam}
              disabled={leaveBusy}
              className="text-xs font-bold text-white/25 hover:text-red-400/70 transition-colors disabled:opacity-40"
            >
              Leave
            </button>
          </div>
        </div>

        {/* Sub-tab switcher */}
        <div className="flex gap-1 mt-4 overflow-x-auto no-scrollbar">
          {subTabs.map(t => (
            <button
              key={t}
              onClick={() => switchTab(t)}
              className={`text-[10px] font-black tracking-widest uppercase px-3 py-1.5 rounded-xl whitespace-nowrap transition-all flex-shrink-0
                ${subTab === t ? "bg-lime-400/20 text-lime-400" : "text-white/30 hover:text-white/50"}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 py-5 space-y-4">

        {/* ── LEADERBOARD ── */}
        {subTab === "leaderboard" && (
          <div className="space-y-2">
            {leaderboard.length === 0 ? (
              <p className="text-white/25 text-sm text-center py-8">No members yet</p>
            ) : (
              leaderboard.map((m, i) => (
                <div key={m.userId} className="flex items-center gap-3 bg-white/[0.03] border border-white/[0.06] rounded-2xl px-4 py-3">
                  <span className="text-xs font-black text-white/20 w-5 text-center">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <button
                      onClick={() => setProfileUserId(m.userId)}
                      className="text-sm font-semibold text-white/80 truncate hover:text-white transition-colors text-left"
                    >
                      {m.displayName || `@${m.username}`}
                      {m.userId === userId && <span className="text-xs text-lime-400/60 ml-1.5">you</span>}
                    </button>
                    <p className="text-xs text-white/30">{m.wins}W – {m.losses}L</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-black ${m.winPct >= 60 ? "text-lime-400" : m.winPct >= 40 ? "text-white/60" : "text-white/30"}`}>
                      {m.winPct}%
                    </span>
                    {m.userId !== userId && (
                      <button
                        onClick={() => sendChallenge(m.userId)}
                        disabled={challengeBusy.has(m.userId)}
                        className="text-[10px] font-black text-lime-400/70 bg-lime-400/10 px-2.5 py-1 rounded-lg hover:bg-lime-400/20 transition-all active:scale-95 disabled:opacity-40"
                      >
                        Challenge
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── FEED ── */}
        {subTab === "feed" && (
          <div className="space-y-2">
            {feed.length === 0 ? (
              <p className="text-white/25 text-sm text-center py-8">No matches logged yet</p>
            ) : (
              feed.map(m => (
                <Link key={m.id} href={`/match/${m.id}`} className="block bg-white/[0.03] border border-white/[0.06] rounded-2xl px-4 py-3 hover:border-white/10 transition-all">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-white/30">{m.player_name}</span>
                    <span className="text-[10px] text-white/20">{relativeTime(m.created_at)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-white/80">vs {m.opponent_name}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-white/30 capitalize">{m.surface}</span>
                      <span className={`text-xs font-black px-2 py-0.5 rounded-lg ${m.result === "win" ? "text-lime-400 bg-lime-400/10" : "text-red-400/70 bg-red-400/10"}`}>
                        {m.result === "win" ? "W" : "L"}
                      </span>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        )}

        {/* ── WALL ── */}
        {subTab === "wall" && (
          <div className="space-y-4">
            {/* Post input */}
            <div className="space-y-2">
              <textarea
                value={postText}
                onChange={e => setPostText(e.target.value)}
                placeholder="Post something to the team…"
                rows={2}
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm placeholder:text-white/25 outline-none focus:ring-2 focus:ring-lime-400/50 focus:border-lime-400/30 transition-all resize-none"
              />
              <button
                onClick={submitPost}
                disabled={postBusy || !postText.trim()}
                className="w-full text-sm font-black text-black bg-lime-400 py-2.5 rounded-2xl hover:bg-lime-300 transition-all active:scale-95 disabled:opacity-40"
              >
                {postBusy ? "Posting…" : "Post"}
              </button>
            </div>

            {/* Posts list */}
            {posts.length === 0 ? (
              <p className="text-white/25 text-sm text-center py-4">No posts yet — be the first!</p>
            ) : (
              <div className="space-y-2">
                {posts.map(p => (
                  <div key={p.id} className="bg-white/[0.03] border border-white/[0.06] rounded-2xl px-4 py-3 space-y-2">
                    {/* Post header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-lime-400/20 flex items-center justify-center">
                          <span className="text-[10px] font-black text-lime-400">
                            {(p.display_name || p.username || "?")[0].toUpperCase()}
                          </span>
                        </div>
                        <span className="text-xs font-bold text-white/50">
                          {p.display_name ?? `@${p.username}`}
                          {p.user_id === userId && <span className="text-lime-400/50 ml-1">· you</span>}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-white/20">{relativeTime(p.created_at)}</span>
                        {(p.user_id === userId || isAdmin) && (
                          <button
                            onClick={() => deletePost(p.id)}
                            className="text-white/15 hover:text-red-400/60 transition-colors text-sm leading-none"
                            title="Delete post"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    </div>
                    {/* Post content */}
                    <p className="text-sm text-white/70 leading-relaxed">{p.content}</p>
                    {/* Replies */}
                    {p.replies.length > 0 && (
                      <div className="ml-3 border-l border-white/10 pl-3 space-y-2 mt-1">
                        {p.replies.map(r => (
                          <div key={r.id}>
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span className="text-[10px] font-black text-white/40">
                                {r.display_name ?? `@${r.username}`}
                                {r.user_id === userId && <span className="text-lime-400/40 ml-1">· you</span>}
                              </span>
                              <span className="text-[9px] text-white/15">{relativeTime(r.created_at)}</span>
                              {(r.user_id === userId || isAdmin) && (
                                <button
                                  onClick={() => deleteReply(r.id)}
                                  className="text-white/15 hover:text-red-400/60 transition-colors text-xs leading-none ml-auto"
                                  title="Delete reply"
                                >
                                  ×
                                </button>
                              )}
                            </div>
                            <p className="text-xs text-white/60 leading-relaxed">{r.content}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Reply toggle */}
                    <button
                      onClick={() => { setReplyingTo(replyingTo === p.id ? null : p.id); setReplyText(""); }}
                      className="text-[10px] font-bold text-white/20 hover:text-white/50 transition-colors"
                    >
                      {replyingTo === p.id ? "Cancel" : `Reply${p.replies.length > 0 ? ` (${p.replies.length})` : ""}`}
                    </button>
                    {/* Inline reply input */}
                    {replyingTo === p.id && (
                      <div className="flex gap-2 mt-1">
                        <input
                          autoFocus
                          type="text"
                          placeholder="Write a reply…"
                          value={replyText}
                          onChange={e => setReplyText(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") submitReply(p.id); }}
                          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-white text-xs placeholder:text-white/20 outline-none focus:ring-1 focus:ring-lime-400/50 transition-all"
                        />
                        <button
                          onClick={() => submitReply(p.id)}
                          disabled={postBusy || !replyText.trim()}
                          className="text-xs font-black text-black bg-lime-400 px-3 py-1.5 rounded-xl hover:bg-lime-300 transition-all disabled:opacity-40"
                        >
                          Post
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── CHALLENGES ── */}
        {subTab === "challenges" && (
          <div className="space-y-3">
            <p className="text-xs font-black tracking-widest uppercase text-white/30">Your Challenges</p>
            {challenges.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center space-y-2">
                <p className="text-3xl">⚔️</p>
                <p className="text-sm text-white/50">No challenges yet</p>
                <p className="text-xs text-white/25">Challenge a teammate from the leaderboard</p>
              </div>
            ) : (
              <div className="space-y-2">
                {challenges.map(c => {
                  const isChallenger = c.challenger_id === userId;
                  const iReceived = c.opponent_id === userId && c.status === "pending";
                  return (
                    <div key={c.id} className="bg-white/[0.03] border border-white/[0.06] rounded-2xl px-4 py-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-white/80">
                            {isChallenger ? `vs ${c.opponent_name}` : `from ${c.challenger_name}`}
                          </p>
                          <p className="text-xs text-white/30 capitalize mt-0.5">
                            {c.status === "pending" && isChallenger ? "Waiting for response…" : c.status}
                          </p>
                        </div>
                        {iReceived && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => respondChallenge(c.id, false)}
                              disabled={challengeBusy.has(c.id)}
                              className="text-xs font-bold text-white/40 bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl hover:text-white/60 transition-all disabled:opacity-40"
                            >
                              Decline
                            </button>
                            <button
                              onClick={() => respondChallenge(c.id, true)}
                              disabled={challengeBusy.has(c.id)}
                              className="text-xs font-black text-lime-400 bg-lime-400/10 px-3 py-1.5 rounded-xl hover:bg-lime-400/20 transition-all disabled:opacity-40"
                            >
                              Accept
                            </button>
                          </div>
                        )}
                        {c.status === "accepted" && (
                          <div className="flex gap-2">
                            <Link
                              href={`/log?opponent=${encodeURIComponent(isChallenger ? (c.opponent_name ?? "") : (c.challenger_name ?? ""))}&challengeId=${c.id}&challengeType=team`}
                              className="text-xs font-black text-lime-400 bg-lime-400/10 px-3 py-1.5 rounded-xl hover:bg-lime-400/20 transition-all"
                            >
                              Log Match
                            </Link>
                            <button
                              onClick={() => respondChallenge(c.id, false)}
                              disabled={challengeBusy.has(c.id)}
                              className="text-xs font-bold text-white/25 hover:text-red-400/70 transition-colors disabled:opacity-40"
                              title="Cancel challenge"
                            >
                              ×
                            </button>
                          </div>
                        )}
                        {c.status === "completed" && c.match_id && (
                          <Link
                            href={`/match/${c.match_id}`}
                            className="text-xs font-black text-lime-400/70 bg-lime-400/10 px-3 py-1.5 rounded-xl hover:bg-lime-400/20 transition-all"
                          >
                            View Match
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── MANAGE ── */}
        {subTab === "manage" && (
          <div className="space-y-5">
            {(!isAdmin && !isAssistant) ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center">
                <p className="text-sm text-white/40">Only coaches can manage members.</p>
              </div>
            ) : (
              <>
                {/* Add Member — coaches + assistants */}
                <section className="space-y-3">
                  <p className="text-xs font-black tracking-widest uppercase text-white/30">Add Member</p>
                  <input
                    type="text"
                    placeholder="Search by name or username…"
                    value={manageSearchQuery}
                    onChange={e => searchToAdd(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm placeholder:text-white/25 outline-none focus:ring-2 focus:ring-lime-400/50 focus:border-lime-400/30 transition-all"
                  />
                  {manageSearchResults.length > 0 && (
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] divide-y divide-white/[0.06]">
                      {manageSearchResults.map(r => (
                        <div key={r.id} className="flex items-center justify-between px-4 py-3 gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-white/80 truncate">{r.display_name ?? `@${r.username}`}</p>
                            {r.display_name && <p className="text-xs text-white/30">@{r.username}</p>}
                          </div>
                          <button
                            onClick={() => addTeamMember(r.id)}
                            disabled={manageBusy.has(r.id)}
                            className="text-xs font-black text-lime-400 bg-lime-400/10 px-3 py-1.5 rounded-xl hover:bg-lime-400/20 transition-all active:scale-95 disabled:opacity-40 flex-shrink-0"
                          >
                            {manageBusy.has(r.id) ? "Adding…" : "Add"}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* Member list — coaches only */}
                {isAdmin && (
                  <section className="space-y-3">
                    <p className="text-xs font-black tracking-widest uppercase text-white/30">
                      Members <span className="text-white/20">({managedMembers.length})</span>
                    </p>
                    {managedMembers.length === 0 ? (
                      <p className="text-white/25 text-sm text-center py-4">No members</p>
                    ) : (
                      <div className="rounded-2xl border border-white/10 bg-white/[0.03] divide-y divide-white/[0.06]">
                        {managedMembers.map(m => (
                          <div key={m.userId} className="flex items-center justify-between px-4 py-3 gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-8 h-8 rounded-full bg-lime-400/10 flex items-center justify-center flex-shrink-0">
                                <span className="text-xs font-black text-lime-400">
                                  {(m.displayName || m.username)[0].toUpperCase()}
                                </span>
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-white/80 truncate">
                                  {m.displayName || `@${m.username}`}
                                  {m.userId === userId && <span className="text-xs text-lime-400/50 ml-1.5">you</span>}
                                </p>
                                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${
                                  m.role === "admin" ? "bg-lime-400/10 text-lime-400"
                                  : m.role === "assistant" ? "bg-amber-400/10 text-amber-400"
                                  : "bg-white/5 text-white/30"
                                }`}>
                                  {m.role === "admin" ? "Coach" : m.role === "assistant" ? "Asst" : "Member"}
                                </span>
                              </div>
                            </div>
                            {m.userId !== userId && (
                              <div className="flex gap-1.5 flex-shrink-0 items-center">
                                {m.role === "member" && (<>
                                  <button onClick={() => changeTeamRole(m.userId, "admin")} disabled={manageBusy.has(m.userId)}
                                    className="text-[10px] font-black text-lime-400/70 bg-lime-400/10 px-2 py-1 rounded-xl hover:bg-lime-400/20 transition-all active:scale-95 disabled:opacity-40">
                                    Coach
                                  </button>
                                  <button onClick={() => changeTeamRole(m.userId, "assistant")} disabled={manageBusy.has(m.userId)}
                                    className="text-[10px] font-black text-amber-400/70 bg-amber-400/10 px-2 py-1 rounded-xl hover:bg-amber-400/20 transition-all active:scale-95 disabled:opacity-40">
                                    Asst
                                  </button>
                                </>)}
                                {m.role === "assistant" && (<>
                                  <button onClick={() => changeTeamRole(m.userId, "admin")} disabled={manageBusy.has(m.userId)}
                                    className="text-[10px] font-black text-lime-400/70 bg-lime-400/10 px-2 py-1 rounded-xl hover:bg-lime-400/20 transition-all active:scale-95 disabled:opacity-40">
                                    Coach
                                  </button>
                                  <button onClick={() => changeTeamRole(m.userId, "member")} disabled={manageBusy.has(m.userId)}
                                    className="text-[10px] font-black text-white/40 bg-white/5 border border-white/10 px-2 py-1 rounded-xl hover:text-white/70 transition-all active:scale-95 disabled:opacity-40">
                                    Demote
                                  </button>
                                </>)}
                                {m.role === "admin" && (
                                  <button onClick={() => changeTeamRole(m.userId, "member")} disabled={manageBusy.has(m.userId)}
                                    className="text-[10px] font-black text-white/40 bg-white/5 border border-white/10 px-2.5 py-1 rounded-xl hover:text-white/70 transition-all active:scale-95 disabled:opacity-40">
                                    Demote
                                  </button>
                                )}
                                <button onClick={() => kickMember(m.userId)} disabled={manageBusy.has(m.userId)}
                                  className="text-[10px] font-bold text-white/25 hover:text-red-400/70 transition-colors disabled:opacity-40"
                                  title="Remove from team">
                                  ×
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                )}
              </>
            )}
          </div>
        )}

      </div>

      <BottomNav active="friends" />

      {profileUserId && (
        <ProfileCard userId={profileUserId} onClose={() => setProfileUserId(null)} />
      )}
    </main>
  );
}
