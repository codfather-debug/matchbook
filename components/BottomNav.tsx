"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Tab = "log" | "history" | "dashboard" | "playbook" | "friends" | "profile";

export default function BottomNav({ active }: { active: Tab }) {
  const [notifCount, setNotifCount] = useState(0);

  useEffect(() => {
    async function loadNotifications() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const results = await Promise.allSettled([
          // Pending friend requests sent to me
          supabase.from("friendships").select("id", { count: "exact", head: true })
            .eq("addressee_id", user.id).eq("status", "pending"),
          // Pending team challenges (I'm the opponent)
          supabase.from("challenges").select("id", { count: "exact", head: true })
            .eq("opponent_id", user.id).eq("status", "pending"),
          // Pending group challenges (I'm the opponent)
          supabase.from("group_challenges").select("id", { count: "exact", head: true })
            .eq("opponent_id", user.id).eq("status", "pending"),
          // Score confirmations needed from me — team
          supabase.from("challenges").select("id", { count: "exact", head: true })
            .eq("opponent_id", user.id).eq("status", "pending_confirmation"),
          // Score confirmations needed from me — group
          supabase.from("group_challenges").select("id", { count: "exact", head: true })
            .eq("opponent_id", user.id).eq("status", "pending_confirmation"),
        ]);

        const total = results.reduce((sum, r) => {
          if (r.status === "fulfilled") return sum + (r.value.count ?? 0);
          return sum;
        }, 0);

        setNotifCount(total);
      } catch {
        // silently ignore — badge just won't show
      }
    }
    loadNotifications();
  }, []);

  const base = "flex flex-col items-center justify-center gap-0.5 text-[9px] font-bold transition-colors";
  const on   = "text-lime-600";
  const off  = "text-gray-400 hover:text-gray-600";

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-2xl border-t border-gray-200 pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
      <div className="max-w-sm mx-auto flex items-center justify-around h-16 px-1">

        {/* Log */}
        <Link href="/log" className={`${base} flex-1 py-2 ${active === "log" ? on : off}`}>
          <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${active === "log" ? "bg-lime-400" : "bg-lime-100"}`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={active === "log" ? "black" : "rgb(101 163 13)"} strokeWidth="3" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </div>
          Log
        </Link>

        {/* History */}
        <Link href="/history" className={`${base} flex-1 py-2 ${active === "history" ? on : off}`}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="12 8 12 12 14 14"/>
            <path d="M3.05 11a9 9 0 1 0 .5-4.5"/>
            <polyline points="3 3 3 8 8 8"/>
          </svg>
          History
        </Link>

        {/* Dashboard — center accent */}
        <Link href="/dashboard" className="flex-1 flex flex-col items-center justify-center -mt-3">
          <div className={`w-11 h-11 rounded-full flex items-center justify-center transition-all active:scale-90 ${active === "dashboard" ? "bg-lime-500 shadow-[0_0_12px_rgba(101,163,13,0.25)]" : "bg-lime-400 shadow-[0_0_10px_rgba(163,230,53,0.2)] hover:bg-lime-500"}`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1"/>
              <rect x="14" y="3" width="7" height="7" rx="1"/>
              <rect x="3" y="14" width="7" height="7" rx="1"/>
              <rect x="14" y="14" width="7" height="7" rx="1"/>
            </svg>
          </div>
          <span className="text-[9px] font-bold text-lime-600 mt-0.5">Dashboard</span>
        </Link>

        {/* Playbook */}
        <Link href="/playbook" className={`${base} ${active === "playbook" ? on : off} flex-1 py-2`}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5A2.5 2.5 0 016.5 17H20"/>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>
          </svg>
          Playbook
        </Link>

        {/* Friends — with notification badge */}
        <Link href="/friends" className={`${base} ${active === "friends" ? on : off} flex-1 py-2`}>
          <div className="relative">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            {notifCount > 0 && (
              <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 bg-red-500 rounded-full text-[9px] font-black text-gray-900 flex items-center justify-center px-0.5 leading-none">
                {notifCount > 9 ? "9+" : notifCount}
              </span>
            )}
          </div>
          Friends
        </Link>

      </div>
    </nav>
  );
}
