"use client";
import { useState } from "react";
import Link from "next/link";

// ─── Data ────────────────────────────────────────────────────────────────────

const PILLARS = [
  {
    key: "tilt",
    label: "Tilt Control",
    icon: "😤",
    color: "border-red-400/20 bg-red-400/[0.04]",
    badge: "text-red-400",
    dot: "bg-red-400",
    summary: "Tilt is anger or frustration leaking into your game. It's the #1 performance killer.",
    points: [
      "Recognize your tilt triggers: bad calls, double faults, easy errors.",
      "Tilt compounds — one bad reaction leads to the next. Break the chain early.",
      "Never react to a missed shot for more than 3 seconds. Then reset.",
      "Use the walk between points to physically shake it off.",
      "High-tilt players win far fewer games after momentum swings — track yours.",
    ],
    cue: "After a bad point: exhale, look down at strings, walk to the baseline. Reset.",
  },
  {
    key: "focus",
    label: "Focus",
    icon: "🎯",
    color: "border-sky-400/20 bg-sky-400/[0.04]",
    badge: "text-sky-400",
    dot: "bg-sky-400",
    summary: "Focus is staying in the present point — not the last one, not the score.",
    points: [
      "The only thing you can control is the next ball. Play it.",
      "Have a pre-point ritual: bounce the ball, take a breath, pick a target.",
      "When your mind drifts to the score, refocus on your feet or breathing.",
      "Distracted play = reactive play. Focused play = intentional play.",
      "If you're thinking about winning, you've already lost the point.",
    ],
    cue: "Before each point: pick a target, commit to a pattern, then serve or return.",
  },
  {
    key: "energy",
    label: "Energy",
    icon: "⚡",
    color: "border-amber-400/20 bg-amber-400/[0.04]",
    badge: "text-amber-400",
    dot: "bg-amber-400",
    summary: "Energy management determines whether you can sustain quality in the third set.",
    points: [
      "Move between every point — standing still drains energy faster than moving.",
      "Use changeovers to eat, hydrate, and breathe. Not to worry.",
      "High-energy body language raises your actual performance level.",
      "When energy drops, shorten your swing — tighter, more controlled strokes.",
      "Fist pumps and positive calls after won points boost energy for both players.",
    ],
    cue: "On changeovers: sit, close your eyes for 30 seconds, breathe slowly. Arrive ready.",
  },
  {
    key: "confidence",
    label: "Confidence",
    icon: "💪",
    color: "border-lime-400/20 bg-lime-400/[0.04]",
    badge: "text-lime-400",
    dot: "bg-lime-400",
    summary: "Confidence is built in practice and protected in matches. It's fragile — protect it.",
    points: [
      "Play to your strengths first. Winning with your best shot builds confidence fast.",
      "Never change a winning strategy. Trust what's working.",
      "After an error, remind yourself of the shot you'll hit next — not the one you missed.",
      "Walk tall, move between points with purpose. Fake it until it's real.",
      "Confidence comes from preparation. Know your game plan before you walk on court.",
    ],
    cue: "When confidence wavers: go back to your most reliable shot and build from there.",
  },
];

const BETWEEN_POINT = [
  { step: "1", label: "React", detail: "Allow yourself one brief reaction — positive or neutral. Never dwell." },
  { step: "2", label: "Release", detail: "Turn away from the net. Exhale. Look at your strings or walk calmly." },
  { step: "3", label: "Reset", detail: "Bounce the ball, pick your serve target, commit to a pattern." },
  { step: "4", label: "Ready", detail: "Split step before the serve. Eyes locked. Trust the plan." },
];

const MOMENTUM = [
  {
    situation: "You're on a roll",
    action: "Shorten between-point time. Serve quickly. Don't let your opponent reset.",
    color: "border-lime-400/20 text-lime-400",
  },
  {
    situation: "Opponent is on a roll",
    action: "Slow everything down. Bounce the ball more. Take a full breath. Break their rhythm.",
    color: "border-red-400/20 text-red-400",
  },
  {
    situation: "Big point (break point, set point)",
    action: "Go to your highest-percentage shot. This is not the time to try something new.",
    color: "border-amber-400/20 text-amber-400",
  },
  {
    situation: "After a double fault",
    action: "Reset completely before the next point. One serve at a time. Pick a target, not a result.",
    color: "border-sky-400/20 text-sky-400",
  },
  {
    situation: "Down a set",
    action: "Wipe the slate. The second set is a new match. Go back to what's working.",
    color: "border-white/10 text-white/50",
  },
];

