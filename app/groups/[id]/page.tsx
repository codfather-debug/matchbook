"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import BottomNav from "@/components/BottomNav";
import ProfileCard from "@/components/ProfileCard";
import AvatarCircle from "@/components/AvatarCircle";

interface Member {
  userId: string;
  displayName?: string;
  username: string;
  avatarUrl?: string;
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
  userId: string;
  content: string;
  created_at: string;
  playerName: string;
  initial: string;
  avatarUrl?: string;
}

interface WallPost {
  id: string;
  userId: string;
  content: string;
  created_at: string;
  playerName: string;
  initial: string;
  avatarUrl?: string;
  replies: WallReply[];
}

interface ManagedGroupMember {
  userId: string;
  displayName?: string;
  username: string;
  avatarUrl?: string;
  role: string;
}

interface GroupChallenge {
  id: string;
  challenger_id: string;
  opponent_id: string;
  status: string;
  match_id?: string;
  created_at: string;
  challengerName: string;
  opponentName: string;
  pending_match_result?: string;
  pending_match_score?: string;
}

type SubTab = "leaderboard" | "feed" | "wall" | "challenges" | "manage";

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function GroupPage() {
  const router = useRouter();
  const params = useParams();
  const groupId = params?.id as string;

  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [isCreator, setIsCreator] = useState(false);
  const [isGroupAdmin, setIsGroupAdmin] = useState(false);
  const [isGroupAssistant, setIsGroupAssistant] = useState(false);
  const [leaveBusy, setLeaveBusy] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [subTab, setSubTab] = useState<SubTab>("leaderboard");

  const [members, setMembers] = useState<Member[]>([]);
  const [feed, setFeed] = useState<FeedMatch[]>([]);
  const [posts, setPosts] = useState<WallPost[]>([]);
  const [challenges, setChallenges] = useState<GroupChallenge[]>([]);
  const [postContent, setPostContent] = useState("");
  const [postBusy, setPostBusy] = useState(false);
  const [postError, setPostError] = useState("");
  const [challengeBusy, setChallengeBusy] = useState<Set<string>>(new Set());
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  // Manage tab
  const [managedGroupMembers, setManagedGroupMembers] = useState<ManagedGroupMember[]>([]);
  const [manageSearchQuery, setManageSearchQuery] = useState("");
  const [manageSearchResults, setManageSearchResults] = useState<{id: string; display_name?: string; username: string}[]>([]);
  const [manageBusy, setManageBusy] = useState<Set<string>>(new Set());

  const loadAll = useCallback(async () => {
    const { data: memberRows } = await supabase
      .from("friend_group_members")
      .select("user_id")
      .eq("group_id", groupId);

    const userIds = (memberRows ?? []).map((m: { user_id: string }) => m.user_id);
    if (userIds.length === 0) { setMembers([]); setFeed([]); return; }

    const { data: profiles } = await supabase
      .from("profiles").select("id, display_name, username, avatar_url").in("id", userIds);
    const pm: Record<string, { display_name?: string; username?: string; avatar_url?: string }> = Object.fromEntries(
      (profiles ?? []).map((p: { id: string; display_name?: string; username?: string; avatar_url?: string }) => [p.id, p])
    );

    const { data: matchRows } = await supabase
      .from("matches")
      .select("id, user_id, data, created_at")
      .in("user_id", userIds)
      .order("created_at", { ascending: false })
      .limit(50);

    type MD = { result?: string; opponentName?: string; surface?: string };
    const stats: Record<string, { wins: number; losses: number }> = {};
    for (const id of userIds) stats[id] = { wins: 0, losses: 0 };
    for (const m of (matchRows ?? []) as { user_id: string; data: MD }[]) {
      if (m.data?.result === "win") stats[m.user_id].wins++;
      else if (m.data?.result === "loss") stats[m.user_id].losses++;
    }

    setMembers(
      userIds.map((id: string) => {
        const { wins, losses } = stats[id];
        const total = wins + losses;
        return {
          userId: id, wins, losses,
          displayName: pm[id]?.display_name,
          username: pm[id]?.username ?? id,
          avatarUrl: pm[id]?.avatar_url ?? undefined,
          winPct: total > 0 ? Math.round((wins / total) * 100) : 0,
        };
      }).sort((a: Member, b: Member) => b.winPct - a.winPct || (b.wins + b.losses) - (a.wins + a.losses))
    );

    setFeed(
      ((matchRows ?? []) as { id: string; user_id: string; data: MD; created_at: string }[])
        .slice(0, 30)
        .map(m => ({
          id: m.id,
          opponent_name: m.data?.opponentName ?? "Unknown",
          result: m.data?.result ?? "unfinished",
          surface: m.data?.surface ?? "",
          created_at: m.created_at,
          player_name: pm[m.user_id]?.display_name ?? `@${pm[m.user_id]?.username ?? m.user_id}`,
        }))
    );
  }, [groupId]);

  const loadPosts = useCallback(async () => {
    const { data: rows } = await supabase
      .from("group_posts")
      .select("id, user_id, content, created_at, reply_to_id")
      .eq("group_id", groupId)
      .order("created_at", { ascending: true })
      .limit(200);

    if (!rows || rows.length === 0) { setPosts([]); return; }

    const uids = [...new Set((rows as { user_id: string }[]).map(r => r.user_id))];
    const { data: profiles } = await supabase
      .from("profiles").select("id, display_name, username, avatar_url").in("id", uids);
    const pm: Record<string, { display_name?: string; username?: string; avatar_url?: string }> = Object.fromEntries(
      (profiles ?? []).map((p: { id: string; display_name?: string; username?: string; avatar_url?: string }) => [p.id, p])
    );

    type RawRow = { id: string; user_id: string; content: string; created_at: string; reply_to_id?: string | null };
    const postMap: Record<string, WallPost> = {};
    const topLevel: WallPost[] = [];

    for (const r of rows as RawRow[]) {
      if (!r.reply_to_id) {
        const wp: WallPost = {
          id: r.id, userId: r.user_id, content: r.content, created_at: r.created_at,
          playerName: pm[r.user_id]?.display_name ?? `@${pm[r.user_id]?.username ?? r.user_id}`,
          initial: (pm[r.user_id]?.display_name || pm[r.user_id]?.username || "?")[0].toUpperCase(),
          avatarUrl: pm[r.user_id]?.avatar_url ?? undefined,
          replies: [],
        };
        postMap[r.id] = wp;
        topLevel.push(wp);
      }
    }
    for (const r of rows as RawRow[]) {
      if (r.reply_to_id && postMap[r.reply_to_id]) {
        postMap[r.reply_to_id].replies.push({
          id: r.id, userId: r.user_id, content: r.content, created_at: r.created_at,
          playerName: pm[r.user_id]?.display_name ?? `@${pm[r.user_id]?.username ?? r.user_id}`,
          initial: (pm[r.user_id]?.display_name || pm[r.user_id]?.username || "?")[0].toUpperCase(),
          avatarUrl: pm[r.user_id]?.avatar_url ?? undefined,
        });
      }
    }
    topLevel.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setPosts(topLevel);
  }, [groupId]);

  const loadChallenges = useCallback(async (uid: string) => {
    const { data: rows } = await supabase
      .from("group_challenges")
      .select("id, challenger_id, opponent_id, status, match_id, created_at")
      .eq("group_id", groupId)
      .or(`challenger_id.eq.${uid},opponent_id.eq.${uid}`)
      .order("created_at", { ascending: false });

    if (!rows || rows.length === 0) { setChallenges([]); return; }

    type CRow = { id: string; challenger_id: string; opponent_id: string; status: string; match_id?: string; created_at: string };
    const pids = [...new Set((rows as CRow[]).flatMap(r => [r.challenger_id, r.opponent_id]))];
    const { data: profiles } = await supabase
      .from("profiles").select("id, display_name, username").in("id", pids);
    const pm: Record<string, { display_name?: string; username?: string }> = Object.fromEntries(
      (profiles ?? []).map((p: { id: string; display_name?: string; username?: string }) => [p.id, p])
    );
    const name = (id: string) => pm[id]?.display_name ?? `@${pm[id]?.username ?? id}`;

    // Fetch match data for pending_confirmation rows so opponent can see the score
    type SetData = { player?: number | null; opponent?: number | null };
    type MatchData = { result?: string; score?: { sets: SetData[] } };
    const pendingMatchIds = (rows as CRow[])
      .filter(r => r.status === "pending_confirmation" && r.match_id)
      .map(r => r.match_id as string);
    const matchInfoMap: Record<string, { result: string; scoreStr: string }> = {};
    if (pendingMatchIds.length > 0) {
      const { data: matchRows } = await supabase
        .from("matches").select("id, data").in("id", pendingMatchIds);
      for (const m of matchRows ?? []) {
        const d = m.data as MatchData;
        const scoreStr = (d?.score?.sets ?? [])
          .filter(s => s.player != null && s.opponent != null)
          .map(s => `${s.player}-${s.opponent}`)
          .join(", ");
        matchInfoMap[m.id] = { result: d?.result ?? "unknown", scoreStr };
      }
    }

    setChallenges((rows as CRow[]).map(r => ({
      id: r.id,
      challenger_id: r.challenger_id,
      opponent_id: r.opponent_id,
      status: r.status,
      match_id: r.match_id,
      created_at: r.created_at,
      challengerName: name(r.challenger_id),
      opponentName: name(r.opponent_id),
      pending_match_result: r.match_id ? matchInfoMap[r.match_id]?.result : undefined,
      pending_match_score: r.match_id ? matchInfoMap[r.match_id]?.scoreStr : undefined,
    })));
  }, [groupId]);

  const loadManagedGroupMembers = useCallback(async () => {
    const { data: rows } = await supabase
      .from("friend_group_members")
      .select("user_id, role")
      .eq("group_id", groupId);
    if (!rows || rows.length === 0) { setManagedGroupMembers([]); return; }
    const uids = rows.map((r: { user_id: string }) => r.user_id);
    const { data: profiles } = await supabase
      .from("profiles").select("id, display_name, username, avatar_url").in("id", uids);
    const pm = Object.fromEntries((profiles ?? []).map(p => [p.id, p]));
    setManagedGroupMembers((rows as { user_id: string; role: string }[]).map(r => ({
      userId: r.user_id,
      role: r.role ?? "member",
      displayName: (pm[r.user_id] as { display_name?: string } | undefined)?.display_name,
      username: (pm[r.user_id] as { username?: string } | undefined)?.username ?? r.user_id,
      avatarUrl: (pm[r.user_id] as { avatar_url?: string } | undefined)?.avatar_url ?? undefined,
    })));
  }, [groupId]);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/auth"); return; }
      setUserId(user.id);

      const { data: group } = await supabase
        .from("friend_groups").select("name, created_by").eq("id", groupId).single();
      if (!group) { router.push("/friends"); return; }
      setGroupName(group.name);
      setIsCreator(group.created_by === user.id);

      const { data: membership } = await supabase
        .from("friend_group_members").select("id, role")
        .eq("group_id", groupId).eq("user_id", user.id).single();
      if (!membership) { router.push("/friends"); return; }
      const memberRole = (membership as { role?: string }).role ?? "member";
      setIsGroupAdmin(memberRole === "admin" || group.created_by === user.id);
      setIsGroupAssistant(memberRole === "assistant" && group.created_by !== user.id);

      await Promise.all([loadAll(), loadPosts(), loadChallenges(user.id), loadManagedGroupMembers()]);
      setLoading(false);
    }
    init();
  }, [router, groupId, loadAll, loadPosts, loadChallenges, loadManagedGroupMembers]);

  function switchTab(tab: SubTab) {
    setSubTab(tab);
    if (tab === "leaderboard" || tab === "feed") loadAll();
    else if (tab === "challenges" && userId) loadChallenges(userId);
    else if (tab === "manage") loadManagedGroupMembers();
  }

  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible" && userId) loadAll();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [userId, loadAll]);

  async function leaveOrDelete() {
    if (!confirm(isCreator ? "Delete this group?" : "Leave this group?")) return;
    setLeaveBusy(true);
    if (isCreator) {
      await supabase.from("friend_groups").delete().eq("id", groupId);
    } else {
      await supabase.from("friend_group_members").delete()
        .eq("group_id", groupId).eq("user_id", userId);
    }
    router.push("/friends");
  }

  async function submitPost() {
    if (!postContent.trim()) return;
    if (postContent.trim().length > 500) { setPostError("Posts must be 500 characters or fewer."); return; }
    setPostError("");
    setPostBusy(true);
    const { error } = await supabase.from("group_posts").insert({
      group_id: groupId, user_id: userId, content: postContent.trim(),
    });
    if (error) { setPostError("Failed to post. Please try again."); setPostBusy(false); return; }
    setPostContent("");
    await loadPosts();
    setPostBusy(false);
  }

  async function deletePost(postId: string) {
    await supabase.from("group_posts").delete().eq("id", postId);
    await loadPosts();
  }

  async function deleteReply(replyId: string) {
    await supabase.from("group_posts").delete().eq("id", replyId);
    await loadPosts();
  }

  async function changeGroupRole(uid: string, newRole: "admin" | "assistant" | "member") {
    setManageBusy(s => new Set(s).add(uid));
    const { error } = await supabase
      .from("friend_group_members").update({ role: newRole }).eq("group_id", groupId).eq("user_id", uid);
    if (error) console.error("changeGroupRole:", error.message);
    await loadManagedGroupMembers();
    setManageBusy(s => { const n = new Set(s); n.delete(uid); return n; });
  }

  async function kickGroupMember(uid: string) {
    const member = managedGroupMembers.find(m => m.userId === uid);
    const name = member?.displayName || `@${member?.username ?? uid}`;
    if (!confirm(`Remove ${name} from the group?`)) return;
    setManageBusy(s => new Set(s).add(uid));
    const { error } = await supabase.from("friend_group_members").delete().eq("group_id", groupId).eq("user_id", uid);
    if (error) {
      alert("Remove failed — run the DELETE policy SQL in Supabase first.");
      setManageBusy(s => { const n = new Set(s); n.delete(uid); return n; });
      return;
    }
    await loadManagedGroupMembers();
    await loadAll();
    setManageBusy(s => { const n = new Set(s); n.delete(uid); return n; });
  }

  async function searchToAdd(q: string) {
    setManageSearchQuery(q);
    if (q.trim().length < 2) { setManageSearchResults([]); return; }
    const existingIds = managedGroupMembers.map(m => m.userId);
    const { data } = await supabase
      .from("profiles")
      .select("id, display_name, username")
      .or(`username.ilike.%${q.trim()}%,display_name.ilike.%${q.trim()}%`)
      .not("id", "in", `(${existingIds.join(",")})`)
      .limit(8);
    setManageSearchResults(data ?? []);
  }

  async function addGroupMember(uid: string) {
    setManageBusy(s => new Set(s).add(uid));
    await supabase.from("friend_group_members").insert({ group_id: groupId, user_id: uid, role: "member" });
    setManageSearchResults(prev => prev.filter(r => r.id !== uid));
    await loadManagedGroupMembers();
    await loadAll();
    setManageBusy(s => { const n = new Set(s); n.delete(uid); return n; });
  }

  async function submitReply(postId: string) {
    if (!replyText.trim()) return;
    if (replyText.trim().length > 500) { setPostError("Replies must be 500 characters or fewer."); return; }
    setPostError("");
    setPostBusy(true);
    const { error } = await supabase.from("group_posts").insert({
      group_id: groupId, user_id: userId, content: replyText.trim(), reply_to_id: postId,
    });
    if (error) { setPostError("Failed to post reply. Please try again."); setPostBusy(false); return; }
    setReplyText("");
    setReplyingTo(null);
    await loadPosts();
    setPostBusy(false);
  }

  async function sendChallenge(opponentId: string) {
    // Block if an active challenge already exists between these two users
    const [{ data: c1 }, { data: c2 }] = await Promise.all([
      supabase.from("group_challenges").select("id").eq("group_id", groupId)
        .eq("challenger_id", userId).eq("opponent_id", opponentId)
        .in("status", ["pending", "accepted"]).limit(1),
      supabase.from("group_challenges").select("id").eq("group_id", groupId)
        .eq("challenger_id", opponentId).eq("opponent_id", userId)
        .in("status", ["pending", "accepted"]).limit(1),
    ]);
    if ((c1 && c1.length > 0) || (c2 && c2.length > 0)) {
      alert("You already have an active challenge with this player. Complete it first.");
      return;
    }
    await supabase.from("group_challenges").insert({
      group_id: groupId, challenger_id: userId, opponent_id: opponentId, status: "pending",
    });
    await loadChallenges(userId);
  }

  async function respondChallenge(challengeId: string, accept: boolean) {
    if (challengeBusy.has(challengeId)) return;
    setChallengeBusy(s => { const n = new Set(s); n.add(challengeId); return n; });
    if (accept) {
      await supabase.from("group_challenges").update({ status: "accepted" }).eq("id", challengeId);
    } else {
      await supabase.from("group_challenges").delete().eq("id", challengeId);
    }
    await loadChallenges(userId);
    setChallengeBusy(s => { const n = new Set(s); n.delete(challengeId); return n; });
  }

  async function confirmGroupChallengeScore(id: string, accept: boolean) {
    if (accept) {
      await supabase.from("group_challenges").update({ status: "completed" }).eq("id", id);
    } else {
      // Dispute: reset to accepted so challenger can re-log the correct score
      await supabase.from("group_challenges").update({ status: "accepted", match_id: null }).eq("id", id);
    }
    await loadChallenges(userId);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-gray-400 text-sm">Loading…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white max-w-sm mx-auto pb-24">

      {/* Header */}
      <div className="px-5 pt-5 pb-3 border-b border-gray-200">
        <div className="flex items-center gap-2 mb-1">
          <Link href="/friends" className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </Link>
          <p className="text-gray-400 text-xs font-bold tracking-widest uppercase">Groups</p>
        </div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-gray-900 leading-tight">{groupName}</h1>
            <p className="text-gray-400 text-xs mt-0.5">{members.length} member{members.length !== 1 ? "s" : ""}</p>
          </div>
          <button
            onClick={leaveOrDelete}
            disabled={leaveBusy}
            className={`text-xs font-bold mt-1 transition-colors disabled:opacity-40 ${isCreator ? "text-red-500 hover:text-red-600" : "text-red-500 hover:text-red-600"}`}
          >
            {isCreator ? "Delete" : "Leave"}
          </button>
        </div>

        {/* Sub-tabs */}
        <div className="flex gap-1 mt-3">
          {(["leaderboard", "feed", "wall", "challenges", "manage"] as SubTab[]).map(t => (
            <button
              key={t}
              onClick={() => switchTab(t)}
              className={`text-[10px] font-black tracking-widest uppercase px-2.5 py-1.5 rounded-xl transition-all capitalize
                ${subTab === t ? "bg-lime-100 text-lime-700" : "text-gray-400 hover:text-gray-500"}`}
            >
              {t === "leaderboard" ? "Board" : t === "challenges" ? "Duels" : t}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 py-5 space-y-4">

        {/* ── LEADERBOARD ── */}
        {subTab === "leaderboard" && (
          <section className="space-y-3">
            {members.length === 0 ? (
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 text-center">
                <p className="text-sm text-gray-500">No members yet</p>
              </div>
            ) : (
              <div className="rounded-2xl border border-gray-200 bg-gray-50 divide-y divide-white/[0.06]">
                {members.map((m, i) => (
                  <div key={m.userId} className="flex items-center justify-between px-4 py-3 gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs font-black text-gray-300 w-4 flex-shrink-0">{i + 1}</span>
                      <AvatarCircle name={m.displayName || m.username} avatarUrl={m.avatarUrl} size={32} textClassName="text-xs font-black text-lime-700" />
                      <div className="min-w-0">
                        <button
                          onClick={() => setProfileUserId(m.userId)}
                          className="text-sm font-semibold text-gray-800 truncate hover:text-gray-900 transition-colors text-left"
                        >
                          {m.displayName ?? `@${m.username}`}
                          {m.userId === userId && <span className="text-xs text-lime-700/60 ml-1.5">you</span>}
                        </button>
                        <p className="text-xs text-gray-400">{m.wins}W – {m.losses}L</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-sm font-black text-gray-700">{m.winPct}%</span>
                      {m.userId !== userId && (
                        <button
                          onClick={() => sendChallenge(m.userId)}
                          className="text-[10px] font-black text-lime-700/70 bg-lime-50 px-2 py-1 rounded-lg hover:bg-lime-100 transition-all"
                        >
                          Challenge
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── FEED ── */}
        {subTab === "feed" && (
          <section className="space-y-2">
            {feed.length === 0 ? (
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 text-center space-y-1">
                <p className="text-sm text-gray-500">No matches yet</p>
                <p className="text-xs text-gray-300">Matches logged by group members will appear here</p>
              </div>
            ) : (
              feed.map(m => (
                <div key={m.id} className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-gray-400">{m.player_name}</span>
                    <span className="text-[10px] text-gray-300">{relativeTime(m.created_at)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-800">vs {m.opponent_name}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-400 capitalize">{m.surface}</span>
                      <span className={`text-xs font-black px-2 py-0.5 rounded-lg ${m.result === "win" ? "text-lime-700 bg-lime-50" : "text-red-600/70 bg-red-400/10"}`}>
                        {m.result === "win" ? "W" : "L"}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </section>
        )}

        {/* ── WALL ── */}
        {subTab === "wall" && (
          <section className="space-y-4">
            <div className="space-y-2">
              <textarea
                value={postContent}
                onChange={e => { setPostContent(e.target.value); setPostError(""); }}
                placeholder="Post to the group…"
                rows={3}
                maxLength={500}
                className="w-full bg-white/5 border border-gray-200 rounded-2xl px-4 py-3 text-gray-900 text-sm placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-lime-400/50 focus:border-lime-400/30 transition-all resize-none"
              />
              <div className="flex items-center justify-between">
                <span className={`text-[10px] ${postContent.length > 480 ? "text-red-500" : "text-gray-400"}`}>{postContent.length}/500</span>
                {postError && <span className="text-[10px] text-red-500">{postError}</span>}
              </div>
              <button
                onClick={submitPost}
                disabled={postBusy || !postContent.trim() || postContent.length > 500}
                className="text-xs font-black text-black bg-lime-400 px-4 py-2 rounded-xl hover:bg-lime-300 transition-all active:scale-95 disabled:opacity-40"
              >
                {postBusy ? "Posting…" : "Post"}
              </button>
            </div>
            {posts.length === 0 ? (
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 text-center space-y-1">
                <p className="text-sm text-gray-500">No posts yet</p>
                <p className="text-xs text-gray-300">Be the first to post in this group</p>
              </div>
            ) : (
              <div className="space-y-2">
                {posts.map(p => (
                  <div key={p.id} className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 space-y-2">
                    {/* Post */}
                    <div className="flex items-start gap-3">
                      <AvatarCircle name={p.playerName} avatarUrl={p.avatarUrl} size={32} textClassName="text-xs font-black text-lime-700" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-xs font-bold text-gray-500">{p.playerName}</span>
                          <span className="text-[10px] text-gray-300 flex-shrink-0">{relativeTime(p.created_at)}</span>
                        </div>
                        <p className="text-sm text-gray-800 break-words">{p.content}</p>
                      </div>
                      {p.userId === userId && (
                        <button
                          onClick={() => deletePost(p.id)}
                          className="text-red-500 hover:text-red-600 transition-colors flex-shrink-0 text-sm leading-none mt-0.5"
                        >
                          ×
                        </button>
                      )}
                    </div>
                    {/* Replies */}
                    {p.replies.length > 0 && (
                      <div className="ml-11 border-l border-gray-200 pl-3 space-y-2">
                        {p.replies.map(r => (
                          <div key={r.id} className="flex items-start gap-2">
                            <AvatarCircle name={r.playerName} avatarUrl={r.avatarUrl} size={20} textClassName="text-[8px] font-black text-lime-700" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <span className="text-[10px] font-bold text-gray-500">{r.playerName}</span>
                                <span className="text-[9px] text-gray-300">{relativeTime(r.created_at)}</span>
                                {(r.userId === userId || isCreator) && (
                                  <button
                                    onClick={() => deleteReply(r.id)}
                                    className="text-red-500 hover:text-red-600 transition-colors text-xs leading-none ml-auto"
                                    title="Delete reply"
                                  >
                                    ×
                                  </button>
                                )}
                              </div>
                              <p className="text-xs text-gray-600 break-words">{r.content}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Reply toggle */}
                    <button
                      onClick={() => { setReplyingTo(replyingTo === p.id ? null : p.id); setReplyText(""); }}
                      className="text-[10px] font-bold text-gray-300 hover:text-gray-500 transition-colors ml-11"
                    >
                      {replyingTo === p.id ? "Cancel" : `Reply${p.replies.length > 0 ? ` (${p.replies.length})` : ""}`}
                    </button>
                    {replyingTo === p.id && (
                      <div className="flex gap-2 ml-11">
                        <input
                          autoFocus
                          type="text"
                          placeholder="Write a reply…"
                          value={replyText}
                          onChange={e => setReplyText(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") submitReply(p.id); }}
                          className="flex-1 bg-white/5 border border-gray-200 rounded-xl px-3 py-1.5 text-gray-900 text-xs placeholder:text-gray-300 outline-none focus:ring-1 focus:ring-lime-400/50 transition-all"
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
          </section>
        )}

        {/* ── CHALLENGES ── */}
        {subTab === "challenges" && (
          <section className="space-y-3">
            <p className="text-xs text-gray-300">Challenge a group member from the Leaderboard tab.</p>
            {challenges.length === 0 ? (
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 text-center">
                <p className="text-sm text-gray-500">No challenges yet</p>
              </div>
            ) : (
              <div className="rounded-2xl border border-gray-200 bg-gray-50 divide-y divide-white/[0.06]">
                {challenges.map(c => {
                  const isChallenger = c.challenger_id === userId;
                  const isPending = c.status === "pending";
                  const isReceived = isPending && !isChallenger;
                  const needsConfirm = c.status === "pending_confirmation" && c.opponent_id === userId;
                  const waitingConfirm = c.status === "pending_confirmation" && c.challenger_id === userId;
                  const statusLabel =
                    c.status === "pending_confirmation" ? "Awaiting confirmation" : c.status;
                  return (
                    <div key={c.id} className="px-4 py-3 space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-800 truncate">
                            {isChallenger ? `vs ${c.opponentName}` : `${c.challengerName} challenged you`}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                              c.status === "accepted" ? "bg-lime-50 text-lime-700" :
                              c.status === "completed" ? "bg-white/5 text-gray-400" :
                              c.status === "pending_confirmation" ? "bg-amber-400/10 text-amber-400/80" :
                              "bg-amber-400/10 text-amber-400/80"
                            }`}>
                              {statusLabel}
                            </span>
                            <span className="text-[10px] text-gray-300">{relativeTime(c.created_at)}</span>
                          </div>
                        </div>
                        {isReceived && (
                          <div className="flex gap-2 flex-shrink-0">
                            <button
                              onClick={() => respondChallenge(c.id, false)}
                              disabled={challengeBusy.has(c.id)}
                              className="text-xs font-bold text-gray-400 bg-white/5 border border-gray-200 px-2.5 py-1.5 rounded-xl hover:text-gray-500 transition-all disabled:opacity-40"
                            >
                              Decline
                            </button>
                            <button
                              onClick={() => respondChallenge(c.id, true)}
                              disabled={challengeBusy.has(c.id)}
                              className="text-xs font-black text-lime-700 bg-lime-50 px-2.5 py-1.5 rounded-xl hover:bg-lime-100 transition-all disabled:opacity-40"
                            >
                              Accept
                            </button>
                          </div>
                        )}
                        {isPending && isChallenger && (
                          <span className="text-xs text-gray-400 flex-shrink-0">Waiting…</span>
                        )}
                        {c.status === "accepted" && (
                          <div className="flex gap-2 flex-shrink-0">
                            <Link
                              href={`/log?opponent=${encodeURIComponent(isChallenger ? c.opponentName : c.challengerName)}&challengeId=${c.id}&challengeType=group&returnTo=/groups/${groupId}`}
                              className="text-xs font-black text-lime-700 bg-lime-50 px-2.5 py-1.5 rounded-xl hover:bg-lime-100 transition-all"
                            >
                              Log Match
                            </Link>
                            <button
                              onClick={() => respondChallenge(c.id, false)}
                              className="text-xs font-bold text-red-500 hover:text-red-600 transition-colors"
                              title="Cancel challenge"
                            >
                              ×
                            </button>
                          </div>
                        )}
                        {c.status === "completed" && c.match_id && (
                          <Link
                            href={`/match/${c.match_id}`}
                            className="text-xs font-black text-lime-700/70 bg-lime-50 px-2.5 py-1.5 rounded-xl hover:bg-lime-100 transition-all flex-shrink-0"
                          >
                            View Match
                          </Link>
                        )}
                      </div>

                      {/* Score confirmation UI for the opponent */}
                      {needsConfirm && (
                        <div className="p-3 bg-amber-400/5 border border-amber-400/20 rounded-xl space-y-2">
                          <p className="text-xs font-bold text-amber-400/80">Confirm the score</p>
                          <p className="text-xs text-gray-500">
                            {c.challengerName} logged:{" "}
                            <span className={c.pending_match_result === "win" ? "text-red-600 font-semibold" : "text-lime-700 font-semibold"}>
                              {c.pending_match_result === "win" ? "their win" : "your win"}
                            </span>
                            {c.pending_match_score ? ` · ${c.pending_match_score}` : ""}
                          </p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => confirmGroupChallengeScore(c.id, false)}
                              className="flex-1 text-xs font-bold text-gray-500 bg-white/5 border border-gray-200 py-1.5 rounded-xl hover:text-red-600/70 transition-all"
                            >
                              Dispute
                            </button>
                            <button
                              onClick={() => confirmGroupChallengeScore(c.id, true)}
                              className="flex-1 text-xs font-black text-lime-700 bg-lime-50 py-1.5 rounded-xl hover:bg-lime-100 transition-all"
                            >
                              Confirm ✓
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Waiting indicator for the challenger */}
                      {waitingConfirm && (
                        <p className="text-xs text-amber-400/60">
                          Waiting for {c.opponentName} to confirm the score…
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* ── MANAGE ── */}
        {subTab === "manage" && (
          <div className="space-y-5">
            {(!isGroupAdmin && !isGroupAssistant) ? (
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 text-center">
                <p className="text-sm text-gray-500">Only coaches can manage members.</p>
              </div>
            ) : (
              <>
                {/* Add Member — coaches + assistants */}
                <section className="space-y-3">
                  <p className="text-xs font-black tracking-widest uppercase text-gray-400">Add Member</p>
                  <input
                    type="text"
                    placeholder="Search by name or username…"
                    value={manageSearchQuery}
                    onChange={e => searchToAdd(e.target.value)}
                    className="w-full bg-white/5 border border-gray-200 rounded-2xl px-4 py-3 text-gray-900 text-sm placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-lime-400/50 focus:border-lime-400/30 transition-all"
                  />
                  {manageSearchResults.length > 0 && (
                    <div className="rounded-2xl border border-gray-200 bg-gray-50 divide-y divide-white/[0.06]">
                      {manageSearchResults.map(r => (
                        <div key={r.id} className="flex items-center justify-between px-4 py-3 gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-800 truncate">{r.display_name ?? `@${r.username}`}</p>
                            {r.display_name && <p className="text-xs text-gray-400">@{r.username}</p>}
                          </div>
                          <button
                            onClick={() => addGroupMember(r.id)}
                            disabled={manageBusy.has(r.id)}
                            className="text-xs font-black text-lime-700 bg-lime-50 px-3 py-1.5 rounded-xl hover:bg-lime-100 transition-all active:scale-95 disabled:opacity-40 flex-shrink-0"
                          >
                            {manageBusy.has(r.id) ? "Adding…" : "Add"}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* Member list — coaches only */}
                {isGroupAdmin && (
                  <section className="space-y-3">
                    <p className="text-xs font-black tracking-widest uppercase text-gray-400">
                      Members <span className="text-gray-300">({managedGroupMembers.length})</span>
                    </p>
                    {managedGroupMembers.length === 0 ? (
                      <p className="text-gray-400 text-sm text-center py-4">No members</p>
                    ) : (
                      <div className="rounded-2xl border border-gray-200 bg-gray-50 divide-y divide-white/[0.06]">
                        {managedGroupMembers.map(m => (
                          <div key={m.userId} className="flex items-center justify-between px-4 py-3 gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <AvatarCircle name={m.displayName || m.username} avatarUrl={m.avatarUrl} size={32} textClassName="text-xs font-black text-lime-700" />
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-gray-800 truncate">
                                  {m.displayName ?? `@${m.username}`}
                                  {m.userId === userId && <span className="text-xs text-lime-700/50 ml-1.5">you</span>}
                                </p>
                                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${
                                  m.role === "admin" ? "bg-lime-50 text-lime-700"
                                  : m.role === "assistant" ? "bg-amber-400/10 text-amber-400"
                                  : "bg-white/5 text-gray-400"
                                }`}>
                                  {m.role === "admin" ? "Coach" : m.role === "assistant" ? "Asst" : "Member"}
                                </span>
                              </div>
                            </div>
                            {m.userId !== userId && (
                              <div className="flex gap-1.5 flex-shrink-0 items-center">
                                {m.role === "member" && (<>
                                  <button onClick={() => changeGroupRole(m.userId, "admin")} disabled={manageBusy.has(m.userId)}
                                    className="text-[10px] font-black text-lime-700/70 bg-lime-50 px-2 py-1 rounded-xl hover:bg-lime-100 transition-all active:scale-95 disabled:opacity-40">
                                    Coach
                                  </button>
                                  <button onClick={() => changeGroupRole(m.userId, "assistant")} disabled={manageBusy.has(m.userId)}
                                    className="text-[10px] font-black text-amber-400/70 bg-amber-400/10 px-2 py-1 rounded-xl hover:bg-amber-400/20 transition-all active:scale-95 disabled:opacity-40">
                                    Asst
                                  </button>
                                </>)}
                                {m.role === "assistant" && (<>
                                  <button onClick={() => changeGroupRole(m.userId, "admin")} disabled={manageBusy.has(m.userId)}
                                    className="text-[10px] font-black text-lime-700/70 bg-lime-50 px-2 py-1 rounded-xl hover:bg-lime-100 transition-all active:scale-95 disabled:opacity-40">
                                    Coach
                                  </button>
                                  <button onClick={() => changeGroupRole(m.userId, "member")} disabled={manageBusy.has(m.userId)}
                                    className="text-[10px] font-black text-gray-500 bg-white/5 border border-gray-200 px-2 py-1 rounded-xl hover:text-gray-700 transition-all active:scale-95 disabled:opacity-40">
                                    Demote
                                  </button>
                                </>)}
                                {m.role === "admin" && (
                                  <button onClick={() => changeGroupRole(m.userId, "member")} disabled={manageBusy.has(m.userId)}
                                    className="text-[10px] font-black text-gray-500 bg-white/5 border border-gray-200 px-2.5 py-1 rounded-xl hover:text-gray-700 transition-all active:scale-95 disabled:opacity-40">
                                    Demote
                                  </button>
                                )}
                                <button onClick={() => kickGroupMember(m.userId)} disabled={manageBusy.has(m.userId)}
                                  className="text-[10px] font-bold text-red-500 hover:text-red-600 transition-colors disabled:opacity-40"
                                  title="Remove from group">
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
