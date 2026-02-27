"use client";
import Link from "next/link";

type Tab = "log" | "history" | "dashboard" | "playbook" | "friends" | "profile";

export default function BottomNav({ active }: { active: Tab }) {
  const base = "flex flex-col items-center justify-center gap-0.5 text-[9px] font-bold transition-colors";
  const on   = "text-lime-400";
  const off  = "text-white/30 hover:text-white/60";

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#0c0c0e]/90 backdrop-blur-2xl border-t border-white/[0.05] pb-safe shadow-[0_-12px_50px_rgba(0,0,0,0.85)]">
      <div className="max-w-sm mx-auto flex items-center justify-around h-16 px-1">

        {/* Log */}
        <Link href="/log" className={`${base} flex-1 py-2 ${active === "log" ? on : off}`}>
          <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${active === "log" ? "bg-lime-400" : "bg-lime-400/20"}`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={active === "log" ? "black" : "rgb(163 230 53)"} strokeWidth="3" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </div>
          Log
        </Link>

        {/* History */}
        <Link href="/history" className={`${base} ${active === "history" ? on : off} flex-1 py-2`}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/>
            <path d="M9 21V12h6v9"/>
          </svg>
          History
        </Link>

        {/* Dashboard — center accent */}
        <Link href="/dashboard" className="flex-1 flex flex-col items-center justify-center -mt-3">
          <div className={`w-11 h-11 rounded-full flex items-center justify-center transition-all active:scale-90 ${active === "dashboard" ? "bg-lime-300 shadow-[0_0_24px_rgba(163,230,53,0.5)]" : "bg-lime-400 shadow-[0_0_16px_rgba(163,230,53,0.3)] hover:bg-lime-300 hover:shadow-[0_0_24px_rgba(163,230,53,0.5)]"}`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1"/>
              <rect x="14" y="3" width="7" height="7" rx="1"/>
              <rect x="3" y="14" width="7" height="7" rx="1"/>
              <rect x="14" y="14" width="7" height="7" rx="1"/>
            </svg>
          </div>
          <span className="text-[9px] font-bold text-lime-400 mt-0.5">Dashboard</span>
        </Link>

        {/* Playbook */}
        <Link href="/playbook" className={`${base} ${active === "playbook" ? on : off} flex-1 py-2`}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5A2.5 2.5 0 016.5 17H20"/>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>
          </svg>
          Playbook
        </Link>

        {/* Friends */}
        <Link href="/friends" className={`${base} ${active === "friends" ? on : off} flex-1 py-2`}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          Friends
        </Link>

        {/* Profile */}
        <Link href="/player-profile" className={`${base} ${active === "profile" ? on : off} flex-1 py-2`}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="4"/>
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
          </svg>
          Profile
        </Link>

      </div>
    </nav>
  );
}
