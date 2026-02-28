"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface Props {
  userId: string;
  onClose: () => void;
}

interface ProfileData {
  displayName?: string;
  username: string;
  avatarUrl?: string;
  wins: number;
  losses: number;
  winPct: number;
  recentMatches: { id: string; opponent_name: string; result: string; surface: string }[];
}

export default function ProfileCard({ userId, onClose }: Props) {
  const [data, setData] = useState<ProfileData | null>(null);

  useEffect(() => {
    async function load() {
      const [{ data: profile }, { data: matches }] = await Promise.all([
        supabase.from("profiles").select("display_name, username, avatar_url").eq("id", userId).single(),
        supabase.from("matches")
          .select("id, opponent_name, result, surface, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(100),
      ]);
      const wins = (matches ?? []).filter(m => m.result === "win").length;
      const losses = (matches ?? []).filter(m => m.result === "loss").length;
      const total = wins + losses;
      setData({
        displayName: profile?.display_name,
        username: profile?.username ?? userId,
        avatarUrl: profile?.avatar_url ?? undefined,
        wins,
        losses,
        winPct: total > 0 ? Math.round((wins / total) * 100) : 0,
        recentMatches: (matches ?? []).slice(0, 5),
      });
    }
    load();
  }, [userId]);

  return (
    <div
      className="fixed inset-0 z-[200] bg-black/70 flex items-end justify-center"
      onClick={onClose}
    >
      <div
        className="bg-[#141416] border border-gray-200 rounded-t-3xl w-full max-w-sm p-6 space-y-5"
        onClick={e => e.stopPropagation()}
      >
        {!data ? (
          <div className="py-10 text-center">
            <p className="text-gray-400 text-sm">Loading…</p>
          </div>
        ) : (
          <>
            {/* Avatar + name */}
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full overflow-hidden bg-lime-50 flex items-center justify-center flex-shrink-0">
                {data.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={data.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl font-black text-lime-700">
                    {(data.displayName || data.username)[0].toUpperCase()}
                  </span>
                )}
              </div>
              <div>
                <p className="text-lg font-black text-white">
                  {data.displayName ?? `@${data.username}`}
                </p>
                {data.displayName && (
                  <p className="text-sm text-gray-400">@{data.username}</p>
                )}
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-3 text-center">
                <p className="text-xl font-black text-gray-900">{data.wins}</p>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">Wins</p>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-3 text-center">
                <p className="text-xl font-black text-gray-900">{data.losses}</p>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">Losses</p>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-3 text-center">
                <p className="text-xl font-black text-lime-700">{data.winPct}%</p>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">Win %</p>
              </div>
            </div>

            {/* Recent matches */}
            {data.recentMatches.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-black tracking-widest uppercase text-gray-400">Recent Matches</p>
                <div className="space-y-1.5">
                  {data.recentMatches.map(m => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between bg-gray-50 border border-gray-100 rounded-xl px-3 py-2"
                    >
                      <p className="text-sm text-gray-700 truncate">vs {m.opponent_name}</p>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-[10px] text-gray-400 capitalize">{m.surface}</span>
                        <span className={`text-xs font-black px-1.5 py-0.5 rounded-lg ${
                          m.result === "win" ? "text-lime-700 bg-lime-50" : "text-red-600/70 bg-red-400/10"
                        }`}>
                          {m.result === "win" ? "W" : "L"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.wins + data.losses === 0 && (
              <p className="text-sm text-gray-400 text-center py-2">No matches logged yet</p>
            )}

            <button
              onClick={onClose}
              className="w-full text-sm font-bold text-gray-500 bg-white/5 border border-gray-200 py-3 rounded-2xl hover:text-gray-600 transition-all"
            >
              Close
            </button>
          </>
        )}
      </div>
    </div>
  );
}
