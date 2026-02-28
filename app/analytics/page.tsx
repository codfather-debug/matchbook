"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Match } from "@/types";
import { supabase } from "@/lib/supabase";
import BottomNav from "@/components/BottomNav";
import {
  getWinRate, getRecord, getSurfaceWinRates, getStyleWinRates,
  getMentalAverage, getExecutionAverage,
  getWinRateSeries, getMentalSeries, getExecutionSeries,
  generateInsights, ChartPoint,
} from "@/lib/analytics";

// ── Inline SVG line chart ──────────────────────────────────────────────────────
function LineChart({
  data, color, min = 0, max = 100, height = 80,
}: {
  data: ChartPoint[]; color: string; min?: number; max?: number; height?: number;
}) {
  if (data.length < 2) {
    return (
      <div className="h-20 flex items-center justify-center">
        <p className="text-gray-300 text-xs">Need more data to show trend</p>
      </div>
    );
  }
  const W = 300;
  const H = height;
  const PAD = 4;
  const range = max - min || 1;
  const pts = data.map((d, i) => {
    const x = PAD + (i / (data.length - 1)) * (W - PAD * 2);
    const y = H - PAD - ((d.value - min) / range) * (H - PAD * 2);
    return { x, y, ...d };
  });
  const polyline = pts.map(p => `${p.x},${p.y}`).join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none">
      {/* Subtle grid lines */}
      {[0, 0.5, 1].map(t => {
        const y = PAD + t * (H - PAD * 2);
        return <line key={t} x1={PAD} x2={W - PAD} y1={y} y2={y} stroke="white" strokeOpacity={0.05} strokeWidth={1} />;
      })}
      {/* Area fill */}
      <defs>
        <linearGradient id={`grad-${color.replace(/[^a-z]/gi, "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.25} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon
        points={`${pts[0].x},${H} ${polyline} ${pts[pts.length - 1].x},${H}`}
        fill={`url(#grad-${color.replace(/[^a-z]/gi, "")})`}
      />
      {/* Line */}
      <polyline points={polyline} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {/* Dots */}
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3} fill={color} />
      ))}
    </svg>
  );
}

type Filter = "5" | "10" | "all";

const SURFACES = ["hard", "clay", "grass"] as const;
const SURF_EMOJI: Record<string, string> = { hard: "🟦", clay: "🟫", grass: "🟩" };

