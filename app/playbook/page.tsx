"use client";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";

const BOOKS = [
  {
    href: "/playbook/singles",
    icon: "🎾",
    title: "Singles Playbook",
    sub: "8 strategies · patterns · court zones",
    accent: "border-lime-400/20 hover:border-lime-400/40",
    badge: "text-lime-700",
  },
  {
    href: "/playbook/doubles",
    icon: "👥",
    title: "Doubles Playbook",
    sub: "Roles · formations · communication",
    accent: "border-sky-400/20 hover:border-sky-400/40",
    badge: "text-sky-400",
  },
  {
    href: "/playbook/mental",
    icon: "🧠",
    title: "Mental Toughness",
    sub: "Routines · focus · momentum",
    accent: "border-amber-400/20 hover:border-amber-400/40",
    badge: "text-amber-400",
  },
  {
    href: "/playbook/return",
    icon: "↩️",
    title: "Return Game",
    sub: "Positioning · patterns · reading serves",
    accent: "border-sky-400/20 hover:border-sky-400/40",
    badge: "text-sky-300",
  },
  {
    href: "/playbook/warmup",
    icon: "🔥",
    title: "Warm-Up Routine",
    sub: "10-min protocol · dynamic prep · mental checklist",
    accent: "border-orange-400/20 hover:border-orange-400/40",
    badge: "text-orange-400",
  },
  {
    href: "/playbook/scoring",
    icon: "📊",
    title: "Match Scoring",
    sub: "Ad scoring · tiebreaks · pro-set",
    accent: "border-red-400/20 hover:border-red-400/40",
    badge: "text-red-600",
  },
  {
    href: "/playbook/rules",
    icon: "📋",
    title: "Rules & The Code",
    sub: "Line calls · serving · hindrance",
    accent: "border-gray-200 hover:border-gray-200",
    badge: "text-gray-700",
  },
];

export default function PlaybookIndexPage() {
  return (
    <main className="min-h-screen bg-white max-w-sm mx-auto pb-24">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-gray-200">
        <p className="text-gray-400 text-xs font-bold tracking-widest uppercase">Matchbook</p>
        <h1 className="text-2xl font-black text-gray-900 mt-0.5">Playbooks</h1>
        <p className="text-gray-400 text-sm mt-0.5">Strategy guides for every situation</p>
      </div>

      <div className="px-5 py-5 space-y-3">
        {BOOKS.map(b => (
          <Link
            key={b.href}
            href={b.href}
            className={`flex items-center gap-4 rounded-2xl border bg-gray-50 p-5 transition-all active:scale-[0.98] ${b.accent}`}
          >
            <span className="text-4xl flex-shrink-0">{b.icon}</span>
            <div className="flex-1 min-w-0">
              <p className={`text-base font-black ${b.badge}`}>{b.title}</p>
              <p className="text-sm text-gray-500 mt-0.5">{b.sub}</p>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-gray-300 flex-shrink-0">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </Link>
        ))}
      </div>

      <BottomNav active="playbook" />
    </main>
  );
}
