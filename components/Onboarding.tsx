"use client";
import { useState } from "react";

const SLIDES = [
  {
    emoji: "🎾",
    title: "Welcome to Matchbook",
    body: "Your personal tennis match logger, scouting tool, and performance tracker. Built for competitive players who want to improve with data.",
    accent: "text-lime-400",
    border: "border-lime-400/20",
    bg: "from-lime-400/15 to-lime-400/5",
  },
  {
    emoji: "💭",
    title: "Reflect After Every Match",
    body: "Log Energy (1–10), Focus (1–10), and Emotional Control (1–10) after each match. These feed into your Mental Score — the engine behind your insights.",
    accent: "text-blue-400",
    border: "border-blue-400/20",
    bg: "from-blue-400/15 to-blue-400/5",
    detail: "7–10 = 🟢 Strong  ·  4–6 = 🟡 OK  ·  1–3 = 🔴 Struggled",
  },
  {
    emoji: "📖",
    title: "Use the Playbooks",
    body: "Browse tactics for Singles, Doubles, Mental game, Return play, and more. Link directly from your pre-match game plan to stay sharp before you step on court.",
    accent: "text-amber-400",
    border: "border-amber-400/20",
    bg: "from-amber-400/15 to-amber-400/5",
  },
  {
    emoji: "📊",
    title: "Unlock Insights Over Time",
    body: "Log 5+ matches to unlock Analytics — surface win rates, execution trends, opponent style breakdowns, and personalised recommendations.",
    accent: "text-purple-400",
    border: "border-purple-400/20",
    bg: "from-purple-400/15 to-purple-400/5",
    detail: "Log your first match to start.",
  },
];

interface OnboardingProps {
  onDismiss: () => void;
}

export default function Onboarding({ onDismiss }: OnboardingProps) {
  const [slide, setSlide] = useState(0);
  const current = SLIDES[slide];
  const isLast = slide === SLIDES.length - 1;

  function next() {
    if (isLast) {
      onDismiss();
    } else {
      setSlide(s => s + 1);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-[#0c0c0e]/95 backdrop-blur-xl flex flex-col items-center justify-center px-6">
      {/* Skip */}
      <button
        onClick={onDismiss}
        className="absolute top-5 right-5 text-white/30 text-xs font-semibold hover:text-white/60 transition-colors"
      >
        Skip
      </button>

      {/* Card */}
      <div className={`w-full max-w-xs rounded-3xl border bg-gradient-to-br p-7 space-y-4 ${current.border} ${current.bg}`}>
        <div className="text-5xl text-center">{current.emoji}</div>
        <h2 className={`text-xl font-black text-center ${current.accent}`}>{current.title}</h2>
        <p className="text-sm text-white/70 leading-relaxed text-center">{current.body}</p>
        {current.detail && (
          <p className="text-xs text-white/40 text-center">{current.detail}</p>
        )}
      </div>

      {/* Dots */}
      <div className="flex gap-1.5 mt-6">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => setSlide(i)}
            className={`h-1.5 rounded-full transition-all ${i === slide ? "w-6 bg-white" : "w-1.5 bg-white/20"}`}
          />
        ))}
      </div>

      {/* CTA */}
      <button
        onClick={next}
        className="mt-6 bg-lime-400 text-black px-8 py-3.5 rounded-2xl text-sm font-black hover:bg-lime-300 transition-all active:scale-95"
      >
        {isLast ? "Get Started" : "Next →"}
      </button>
    </div>
  );
}