export default function AnalyticsPage() {
  const router = useRouter();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");

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
      <main className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-gray-400 text-sm">Loading…</p>
      </main>
    );
  }

  const filtered = filter === "5" ? matches.slice(0, 5)
                 : filter === "10" ? matches.slice(0, 10)
                 : matches;

  const record   = getRecord(filtered);
  const winRate  = getWinRate(filtered);
  const mentalAvg  = getMentalAverage(filtered);
  const execAvg    = getExecutionAverage(filtered);
  const surfRates  = getSurfaceWinRates(filtered);
  const styleRates = getStyleWinRates(filtered);
  const insights   = generateInsights(filtered);

  // Chart series always use all matches (shows full trend), sliced to filter window
  const winSeries    = getWinRateSeries(filtered);
  const mentalSeries = getMentalSeries(filtered);
  const execSeries   = getExecutionSeries(filtered);

  return (
    <main className="min-h-screen bg-white max-w-sm mx-auto pb-24">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-gray-200">
        <p className="text-gray-400 text-xs font-bold tracking-widest uppercase mb-0.5">Matchbook</p>
        <h1 className="text-2xl font-black text-gray-900">Analytics</h1>
        <p className="text-gray-400 text-sm mt-0.5">{matches.length} matches logged</p>
      </div>

      <div className="px-5 py-5 space-y-6">

        {matches.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-8 text-center space-y-2">
            <p className="text-4xl">📊</p>
            <p className="text-gray-900 font-bold">No data yet</p>
            <p className="text-gray-500 text-sm">Log matches to unlock analytics.</p>
          </div>
        ) : (
          <>
            {/* Filter tabs */}
            <div className="flex gap-2">
              {(["5", "10", "all"] as Filter[]).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                    filter === f
                      ? "bg-lime-400 text-black"
                      : "bg-gray-100 text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {f === "all" ? "All" : `Last ${f}`}
                </button>
              ))}
            </div>

            {/* Summary row */}
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-2xl bg-gray-50 border border-gray-200 p-3 text-center">
                <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Record</p>
                <p className="text-xl font-black text-gray-900 mt-0.5">{record.wins}–{record.losses}</p>
              </div>
              <div className="rounded-2xl bg-gray-50 border border-gray-200 p-3 text-center">
                <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Win %</p>
                <p className={`text-xl font-black mt-0.5 ${winRate >= 60 ? "text-lime-700" : winRate >= 40 ? "text-amber-400" : "text-red-600"}`}>{winRate}%</p>
              </div>
              <div className="rounded-2xl bg-gray-50 border border-gray-200 p-3 text-center">
                <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Mental</p>
                <p className={`text-xl font-black mt-0.5 ${mentalAvg === null ? "text-gray-300" : mentalAvg >= 7 ? "text-lime-700" : mentalAvg >= 5 ? "text-amber-400" : "text-red-600"}`}>
                  {mentalAvg !== null ? mentalAvg : "—"}
                </p>
              </div>
            </div>

            {/* Win Rate Chart */}
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-black tracking-widest uppercase text-gray-400">Win Rate Trend</p>
                {winSeries.length > 0 && (
                  <p className="text-xs text-gray-400">{winRate}% current</p>
                )}
              </div>
              <div className="rounded-2xl bg-gray-50 border border-gray-200 p-3">
                <LineChart data={winSeries} color="#a3e635" min={0} max={100} />
                {winSeries.length >= 2 && (
                  <div className="flex justify-between mt-1 px-1">
                    <span className="text-[10px] text-gray-300">{winSeries[0].label}</span>
                    <span className="text-[10px] text-gray-300">{winSeries[winSeries.length - 1].label}</span>
                  </div>
                )}
              </div>
            </section>

            {/* Mental Score Chart */}
            {mentalSeries.length >= 2 && (
              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-black tracking-widest uppercase text-gray-400">Mental Score</p>
                  {mentalAvg !== null && <p className="text-xs text-gray-400">{mentalAvg}/10 avg</p>}
                </div>
                <div className="rounded-2xl bg-gray-50 border border-gray-200 p-3">
                  <LineChart data={mentalSeries} color="#60a5fa" min={1} max={10} />
                  <div className="flex justify-between mt-1 px-1">
                    <span className="text-[10px] text-gray-300">{mentalSeries[0].label}</span>
                    <span className="text-[10px] text-gray-300">{mentalSeries[mentalSeries.length - 1].label}</span>
                  </div>
                </div>
              </section>
            )}

            {/* Execution Score Chart */}
            {execSeries.length >= 2 && (
              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-black tracking-widest uppercase text-gray-400">Execution Score</p>
                  {execAvg !== null && <p className="text-xs text-gray-400">{execAvg}/10 avg</p>}
                </div>
                <div className="rounded-2xl bg-gray-50 border border-gray-200 p-3">
                  <LineChart data={execSeries} color="#f59e0b" min={1} max={10} />
                  <div className="flex justify-between mt-1 px-1">
                    <span className="text-[10px] text-gray-300">{execSeries[0].label}</span>
                    <span className="text-[10px] text-gray-300">{execSeries[execSeries.length - 1].label}</span>
                  </div>
                </div>
              </section>
            )}

            {/* Surface Breakdown */}
            <section className="space-y-2">
              <p className="text-xs font-black tracking-widest uppercase text-gray-400">Surface Breakdown</p>
              <div className="rounded-2xl border border-gray-200 bg-gray-50 divide-y divide-white/[0.06]">
                {SURFACES.map(surf => {
                  const d = surfRates[surf];
                  if (!d) {
                    return (
                      <div key={surf} className="flex items-center justify-between px-4 py-3 opacity-40">
                        <div className="flex items-center gap-2">
                          <span>{SURF_EMOJI[surf]}</span>
                          <span className="text-sm text-gray-500 capitalize">{surf}</span>
                        </div>
                        <span className="text-xs text-gray-300">No matches</span>
                      </div>
                    );
                  }
                  return (
                    <div key={surf} className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span>{SURF_EMOJI[surf]}</span>
                        <span className="text-sm font-semibold text-gray-700 capitalize">{surf}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-400">{d.wins}W – {d.total - d.wins}L</span>
                        <span className={`text-sm font-black ${d.rate >= 60 ? "text-lime-700" : d.rate >= 40 ? "text-amber-400" : "text-red-600"}`}>
                          {d.rate}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Opponent Style Breakdown */}
            {Object.keys(styleRates).length > 0 && (
              <section className="space-y-2">
                <p className="text-xs font-black tracking-widest uppercase text-gray-400">By Opponent Style</p>
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 space-y-3">
                  {(Object.entries(styleRates) as [string, { wins: number; total: number; rate: number }][])
                    .sort((a, b) => b[1].rate - a[1].rate)
                    .map(([style, d]) => (
                      <div key={style}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-gray-600 capitalize">{style.replace("-", " ")}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400">{d.wins}W – {d.total - d.wins}L</span>
                            <span className={`text-xs font-black ${d.rate >= 60 ? "text-lime-700" : d.rate >= 40 ? "text-amber-400" : "text-red-600"}`}>{d.rate}%</span>
                          </div>
                        </div>
                        <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${d.rate >= 60 ? "bg-lime-400" : d.rate >= 40 ? "bg-amber-400" : "bg-red-400"}`}
                            style={{ width: `${d.rate}%` }}
                          />
                        </div>
                      </div>
                    ))}
                </div>
              </section>
            )}

            {/* Insights */}
            {insights.length > 0 && (
              <section className="space-y-2">
                <p className="text-xs font-black tracking-widest uppercase text-gray-400">Insights</p>
                <div className="space-y-2">
                  {insights.map((ins, i) => (
                    <div
                      key={i}
                      className={`rounded-2xl border p-4 ${
                        ins.type === "strength"
                          ? "border-lime-400/20 bg-lime-400/[0.04]"
                          : "border-red-500/20 bg-red-500/[0.04]"
                      }`}
                    >
                      <p className={`text-xs font-black uppercase tracking-widest mb-1 ${ins.type === "strength" ? "text-lime-700" : "text-red-600"}`}>
                        {ins.type === "strength" ? "💪 Strength" : "⚠️ Watch Out"}
                      </p>
                      <p className="text-sm text-gray-800 leading-relaxed">{ins.text}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

          </>
        )}

      </div>

      <BottomNav active="profile" />
    </main>
  );
}
