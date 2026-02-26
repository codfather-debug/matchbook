"use client";
import { useState } from "react";
import Link from "next/link";

// ─── Data ────────────────────────────────────────────────────────────────────

const FORMATS = [
  {
    id: "ad",
    title: "Ad Scoring",
    icon: "🎾",
    color: "border-lime-400/20 bg-lime-400/[0.03]",
    badge: "text-lime-400",
    summary: "Standard tennis scoring used in most matches.",
    rules: [
      "Points are scored as: Love (0), 15, 30, 40, Game.",
      "When both players reach 40, the score is Deuce.",
      "After deuce, the server wins the next point → Ad-In; receiver wins it → Ad-Out.",
      "The player with the Ad must win the next point to win the game.",
      "If the Ad player loses the point, the score returns to Deuce.",
      "There is no limit to the number of Deuces in a single game.",
    ],
  },
  {
    id: "proset",
    title: "Pro-Set",
    icon: "⚡",
    color: "border-amber-400/20 bg-amber-400/[0.03]",
    badge: "text-amber-400",
    summary: "One extended set played to 8 games. Common in HS tennis.",
    rules: [
      "The winner must reach 8 games to win the set.",
      "If the score reaches 8–8, a 7-point tiebreaker is played.",
      "Common in freshman and JV tennis, and varsity doubles during the regular season.",
      "No second set — the match is decided in one pro-set.",
      "Tiebreak rules are identical to those used at 6–6 in a regular set.",
    ],
  },
  {
    id: "tiebreak7",
    title: "7-Point Tiebreaker",
    icon: "🔥",
    color: "border-sky-400/20 bg-sky-400/[0.03]",
    badge: "text-sky-400",
    summary: "Used at 6–6 in a regular set (or 8–8 in a pro-set).",
    rules: [
      "First to 7 points wins, must win by 2.",
      "The player whose turn it is to serve starts the tiebreak (1 point from the right court).",
      "After the first point, players alternate serving in groups of 2.",
      "Players change ends after every 6 total points.",
      "If the score reaches 6–6, change ends and keep serving in sequence until one player leads by 2.",
      "The set is recorded as 7–6.",
      "After the tiebreak, the opponent of the tiebreak server serves first in the next set.",
    ],
  },
  {
    id: "super",
    title: "Super Tiebreaker (10-Point)",
    icon: "🏆",
    color: "border-red-400/20 bg-red-400/[0.03]",
    badge: "text-red-400",
    summary: "Played in lieu of a full third set. First to 10 points, win by 2.",
    rules: [
      "First to 10 points wins, must win by 2.",
      "Same serving rotation as a 7-point tiebreaker.",
      "Change ends when the total point score equals a multiple of 6 (e.g. 3–3, 0–6, 7–5, 6–6…).",
      "Doubles partners preserve their serving sequence throughout.",
      "After the super tiebreaker, the opposing team serves first in the next set.",
    ],
  },
];

const TIEBREAK_SERVING = {
  singles: [
    { pts: "1",    server: "A", court: "Right" },
    { pts: "2–3",  server: "B", court: "L → R" },
    { pts: "4–5",  server: "A", court: "L → R" },
    { pts: "6",    server: "B", court: "Left" },
    { pts: "—",    server: "",  court: "Change ends" },
    { pts: "7",    server: "B", court: "Right" },
    { pts: "8–9",  server: "A", court: "L → R" },
    { pts: "10–11",server: "B", court: "L → R" },
    { pts: "12",   server: "A", court: "Left" },
  ],
  doubles: [
    { pts: "1",    server: "A", court: "Right" },
    { pts: "2–3",  server: "C", court: "L → R" },
    { pts: "4–5",  server: "B", court: "L → R" },
    { pts: "6",    server: "D", court: "Left" },
    { pts: "—",    server: "",  court: "Change ends" },
    { pts: "7",    server: "D", court: "Right" },
    { pts: "8–9",  server: "A", court: "L → R" },
    { pts: "10–11",server: "C", court: "L → R" },
    { pts: "12",   server: "B", court: "Left" },
  ],
};

const SCORE_QUICK = [
  { situation: "Both at 40", call: "Deuce" },
  { situation: "Server wins point after Deuce", call: "Ad-In" },
  { situation: "Receiver wins point after Deuce", call: "Ad-Out" },
  { situation: "Ad player loses next point", call: "Back to Deuce" },
  { situation: "6–6 in regular set", call: "7-pt Tiebreak" },
  { situation: "8–8 in pro-set", call: "7-pt Tiebreak" },
  { situation: "Tied in sets (most formats)", call: "Super Tiebreak" },
];

// ─── Components ──────────────────────────────────────────────────────────────

