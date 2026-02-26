"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import BottomNav from "@/components/BottomNav";
import { upsertProfile } from "@/lib/profile";

interface FriendProfile { friendshipId: string; userId: string; username: string; }
interface PendingRequest { friendshipId: string; userId: string; username: string; }
interface SearchResult { id: string; username: string; }
interface FriendshipRow { id: string; requester_id: string; addressee_id: string; status: string; }

export default function FriendsPage() {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [pending, setPending] = useState<PendingRequest[]>([]);
  const [allFriendships, setAllFriendships] = useState<FriendshipRow[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [sentRequests, setSentRequests] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<Set<string>>(new Set());

  const loadData = useCallback(async (uid: string) => {
    const { data: friendshipRows } = await supabase
      .from("friendships")
      .select("id, requester_id, addressee_id, status")
      .or(`requester_id.eq.${uid},addressee_id.eq.${uid}`);

    const rows: FriendshipRow[] = friendshipRows ?? [];
    setAllFriendships(rows);

    const otherIds = [...new Set(rows.map(r => r.requester_id === uid ? r.addressee_id : r.requester_id))];

    let profileMap: Record<string, string> = {};
    if (otherIds.length > 0) {
      const { data: profileRows } = await supabase
        .from("profiles").select("id, username").in("id", otherIds);
      profileMap = Object.fromEntries((profileRows ?? []).map(p => [p.id, p.username]));
    }

    setPending(
      rows
        .filter(r => r.status === "pending" && r.addressee_id === uid)
        .map(r => ({ friendshipId: r.id, userId: r.requester_id, username: profileMap[r.requester_id] ?? r.requester_id }))
    );

    setFriends(
      rows
        .filter(r => r.status === "accepted")
        .map(r => {
          const friendId = r.requester_id === uid ? r.addressee_id : r.requester_id;
          return { friendshipId: r.id, userId: friendId, username: profileMap[friendId] ?? friendId };
        })
    );
  }, []);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/auth"); return; }
      setUserId(user.id);
      await upsertProfile(user);
      await loadData(user.id);
      setLoading(false);
    }
    init();
  }, [router, loadData]);

  // Debounced search
  useEffect(() => {
    if (searchQuery.trim().length < 2) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("profiles").select("id, username")
        .ilike("username", `%${searchQuery.trim()}%`)
        .neq("id", userId)
        .limit(10);
      const existingIds = new Set(
        allFriendships.map(r => r.requester_id === userId ? r.addressee_id : r.requester_id)
      );
      setSearchResults((data ?? []).filter(p => !existingIds.has(p.id)));
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery, userId, allFriendships]);

  async function sendRequest(toUserId: string) {
    setBusy(s => new Set(s).add(toUserId));
    await supabase.from("friendships").insert({ requester_id: userId, addressee_id: toUserId });
    setSentRequests(s => new Set(s).add(toUserId));
    setSearchResults(r => r.filter(p => p.id !== toUserId));
    await loadData(userId);
    setBusy(s => { const n = new Set(s); n.delete(toUserId); return n; });
  }

  async function acceptRequest(friendshipId: string, fromUserId: string) {
    setBusy(s => new Set(s).add(friendshipId));
    await supabase.from("friendships").update({ status: "accepted" }).eq("id", friendshipId);
    await loadData(userId);
    setBusy(s => { const n = new Set(s); n.delete(friendshipId); return n; });
  }

  async function declineRequest(friendshipId: string) {
    setBusy(s => new Set(s).add(friendshipId));
    await supabase.from("friendships").delete().eq("id", friendshipId);
    await loadData(userId);
    setBusy(s => { const n = new Set(s); n.delete(friendshipId); return n; });
  }

  async function removeFriend(friendshipId: string) {
    setBusy(s => new Set(s).add(friendshipId));
    await supabase.from("friendships").delete().eq("id", friendshipId);
    await loadData(userId);
    setBusy(s => { const n = new Set(s); n.delete(friendshipId); return n; });
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
        <h1 className="text-2xl font-black text-white">Friends</h1>
        <p className="text-white/30 text-sm mt-0.5">{friends.length} {friends.length === 1 ? "friend" : "friends"}</p>
      </div>

      <div className="px-5 py-5 space-y-6">

        {/* Search */}
        <section className="space-y-3">
          <p className="text-xs font-black tracking-widest uppercase text-white/30">Find Players</p>
          <div className="relative">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              placeholder="Search by username…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl pl-10 pr-4 py-3 text-white text-sm placeholder:text-white/25 outline-none focus:ring-2 focus:ring-lime-400/50 focus:border-lime-400/30 transition-all"
            />
          </div>
          {searchResults.length > 0 && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] divide-y divide-white/[0.06]">
              {searchResults.map(r => (
                <div key={r.id} className="flex items-center justify-between px-4 py-3">
                  <p className="text-sm font-semibold text-white/80">@{r.username}</p>
                  {sentRequests.has(r.id) ? (
                    <span className="text-xs text-white/30 font-semibold">Sent ✓</span>
                  ) : (
                    <button
                      onClick={() => sendRequest(r.id)}
                      disabled={busy.has(r.id)}
                      className="text-xs font-black text-lime-400 bg-lime-400/10 px-3 py-1.5 rounded-xl hover:bg-lime-400/20 transition-all active:scale-95 disabled:opacity-40"
                    >
                      Add Friend
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          {searchQuery.trim().length >= 2 && searchResults.length === 0 && (
            <p className="text-xs text-white/20 text-center py-2">No players found</p>
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
                <div key={p.friendshipId} className="flex items-center justify-between px-4 py-3">
                  <p className="text-sm font-semibold text-white/80">@{p.username}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => declineRequest(p.friendshipId)}
                      disabled={busy.has(p.friendshipId)}
                      className="text-xs font-bold text-white/40 bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl hover:text-white/60 transition-all active:scale-95 disabled:opacity-40"
                    >
                      Decline
                    </button>
                    <button
                      onClick={() => acceptRequest(p.friendshipId, p.userId)}
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
          <p className="text-xs font-black tracking-widest uppercase text-white/30">Your Friends</p>
          {friends.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center space-y-2">
              <p className="text-3xl">👥</p>
              <p className="text-sm text-white/50">No friends yet</p>
              <p className="text-xs text-white/25">Search for players above to get started</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] divide-y divide-white/[0.06]">
              {friends.map(f => (
                <div key={f.friendshipId} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-white/80">@{f.username}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/friends/${f.userId}`}
                      className="text-xs font-black text-lime-400 bg-lime-400/10 px-3 py-1.5 rounded-xl hover:bg-lime-400/20 transition-all active:scale-95"
                    >
                      View
                    </Link>
                    <button
                      onClick={() => removeFriend(f.friendshipId)}
                      disabled={busy.has(f.friendshipId)}
                      className="text-xs font-bold text-white/25 hover:text-red-400/70 transition-colors disabled:opacity-40"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>

      <BottomNav active="profile" />
    </main>
  );
}
