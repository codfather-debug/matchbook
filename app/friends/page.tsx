"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import BottomNav from "@/components/BottomNav";
import ProfileCard from "@/components/ProfileCard";
import { upsertProfile } from "@/lib/profile";
import { hasProfanity } from "@/lib/profanity";

interface FriendProfile { friendshipId: string; userId: string; username: string; displayName?: string; }
interface PendingRequest { friendshipId: string; userId: string; username: string; displayName?: string; }
interface SearchResult { id: string; username: string; display_name?: string; }
interface FriendshipRow { id: string; requester_id: string; addressee_id: string; status: string; }
interface TeamRow { id: string; name: string; invite_code: string; member_count?: number; role?: string; }
interface GroupRow { id: string; name: string; member_count?: number; }
interface ChallengeItem {
  id: string;
  type: "team" | "group";
  contextName: string;
  challengerId: string;
  opponentId: string;
  challengerName: string;
  opponentName: string;
  status: string;
  createdAt: string;
}

type ActiveTab = "friends" | "teams" | "groups" | "challenges";

export default function FriendsPage() {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>("friends");

  // Friends state
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [pending, setPending] = useState<PendingRequest[]>([]);
  const [allFriendships, setAllFriendships] = useState<FriendshipRow[]>([]);
  const [sentRequests, setSentRequests] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [profileUserId, setProfileUserId] = useState<string | null>(null);

  // Teams state
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamDesc, setNewTeamDesc] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [teamBusy, setTeamBusy] = useState(false);
  const [teamError, setTeamError] = useState("");

  // Groups state
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [selectedFriendIds, setSelectedFriendIds] = useState<Set<string>>(new Set());
  const [groupBusy, setGroupBusy] = useState(false);
  const [groupError, setGroupError] = useState("");
  const [groupJoinCode, setGroupJoinCode] = useState("");

  // Discover teams/groups
  const [discoverTeams, setDiscoverTeams] = useState<{id: string; name: string; member_count: number}[]>([]);
  const [discoverTeamsBusy, setDiscoverTeamsBusy] = useState<Set<string>>(new Set());
  const [discoverGroups, setDiscoverGroups] = useState<{id: string; name: string; member_count: number}[]>([]);
  const [discoverGroupsBusy, setDiscoverGroupsBusy] = useState<Set<string>>(new Set());

  // Discover tab
  const [discoverQuery, setDiscoverQuery] = useState("");
  const [discoverList, setDiscoverList] = useState<SearchResult[]>([]);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [discoverFilter, setDiscoverFilter] = useState("all");

  // Challenges tab
  const [challenges, setChallenges] = useState<ChallengeItem[]>([]);
  const [challengesLoading, setChallengesLoading] = useState(false);
  const [challengeBusy, setChallengeBusy] = useState<Set<string>>(new Set());

  const loadFriends = useCallback(async (uid: string) => {
    const { data: friendshipRows } = await supabase
      .from("friendships")
      .select("id, requester_id, addressee_id, status")
      .or(`requester_id.eq.${uid},addressee_id.eq.${uid}`);

    const rows: FriendshipRow[] = friendshipRows ?? [];
    setAllFriendships(rows);

    const otherIds = [...new Set(rows.map(r => r.requester_id === uid ? r.addressee_id : r.requester_id))];

    type ProfileRow = { id: string; username: string; display_name?: string };
    let profileMap: Record<string, ProfileRow> = {};
    if (otherIds.length > 0) {
      const { data: profileRows } = await supabase
        .from("profiles").select("id, username, display_name").in("id", otherIds);
      profileMap = Object.fromEntries((profileRows ?? []).map(p => [p.id, p]));
    }

    setPending(
      rows
        .filter(r => r.status === "pending" && r.addressee_id === uid)
        .map(r => ({
          friendshipId: r.id,
          userId: r.requester_id,
          username: profileMap[r.requester_id]?.username ?? r.requester_id,
          displayName: profileMap[r.requester_id]?.display_name,
        }))
    );

    setFriends(
      rows
        .filter(r => r.status === "accepted")
        .map(r => {
          const friendId = r.requester_id === uid ? r.addressee_id : r.requester_id;
          return {
            friendshipId: r.id,
            userId: friendId,
            username: profileMap[friendId]?.username ?? friendId,
            displayName: profileMap[friendId]?.display_name,
          };
        })
    );
  }, []);

  const loadTeams = useCallback(async (uid: string) => {
    // Two-query approach to avoid relying on PostgREST FK join recognition
    const { data: memberRows } = await supabase
      .from("team_members")
      .select("team_id, role")
      .eq("user_id", uid);

    if (!memberRows || memberRows.length === 0) { setTeams([]); return; }

    const teamIds = memberRows.map(r => r.team_id);
    const roleMap = Object.fromEntries(memberRows.map(r => [r.team_id, r.role]));

    const { data: teamRows } = await supabase
      .from("teams")
      .select("id, name, invite_code")
      .in("id", teamIds);

    if (!teamRows) { setTeams([]); return; }

    const teamList: TeamRow[] = await Promise.all(
      teamRows.map(async t => {
        const { count } = await supabase
          .from("team_members").select("id", { count: "exact", head: true })
          .eq("team_id", t.id);
        return { id: t.id, name: t.name, invite_code: t.invite_code, member_count: count ?? 0, role: roleMap[t.id] };
      })
    );

    setTeams(teamList);
  }, []);

  const loadGroups = useCallback(async (uid: string) => {
    // Two-query approach to avoid relying on PostgREST FK join recognition
    const { data: memberRows } = await supabase
      .from("friend_group_members")
      .select("group_id")
      .eq("user_id", uid);

    if (!memberRows || memberRows.length === 0) { setGroups([]); return; }

    const groupIds = memberRows.map(r => r.group_id);

    const { data: groupRows } = await supabase
      .from("friend_groups")
      .select("id, name")
      .in("id", groupIds);

    if (!groupRows) { setGroups([]); return; }

    const groupList: GroupRow[] = await Promise.all(
      groupRows.map(async g => {
        const { count } = await supabase
          .from("friend_group_members").select("id", { count: "exact", head: true })
          .eq("group_id", g.id);
        return { id: g.id, name: g.name, member_count: count ?? 0 };
      })
    );

    setGroups(groupList);
  }, []);

  const loadDiscoverTeams = useCallback(async (uid: string) => {
    const { data: mine } = await supabase.from("team_members").select("team_id").eq("user_id", uid);
    const myIds = (mine ?? []).map(r => r.team_id);
    let q = supabase.from("teams").select("id, name").limit(10);
    if (myIds.length > 0) q = q.not("id", "in", `(${myIds.join(",")})`);
    const { data: rows } = await q;
    if (!rows) { setDiscoverTeams([]); return; }
    const withCounts = await Promise.all(rows.map(async t => {
      const { count } = await supabase.from("team_members").select("id", { count: "exact", head: true }).eq("team_id", t.id);
      return { id: t.id, name: t.name, member_count: count ?? 0 };
    }));
    setDiscoverTeams(withCounts);
  }, []);

  const loadDiscoverGroups = useCallback(async (uid: string) => {
    const { data: mine } = await supabase.from("friend_group_members").select("group_id").eq("user_id", uid);
    const myIds = (mine ?? []).map(r => r.group_id);
    let q = supabase.from("friend_groups").select("id, name").limit(10);
    if (myIds.length > 0) q = q.not("id", "in", `(${myIds.join(",")})`);
    const { data: rows } = await q;
    if (!rows) { setDiscoverGroups([]); return; }
    const withCounts = await Promise.all(rows.map(async g => {
      const { count } = await supabase.from("friend_group_members").select("id", { count: "exact", head: true }).eq("group_id", g.id);
      return { id: g.id, name: g.name, member_count: count ?? 0 };
    }));
    setDiscoverGroups(withCounts);
  }, []);

  const loadDiscover = useCallback(async (uid: string, friendships: FriendshipRow[], q = "", filter = "all") => {
    setDiscoverLoading(true);
    // Only exclude accepted friends
    const acceptedIds = new Set([
      uid,
      ...friendships
        .filter(r => r.status === "accepted")
        .map(r => r.requester_id === uid ? r.addressee_id : r.requester_id),
    ]);
    let query = supabase.from("profiles").select("id, username, display_name").neq("id", uid);
    if (q.trim().length >= 2) {
      query = query.or(`username.ilike.%${q.trim()}%,display_name.ilike.%${q.trim()}%`);
    }
    const { data } = await query.order("username").limit(10);
    let results = (data ?? []).filter((p: SearchResult) => !acceptedIds.has(p.id));

    // Apply team/group filter
    if (filter !== "all") {
      const [type, id] = filter.split(":");
      const table = type === "team" ? "team_members" : "friend_group_members";
      const idCol = type === "team" ? "team_id" : "group_id";
      const { data: memberRows } = await supabase.from(table).select("user_id").eq(idCol, id);
      const memberIds = new Set((memberRows ?? []).map((r: { user_id: string }) => r.user_id));
      results = results.filter(p => memberIds.has(p.id));
    }

    setDiscoverList(results);
    setDiscoverLoading(false);
  }, []);

  const loadChallenges = useCallback(async (uid: string) => {
    setChallengesLoading(true);
    // Fetch from both challenges (team) and group_challenges tables
    const [{ data: teamChallenges }, { data: groupChallenges }] = await Promise.all([
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
    ]);

    // Collect all user IDs and context IDs we need to resolve
    const allRows = [
      ...(teamChallenges ?? []).map(r => ({ ...r, type: "team" as const })),
      ...(groupChallenges ?? []).map(r => ({ ...r, type: "group" as const })),
    ];

    const userIds = [...new Set(allRows.flatMap(r => [r.challenger_id, r.opponent_id]))];
    const teamIds = [...new Set((teamChallenges ?? []).map(r => r.team_id))];
    const groupIds = [...new Set((groupChallenges ?? []).map(r => r.group_id))];

    const [profilesRes, teamsRes, groupsRes] = await Promise.all([
      userIds.length > 0
        ? supabase.from("profiles").select("id, username, display_name").in("id", userIds)
        : Promise.resolve({ data: [] }),
      teamIds.length > 0
        ? supabase.from("teams").select("id, name").in("id", teamIds)
        : Promise.resolve({ data: [] }),
      groupIds.length > 0
        ? supabase.from("friend_groups").select("id, name").in("id", groupIds)
        : Promise.resolve({ data: [] }),
    ]);

    type ProfileRow = { id: string; username: string; display_name?: string };
    type NameRow = { id: string; name: string };
    const profileMap: Record<string, ProfileRow> = Object.fromEntries(
      ((profilesRes.data ?? []) as ProfileRow[]).map(p => [p.id, p])
    );
    const teamMap: Record<string, string> = Object.fromEntries(
      ((teamsRes.data ?? []) as NameRow[]).map(t => [t.id, t.name])
    );
    const groupMap: Record<string, string> = Object.fromEntries(
      ((groupsRes.data ?? []) as NameRow[]).map(g => [g.id, g.name])
    );

    const getName = (id: string) => {
      const p = profileMap[id];
      return p ? (p.display_name || `@${p.username}`) : id;
    };

    const items: ChallengeItem[] = allRows.map(r => ({
      id: r.id,
      type: r.type,
      contextName: r.type === "team"
        ? (teamMap[(r as { team_id: string }).team_id] ?? "Team")
        : (groupMap[(r as { group_id: string }).group_id] ?? "Group"),
      challengerId: r.challenger_id,
      opponentId: r.opponent_id,
      challengerName: getName(r.challenger_id),
      opponentName: getName(r.opponent_id),
      status: r.status,
      createdAt: r.created_at,
    }));

    setChallenges(items);
    setChallengesLoading(false);
  }, []);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/auth"); return; }
      setUserId(user.id);
      await upsertProfile(user);
      await Promise.all([loadFriends(user.id), loadTeams(user.id), loadGroups(user.id)]);
      setLoading(false);
    }
    init();
  }, [router, loadFriends, loadTeams, loadGroups]);

  // Load challenges when tab becomes active
  useEffect(() => {
    if (activeTab !== "challenges" || !userId) return;
    loadChallenges(userId);
  }, [activeTab, userId, loadChallenges]);

  useEffect(() => {
    if (activeTab === "teams" && userId) loadDiscoverTeams(userId);
  }, [activeTab, userId, loadDiscoverTeams]);

  useEffect(() => {
    if (activeTab === "groups" && userId) loadDiscoverGroups(userId);
  }, [activeTab, userId, loadDiscoverGroups]);

  // Refresh discover list whenever the friends tab is active, query, or filter changes
  useEffect(() => {
    if (activeTab !== "friends" || !userId) return;
    const timer = setTimeout(() => {
      loadDiscover(userId, allFriendships, discoverQuery, discoverFilter);
    }, discoverQuery.trim().length >= 2 ? 300 : 0);
    return () => clearTimeout(timer);
  }, [activeTab, discoverQuery, discoverFilter, userId, allFriendships, loadDiscover]);

  async function sendRequest(toUserId: string) {
    setBusy(s => new Set(s).add(toUserId));
    await supabase.from("friendships").insert({ requester_id: userId, addressee_id: toUserId });
    setSentRequests(s => new Set(s).add(toUserId));
    await loadFriends(userId);
    setBusy(s => { const n = new Set(s); n.delete(toUserId); return n; });
  }

  async function acceptRequest(friendshipId: string) {
    setBusy(s => new Set(s).add(friendshipId));
    await supabase.from("friendships").update({ status: "accepted" }).eq("id", friendshipId);
    await loadFriends(userId);
    setBusy(s => { const n = new Set(s); n.delete(friendshipId); return n; });
  }

  async function declineRequest(friendshipId: string) {
    setBusy(s => new Set(s).add(friendshipId));
    await supabase.from("friendships").delete().eq("id", friendshipId);
    await loadFriends(userId);
    setBusy(s => { const n = new Set(s); n.delete(friendshipId); return n; });
  }

  async function removeFriend(friendshipId: string) {
    setBusy(s => new Set(s).add(friendshipId));
    await supabase.from("friendships").delete().eq("id", friendshipId);
    await loadFriends(userId);
    setBusy(s => { const n = new Set(s); n.delete(friendshipId); return n; });
  }

  async function declineChallenge(challenge: ChallengeItem) {
    setChallengeBusy(s => new Set(s).add(challenge.id));
    const table = challenge.type === "team" ? "challenges" : "group_challenges";
    await supabase.from(table).delete().eq("id", challenge.id);
    setChallenges(prev => prev.filter(c => c.id !== challenge.id));
    setChallengeBusy(s => { const n = new Set(s); n.delete(challenge.id); return n; });
  }

  async function acceptChallenge(challenge: ChallengeItem) {
    setChallengeBusy(s => new Set(s).add(challenge.id));
    const table = challenge.type === "team" ? "challenges" : "group_challenges";
    await supabase.from(table).update({ status: "accepted" }).eq("id", challenge.id);
    setChallenges(prev => prev.map(c => c.id === challenge.id ? { ...c, status: "accepted" } : c));
    setChallengeBusy(s => { const n = new Set(s); n.delete(challenge.id); return n; });
  }

  async function joinDiscoverTeam(teamId: string) {
    setDiscoverTeamsBusy(s => new Set(s).add(teamId));
    const { error } = await supabase.from("team_members").insert({ team_id: teamId, user_id: userId, role: "member" });
    if (error) { setTeamError("Could not join — you may already be a member."); }
    else { await Promise.all([loadTeams(userId), loadDiscoverTeams(userId)]); }
    setDiscoverTeamsBusy(s => { const n = new Set(s); n.delete(teamId); return n; });
  }

  async function joinDiscoverGroup(groupId: string) {
    setDiscoverGroupsBusy(s => new Set(s).add(groupId));
    const { error } = await supabase.from("friend_group_members").insert({ group_id: groupId, user_id: userId, role: "member" });
    if (error) { setGroupError("Could not join — you may already be a member."); }
    else { await Promise.all([loadGroups(userId), loadDiscoverGroups(userId)]); }
    setDiscoverGroupsBusy(s => { const n = new Set(s); n.delete(groupId); return n; });
  }

  async function joinGroupByCode() {
    const code = groupJoinCode.trim().toUpperCase();
    if (!code) return;
    setGroupBusy(true);
    setGroupError("");
    const { data: group } = await supabase.from("friend_groups").select("id").eq("invite_code", code).maybeSingle();
    if (!group) { setGroupError("Invalid code — no group found."); setGroupBusy(false); return; }
    const { error } = await supabase.from("friend_group_members").insert({ group_id: group.id, user_id: userId, role: "member" });
    if (error) { setGroupError("You're already in this group."); setGroupBusy(false); return; }
    setGroupJoinCode("");
    await Promise.all([loadGroups(userId), loadDiscoverGroups(userId)]);
    setGroupBusy(false);
  }

  async function createTeam() {
    if (!newTeamName.trim()) return;
    setTeamBusy(true);
    setTeamError("");
    if (hasProfanity(newTeamName) || hasProfanity(newTeamDesc)) {
      setTeamError("Please use an appropriate name.");
      setTeamBusy(false); return;
    }
    const teamId = crypto.randomUUID();
    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const { error } = await supabase
      .from("teams")
      .insert({ id: teamId, name: newTeamName.trim(), description: newTeamDesc.trim() || null, created_by: userId, invite_code: inviteCode });
    if (error) { setTeamError("Failed to create team."); setTeamBusy(false); return; }
    await supabase.from("team_members").insert({ team_id: teamId, user_id: userId, role: "admin" });
    setNewTeamName(""); setNewTeamDesc(""); setShowCreateTeam(false);
    await loadTeams(userId);
    setTeamBusy(false);
  }

  async function joinTeam() {
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    setTeamBusy(true);
    setTeamError("");
    // Use maybeSingle to avoid 406 on no match; RLS allows select by invite_code lookup needs creator policy
    const { data: team } = await supabase.from("teams").select("id").eq("invite_code", code).maybeSingle();
    if (!team) { setTeamError("Invalid code — no team found."); setTeamBusy(false); return; }
    const { error } = await supabase.from("team_members").insert({ team_id: team.id, user_id: userId, role: "member" });
    if (error) { setTeamError("You're already in this team."); setTeamBusy(false); return; }
    setJoinCode("");
    await loadTeams(userId);
    setTeamBusy(false);
  }

  async function createGroup() {
    if (!newGroupName.trim() || selectedFriendIds.size === 0) return;
    setGroupBusy(true);
    setGroupError("");
    if (hasProfanity(newGroupName)) {
      setGroupError("Please use an appropriate group name.");
      setGroupBusy(false); return;
    }
    // No duplicate group names allowed
    const { data: existing } = await supabase
      .from("friend_groups")
      .select("id")
      .ilike("name", newGroupName.trim())
      .limit(1);
    if (existing && existing.length > 0) {
      setGroupError("A group with this name already exists.");
      setGroupBusy(false); return;
    }
    const groupId = crypto.randomUUID();
    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const { error } = await supabase
      .from("friend_groups")
      .insert({ id: groupId, name: newGroupName.trim(), created_by: userId, invite_code: inviteCode });
    if (error) { setGroupError("Failed to create group."); setGroupBusy(false); return; }
    const memberInserts = [
      { group_id: groupId, user_id: userId, role: "admin" },
      ...Array.from(selectedFriendIds).map(uid => ({ group_id: groupId, user_id: uid, role: "member" })),
    ];
    await supabase.from("friend_group_members").insert(memberInserts);
    setNewGroupName(""); setSelectedFriendIds(new Set()); setShowCreateGroup(false);
    await loadGroups(userId);
    setGroupBusy(false);
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
          <Link href="/player-profile" className="text-white/30 hover:text-white/60 transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </Link>
          <p className="text-white/30 text-xs font-bold tracking-widest uppercase">Matchbook</p>
        </div>
        <h1 className="text-2xl font-black text-white">Social</h1>
        {/* Tab switcher */}
        <div className="flex gap-1.5 mt-3 flex-wrap">
          {(["friends", "teams", "groups", "challenges"] as ActiveTab[]).map(t => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`text-xs font-black tracking-widest uppercase px-3 py-1.5 rounded-xl transition-all capitalize
                ${activeTab === t ? "bg-lime-400/20 text-lime-400" : "text-white/30 hover:text-white/50"}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 py-5 space-y-6">

        {/* ── FRIENDS TAB ── */}
        {activeTab === "friends" && (
          <>
            {/* ── Discover section (inline, always at top) ── */}
            <section className="space-y-3">
              <p className="text-xs font-black tracking-widest uppercase text-white/30">Discover Players</p>

              {/* Search */}
              <div className="relative">
                <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input
                  type="text"
                  placeholder="Search by name or username…"
                  value={discoverQuery}
                  onChange={e => setDiscoverQuery(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl pl-10 pr-4 py-3 text-white text-sm placeholder:text-white/25 outline-none focus:ring-2 focus:ring-lime-400/50 focus:border-lime-400/30 transition-all"
                />
              </div>

              {discoverLoading ? (
                <p className="text-xs text-white/20 text-center py-3">Loading players…</p>
              ) : discoverList.length === 0 ? (
                <p className="text-xs text-white/20 text-center py-3">No players found</p>
              ) : (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] divide-y divide-white/[0.06]">
                  {discoverList.map(r => (
                    <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                      <button
                        onClick={() => setProfileUserId(r.id)}
                        className="w-9 h-9 rounded-full bg-white/[0.06] flex items-center justify-center flex-shrink-0 active:scale-90 transition-transform"
                      >
                        <span className="text-sm font-black text-white/50">
                          {(r.display_name || r.username)[0].toUpperCase()}
                        </span>
                      </button>
                      <button onClick={() => setProfileUserId(r.id)} className="flex-1 text-left min-w-0">
                        <p className="text-sm font-semibold text-white/80 truncate">{r.display_name ?? `@${r.username}`}</p>
                        {r.display_name && <p className="text-xs text-white/30">@{r.username}</p>}
                      </button>
                      {sentRequests.has(r.id) ? (
                        <span className="text-xs text-white/30 font-semibold flex-shrink-0">Sent ✓</span>
                      ) : (
                        <button
                          onClick={() => sendRequest(r.id)}
                          disabled={busy.has(r.id)}
                          className="text-xs font-black text-lime-400 bg-lime-400/10 px-3 py-1.5 rounded-xl hover:bg-lime-400/20 transition-all active:scale-95 disabled:opacity-40 flex-shrink-0"
                        >
                          Add
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Pending requests */}
            {pending.length > 0 && (
              <section className="space-y-3">
                <p className="text-xs font-black tracking-widest uppercase text-white/30">
                  Friend Requests <span className="text-lime-400">({pending.length})</span>
                </p>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] divide-y divide-white/[0.06]">
                  {pending.map(p => (
                    <div key={p.friendshipId} className="flex items-center gap-3 px-4 py-3">
                      <div className="w-10 h-10 rounded-full bg-lime-400/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-base font-black text-lime-400">
                          {(p.displayName || p.username)[0].toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white/80 truncate">{p.displayName ?? `@${p.username}`}</p>
                        {p.displayName && <p className="text-xs text-white/30">@{p.username}</p>}
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          onClick={() => declineRequest(p.friendshipId)}
                          disabled={busy.has(p.friendshipId)}
                          className="text-xs font-bold text-white/40 bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl hover:text-white/60 transition-all active:scale-95 disabled:opacity-40"
                        >
                          Decline
                        </button>
                        <button
                          onClick={() => acceptRequest(p.friendshipId)}
                          disabled={busy.has(p.friendshipId)}
                          className="text-xs font-black text-lime-400 bg-lime-400/10 px-3 py-1.5 rounded-xl hover:bg-lime-400/20 transition-all active:scale-95 disabled:opacity-40"
                        >
                          Accept
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Friends list */}
            <section className="space-y-3">
              <p className="text-xs font-black tracking-widest uppercase text-white/30">
                Your Friends <span className="text-white/20">({friends.length})</span>
              </p>
              {friends.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center space-y-2">
                  <p className="text-3xl">👥</p>
                  <p className="text-sm text-white/50">No friends yet</p>
                  <p className="text-xs text-white/25">Search above to find and add players</p>
                </div>
              ) : (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] divide-y divide-white/[0.06]">
                  {friends.map(f => (
                    <div key={f.friendshipId} className="flex items-center gap-3 px-4 py-3">
                      <button
                        onClick={() => setProfileUserId(f.userId)}
                        className="w-10 h-10 rounded-full bg-lime-400/10 flex items-center justify-center flex-shrink-0 active:scale-90 transition-transform"
                      >
                        <span className="text-base font-black text-lime-400">
                          {(f.displayName || f.username)[0].toUpperCase()}
                        </span>
                      </button>
                      <button
                        onClick={() => setProfileUserId(f.userId)}
                        className="flex-1 text-left min-w-0"
                      >
                        <p className="text-sm font-semibold text-white/80 truncate">{f.displayName ?? `@${f.username}`}</p>
                        {f.displayName && <p className="text-xs text-white/30">@{f.username}</p>}
                      </button>
                      <button
                        onClick={() => removeFriend(f.friendshipId)}
                        disabled={busy.has(f.friendshipId)}
                        className="text-xs text-white/20 hover:text-red-400/60 transition-colors disabled:opacity-40 flex-shrink-0"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {/* ── TEAMS TAB ── */}
        {activeTab === "teams" && (
          <>
            {/* Create / Join row */}
            <div className="flex gap-2">
              <button
                onClick={() => { setShowCreateTeam(true); setTeamError(""); }}
                className="flex-1 text-xs font-black text-lime-400 bg-lime-400/10 py-2.5 rounded-xl hover:bg-lime-400/20 transition-all active:scale-95"
              >
                + Create Team
              </button>
            </div>

            {/* Join via code */}
            <section className="space-y-2">
              <p className="text-xs font-black tracking-widest uppercase text-white/30">Join via Invite Code</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Enter 6-char code…"
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value.toUpperCase())}
                  maxLength={6}
                  className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm placeholder:text-white/25 outline-none focus:ring-2 focus:ring-lime-400/50 focus:border-lime-400/30 transition-all font-mono tracking-widest uppercase"
                />
                <button
                  onClick={joinTeam}
                  disabled={teamBusy || joinCode.trim().length < 6}
                  className="text-xs font-black text-lime-400 bg-lime-400/10 px-4 rounded-xl hover:bg-lime-400/20 transition-all active:scale-95 disabled:opacity-40"
                >
                  Join
                </button>
              </div>
              {teamError && <p className="text-xs text-red-400/80">{teamError}</p>}
            </section>

            {/* Discover Teams */}
            <section className="space-y-3">
              <p className="text-xs font-black tracking-widest uppercase text-white/30">Discover Teams</p>
              {discoverTeams.length === 0 ? (
                <p className="text-white/25 text-xs text-center py-3">No other teams to discover</p>
              ) : (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] divide-y divide-white/[0.06]">
                  {discoverTeams.map(t => (
                    <div key={t.id} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-white/80">{t.name}</p>
                        <p className="text-xs text-white/30">{t.member_count} member{t.member_count !== 1 ? "s" : ""}</p>
                      </div>
                      <button
                        onClick={() => joinDiscoverTeam(t.id)}
                        disabled={discoverTeamsBusy.has(t.id)}
                        className="text-xs font-black text-lime-400 bg-lime-400/10 px-3 py-1.5 rounded-xl hover:bg-lime-400/20 transition-all active:scale-95 disabled:opacity-40"
                      >
                        {discoverTeamsBusy.has(t.id) ? "Joining…" : "Join"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Teams list */}
            <section className="space-y-3">
              <p className="text-xs font-black tracking-widest uppercase text-white/30">
                Your Teams <span className="text-white/20">({teams.length})</span>
              </p>
              {teams.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center space-y-2">
                  <p className="text-3xl">🏆</p>
                  <p className="text-sm text-white/50">No teams yet</p>
                  <p className="text-xs text-white/25">Create a team or join with an invite code</p>
                </div>
              ) : (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] divide-y divide-white/[0.06]">
                  {teams.map(t => (
                    <div key={t.id} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-white/80">{t.name}</p>
                        <p className="text-xs text-white/30">{t.member_count} member{t.member_count !== 1 ? "s" : ""} · {t.role}</p>
                      </div>
                      <Link
                        href={`/teams/${t.id}`}
                        className="text-xs font-black text-lime-400 bg-lime-400/10 px-3 py-1.5 rounded-xl hover:bg-lime-400/20 transition-all active:scale-95"
                      >
                        View
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Create Team Modal */}
            {showCreateTeam && (
              <div className="fixed inset-0 z-[100] bg-black/70 flex items-end justify-center" onClick={() => setShowCreateTeam(false)}>
                <div className="bg-[#141416] border border-white/10 rounded-t-3xl w-full max-w-sm p-6 space-y-4" onClick={e => e.stopPropagation()}>
                  <h2 className="text-lg font-black text-white">Create Team</h2>
                  <input
                    type="text"
                    placeholder="Team name…"
                    value={newTeamName}
                    onChange={e => setNewTeamName(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm placeholder:text-white/25 outline-none focus:ring-2 focus:ring-lime-400/50 focus:border-lime-400/30 transition-all"
                  />
                  <input
                    type="text"
                    placeholder="Description (optional)…"
                    value={newTeamDesc}
                    onChange={e => setNewTeamDesc(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm placeholder:text-white/25 outline-none focus:ring-2 focus:ring-lime-400/50 focus:border-lime-400/30 transition-all"
                  />
                  {teamError && <p className="text-xs text-red-400/80">{teamError}</p>}
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowCreateTeam(false)}
                      className="flex-1 text-sm font-bold text-white/40 bg-white/5 border border-white/10 py-3 rounded-2xl hover:text-white/60 transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={createTeam}
                      disabled={teamBusy || !newTeamName.trim()}
                      className="flex-1 text-sm font-black text-black bg-lime-400 py-3 rounded-2xl hover:bg-lime-300 transition-all active:scale-95 disabled:opacity-40"
                    >
                      {teamBusy ? "Creating…" : "Create"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── GROUPS TAB ── */}
        {activeTab === "groups" && (
          <>
            <div className="flex gap-2">
              <button
                onClick={() => { setShowCreateGroup(true); setGroupError(""); setSelectedFriendIds(new Set()); }}
                className="flex-1 text-xs font-black text-lime-400 bg-lime-400/10 py-2.5 rounded-xl hover:bg-lime-400/20 transition-all active:scale-95"
              >
                + Create Group
              </button>
            </div>

            {/* Join via Invite Code */}
            <section className="space-y-2">
              <p className="text-xs font-black tracking-widest uppercase text-white/30">Join via Invite Code</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Enter 6-char code…"
                  value={groupJoinCode}
                  onChange={e => setGroupJoinCode(e.target.value.toUpperCase())}
                  maxLength={6}
                  className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm placeholder:text-white/25 outline-none focus:ring-2 focus:ring-lime-400/50 focus:border-lime-400/30 transition-all font-mono tracking-widest uppercase"
                />
                <button
                  onClick={joinGroupByCode}
                  disabled={groupBusy || groupJoinCode.trim().length < 6}
                  className="text-xs font-black text-lime-400 bg-lime-400/10 px-4 rounded-xl hover:bg-lime-400/20 transition-all active:scale-95 disabled:opacity-40"
                >
                  Join
                </button>
              </div>
              {groupError && <p className="text-xs text-red-400/80">{groupError}</p>}
            </section>

            {/* Discover Groups */}
            <section className="space-y-3">
              <p className="text-xs font-black tracking-widest uppercase text-white/30">Discover Groups</p>
              {discoverGroups.length === 0 ? (
                <p className="text-white/25 text-xs text-center py-3">No other groups to discover</p>
              ) : (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] divide-y divide-white/[0.06]">
                  {discoverGroups.map(g => (
                    <div key={g.id} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-white/80">{g.name}</p>
                        <p className="text-xs text-white/30">{g.member_count} member{g.member_count !== 1 ? "s" : ""}</p>
                      </div>
                      <button
                        onClick={() => joinDiscoverGroup(g.id)}
                        disabled={discoverGroupsBusy.has(g.id)}
                        className="text-xs font-black text-lime-400 bg-lime-400/10 px-3 py-1.5 rounded-xl hover:bg-lime-400/20 transition-all active:scale-95 disabled:opacity-40"
                      >
                        {discoverGroupsBusy.has(g.id) ? "Joining…" : "Join"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Groups list */}
            <section className="space-y-3">
              <p className="text-xs font-black tracking-widest uppercase text-white/30">
                Your Groups <span className="text-white/20">({groups.length})</span>
              </p>
              {groups.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center space-y-2">
                  <p className="text-3xl">💬</p>
                  <p className="text-sm text-white/50">No groups yet</p>
                  <p className="text-xs text-white/25">Create a group with your friends</p>
                </div>
              ) : (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] divide-y divide-white/[0.06]">
                  {groups.map(g => (
                    <div key={g.id} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-white/80">{g.name}</p>
                        <p className="text-xs text-white/30">{g.member_count} member{g.member_count !== 1 ? "s" : ""}</p>
                      </div>
                      <Link
                        href={`/groups/${g.id}`}
                        className="text-xs font-black text-lime-400 bg-lime-400/10 px-3 py-1.5 rounded-xl hover:bg-lime-400/20 transition-all active:scale-95"
                      >
                        View
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Create Group Modal */}
            {showCreateGroup && (
              <div className="fixed inset-0 z-[100] bg-black/70 flex items-end justify-center" onClick={() => setShowCreateGroup(false)}>
                <div className="bg-[#141416] border border-white/10 rounded-t-3xl w-full max-w-sm flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
                  {/* Fixed header */}
                  <div className="px-6 pt-6 pb-4 space-y-4 flex-shrink-0">
                    <h2 className="text-lg font-black text-white">Create Group</h2>
                    <input
                      type="text"
                      placeholder="Group name…"
                      value={newGroupName}
                      onChange={e => setNewGroupName(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm placeholder:text-white/25 outline-none focus:ring-2 focus:ring-lime-400/50 focus:border-lime-400/30 transition-all"
                    />
                    <p className="text-xs font-black tracking-widest uppercase text-white/30">Add Friends</p>
                  </div>
                  {/* Scrollable friends list */}
                  <div className="px-6 overflow-y-auto flex-1 min-h-0">
                    {friends.length === 0 ? (
                      <p className="text-xs text-white/25 pb-4">You need friends to create a group</p>
                    ) : (
                      <div className="flex flex-wrap gap-2 pb-4">
                        {friends.map(f => {
                          const sel = selectedFriendIds.has(f.userId);
                          return (
                            <button
                              key={f.userId}
                              onClick={() => setSelectedFriendIds(prev => {
                                const n = new Set(prev);
                                sel ? n.delete(f.userId) : n.add(f.userId);
                                return n;
                              })}
                              className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-all border
                                ${sel ? "bg-lime-400/20 text-lime-400 border-lime-400/30" : "bg-white/5 text-white/40 border-white/10 hover:text-white/60"}`}
                            >
                              {f.displayName ?? `@${f.username}`}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  {/* Fixed footer */}
                  <div className="px-6 pt-3 pb-6 flex-shrink-0 space-y-3">
                  {groupError && <p className="text-xs text-red-400/80">{groupError}</p>}
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowCreateGroup(false)}
                      className="flex-1 text-sm font-bold text-white/40 bg-white/5 border border-white/10 py-3 rounded-2xl hover:text-white/60 transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={createGroup}
                      disabled={groupBusy || !newGroupName.trim() || selectedFriendIds.size === 0}
                      className="flex-1 text-sm font-black text-black bg-lime-400 py-3 rounded-2xl hover:bg-lime-300 transition-all active:scale-95 disabled:opacity-40"
                    >
                      {groupBusy ? "Creating…" : "Create"}
                    </button>
                  </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── CHALLENGES TAB ── */}
        {activeTab === "challenges" && (
          <>
            {challengesLoading ? (
              <div className="py-10 text-center">
                <p className="text-white/30 text-sm">Loading…</p>
              </div>
            ) : challenges.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center space-y-2">
                <p className="text-3xl">⚔️</p>
                <p className="text-sm text-white/50">No active challenges</p>
                <p className="text-xs text-white/25">Challenge teammates from the Teams or Groups pages</p>
              </div>
            ) : (
              <>
                {/* Received challenges */}
                {challenges.filter(c => c.opponentId === userId).length > 0 && (
                  <section className="space-y-3">
                    <p className="text-xs font-black tracking-widest uppercase text-white/30">
                      Received <span className="text-lime-400">({challenges.filter(c => c.opponentId === userId).length})</span>
                    </p>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] divide-y divide-white/[0.06]">
                      {challenges.filter(c => c.opponentId === userId).map(c => (
                        <div key={c.id} className="px-4 py-3 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-white/80">
                                {c.challengerName} challenged you
                              </p>
                              <p className="text-xs text-white/30 mt-0.5">
                                {c.type === "team" ? "Team" : "Group"}: {c.contextName}
                              </p>
                            </div>
                            {c.status === "accepted" ? (
                              <div className="flex gap-2 flex-shrink-0">
                                <button
                                  onClick={() => router.push(`/log?opponent=${encodeURIComponent(c.challengerName)}&challengeId=${c.id}&challengeType=${c.type}`)}
                                  className="text-xs font-black text-lime-400 bg-lime-400/10 px-3 py-1.5 rounded-xl hover:bg-lime-400/20 transition-all active:scale-95"
                                >
                                  Log Match
                                </button>
                                <button
                                  onClick={() => declineChallenge(c)}
                                  disabled={challengeBusy.has(c.id)}
                                  className="text-xs font-bold text-white/25 hover:text-red-400/70 transition-colors disabled:opacity-40"
                                  title="Cancel challenge"
                                >
                                  ×
                                </button>
                              </div>
                            ) : (
                              <div className="flex gap-2 flex-shrink-0">
                                <button
                                  onClick={() => declineChallenge(c)}
                                  disabled={challengeBusy.has(c.id)}
                                  className="text-xs font-bold text-white/40 bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl hover:text-red-400/70 hover:border-red-400/20 transition-all active:scale-95 disabled:opacity-40"
                                >
                                  Decline
                                </button>
                                <button
                                  onClick={() => acceptChallenge(c)}
                                  disabled={challengeBusy.has(c.id)}
                                  className="text-xs font-black text-lime-400 bg-lime-400/10 px-3 py-1.5 rounded-xl hover:bg-lime-400/20 transition-all active:scale-95 disabled:opacity-40"
                                >
                                  Accept
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Sent challenges */}
                {challenges.filter(c => c.challengerId === userId).length > 0 && (
                  <section className="space-y-3">
                    <p className="text-xs font-black tracking-widest uppercase text-white/30">Sent</p>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] divide-y divide-white/[0.06]">
                      {challenges.filter(c => c.challengerId === userId).map(c => (
                        <div key={c.id} className="flex items-center justify-between px-4 py-3">
                          <div>
                            <p className="text-sm font-semibold text-white/80">
                              vs {c.opponentName}
                            </p>
                            <p className="text-xs text-white/30 mt-0.5">
                              {c.type === "team" ? "Team" : "Group"}: {c.contextName}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {c.status === "accepted" ? (
                              <button
                                onClick={() => router.push(`/log?opponent=${encodeURIComponent(c.opponentName)}&challengeId=${c.id}&challengeType=${c.type}`)}
                                className="text-xs font-black text-lime-400 bg-lime-400/10 px-3 py-1.5 rounded-xl hover:bg-lime-400/20 transition-all active:scale-95"
                              >
                                Log Match
                              </button>
                            ) : (
                              <span className="text-[10px] font-black px-2 py-1 rounded-lg text-white/30 bg-white/5">
                                Pending
                              </span>
                            )}
                            <button
                              onClick={() => declineChallenge(c)}
                              disabled={challengeBusy.has(c.id)}
                              className="text-xs font-bold text-white/25 hover:text-red-400/70 transition-colors disabled:opacity-40"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </>
            )}
          </>
        )}

      </div>

      {profileUserId && (
        <ProfileCard userId={profileUserId} onClose={() => setProfileUserId(null)} />
      )}
      <BottomNav active="friends" />
    </main>
  );
}
