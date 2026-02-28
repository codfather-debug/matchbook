"use client";
import { useState } from "react";
import Link from "next/link";

const PHASES = [
  {
    time: "0:00",
    duration: "2 min",
    label: "Mini Tennis",
    emoji: "🎾",
    color: "border-lime-400/30 bg-lime-400/[0.06]",
    accent: "text-lime-400",
    tips: [
      "Stand at the service box, hit soft volleys and drops",
      "Focus on touch and feel — easy, loose swings",
      "Get eyes tracking the ball, hands warming up",
    ],
  },
  {
    time: "2:00",
    duration: "2 min",
    label: "Baseline Rallies",
    emoji: "↔️",
    color: "border-sky-400/30 bg-sky-400/[0.06]",
    accent: "text-sky-400",
    tips: [
      "Move to the baseline, hit forehands and backhands",
      "Keep it in — medium pace, deep cross-court",
      "Find your rhythm before increasing pace",
    ],
  },
  {
    time: "4:00",
    duration: "1:30 min",
    label: "Net Play",
    emoji: "🥅",
    color: "border-purple-400/30 bg-purple-400/[0.06]",
    accent: "text-purple-400",
    tips: [
      "Hit volleys from midcourt — forehand and backhand",
      "Work 2–3 overheads from each side",
      "Focus on short, firm volleys — no big swings",
    ],
  },
  {
    time: "5:30",
    duration: "2 min",
    label: "Serves",
    emoji: "💥",
    color: "border-amber-400/30 bg-amber-400/[0.06]",
    accent: "text-amber-400",
    tips: [
      "Start with easy serves — pace up gradually",
      "Hit both 1st and 2nd serve patterns",
      "Pick your serve for the first game now",
    ],
  },
  {
    time: "7:30",
    duration: "2:30 min",
    label: "Returns & Mental Prep",
    emoji: "🧠",
    color: "border-red-400/30 bg-red-400/[0.06]",
    accent: "text-red-400",
    tips: [
      "Return a few serves — get eyes on ball speed",
      "Set your focus word for the match",
      "Visualize winning the first 2 games",
    ],
  },
];

const DYNAMIC_STRETCHES = [
  { move: "Leg Swings", sets: "10 each leg", note: "Forward/back + side-to-side. Loosen hip flexors." },
  { move: "Arm Circles", sets: "10 each dir", note: "Small to large. Shoulder prep for serves." },
  { move: "High Knees", sets: "20 steps", note: "Get blood moving. Activates glutes and calves." },
  { move: "Lateral Shuffle", sets: "4 court widths", note: "Quick steps, stay low. Tennis-specific movement." },
  { move: "Wrist Rolls", sets: "10 each dir", note: "Forearm and wrist warm-up for groundstrokes." },
  { move: "Torso Rotations", sets: "10 each side", note: "Mimic swing motion. Core and back activation." },
];

const MENTAL_CHECKLIST = [
  "I know my 1st serve direction for game 1",
  "I know my return target (cross-court deep)",
  "I have a focus word for this match",
  "I've identified their biggest weapon to neutralize",
  "I'm ready to compete for the first point",
];