const LANGUAGE = [
  { bad: "Don't miss this", good: "Hit to the backhand corner" },
  { bad: "I'm going to double fault", good: "Spin it in to the body" },
  { bad: "I always choke on this point", good: "Play the ball, not the score" },
  { bad: "I can't beat this guy", good: "Focus on the next ball" },
  { bad: "I'm so bad at this", good: "I'm going to hit 3 in a row" },
];

const BODY_LANGUAGE = [
  { label: "Walk tall", detail: "Head up, shoulders back between every point — regardless of the score." },
  { label: "Pump your fist", detail: "After big points won. Controlled celebration builds momentum." },
  { label: "Slow your walk", detail: "When you want to slow the game down, walk slowly and deliberately." },
  { label: "Never drop your head", detail: "Slumped shoulders broadcast weakness to your opponent." },
  { label: "Stay still at baseline", detail: "Stillness before the serve signals control and focus." },
];

const PRE_MATCH = [
  { icon: "🎯", tip: "Arrive with a game plan. Know your first-strike patterns before you start." },
  { icon: "🧘", tip: "Warm up at match pace — not 50%. Your body needs to be ready from point one." },
  { icon: "📋", tip: "Set a process goal (e.g. 'first strike on every 2nd serve') not just 'win'." },
  { icon: "🚶", tip: "Use the walk-on time to breathe and get focused. Not to worry about the opponent." },
  { icon: "💤", tip: "Sleep and nutrition matter more than last-minute drilling. Arrive rested." },
];

const MISTAKES = [
  {
    mistake: "Changing a winning game plan",
    fix: "If it's working, keep doing it. The temptation to be clever costs more matches than anything.",
  },
  {
    mistake: "Going for too much on big points",
    fix: "Big points call for your best shot, not your riskiest. Consistency wins under pressure.",
  },
  {
    mistake: "Thinking about the score instead of the ball",
    fix: "The score is information. The ball is the job. Focus on the ball.",
  },
  {
    mistake: "Reacting visibly to bad calls or errors",
    fix: "Your reaction is your opponent's best weapon. Give them nothing.",
  },
  {
    mistake: "Playing not to lose instead of playing to win",
    fix: "Defensive tennis feels safe but produces errors. Commit to every shot.",
  },
];

// ─── Components ──────────────────────────────────────────────────────────────

