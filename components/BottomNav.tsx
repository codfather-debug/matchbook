"use client";
import Link from "next/link";

type Tab = "log" | "history" | "dashboard" | "playbook" | "profile";

export default function BottomNav({ active }: { active: Tab }) {
  const base = "flex flex-col items-center justify-center gap-1 text-[10px] font-bold transition-colors";
  const on   = "text-lime-400";
  const off  = "text-white/30 hover:text-white/60";

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#0c0c0e]/95 backdrop-blur-xl border-t border-white/[0.06] pb-safe">
      <div className="max-w-sm mx-auto flex items-center justify-around h-16 px-2">

        {/* Log — left, retains lime accent pill */}
        <Link href="/log" className={`${base} flex-1 py-2 ${active === "log" ? on : off}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${active === "log" ? "bg-lime-400" : "bg-lime-400/20"}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={active === "log" ? "black" : "rgb(163 230 53)"} strokeWidth="3" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </div>
          Log
        </Link>

        {/* History */}
        <Link href="/history" className={`${base} ${active === "history" ? on : off} flex-1 py-2`}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/>
            <path d="M9 21V12h6v9"/>
          </svg>
          History
        </Link>

        {/* Dashboard — center accent */}
        <Link href="/dashboard" className="flex-1 flex flex-col items-center justify-center -mt-4">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-90 ${active === "dashboard" ? "bg-lime-300 shadow-lime-400/40" : "bg-lime-400 shadow-lime-400/30 hover:bg-lime-300"}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1"/>
              <rect x="14" y="3" width="7" height="7" rx="1"/>
              <rect x="3" y="14" width="7" height="7" rx="1"/>
              <rect x="14" y="14" width="7" height="7" rx="1"/>
            </svg>
          </div>
          <span className="text-[10px] font-bold text-lime-400 mt-0.5">Dashboard</span>
        </Link>

        {/* Playbook */}
        <Link href="/playbook" className={`${base} ${active === "playbook" ? on : off} flex-1 py-2`}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5A2.5 2.5 0 016.5 17H20"/>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>
          </svg>
          Playbook
        </Link>

        {/* Profile */}
        <Link href="/player-profile" className={`${base} ${active === "profile" ? on : off} flex-1 py-2`}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="4"/>
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
          </svg>
          Profile
        </Link>

      </div>
    </nav>
  );
}