export default function WarmupPlaybookPage() {
  const [checked, setChecked] = useState<Record<number, boolean>>({});

  function toggle(i: number) {
    setChecked(prev => ({ ...prev, [i]: !prev[i] }));
  }

  const allChecked = MENTAL_CHECKLIST.every((_, i) => checked[i]);

  return (
    <main className="min-h-screen bg-[#1e1e2a] max-w-sm mx-auto pb-10">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#1e1e2a]/90 backdrop-blur-xl border-b border-white/[0.06] px-5">
        <div className="flex items-center justify-between h-14">
          <Link href="/playbook" className="text-white/40 text-sm font-medium hover:text-white/80 transition-colors">
            ← Back
          </Link>
          <span className="text-xs font-bold tracking-[0.2em] uppercase text-white/30">Playbook</span>
          <div className="w-12" />
        </div>
      </div>

      <div className="px-5 pt-6 pb-10 space-y-6">
        {/* Hero */}
        <div className="rounded-3xl border border-lime-400/20 bg-gradient-to-br from-lime-400/15 to-lime-400/5 p-6">
          <p className="text-xs font-black tracking-widest uppercase text-lime-400 mb-1">Warm-Up Routine</p>
          <h1 className="text-2xl font-black text-white">10-Minute Protocol</h1>
          <p className="text-sm text-white/50 mt-2 leading-relaxed">
            A consistent pre-match warm-up reduces injury risk, sharpens touch, and sets your mental tone before the first point.
          </p>
          <div className="mt-4 flex items-center gap-2 text-xs text-white/30">
            <span className="w-2 h-2 rounded-full bg-lime-400 inline-block"></span>
            Start 10–15 minutes before your match
          </div>
        </div>

        {/* Before Court — Dynamic Movement */}
        <section className="space-y-3">
          <p className="text-xs font-black tracking-widest uppercase text-white/30">Before You Hit — Dynamic Movement</p>
          <p className="text-xs text-white/30">Do these 5 minutes before going on court.</p>
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] divide-y divide-white/[0.06]">
            {DYNAMIC_STRETCHES.map(s => (
              <div key={s.move} className="px-4 py-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-white">{s.move}</p>
                  <span className="text-xs text-white/30 bg-white/[0.06] px-2 py-0.5 rounded-full">{s.sets}</span>
                </div>
                <p className="text-xs text-white/40 mt-0.5">{s.note}</p>
              </div>
            ))}
          </div>
        </section>

        {/* On-Court Protocol */}
        <section className="space-y-3">
          <p className="text-xs font-black tracking-widest uppercase text-white/30">On-Court Protocol</p>
          <div className="space-y-2">
            {PHASES.map((phase, i) => (
              <div key={phase.label} className={`rounded-2xl border p-4 ${phase.color}`}>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-12 text-center">
                    <p className={`text-xs font-black ${phase.accent}`}>{phase.time}</p>
                    <p className="text-[10px] text-white/25">{phase.duration}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{phase.emoji}</span>
                    <p className="text-sm font-black text-white">{phase.label}</p>
                  </div>
                </div>
                <ul className="space-y-1 pl-14">
                  {phase.tips.map(t => (
                    <li key={t} className="flex gap-2 text-xs text-white/60">
                      <span className={`${phase.accent} flex-shrink-0`}>·</span>
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Mental Readiness Checklist */}
        <section className="space-y-3">
          <p className="text-xs font-black tracking-widest uppercase text-white/30">Mental Readiness Checklist</p>
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] divide-y divide-white/[0.06]">
            {MENTAL_CHECKLIST.map((item, i) => (
              <button
                key={i}
                onClick={() => toggle(i)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left transition-all"
              >
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                  checked[i] ? "border-lime-400 bg-lime-400" : "border-white/20"
                }`}>
                  {checked[i] && (
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <polyline points="1.5,5 4,7.5 8.5,2" stroke="black" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                <p className={`text-sm transition-all ${checked[i] ? "text-white/40 line-through" : "text-white/80"}`}>{item}</p>
              </button>
            ))}
          </div>
          {allChecked && (
            <div className="rounded-2xl border border-lime-400/30 bg-lime-400/[0.06] px-4 py-3 text-center">
              <p className="text-sm font-black text-lime-400">You're ready. Go compete.</p>
            </div>
          )}
        </section>

        {/* The Code Note */}
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
          <p className="text-xs font-black text-white/20 uppercase tracking-widest mb-1">Note — The Code</p>
          <p className="text-xs text-white/30 leading-relaxed">
            Per USTA regulations, each player is entitled to a warm-up of up to 5 minutes on court (or as mutually agreed). Use this time purposefully — it's part of the match.
          </p>
        </div>
      </div>
    </main>
  );
}
