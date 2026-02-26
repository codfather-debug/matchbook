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
    badge: "text-lime-400",
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
];

export default function PlaybookIndexPage() {
  return (
    <main className="min-h-screen bg-[#0c0c0e] max-w-sm mx-auto pb-24">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-white/[0.06]">
        <p className="text-white/30 text-xs font-bold tracking-widest uppercase">Matchbook</p>
        <h1 className="text-2xl font-black text-white mt-0.5">Playbooks</h1>
        <p className="text-white/30 text-sm mt-0.5">Strategy guides for every situation</p>
      </div>

      <div className="px-5 py-5 space-y-3">
        {BOOKS.map(b => (
          <Link
            key={b.href}
            href={b.href}
            className={`flex items-center gap-4 rounded-2xl border bg-white/[0.02] p-5 transition-all active:scale-[0.98] ${b.accent}`}
          >
            <span className="text-4xl flex-shrink-0">{b.icon}</span>
            <div className="flex-1 min-w-0">
              <p className={`text-base font-black ${b.badge}`}>{b.title}</p>
              <p className="text-sm text-white/40 mt-0.5">{b.sub}</p>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-white/20 flex-shrink-0">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </Link>
        ))}
      </div>

      <BottomNav active="playbook" />
    </main>
  );
}
