"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import BottomNav from "@/components/BottomNav";

interface GroupMember {
  userId: string;
  displayName?: string;
  username: string;
}

interface FeedMatch {
  id: string;
  opponent_name: string;
  result: string;
  surface: string;
  created_at: string;
  player_name: string;
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

export default function GroupPage() {
  const router = useRouter();
  const params = useParams();
  const groupId = params?.id as string;

  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [isCreator, setIsCreator] = useState(false);
  const [leaveBusy, setLeaveBusy] = useState(false);

  const [groupName, setGroupName] = useState("");
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [feed, setFeed] = useState<FeedMatch[]>([]);

  const loadData = useCallback(async (uid: string) => {
    const { data: memberRows } = await supabase
      .from("friend_group_members")
      .select("user_id")
      .eq("group_id", groupId);
    if (!memberRows) return;

    const userIds = memberRows.map(m => m.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name, username")
      .in("id", userIds);
    const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]));

    setMembers(userIds.map(id => ({
      userId: id,
      displayName: profileMap[id]?.display_name,
      username: profileMap[id]?.username ?? id,
    })));

    // Feed
    const { data: matchRows } = await supabase
      .from("matches")
      .select("id, opponent_name, result, surface, created_at, user_id")
      .in("user_id", userIds)
      .order("created_at", { ascending: false })
      .limit(30);

    setFeed(
      (matchRows ?? []).map(m => ({
        id: m.id,
        opponent_name: m.opponent_name,
        result: m.result,
        surface: m.surface,
        created_at: m.created_at,
        player_name: profileMap[m.user_id]?.display_name ?? `@${profileMap[m.user_id]?.username ?? m.user_id}`,
      }))
    );
  }, [groupId]);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/auth"); return; }
      setUserId(user.id);

      const { data: group } = await supabase
        .from("friend_groups")
        .select("name, created_by")
        .eq("id", groupId)
        .single();
      if (!group) { router.push("/friends"); return; }
      setGroupName(group.name);
      setIsCreator(group.created_by === user.id);

      // Verify membership
      const { data: membership } = await supabase
        .from("friend_group_members")
        .select("id")
        .eq("group_id", groupId)
        .eq("user_id", user.id)
        .single();
      if (!membership) { router.push("/friends"); return; }

      await loadData(user.id);
      setLoading(false);
    }
    init();
  }, [router, groupId, loadData]);

  async function removeMember(memberId: string) {
    await supabase.from("friend_group_members").delete().eq("group_id", groupId).eq("user_id", memberId);
    await loadData(userId);
  }

  async function leaveOrDelete() {
    const action = isCreator ? "Delete this group?" : "Leave this group?";
    if (!confirm(action)) return;
    setLeaveBusy(true);
    if (isCreator) {
      await supabase.from("friend_groups").delete().eq("id", groupId);
    } else {
      await supabase.from("friend_group_members").delete().eq("group_id", groupId).eq("user_id", userId);
    }
    router.push("/friends");
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
      <div className="px-5 pt-5 pb-4 border-b border-white/[0.06]">
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
      </div>

      <div className="px-5 py-5 space-y-6">

        {/* Members */}
        <section className="space-y-3">
          <p className="text-xs font-black tracking-widest uppercase text-white/30">Members</p>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] divide-y divide-white/[0.06]">
            {members.map(m => (
              <div key={m.userId} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-lime-400/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-black text-lime-400">
                      {(m.displayName || m.username)[0].toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white/80">
                      {m.displayName ?? `@${m.username}`}
                      {m.userId === userId && <span className="text-xs text-lime-400/60 ml-1.5">you</span>}
                    </p>
                    {m.displayName && <p className="text-xs text-white/30">@{m.username}</p>}
                  </div>
                </div>
                {isCreator && m.userId !== userId && (
                  <button
                    onClick={() => removeMember(m.userId)}
                    className="text-xs font-bold text-white/20 hover:text-red-400/70 transition-colors"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Match Feed */}
        <section className="space-y-3">
          <p className="text-xs font-black tracking-widest uppercase text-white/30">Recent Matches</p>
          {feed.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center space-y-1">
              <p className="text-sm text-white/40">No matches yet</p>
              <p className="text-xs text-white/20">Matches logged by group members will appear here</p>
            </div>
          ) : (
            <div className="space-y-2">
              {feed.map(m => (
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
              ))}
            </div>
          )}
        </section>

      </div>

      <BottomNav active="profile" />
    </main>
  );
}
