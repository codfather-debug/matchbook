"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import BottomNav from "@/components/BottomNav";
import ProfileCard from "@/components/ProfileCard";

interface Member {
  userId: string;
  displayName?: string;
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

interface WallPost {
  id: string;
  userId: string;
  content: string;
  created_at: string;
  playerName: string;
  initial: string;
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
}

type SubTab = "leaderboard" | "feed" | "wall" | "challenges";

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
  const [leaveBusy, setLeaveBusy] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [subTab, setSubTab] = useState<SubTab>("leaderboard");

  const [members, setMembers] = useState<Member[]>([]);
  const [feed, setFeed] = useState<FeedMatch[]>([]);
  const [posts, setPosts] = useState<WallPost[]>([]);
  const [challenges, setChallenges] = useState<GroupChallenge[]>([]);
  const [postContent, setPostContent] = useState("");
  const [postBusy, setPostBusy] = useState(false);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    const { data: memberRows } = await supabase
      .from("friend_group_members")
      .select("user_id")
      .eq("group_id", groupId);

    const userIds = (memberRows ?? []).map((m: { user_id: string }) => m.user_id);
    if (userIds.length === 0) { setMembers([]); setFeed([]); return; }

    const { data: profiles } = await supabase
      .from("profiles").select("id, display_name, username").in("id", userIds);
    const pm: Record<string, { display_name?: string; username?: string }> = Object.fromEntries(
      (profiles ?? []).map((p: { id: string; display_name?: string; username?: string }) => [p.id, p])
    );

    const { data: matchRows } = await supabase
      .from("matches")
      .select("id, user_id, opponent_name, result, surface, created_at")
      .in("user_id", userIds)
      .order("created_at", { ascending: false })
      .limit(50);

    const stats: Record<string, { wins: number; losses: number }> = {};
    for (const id of userIds) stats[id] = { wins: 0, losses: 0 };
    for (const m of (matchRows ?? []) as { user_id: string; result: string }[]) {
      if (m.result === "win") stats[m.user_id].wins++;
      else if (m.result === "loss") stats[m.user_id].losses++;
    }

    setMembers(
      userIds.map((id: string) => {
        const { wins, losses } = stats[id];
        const total = wins + losses;
        return {
          userId: id, wins, losses,
          displayName: pm[id]?.display_name,
          username: pm[id]?.username ?? id,
          winPct: total > 0 ? Math.round((wins / total) * 100) : 0,
        };
      }).sort((a: Member, b: Member) => b.winPct - a.winPct || (b.wins + b.losses) - (a.wins + a.losses))
    );