function FormatCard({ f }: { f: typeof FORMATS[0] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`rounded-2xl border transition-all ${open ? f.color : "border-white/10 bg-white/[0.02]"}`}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3.5 text-left"
      >
        <div className="flex items-center gap-3">
          <span className="text-xl flex-shrink-0">{f.icon}</span>
          <div>
            <span className={`text-sm font-bold ${open ? f.badge : "text-white/90"}`}>{f.title}</span>
            {!open && <p className="text-xs text-white/30 mt-0.5">{f.summary}</p>}
          </div>
        </div>
        <svg
          className={`text-white/30 transition-transform flex-shrink-0 ml-2 ${open ? "rotate-90" : ""}`}
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
        >
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </button>
      {open && (
        <ul className="px-4 pb-4 space-y-2 border-t border-white/[0.06] pt-3">
          {f.rules.map((r, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-white/70">
              <span className={`mt-0.5 flex-shrink-0 font-black ${f.badge}`}>›</span>
              {r}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ScoringPlaybookPage() {
  const [tbView, setTbView] = useState<"singles" | "doubles">("singles");

  return (
    <main className="min-h-screen bg-[#0c0c0e] max-w-sm mx-auto pb-10">

      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0c0c0e]/90 backdrop-blur-xl border-b border-white/[0.06] px-5">
        <div className="flex items-center justify-between h-14">
          <Link href="/playbook" className="text-white/40 text-sm font-medium hover:text-white/80 transition-colors">← Playbook</Link>
          <span className="text-xs font-black tracking-[0.2em] uppercase text-white/30">Scoring</span>
          <div className="w-14" />
        </div>
      </div>

      <div className="px-5 py-5 space-y-7">

        {/* Quick reference */}
        <section className="space-y-3">
          <p className="text-xs font-black tracking-widest uppercase text-white/30">Quick Reference</p>
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] divide-y divide-white/[0.06] overflow-hidden">
            {SCORE_QUICK.map(s => (
              <div key={s.situation} className="flex items-center justify-between px-4 py-3">
                <p className="text-sm text-white/60">{s.situation}</p>
                <span className="text-sm font-black text-white/90 ml-2">{s.call}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Format cards */}
        <section className="space-y-3">
          <div>
            <p className="text-xs font-black tracking-widest uppercase text-white/30">Match Formats</p>
            <p className="text-xs text-white/20 mt-0.5">Tap to expand</p>
          </div>
          <div className="space-y-2">
            {FORMATS.map(f => <FormatCard key={f.id} f={f} />)}
          </div>
        </section>

        {/* Tiebreak serving order */}
        <section className="space-y-3">
          <p className="text-xs font-black tracking-widest uppercase text-white/30">Tiebreak Serving Order</p>
          {/* Toggle */}
          <div className="flex gap-2 p-1 rounded-2xl bg-white/[0.04] border border-white/10">
            {(["singles", "doubles"] as const).map(t => (
              <button key={t} onClick={() => setTbView(t)}
                className={`flex-1 py-2 rounded-xl text-sm font-bold capitalize transition-all ${tbView === t ? "bg-sky-400 text-black shadow" : "text-white/40 hover:text-white/70"}`}>
                {t}
              </button>
            ))}
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
            <div className="grid grid-cols-3 border-b border-white/[0.06]">
              <div className="px-3 py-2 text-[10px] font-black text-white/30 uppercase tracking-wider">Points</div>
              <div className="px-3 py-2 text-[10px] font-black text-white/30 uppercase tracking-wider">Server</div>
              <div className="px-3 py-2 text-[10px] font-black text-white/30 uppercase tracking-wider">Court</div>
            </div>
            {tieBreakRows(tbView).map((row, i) => (
              row.server === "" ? (
                <div key={i} className="col-span-3 px-3 py-1.5 bg-white/[0.04] border-y border-white/[0.06]">
                  <p className="text-[10px] font-black text-sky-400 uppercase tracking-widest text-center">↔ Change Ends</p>
                </div>
              ) : (
                <div key={i} className={`grid grid-cols-3 border-b border-white/[0.04] ${i % 2 === 0 ? "" : "bg-white/[0.01]"}`}>
                  <div className="px-3 py-2.5 text-sm font-bold text-white/70">{row.pts}</div>
                  <div className="px-3 py-2.5 text-sm font-black text-sky-400">{row.server}</div>
                  <div className="px-3 py-2.5 text-xs text-white/40">{row.court}</div>
                </div>
              )
            ))}
          </div>
          {tbView === "doubles" && (
            <p className="text-xs text-white/20 text-center px-2">Team (A & B) vs (C & D). Assumes D served game 12.</p>
          )}
        </section>

      </div>
    </main>
  );
}

function tieBreakRows(view: "singles" | "doubles") {
  return TIEBREAK_SERVING[view];
}
