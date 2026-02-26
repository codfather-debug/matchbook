"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Match, PlayStyle } from "@/types";
import { supabase } from "@/lib/supabase";
import { PLAY_STYLES, STYLE_TIPS, scoreLabel } from "@/components/MatchEntry";
import { generateMatchSummary } from "@/lib/analytics";

const SURFACE_LABEL: Record<string, string> = {
  hard: "Hard Court",
  clay: "Clay Court",
  grass: "Grass Court",
};
const SURFACE_EMOJI: Record<string, string> = {
  hard: "🟦",
  clay: "🟫",
  grass: "🟩",
};

// ─── Scouting Section ─────────────────────────────────────────────────────────

function ScoutingSection({
  label,
  weapon,
  hole,
  keyToWin,
  styles,
  handedness,
}: {
  label?: string;
  weapon?: string;
  hole?: string;
  keyToWin?: string;
  styles: PlayStyle[];
  handedness?: "right" | "left";
}) {
  const hasContent = weapon || hole || keyToWin || styles.length > 0 || handedness;
  if (!hasContent) return null;

  return (
    <section className="space-y-3">
      {label && (
        <div className="flex items-center gap-2">
          <p className="text-xs font-black tracking-widest uppercase text-white/30">{label}</p>
          {handedness && (
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${handedness === "right" ? "bg-blue-400/15 text-blue-300" : "bg-orange-400/15 text-orange-300"}`}>
              {handedness === "right" ? "Righty" : "Lefty"}
            </span>
          )}
        </div>
      )}
      {!label && handedness && (
        <span className={`inline-block text-[10px] font-black px-2 py-0.5 rounded-full ${handedness === "right" ? "bg-blue-400/15 text-blue-300" : "bg-orange-400/15 text-orange-300"}`}>
          {handedness === "right" ? "Righty" : "Lefty"}
        </span>
      )}

      {weapon && (
        <div className="flex gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/10">
          <span className="text-lg">⚡</span>
          <div>
            <p className="text-xs font-bold text-white/30 mb-0.5">Weapon</p>
            <p className="text-sm text-white font-semibold">{weapon}</p>
          </div>
        </div>
      )}

      {hole && (
        <div className="flex gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/10">
          <span className="text-lg">🎯</span>
          <div>
            <p className="text-xs font-bold text-white/30 mb-0.5">Hole</p>
            <p className="text-sm text-white font-semibold">{hole}</p>
          </div>
        </div>
      )}

      {keyToWin && (
        <div className="flex gap-3 p-3 rounded-2xl bg-lime-400/[0.06] border border-lime-400/20">
          <span className="text-lg">🔑</span>
          <div>
            <p className="text-xs font-bold text-lime-400/50 mb-0.5">Key to Win</p>
            <p className="text-sm text-lime-300 font-medium leading-relaxed">{keyToWin}</p>
          </div>
        </div>
      )}

      {styles.length > 0 && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {styles.map((s) => (
              <span
                key={s}
                className="px-3 py-1 rounded-full bg-white/5 border border-white/15 text-white/60 text-xs font-semibold"
              >
                {PLAY_STYLES.find((p) => p.value === s)?.label}
              </span>
            ))}
          </div>
          <div className="space-y-2">
            {styles.map((s) => {
              const ps = PLAY_STYLES.find((p) => p.value === s)!;
              return (
                <div key={s} className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3">
                  <p className="text-xs font-black text-white/30 uppercase tracking-widest mb-1">
                    vs {ps.label}
                  </p>
                  <p className="text-sm text-white/70">{STYLE_TIPS[s]}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MatchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [match, setMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function handleDelete() {
    await supabase.from("matches").delete().eq("id", id);
    router.push("/");
  }

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/auth"); return; }

      const { data } = await supabase
        .from("matches")
        .select("id, created_at, data")
        .eq("id", id)
        .single();

      if (data) {
        setMatch({
          ...(data.data as Omit<Match, "id" | "createdAt">),
          id: data.id,
          createdAt: data.created_at,
        });
      }
      setLoading(false);
    }
    load();
  }, [id, router]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0c0c0e] flex items-center justify-center">
        <p className="text-white/30 text-sm">Loading…</p>
      </main>
    );
  }

  if (!match) {
    return (
      <main className="min-h-screen bg-[#0c0c0e] flex flex-col items-center justify-center gap-4">
        <p className="text-white/50">Match not found.</p>
        <Link href="/" className="text-lime-400 text-sm font-semibold">← Back to feed</Link>
      </main>
    );
  }

  const win       = match.result === "win";
  const isDoubles = match.matchType === "doubles";
  const date      = new Date(match.createdAt).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });

  const playedSets = match.score.sets.filter(
    (s) => s.player !== null && s.opponent !== null
  );

  return (
    <main className="min-h-screen bg-[#0c0c0e] max-w-sm mx-auto pb-10">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0c0c0e]/90 backdrop-blur-xl border-b border-white/[0.06] px-5">
        <div className="flex items-center justify-between h-14">
          <Link
            href="/"
            className="text-white/40 text-sm font-medium hover:text-white/80 transition-colors"
          >
            ← Back
          </Link>
          <span className="text-xs font-bold tracking-[0.2em] uppercase text-white/30">
            Match Detail
          </span>
          <Link
            href={`/match/${id}/edit`}
            className="text-sm font-bold text-lime-400 hover:text-lime-300 transition-colors"
          >
            Edit
          </Link>
        </div>
      </div>

      <div className="px-5 py-6 space-y-6">
        {/* Result Hero */}
        <div
          className={`rounded-3xl p-6 border ${
            win
              ? "bg-gradient-to-br from-lime-400/20 to-lime-400/5 border-lime-400/30"
              : "bg-gradient-to-br from-red-500/20 to-red-500/5 border-red-500/30"
          }`}
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <span
                className={`text-xs font-black tracking-[0.2em] uppercase ${
                  win ? "text-lime-400" : "text-red-400"
                }`}
              >
                {win ? "Victory" : "Defeat"}
              </span>
              <h1 className="text-2xl font-black text-white mt-0.5">
                {isDoubles
                  ? `${match.opponentName} & ${match.opponent2Name ?? ""}`
                  : match.opponentName}
              </h1>
            </div>
            <span
              className={`text-6xl font-black leading-none ${
                win ? "text-lime-400" : "text-red-400"
              }`}
            >
              {win ? "W" : "L"}
            </span>
          </div>

          <div className="flex flex-wrap gap-2 text-sm text-white/50">
            <span>{SURFACE_EMOJI[match.surface]} {SURFACE_LABEL[match.surface]}</span>
            <span>·</span>
            <span className="capitalize">{match.matchType}</span>
          </div>
          <p className="text-xs text-white/25 mt-1">{date}</p>
        </div>

        {/* AI Match Summary */}
        {(() => {
          const summary = generateMatchSummary(match);
          return (
            <section className="space-y-3">
              <p className="text-xs font-black tracking-widest uppercase text-white/30">Match Summary</p>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-2">
                {summary.map((p, i) => (
                  <p key={i} className="text-sm text-white/70 leading-relaxed">{p}</p>
                ))}
              </div>
            </section>
          );
        })()}

        {/* Score Breakdown */}
        <section className="space-y-3">
          <p className="text-xs font-black tracking-widest uppercase text-white/30">Score</p>
          <div className="space-y-2">
            {playedSets.map((s, i) => {
              const playerWon = (s.player ?? 0) > (s.opponent ?? 0);
              const hasTb = s.tiebreak &&
                s.tiebreak.player !== null &&
                s.tiebreak.opponent !== null;
              return (
                <div
                  key={i}
                  className={`flex items-center gap-3 p-3 rounded-2xl border ${
                    playerWon
                      ? "border-lime-400/20 bg-lime-400/[0.04]"
                      : "border-red-500/20 bg-red-500/[0.04]"
                  }`}
                >
                  <span className="text-xs font-bold text-white/30 w-6 shrink-0">S{i + 1}</span>
                  <span className="text-xl font-black text-white flex-1">
                    {s.player}
                    <span className="text-white/30 mx-1">–</span>
                    {s.opponent}
                    {hasTb && (
                      <span className="text-sm font-semibold text-white/40 ml-1">
                        ({Math.min(s.tiebreak!.player!, s.tiebreak!.opponent!)})
                      </span>
                    )}
                  </span>
                  <span
                    className={`text-xs font-black px-2.5 py-0.5 rounded-full ${
                      playerWon
                        ? "bg-lime-400/15 text-lime-400"
                        : "bg-red-500/15 text-red-400"
                    }`}
                  >
                    {playerWon ? "W" : "L"}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Scouting Intel */}
        {!isDoubles ? (
          <ScoutingSection
            label="Scouting Intel"
            weapon={match.scouting?.weapon}
            hole={match.scouting?.hole}
            keyToWin={match.scouting?.keyToWin}
            styles={match.opponentStyle ?? []}
            handedness={match.opponentHandedness}
          />
        ) : (
          <>
            <ScoutingSection
              label={`Scouting — ${match.opponentName}`}
              weapon={match.scouting?.weapon}
              hole={match.scouting?.hole}
              keyToWin={match.scouting?.keyToWin}
              styles={match.opponentStyle ?? []}
              handedness={match.opponentHandedness}
            />
            {match.scouting2 && (
              <ScoutingSection
                label={`Scouting — ${match.opponent2Name ?? "Opponent 2"}`}
                weapon={match.scouting2.weapon}
                hole={match.scouting2.hole}
                keyToWin={match.scouting2.keyToWin}
                styles={match.opponentStyle2 ?? []}
                handedness={match.opponent2Handedness}
              />
            )}
          </>
        )}

        {/* Game Plan */}
        {match.plan && (match.plan.strategy || match.plan.targetWeakness || match.plan.focusWord || match.plan.confidence !== undefined) && (
          <section className="space-y-3">
            <p className="text-xs font-black tracking-widest uppercase text-white/30">Game Plan</p>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
              {match.plan.strategy && (
                <div>
                  <p className="text-xs text-white/30 font-bold mb-0.5">Strategy</p>
                  <p className="text-sm text-white/80">{match.plan.strategy}</p>
                </div>
              )}
              {match.plan.targetWeakness && (
                <div>
                  <p className="text-xs text-white/30 font-bold mb-0.5">Target Weakness</p>
                  <p className="text-sm text-white/80">{match.plan.targetWeakness}</p>
                </div>
              )}
              <div className="flex gap-4">
                {match.plan.focusWord && (
                  <div>
                    <p className="text-xs text-white/30 font-bold mb-0.5">Focus Word</p>
                    <p className="text-sm font-black text-lime-400">{match.plan.focusWord}</p>
                  </div>
                )}
                {match.plan.confidence !== undefined && (
                  <div>
                    <p className="text-xs text-white/30 font-bold mb-0.5">Confidence</p>
                    <p className={`text-sm font-black ${match.plan.confidence >= 7 ? "text-lime-400" : match.plan.confidence >= 5 ? "text-amber-400" : "text-red-400"}`}>
                      {match.plan.confidence}/10
                    </p>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Reflection */}
        {match.reflection && (
          match.reflection.energy !== undefined ||
          match.reflection.focus !== undefined ||
          match.reflection.emotionalControl !== undefined ||
          match.reflection.executionScore !== undefined ||
          match.reflection.notes
        ) && (
          <section className="space-y-3">
            <p className="text-xs font-black tracking-widest uppercase text-white/30">Reflection</p>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
              {/* Scores grid */}
              {(match.reflection.energy !== undefined || match.reflection.focus !== undefined ||
                match.reflection.emotionalControl !== undefined || match.reflection.composite !== undefined) && (
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { label: "Energy", val: match.reflection.energy },
                    { label: "Focus", val: match.reflection.focus },
                    { label: "Emo. Control", val: match.reflection.emotionalControl },
                    { label: "Mental", val: match.reflection.composite },
                  ] as { label: string; val: number | undefined }[]).filter(r => r.val !== undefined).map(({ label, val }) => (
                    <div key={label} className="rounded-xl bg-white/[0.04] px-3 py-2">
                      <p className="text-[10px] text-white/30 font-bold">{label}</p>
                      <p className={`text-lg font-black ${val! >= 7 ? "text-lime-400" : val! >= 5 ? "text-amber-400" : "text-red-400"}`}>
                        {val}/10
                      </p>
                    </div>
                  ))}
                </div>
              )}
              {/* Execution + Plan */}
              <div className="flex gap-3">
                {match.reflection.executionScore !== undefined && (
                  <div className="flex-1 rounded-xl bg-white/[0.04] px-3 py-2">
                    <p className="text-[10px] text-white/30 font-bold">Execution</p>
                    <p className={`text-lg font-black ${match.reflection.executionScore >= 7 ? "text-lime-400" : match.reflection.executionScore >= 5 ? "text-amber-400" : "text-red-400"}`}>
                      {match.reflection.executionScore}/10
                    </p>
                  </div>
                )}
                {match.reflection.stuckToPlan !== undefined && (
                  <div className="flex-1 rounded-xl bg-white/[0.04] px-3 py-2">
                    <p className="text-[10px] text-white/30 font-bold">Stuck to Plan</p>
                    <p className={`text-sm font-black ${match.reflection.stuckToPlan ? "text-lime-400" : "text-red-400"}`}>
                      {match.reflection.stuckToPlan ? "Yes ✓" : "No ✗"}
                    </p>
                  </div>
                )}
              </div>
              {match.reflection.notes && (
                <div>
                  <p className="text-xs text-white/30 font-bold mb-0.5">Notes</p>
                  <p className="text-sm text-white/70 leading-relaxed">{match.reflection.notes}</p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Delete */}
        <div className="pt-4 border-t border-white/[0.06]">
          {confirmDelete ? (
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex-1 py-3 rounded-2xl border border-white/10 text-white/50 text-sm font-bold transition-all active:scale-95"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 py-3 rounded-2xl bg-red-500/20 border border-red-500/40 text-red-400 text-sm font-black transition-all active:scale-95"
              >
                Yes, Delete
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="w-full py-3 rounded-2xl border border-white/[0.06] text-white/20 text-sm font-semibold hover:border-red-500/30 hover:text-red-400/60 transition-all active:scale-95"
            >
              Delete Match
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
