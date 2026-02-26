"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Match } from "@/types";
import { supabase } from "@/lib/supabase";
import BottomNav from "@/components/BottomNav";
import { computeAchievements, Achievement } from "@/lib/achievements";

function AchievementCard({ a }: { a: Achievement }) {
  return (
    <div className={`rounded-2xl border p-4 space-y-3 transition-all ${
      a.unlocked
        ? "border-lime-400/25 bg-lime-400/[0.04]"
        : "border-white/10 bg-white/[0.02] opacity-60"
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className={`text-2xl ${a.unlocked ? "" : "grayscale opacity-50"}`}>{a.icon}</span>
          <div>
            <p className={`text-sm font-black ${a.unlocked ? "text-white" : "text-white/50"}`}>{a.title}</p>
            <p className="text-xs text-white/30 mt-0.5 leading-snug">{a.description}</p>
          </div>
        </div>
        {a.unlocked && (
          <span className="shrink-0 text-[10px] font-black text-lime-400 bg-lime-400/10 px-2 py-0.5 rounded-full uppercase tracking-wide">
            Unlocked
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-white/30">{a.progressText}</span>
          {a.unlockedAt && (
            <span className="text-[10px] text-white/20">
              {new Date(a.unlockedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </span>
          )}
        </div>
        <div className="h-1.5 rounded-full bg-white/[0.07] overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${a.unlocked ? "bg-lime-400" : "bg-white/20"}`}
            style={{ width: `${a.progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}

const CATEGORY_LABELS: Record<string, { label: string; icon: string }> = {
  performance: { label: "Performance", icon: "🏆" },
  mental:      { label: "Mental Game", icon: "🧠" },
  consistency: { label: "Consistency", icon: "📋" },
};

export default function AchievementsPage() {
  const router = useRouter();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/auth"); return; }
      const { data } = await supabase
        .from("matches")
        .select("id, created_at, data")
        .order("created_at", { ascending: false });
      if (data) {
        setMatches(data.map(row => ({
          ...(row.data as Omit<Match, "id" | "createdAt">),
          id: row.id, createdAt: row.created_at,
        })));
      }
      setLoading(false);
    }
    load();
  }, [router]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0c0c0e] flex items-center justify-center">
        <p className="text-white/30 text-sm">Loading…</p>
      </main>
    );
  }

  const achievements = computeAchievements(matches);
  const unlocked = achievements.filter(a => a.unlocked).length;

  // Group by category
  const groups: Record<string, Achievement[]> = {};
  for (const a of achievements) {
    if (!groups[a.category]) groups[a.category] = [];
    groups[a.category].push(a);
  }

  return (
    <main className="min-h-screen bg-[#0c0c0e] max-w-sm mx-auto pb-24">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-2 mb-3">
          <Link href="/player-profile" className="text-white/30 hover:text-white/60 transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </Link>
          <p className="text-white/30 text-xs font-bold tracking-widest uppercase">Achievements</p>
        </div>
        <h1 className="text-2xl font-black text-white">Badges & Progress</h1>
        <div className="flex items-center gap-2 mt-1">
          <p className="text-white/40 text-sm">{unlocked} / {achievements.length} unlocked</p>
          {unlocked > 0 && (
            <div className="flex-1 h-1.5 rounded-full bg-white/[0.07] overflow-hidden">
              <div
                className="h-full rounded-full bg-lime-400 transition-all"
                style={{ width: `${Math.round((unlocked / achievements.length) * 100)}%` }}
              />
            </div>
          )}
        </div>
      </div>

      <div className="px-5 py-5 space-y-7">
        {(["performance", "mental", "consistency"] as const).map(cat => {
          const group = groups[cat] ?? [];
          const { label, icon } = CATEGORY_LABELS[cat];
          return (
            <section key={cat} className="space-y-3">
              <p className="text-xs font-black tracking-widest uppercase text-white/30">
                {icon} {label}
              </p>
              <div className="space-y-2">
                {group.map(a => <AchievementCard key={a.id} a={a} />)}
              </div>
            </section>
          );
        })}
      </div>

      <BottomNav active="profile" />
    </main>
  );
}