function PillarCard({ p }: { p: typeof PILLARS[0] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`rounded-2xl border transition-all ${open ? p.color : "border-white/10 bg-white/[0.02]"}`}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3.5 text-left"
      >
        <div className="flex items-center gap-3">
          <span className="text-xl flex-shrink-0">{p.icon}</span>
          <span className={`text-sm font-bold ${open ? p.badge : "text-white/90"}`}>{p.label}</span>
        </div>
        <svg
          className={`text-white/30 transition-transform flex-shrink-0 ml-2 ${open ? "rotate-90" : ""}`}
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
        >
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-white/[0.06] pt-3">
          <p className="text-sm text-white/60 italic">{p.summary}</p>
          <ul className="space-y-1.5">
            {p.points.map((pt, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-white/70">
                <span className={`mt-0.5 flex-shrink-0 ${p.badge}`}>›</span>
                {pt}
              </li>
            ))}
          </ul>
          <div className={`rounded-xl border p-3 mt-1 ${p.color}`}>
            <p className={`text-xs font-black uppercase tracking-wider ${p.badge} mb-1`}>Reset Cue</p>
            <p className="text-sm text-white/70">{p.cue}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MentalPlaybookPage() {
  return (
    <main className="min-h-screen bg-[#0c0c0e] max-w-sm mx-auto pb-10">

      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0c0c0e]/90 backdrop-blur-xl border-b border-white/[0.06] px-5">
        <div className="flex items-center justify-between h-14">
          <Link href="/playbook" className="text-white/40 text-sm font-medium hover:text-white/80 transition-colors">← Playbook</Link>
          <span className="text-xs font-black tracking-[0.2em] uppercase text-white/30">Mental</span>
          <div className="w-14" />
        </div>
      </div>

      <div className="px-5 py-5 space-y-7">

        {/* Hero */}
        <section className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.04] p-4 text-center space-y-1">
          <p className="text-3xl font-black text-amber-400">The Mental Game</p>
          <p className="text-sm text-white/50">Technical skill gets you on court. Mental skill wins matches.</p>
        </section>

        {/* 4 Pillars */}
        <section className="space-y-3">
          <div>
            <p className="text-xs font-black tracking-widest uppercase text-white/30">4 Mental Pillars</p>
            <p className="text-xs text-white/20 mt-0.5">The same metrics tracked in your match reflections</p>
          </div>
          <div className="space-y-2">
            {PILLARS.map(p => <PillarCard key={p.key} p={p} />)}
          </div>
        </section>

        {/* Between-Point Routine */}
        <section className="space-y-3">
          <p className="text-xs font-black tracking-widest uppercase text-white/30">Between-Point Routine</p>
          <p className="text-xs text-white/20">Do this after every single point — win or lose</p>
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden divide-y divide-white/[0.06]">
            {BETWEEN_POINT.map(b => (
              <div key={b.step} className="flex items-start gap-4 px-4 py-3.5">
                <span className="text-lg font-black text-amber-400 flex-shrink-0 w-5">{b.step}</span>
                <div>
                  <p className="text-sm font-bold text-white/80">{b.label}</p>
                  <p className="text-xs text-white/40 mt-0.5">{b.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Momentum Management */}
        <section className="space-y-3">
          <p className="text-xs font-black tracking-widest uppercase text-white/30">Momentum Management</p>
          <div className="space-y-2">
            {MOMENTUM.map(m => (
              <div key={m.situation} className={`rounded-2xl border p-4 space-y-1.5 ${m.color} bg-white/[0.02]`}>
                <p className={`text-xs font-black uppercase tracking-wider ${m.color.split(" ")[1]}`}>{m.situation}</p>
                <p className="text-sm text-white/65">{m.action}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Language Protocol */}
        <section className="space-y-3">
          <p className="text-xs font-black tracking-widest uppercase text-white/30">Self-Talk Protocol</p>
          <p className="text-xs text-white/20">Replace negative self-talk in real time</p>
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden divide-y divide-white/[0.06]">
            {LANGUAGE.map((l, i) => (
              <div key={i} className="px-4 py-3 space-y-1">
                <p className="text-xs text-red-400/70 line-through">{l.bad}</p>
                <p className="text-sm text-lime-400 font-medium">→ {l.good}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Body Language */}
        <section className="space-y-3">
          <p className="text-xs font-black tracking-widest uppercase text-white/30">Body Language</p>
          <p className="text-xs text-white/20">Your body broadcasts your mental state — to yourself and your opponent</p>
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] divide-y divide-white/[0.06] overflow-hidden">
            {BODY_LANGUAGE.map(b => (
              <div key={b.label} className="px-4 py-3 space-y-0.5">
                <p className="text-sm font-bold text-white/80">{b.label}</p>
                <p className="text-xs text-white/40">{b.detail}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Pre-Match Prep */}
        <section className="space-y-3">
          <p className="text-xs font-black tracking-widest uppercase text-white/30">Pre-Match Prep</p>
          <div className="space-y-2">
            {PRE_MATCH.map((p, i) => (
              <div key={i} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3">
                <span className="text-lg flex-shrink-0">{p.icon}</span>
                <p className="text-sm text-white/65">{p.tip}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Common Mental Mistakes */}
        <section className="space-y-3">
          <p className="text-xs font-black tracking-widest uppercase text-white/30">Common Mental Mistakes</p>
          <div className="space-y-2">
            {MISTAKES.map((m, i) => (
              <div key={i} className="rounded-2xl border border-red-500/15 bg-red-500/[0.03] p-4 space-y-1.5">
                <p className="text-sm font-bold text-red-400/90">⚠ {m.mistake}</p>
                <p className="text-sm text-white/60">{m.fix}</p>
              </div>
            ))}
          </div>
        </section>

      </div>
    </main>
  );
}