    setFeed(
      ((matchRows ?? []) as { id: string; user_id: string; opponent_name: string; result: string; surface: string; created_at: string }[])
        .slice(0, 30)
        .map(m => ({
          id: m.id,
          opponent_name: m.opponent_name,
          result: m.result,
          surface: m.surface,
          created_at: m.created_at,
          player_name: pm[m.user_id]?.display_name ?? `@${pm[m.user_id]?.username ?? m.user_id}`,
        }))
    );
  }, [groupId]);

  const loadPosts = useCallback(async () => {
    const { data: rows } = await supabase
      .from("group_posts")
      .select("id, user_id, content, created_at")
      .eq("group_id", groupId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (!rows || rows.length === 0) { setPosts([]); return; }

    const uids = [...new Set((rows as { user_id: string }[]).map(r => r.user_id))];
    const { data: profiles } = await supabase
      .from("profiles").select("id, display_name, username").in("id", uids);
    const pm: Record<string, { display_name?: string; username?: string }> = Object.fromEntries(
      (profiles ?? []).map((p: { id: string; display_name?: string; username?: string }) => [p.id, p])
    );

    setPosts((rows as { id: string; user_id: string; content: string; created_at: string }[]).map(r => ({
      id: r.id,
      userId: r.user_id,
      content: r.content,
      created_at: r.created_at,
      playerName: pm[r.user_id]?.display_name ?? `@${pm[r.user_id]?.username ?? r.user_id}`,
      initial: (pm[r.user_id]?.display_name || pm[r.user_id]?.username || "?")[0].toUpperCase(),
    })));
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

    setChallenges((rows as CRow[]).map(r => ({
      id: r.id,
      challenger_id: r.challenger_id,
      opponent_id: r.opponent_id,
      status: r.status,
      match_id: r.match_id,
      created_at: r.created_at,
      challengerName: name(r.challenger_id),
      opponentName: name(r.opponent_id),
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
        .from("friend_group_members").select("id")
        .eq("group_id", groupId).eq("user_id", user.id).single();
      if (!membership) { router.push("/friends"); return; }

      await Promise.all([loadAll(), loadPosts(), loadChallenges(user.id)]);
      setLoading(false);
    }
    init();
  }, [router, groupId, loadAll, loadPosts, loadChallenges]);

  async function removeMember(memberId: string) {
    await supabase.from("friend_group_members").delete()
      .eq("group_id", groupId).eq("user_id", memberId);
    await loadAll();
  }

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
    setPostBusy(true);
    await supabase.from("group_posts").insert({
      group_id: groupId, user_id: userId, content: postContent.trim(),
    });
    setPostContent("");
    await loadPosts();
    setPostBusy(false);
  }

  async function deletePost(postId: string) {
    await supabase.from("group_posts").delete().eq("id", postId);
    await loadPosts();
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
    if (accept) {
      await supabase.from("group_challenges").update({ status: "accepted" }).eq("id", challengeId);
    } else {
      await supabase.from("group_challenges").delete().eq("id", challengeId);
    }
    await loadChallenges(userId);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0c0c0e] flex items-center justify-center">
        <p className="text-white/30 text-sm">Loading…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0c0c0e] max-w-sm mx-auto pb-24">

      {/* Header */}
      <div className="px-5 pt-5 pb-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2 mb-1">
          <Link href="/friends" className="text-white/30 hover:text-white/60 transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </Link>
          <p className="text-white/30 text-xs font-bold tracking-widest uppercase">Groups</p>
        </div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-white leading-tight">{groupName}</h1>
            <p className="text-white/30 text-xs mt-0.5">{members.length} member{members.length !== 1 ? "s" : ""}</p>
          </div>
          <button
            onClick={leaveOrDelete}
            disabled={leaveBusy}
            className={`text-xs font-bold mt-1 transition-colors disabled:opacity-40 ${isCreator ? "text-red-400/50 hover:text-red-400/80" : "text-white/25 hover:text-red-400/70"}`}
          >
            {isCreator ? "Delete" : "Leave"}
          </button>
        </div>

        {/* Sub-tabs */}
        <div className="flex gap-1 mt-3 -mx-1">
          {(["leaderboard", "feed", "wall", "challenges"] as SubTab[]).map(t => (
            <button
              key={t}
              onClick={() => setSubTab(t)}
              className={`text-[10px] font-black tracking-widest uppercase px-2.5 py-1.5 rounded-xl transition-all capitalize
                ${subTab === t ? "bg-lime-400/20 text-lime-400" : "text-white/25 hover:text-white/50"}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 py-5 space-y-4">

        {/* ── LEADERBOARD ── */}
        {subTab === "leaderboard" && (
          <section className="space-y-3">
            {members.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center">
                <p className="text-sm text-white/40">No members yet</p>
              </div>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] divide-y divide-white/[0.06]">
                {members.map((m, i) => (
                  <div key={m.userId} className="flex items-center justify-between px-4 py-3 gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs font-black text-white/20 w-4 flex-shrink-0">{i + 1}</span>
                      <div className="w-8 h-8 rounded-full bg-lime-400/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-black text-lime-400">
                          {(m.displayName || m.username)[0].toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <button
                          onClick={() => setProfileUserId(m.userId)}
                          className="text-sm font-semibold text-white/80 truncate hover:text-white transition-colors text-left"
                        >
                          {m.displayName ?? `@${m.username}`}
                          {m.userId === userId && <span className="text-xs text-lime-400/60 ml-1.5">you</span>}
                        </button>
                        <p className="text-xs text-white/30">{m.wins}W – {m.losses}L</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-sm font-black text-white/70">{m.winPct}%</span>
                      {m.userId !== userId && (
                        <button
                          onClick={() => sendChallenge(m.userId)}
                          className="text-[10px] font-black text-lime-400/70 bg-lime-400/10 px-2 py-1 rounded-lg hover:bg-lime-400/20 transition-all"
                        >
                          Challenge
                        </button>
                      )}
                      {isCreator && m.userId !== userId && (
                        <button
                          onClick={() => removeMember(m.userId)}
                          className="text-[10px] font-bold text-white/20 hover:text-red-400/70 transition-colors"
                        >
                          ×
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
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center space-y-1">
                <p className="text-sm text-white/40">No matches yet</p>
                <p className="text-xs text-white/20">Matches logged by group members will appear here</p>
              </div>
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
          </section>
        )}

        {/* ── WALL ── */}
        {subTab === "wall" && (
          <section className="space-y-4">
            <div className="space-y-2">
              <textarea
                value={postContent}
                onChange={e => setPostContent(e.target.value)}
                placeholder="Post to the group…"
                rows={3}
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm placeholder:text-white/25 outline-none focus:ring-2 focus:ring-lime-400/50 focus:border-lime-400/30 transition-all resize-none"
              />
              <button
                onClick={submitPost}
                disabled={postBusy || !postContent.trim()}
                className="text-xs font-black text-black bg-lime-400 px-4 py-2 rounded-xl hover:bg-lime-300 transition-all active:scale-95 disabled:opacity-40"
              >
                {postBusy ? "Posting…" : "Post"}
              </button>
            </div>
            {posts.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center space-y-1">
                <p className="text-sm text-white/40">No posts yet</p>
                <p className="text-xs text-white/20">Be the first to post in this group</p>
              </div>
            ) : (
              <div className="space-y-2">
                {posts.map(p => (
                  <div key={p.id} className="bg-white/[0.03] border border-white/[0.06] rounded-2xl px-4 py-3">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-lime-400/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-black text-lime-400">{p.initial}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-xs font-bold text-white/50">{p.playerName}</span>
                          <span className="text-[10px] text-white/20 flex-shrink-0">{relativeTime(p.created_at)}</span>
                        </div>
                        <p className="text-sm text-white/80 break-words">{p.content}</p>
                      </div>
                      {p.userId === userId && (
                        <button
                          onClick={() => deletePost(p.id)}
                          className="text-white/20 hover:text-red-400/60 transition-colors flex-shrink-0 text-sm leading-none mt-0.5"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── CHALLENGES ── */}
        {subTab === "challenges" && (
          <section className="space-y-3">
            <p className="text-xs text-white/20">Challenge a group member from the Leaderboard tab.</p>
            {challenges.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center">
                <p className="text-sm text-white/40">No challenges yet</p>
              </div>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] divide-y divide-white/[0.06]">
                {challenges.map(c => {
                  const isChallenger = c.challenger_id === userId;
                  const isPending = c.status === "pending";
                  const isReceived = isPending && !isChallenger;
                  return (
                    <div key={c.id} className="px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white/80 truncate">
                            {isChallenger ? `vs ${c.opponentName}` : `${c.challengerName} challenged you`}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                              c.status === "accepted" ? "bg-lime-400/10 text-lime-400" :
                              c.status === "completed" ? "bg-white/5 text-white/30" :
                              "bg-amber-400/10 text-amber-400/80"
                            }`}>
                              {c.status}
                            </span>
                            <span className="text-[10px] text-white/20">{relativeTime(c.created_at)}</span>
                          </div>
                        </div>
                        {isReceived && (
                          <div className="flex gap-2 flex-shrink-0">
                            <button
                              onClick={() => respondChallenge(c.id, false)}
                              className="text-xs font-bold text-white/30 bg-white/5 border border-white/10 px-2.5 py-1.5 rounded-xl hover:text-white/50 transition-all"
                            >
                              Decline
                            </button>
                            <button
                              onClick={() => respondChallenge(c.id, true)}
                              className="text-xs font-black text-lime-400 bg-lime-400/10 px-2.5 py-1.5 rounded-xl hover:bg-lime-400/20 transition-all"
                            >
                              Accept
                            </button>
                          </div>
                        )}
                        {isPending && isChallenger && (
                          <span className="text-xs text-white/25 flex-shrink-0">Waiting…</span>
                        )}
                        {c.status === "accepted" && (
                          <Link
                            href="/log"
                            className="text-xs font-black text-lime-400 bg-lime-400/10 px-2.5 py-1.5 rounded-xl hover:bg-lime-400/20 transition-all flex-shrink-0"
                          >
                            Log Match
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

      </div>

      <BottomNav active="friends" />

      {profileUserId && (
        <ProfileCard userId={profileUserId} onClose={() => setProfileUserId(null)} />
      )}
    </main>
  );
}
