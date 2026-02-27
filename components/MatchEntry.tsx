import { useState, useCallback, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Match,
  Surface,
  MatchType,
  PlayStyle,
  SetScore,
  MatchScore,
  PlanData,
  ReflectionData,
  deriveResult,
} from "../types";
import { supabase } from "@/lib/supabase";

// ─── Sub-types ────────────────────────────────────────────────────────────────

type Step = "plan" | "info" | "score" | "scout" | "reflect" | "review";

const STEPS: Step[] = ["plan", "info", "score", "scout", "reflect", "review"];

const SURFACES: { value: Surface; label: string; emoji: string; color: string }[] = [
  { value: "hard",  label: "Hard",  emoji: "🟦", color: "bg-blue-500/20  border-blue-400  text-blue-300"  },
  { value: "clay",  label: "Clay",  emoji: "🟫", color: "bg-amber-500/20 border-amber-400 text-amber-300" },
  { value: "grass", label: "Grass", emoji: "🟩", color: "bg-green-500/20 border-green-400 text-green-300" },
];

const WEAPON_OPTIONS = [
  "Fast Serve", "Spinny Serve", "Serve Location", "Forehand", "Backhand",
  "Volleys", "Drop Shot", "Heavy Topspin", "Lobs", "Overheads",
  "Deep Groundstrokes", "Return of Serve", "Court Movement", "Consistency", "Mental Toughness",
];

const HOLE_OPTIONS = [
  "1st Serve %", "2nd Serve", "Backhand", "Forehand", "Volleys",
  "High Balls", "Net Game", "Pressure Points", "Court Movement", "Consistency",
  "Short Balls", "Return", "Mental Toughness",
];

function generateKeyToWin(w: string, h: string): string {
  if (w && h) return `Stay away from their ${w.toLowerCase()} — keep attacking their ${h.toLowerCase()}.`;
  if (w) return `Neutralize their ${w.toLowerCase()} — make them play on your terms.`;
  if (h) return `Attack their ${h.toLowerCase()} early and often.`;
  return "";
}

export const PLAY_STYLES: { value: PlayStyle; label: string; desc: string }[] = [
  { value: "pusher",          label: "Pusher",         desc: "Retrieves everything" },
  { value: "big-hitter",      label: "Big Hitter",     desc: "Massive groundstrokes" },
  { value: "serve-volley",    label: "Serve & Volley",  desc: "Net rusher" },
  { value: "counter-puncher", label: "Counter Puncher", desc: "Loves fast balls" },
  { value: "all-court",       label: "All Court",       desc: "Tactically flexible" },
  { value: "moonballer",      label: "Moonballer",      desc: "High heavy topspin" },
];

export const STYLE_TIPS: Record<PlayStyle, string> = {
  "pusher":          "Come to net on short balls. Use angles — don't try to out-steady them.",
  "big-hitter":      "Keep the ball deep and high. Don't feed them pace — make them generate it.",
  "serve-volley":    "Return low to their feet. Wide passing shots — avoid going down the line.",
  "counter-puncher": "Vary pace and spin. Drop shots pull them out of rhythm.",
  "all-court":       "Stay unpredictable — mix depths, spins, and net approaches.",
  "moonballer":      "Step inside the baseline and attack the high ball early. Don't get pushed back.",
};

const WEAPON_TO_STYLE: Record<string, PlayStyle> = {
  "Fast Serve":         "serve-volley",
  "Spinny Serve":       "moonballer",
  "Serve Location":     "serve-volley",
  "Forehand":           "big-hitter",
  "Backhand":           "counter-puncher",
  "Volleys":            "serve-volley",
  "Drop Shot":          "all-court",
  "Heavy Topspin":      "moonballer",
  "Lobs":               "pusher",
  "Overheads":          "serve-volley",
  "Deep Groundstrokes": "counter-puncher",
  "Return of Serve":    "counter-puncher",
  "Court Movement":     "counter-puncher",
  "Consistency":        "pusher",
  "Mental Toughness":   "pusher",
};

const HOLE_TO_STYLE: Record<string, PlayStyle> = {
  "1st Serve %":      "big-hitter",
  "2nd Serve":        "big-hitter",
  "Backhand":         "big-hitter",
  "Forehand":         "big-hitter",
  "Volleys":          "pusher",
  "High Balls":       "pusher",
  "Net Game":         "pusher",
  "Pressure Points":  "counter-puncher",
  "Court Movement":   "serve-volley",
  "Consistency":      "big-hitter",
  "Short Balls":      "moonballer",
  "Return":           "big-hitter",
  "Mental Toughness": "pusher",
};

function suggestStyle(weapon: string, hole: string): PlayStyle | null {
  const scores: Partial<Record<PlayStyle, number>> = {};
  for (const w of weapon.split(" / ").map(s => s.trim()).filter(Boolean)) {
    const s = WEAPON_TO_STYLE[w];
    if (s) scores[s] = (scores[s] ?? 0) + 1;
  }
  for (const h of hole.split(" / ").map(s => s.trim()).filter(Boolean)) {
    const s = HOLE_TO_STYLE[h];
    if (s) scores[s] = (scores[s] ?? 0) + 1;
  }
  const entries = Object.entries(scores) as [PlayStyle, number][];
  if (entries.length === 0) return null;
  return entries.sort((a, b) => b[1] - a[1])[0][0];
}

// ─── Scout State Hook ─────────────────────────────────────────────────────────

interface ScoutInitial {
  weapon?: string;
  hole?: string;
  keyToWin?: string;
  styles?: PlayStyle[];
  keyToWinEdited?: boolean;
}

function useScoutState(initial: ScoutInitial = {}) {
  const initWParts = initial.weapon?.split(" / ").map(s => s.trim()).filter(Boolean) ?? [];
  const initWChips = initWParts.filter(p => WEAPON_OPTIONS.includes(p));
  const initWCustom = initWParts.filter(p => !WEAPON_OPTIONS.includes(p)).join(" / ");

  const initHParts = initial.hole?.split(" / ").map(s => s.trim()).filter(Boolean) ?? [];
  const initHChips = initHParts.filter(p => HOLE_OPTIONS.includes(p));
  const initHCustom = initHParts.filter(p => !HOLE_OPTIONS.includes(p)).join(" / ");

  const [weaponChips, setWeaponChips] = useState<string[]>(() => initWChips);
  const [weaponCustom, setWeaponCustom] = useState(() => initWCustom);
  const [holeChips, setHoleChips]     = useState<string[]>(() => initHChips);
  const [holeCustom, setHoleCustom]   = useState(() => initHCustom);
  const [keyToWin, setKeyToWin]       = useState(() => initial.keyToWin ?? "");
  const [keyToWinEdited, setKeyToWinEdited] = useState(() => initial.keyToWinEdited ?? false);
  const [styles, setStyles]           = useState<PlayStyle[]>(() => initial.styles ?? []);

  const weapon = useMemo(
    () => weaponChips.length > 0 ? weaponChips.join(" / ") : weaponCustom,
    [weaponChips, weaponCustom]
  );
  const hole = useMemo(
    () => holeChips.length > 0 ? holeChips.join(" / ") : holeCustom,
    [holeChips, holeCustom]
  );

  useEffect(() => {
    if (keyToWinEdited) return;
    setKeyToWin(generateKeyToWin(weapon, hole));
  }, [weapon, hole, keyToWinEdited]);

  function toggleStyle(s: PlayStyle) {
    setStyles(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  }

  return { weaponChips, setWeaponChips, weaponCustom, setWeaponCustom,
           holeChips, setHoleChips, holeCustom, setHoleCustom,
           keyToWin, setKeyToWin, keyToWinEdited, setKeyToWinEdited,
           styles, toggleStyle, weapon, hole };
}

type ScoutState = ReturnType<typeof useScoutState>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function emptySet(): SetScore { return { player: null, opponent: null }; }
function emptyScore(): MatchScore { return { sets: [emptySet(), emptySet(), emptySet()] }; }
function setIsPlayed(s: SetScore): boolean { return s.player !== null && s.opponent !== null; }
function setsPlayed(score: MatchScore): number { return score.sets.filter(setIsPlayed).length; }

export function scoreLabel(score: MatchScore): string {
  return score.sets.filter(setIsPlayed).map(s => {
    const base = `${s.player}-${s.opponent}`;
    if (s.tiebreak && s.tiebreak.player !== null && s.tiebreak.opponent !== null)
      return `${base}(${Math.min(s.tiebreak.player, s.tiebreak.opponent)})`;
    return base;
  }).join(", ") || "—";
}

// ─── Step Indicator ───────────────────────────────────────────────────────────

function StepDots({ current }: { current: Step }) {
  const idx = STEPS.indexOf(current);
  return (
    <div className="flex items-center justify-center gap-1.5 mb-6">
      {STEPS.map((s, i) => (
        <div key={s} className={`rounded-full transition-all duration-300 ${
          s === current ? "w-6 h-2 bg-lime-400"
          : i < idx ? "w-2 h-2 bg-lime-400/50"
          : "w-2 h-2 bg-white/20"
        }`} />
      ))}
    </div>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-xl font-black tracking-tight text-white">{title}</h2>
      {sub && <p className="text-sm text-white/40 mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Pill ─────────────────────────────────────────────────────────────────────

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={`px-3 py-1.5 rounded-full border text-xs font-semibold transition-all active:scale-95 ${
        active
          ? "bg-lime-400 text-black border-lime-400"
          : "border-white/20 text-white/50 bg-white/5 hover:border-white/40 hover:text-white/80"
      }`}
    >{children}</button>
  );
}

// ─── Rating Picker (1–10) ─────────────────────────────────────────────────────

function RatingPicker({ label, value, onChange }: {
  label: string;
  value: number | null;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-white/60">{label}</p>
        {value !== null && (
          <span className={`text-sm font-black ${value >= 7 ? "text-lime-400" : value >= 4 ? "text-amber-400" : "text-red-400"}`}>
            {value}/10
          </span>
        )}
      </div>
      <div className="flex gap-1">
        {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
          <button key={n} type="button" onClick={() => onChange(n)}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${
              value === n
                ? n >= 7 ? "bg-lime-400 text-black" : n >= 4 ? "bg-amber-400 text-black" : "bg-red-500 text-white"
                : "bg-white/5 text-white/30 hover:bg-white/10 hover:text-white/70"
            }`}
          >{n}</button>
        ))}
      </div>
    </div>
  );
}

// ─── SetInput ─────────────────────────────────────────────────────────────────

function SetInput({ setNum, value, onChange }: { setNum: number; value: SetScore; onChange: (v: SetScore) => void }) {
  const played = setIsPlayed(value);
  const isTiebreak = played &&
    ((value.player === 7 && value.opponent === 6) || (value.player === 6 && value.opponent === 7));

  const numInput = "w-full bg-white/10 text-white text-center text-2xl font-black rounded-xl p-2 outline-none focus:ring-2 focus:ring-lime-400/60 placeholder:text-white/20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

  return (
    <div className="space-y-1">
      <div className={`flex items-center gap-3 p-3 rounded-2xl border transition-all ${played ? "border-white/20 bg-white/5" : "border-white/10 bg-white/[0.02]"}`}>
        <span className="text-xs font-bold text-white/30 w-8 shrink-0">S{setNum}</span>
        <div className="flex items-center gap-2 flex-1">
          <input type="number" min={0} max={7} placeholder="You" value={value.player ?? ""}
            onChange={e => onChange({ ...value, player: e.target.value === "" ? null : Number(e.target.value) })}
            className={numInput} />
          <span className="text-white/30 font-bold text-lg">–</span>
          <input type="number" min={0} max={7} placeholder="Them" value={value.opponent ?? ""}
            onChange={e => onChange({ ...value, opponent: e.target.value === "" ? null : Number(e.target.value) })}
            className={numInput} />
        </div>
        {played && (
          <span className={`text-xs font-bold shrink-0 w-6 text-right ${(value.player ?? 0) > (value.opponent ?? 0) ? "text-lime-400" : "text-red-400"}`}>
            {(value.player ?? 0) > (value.opponent ?? 0) ? "W" : "L"}
          </span>
        )}
      </div>
      {isTiebreak && (
        <div className="flex items-center gap-3 px-3 py-2 rounded-2xl border border-lime-400/20 bg-lime-400/[0.04]">
          <span className="text-xs font-bold text-lime-400/50 w-8 shrink-0">TB</span>
          <div className="flex items-center gap-2 flex-1">
            <input type="number" min={0} placeholder="You" value={value.tiebreak?.player ?? ""}
              onChange={e => onChange({ ...value, tiebreak: { player: e.target.value === "" ? null : Number(e.target.value), opponent: value.tiebreak?.opponent ?? null } })}
              className={numInput.replace("text-2xl", "text-lg")} />
            <span className="text-white/30 font-bold">–</span>
            <input type="number" min={0} placeholder="Them" value={value.tiebreak?.opponent ?? ""}
              onChange={e => onChange({ ...value, tiebreak: { player: value.tiebreak?.player ?? null, opponent: e.target.value === "" ? null : Number(e.target.value) } })}
              className={numInput.replace("text-2xl", "text-lg")} />
          </div>
          <div className="w-6" />
        </div>
      )}
    </div>
  );
}

// ─── Scout Panel ─────────────────────────────────────────────────────────────

function ScoutPanel({ scout, hand, setHand }: {
  scout: ScoutState;
  hand: "right" | "left" | null;
  setHand: (h: "right" | "left" | null) => void;
}) {
  const { weaponChips, setWeaponChips, weaponCustom, setWeaponCustom,
          holeChips, setHoleChips, holeCustom, setHoleCustom,
          keyToWin, setKeyToWin, keyToWinEdited, setKeyToWinEdited,
          styles, toggleStyle, weapon, hole } = scout;
  const suggested = suggestStyle(weapon, hole);
  const ta = "w-full bg-white/5 border border-white/10 rounded-2xl p-3 text-white text-sm placeholder:text-white/25 outline-none focus:ring-2 focus:ring-lime-400/50 focus:border-lime-400/30 resize-none transition-all";

  return (
    <div className="space-y-6">
      {/* Handedness */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-white/40 uppercase tracking-widest">Handedness</label>
        <div className="flex gap-2">
          <button type="button" onClick={() => setHand(hand === "right" ? null : "right")}
            className={`flex-1 py-3 rounded-2xl border text-sm font-bold transition-all active:scale-95 ${hand === "right" ? "bg-lime-400 text-black border-lime-400" : "border-white/10 text-white/40 bg-white/[0.02] hover:border-white/20"}`}>
            Righty
          </button>
          <button type="button" onClick={() => setHand(hand === "left" ? null : "left")}
            className={`flex-1 py-3 rounded-2xl border text-sm font-bold transition-all active:scale-95 ${hand === "left" ? "bg-lime-400 text-black border-lime-400" : "border-white/10 text-white/40 bg-white/[0.02] hover:border-white/20"}`}>
            Lefty
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm font-bold text-white/70">
          <span>⚡</span> Their Weapon
          {weaponChips.length > 0 && <span className="text-xs font-normal text-white/30">({weaponChips.length} selected)</span>}
        </label>
        <div className="flex flex-wrap gap-1.5">
          {WEAPON_OPTIONS.map(opt => (
            <Pill key={opt} active={weaponChips.includes(opt)}
              onClick={() => setWeaponChips(prev => prev.includes(opt) ? prev.filter(w => w !== opt) : [...prev, opt])}>
              {opt}
            </Pill>
          ))}
        </div>
        {weaponChips.length === 0 && (
          <input type="text" placeholder="Or describe it yourself…" value={weaponCustom}
            onChange={e => setWeaponCustom(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm placeholder:text-white/25 outline-none focus:ring-2 focus:ring-lime-400/50 focus:border-lime-400/30 transition-all" />
        )}
      </div>

      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm font-bold text-white/70">
          <span>🎯</span> Their Weakness
          {holeChips.length > 0 && <span className="text-xs font-normal text-white/30">({holeChips.length} selected)</span>}
        </label>
        <div className="flex flex-wrap gap-1.5">
          {HOLE_OPTIONS.map(opt => (
            <Pill key={opt} active={holeChips.includes(opt)}
              onClick={() => setHoleChips(prev => prev.includes(opt) ? prev.filter(h => h !== opt) : [...prev, opt])}>
              {opt}
            </Pill>
          ))}
        </div>
        {holeChips.length === 0 && (
          <input type="text" placeholder="Or describe it yourself…" value={holeCustom}
            onChange={e => setHoleCustom(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm placeholder:text-white/25 outline-none focus:ring-2 focus:ring-lime-400/50 focus:border-lime-400/30 transition-all" />
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm font-bold text-white/70"><span>🔑</span> Key to Win</label>
          {keyToWinEdited && (weapon || hole) && (
            <button type="button" onClick={() => { setKeyToWinEdited(false); setKeyToWin(generateKeyToWin(weapon, hole)); }}
              className="text-xs text-lime-400/70 hover:text-lime-400 transition-colors">↺ Regenerate</button>
          )}
        </div>
        <textarea rows={2} placeholder="One sentence strategy for next time…" value={keyToWin}
          onChange={e => { setKeyToWin(e.target.value); setKeyToWinEdited(true); }}
          className={ta} />
        {keyToWin && !keyToWinEdited && <p className="text-xs text-lime-400/50">✨ Auto-generated — tap to edit</p>}
      </div>

      <div className="space-y-3">
        <label className="text-xs font-bold text-white/40 uppercase tracking-widest block">Playstyle Tags</label>
        {suggested && !styles.includes(suggested) && (
          <button type="button" onClick={() => toggleStyle(suggested)}
            className="flex items-center gap-2 px-3 py-2 rounded-2xl border border-lime-400/30 bg-lime-400/5 text-lime-400/80 text-xs font-semibold transition-all hover:bg-lime-400/10 active:scale-95">
            <span>✨</span> Suggested: {PLAY_STYLES.find(p => p.value === suggested)?.label} — tap to add
          </button>
        )}
        <div className="grid grid-cols-2 gap-2">
          {PLAY_STYLES.map(ps => (
            <button key={ps.value} type="button" onClick={() => toggleStyle(ps.value)}
              className={`p-3 rounded-2xl border text-left transition-all active:scale-95 ${styles.includes(ps.value) ? "bg-lime-400/10 border-lime-400/40" : "border-white/10 bg-white/[0.02] hover:border-white/20"}`}>
              <p className={`text-sm font-bold ${styles.includes(ps.value) ? "text-lime-400" : "text-white/70"}`}>{ps.label}</p>
              <p className="text-xs text-white/30 mt-0.5">{ps.desc}</p>
            </button>
          ))}
        </div>
        {styles.length > 0 && (
          <div className="space-y-2 pt-1">
            {styles.map(s => {
              const ps = PLAY_STYLES.find(p => p.value === s)!;
              return (
                <div key={s} className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <div className="flex items-baseline gap-2 mb-1">
                    <p className="text-xs font-black text-white/40 uppercase tracking-widest">vs {ps.label}</p>
                    <p className="text-xs text-white/25">{ps.desc}</p>
                  </div>
                  <p className="text-sm text-white/70">{STYLE_TIPS[s]}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Scout Review Block ───────────────────────────────────────────────────────

function ScoutReviewBlock({ label, weapon, hole, keyToWin, styles, handedness }: {
  label: string; weapon: string; hole: string; keyToWin: string; styles: PlayStyle[];
  handedness?: "right" | "left" | null;
}) {
  if (!weapon && !hole && !keyToWin && styles.length === 0 && !handedness) return null;
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-2">
      <p className="text-xs font-black tracking-widest uppercase text-white/30">{label}</p>
      {handedness && <div><span className="text-xs text-white/30">✋ Handedness — </span><span className="text-sm text-white/80">{handedness === "right" ? "Righty" : "Lefty"}</span></div>}
      {weapon  && <div><span className="text-xs text-white/30">⚡ Weapon — </span><span className="text-sm text-white/80">{weapon}</span></div>}
      {hole    && <div><span className="text-xs text-white/30">🎯 Weakness — </span><span className="text-sm text-white/80">{hole}</span></div>}
      {keyToWin && <div><span className="text-xs text-white/30">🔑 Key — </span><span className="text-sm text-white font-medium">{keyToWin}</span></div>}
      {styles.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {styles.map(s => (
            <span key={s} className="px-3 py-1 rounded-full bg-white/5 border border-white/15 text-white/60 text-xs font-semibold">
              {PLAY_STYLES.find(p => p.value === s)?.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface MatchEntryProps {
  initialData?: Match;
  initialOpponentName?: string;
  onSave?: (match: Omit<Match, "id" | "opponentId">) => void;
  onCancel?: () => void;
}

export default function MatchEntry({ initialData, initialOpponentName, onSave, onCancel }: MatchEntryProps) {
  const [step, setStep] = useState<Step>("plan");

  // ── Plan state ──────────────────────────────────────────────────────────────
  const [planStrategy,   setPlanStrategy]   = useState(initialData?.plan?.strategy ?? "");
  const [planWeakness,   setPlanWeakness]   = useState(initialData?.plan?.targetWeakness ?? "");
  const [planFocusWord,  setPlanFocusWord]  = useState(initialData?.plan?.focusWord ?? "");
  const [planConfidence, setPlanConfidence] = useState<number | null>(initialData?.plan?.confidence ?? null);

  // ── Match info ──────────────────────────────────────────────────────────────
  const [opponentName,  setOpponentName]  = useState(initialData?.opponentName ?? initialOpponentName ?? "");
  const [opponent2Name, setOpponent2Name] = useState(initialData?.opponent2Name ?? "");
  const [prevOpponents, setPrevOpponents] = useState<string[]>([]);
  const [nameFocused, setNameFocused] = useState(false);

  useEffect(() => {
    supabase.from("matches").select("data").then(({ data }) => {
      if (!data) return;
      const names = [...new Set(data.map(r => (r.data as { opponentName?: string }).opponentName).filter(Boolean))] as string[];
      setPrevOpponents(names);
    });
  }, []);
  const [surface,  setSurface]  = useState<Surface | null>(initialData?.surface ?? null);
  const [matchType, setMatchType] = useState<MatchType>(initialData?.matchType ?? "singles");
  const [score, setScore] = useState<MatchScore>(initialData?.score ?? emptyScore());

  // ── Scouting ────────────────────────────────────────────────────────────────
  const scout1 = useScoutState({
    weapon: initialData?.scouting?.weapon, hole: initialData?.scouting?.hole,
    keyToWin: initialData?.scouting?.keyToWin, styles: initialData?.opponentStyle,
    keyToWinEdited: !!initialData?.scouting?.keyToWin,
  });
  const scout2 = useScoutState({
    weapon: initialData?.scouting2?.weapon, hole: initialData?.scouting2?.hole,
    keyToWin: initialData?.scouting2?.keyToWin, styles: initialData?.opponentStyle2,
    keyToWinEdited: !!initialData?.scouting2?.keyToWin,
  });
  const [scoutTab, setScoutTab] = useState<1 | 2>(1);
  const [hand1, setHand1] = useState<"right" | "left" | null>(initialData?.opponentHandedness ?? null);
  const [hand2, setHand2] = useState<"right" | "left" | null>(initialData?.opponent2Handedness ?? null);

  // ── Reflect state ───────────────────────────────────────────────────────────
  const [reflEnergy,    setReflEnergy]    = useState<number | null>(initialData?.reflection?.energy ?? null);
  const [reflFocus,     setReflFocus]     = useState<number | null>(initialData?.reflection?.focus ?? null);
  const [reflEmoCtrl,   setReflEmoCtrl]   = useState<number | null>(initialData?.reflection?.emotionalControl ?? null);
  const [reflConf,      setReflConf]      = useState<number | null>(initialData?.reflection?.confidence ?? null);
  const [reflExec,      setReflExec]      = useState<number | null>(initialData?.reflection?.executionScore ?? null);
  const [reflStuck,     setReflStuck]     = useState<boolean | null>(initialData?.reflection?.stuckToPlan ?? null);
  const [reflNotes,     setReflNotes]     = useState(initialData?.reflection?.notes ?? "");

  // ── Derived ─────────────────────────────────────────────────────────────────
  const result    = deriveResult(score);
  const isWin     = result === "win";
  const stepIndex = STEPS.indexOf(step);
  const isDoubles = matchType === "doubles";
  const isEditing = !!initialData;

  const canAdvance = useCallback(() => {
    if (step === "info") return opponentName.trim().length > 0 && surface !== null && (!isDoubles || opponent2Name.trim().length > 0);
    if (step === "score") return setsPlayed(score) >= 1;
    return true; // plan, scout, reflect are all optional
  }, [step, opponentName, opponent2Name, surface, score, isDoubles]);

  function updateSet(i: number, val: SetScore) {
    const sets = [...score.sets] as [SetScore, SetScore, SetScore];
    sets[i] = val;
    setScore({ sets });
  }

  function handleSave() {
    if (!surface) return;

    // Compute mental composite
    const mentalVals = [reflEnergy, reflFocus, reflEmoCtrl, reflConf].filter((n): n is number => n !== null);
    const composite  = mentalVals.length > 0
      ? Math.round((mentalVals.reduce((a, b) => a + b, 0) / mentalVals.length) * 10) / 10
      : undefined;

    const hasPlan = planStrategy || planWeakness || planFocusWord || planConfidence !== null;
    const hasReflect = reflEnergy !== null || reflFocus !== null || reflEmoCtrl !== null ||
                       reflConf !== null || reflExec !== null || reflStuck !== null || reflNotes;

    const base: Omit<Match, "id" | "opponentId"> = {
      createdAt: initialData?.createdAt ?? new Date().toISOString(),
      opponentName,
      surface,
      matchType,
      score,
      result,
      opponentStyle: scout1.styles,
      scouting: { weapon: scout1.weapon, hole: scout1.hole, keyToWin: scout1.keyToWin },
    };

    if (hasPlan) base.plan = {
      strategy: planStrategy || undefined,
      targetWeakness: planWeakness || undefined,
      focusWord: planFocusWord || undefined,
      confidence: planConfidence ?? undefined,
    };

    if (hasReflect) base.reflection = {
      energy: reflEnergy ?? undefined,
      focus: reflFocus ?? undefined,
      emotionalControl: reflEmoCtrl ?? undefined,
      confidence: reflConf ?? undefined,
      composite,
      executionScore: reflExec ?? undefined,
      stuckToPlan: reflStuck ?? undefined,
      notes: reflNotes || undefined,
    };

    if (hand1) base.opponentHandedness = hand1;

    if (isDoubles) {
      base.opponent2Name  = opponent2Name;
      base.opponentStyle2 = scout2.styles;
      base.scouting2      = { weapon: scout2.weapon, hole: scout2.hole, keyToWin: scout2.keyToWin };
      if (hand2) base.opponent2Handedness = hand2;
    }

    onSave?.(base);
  }

  const inputCls = "w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 text-white text-base placeholder:text-white/25 outline-none focus:ring-2 focus:ring-lime-400/50 focus:border-lime-400/30 transition-all font-medium";
  const taCls    = "w-full bg-white/5 border border-white/10 rounded-2xl p-3 text-white text-sm placeholder:text-white/25 outline-none focus:ring-2 focus:ring-lime-400/50 focus:border-lime-400/30 resize-none transition-all";

  return (
    <div className="min-h-screen bg-[#0c0c0e] flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0c0c0e]/90 backdrop-blur-xl border-b border-white/[0.06] px-5">
        <div className="flex items-center justify-between h-14">
          <button onClick={onCancel} className="text-white/40 text-sm font-medium hover:text-white/80 transition-colors">Cancel</button>
          <span className="text-xs font-bold tracking-[0.2em] uppercase text-white/30">{isEditing ? "Edit Match" : "Log Match"}</span>
          {step === "review" ? (
            <button onClick={handleSave} className="text-sm font-black text-lime-400 hover:text-lime-300 transition-colors">
              {isEditing ? "Update" : "Save"}
            </button>
          ) : <div className="w-12" />}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-6">
        <StepDots current={step} />

        {/* ── PLAN ── */}
        {step === "plan" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <SectionHeader title="Game Plan" sub="Set your intentions before the match — all fields optional" />

            <div className="space-y-2">
              <label className="text-xs font-bold text-white/40 uppercase tracking-widest block">Primary Strategy</label>
              <textarea rows={2} placeholder="e.g. Serve wide and attack the short ball, stay back on clay…"
                value={planStrategy} onChange={e => setPlanStrategy(e.target.value)} className={taCls} />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-white/40 uppercase tracking-widest block">Target Weakness</label>
              <input type="text" placeholder="e.g. Second serve, backhand under pressure…"
                value={planWeakness} onChange={e => setPlanWeakness(e.target.value)} className={inputCls} />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-white/40 uppercase tracking-widest block">Focus Word</label>
              <input type="text" placeholder="One word: Calm, Attack, Trust, Process…"
                value={planFocusWord} onChange={e => setPlanFocusWord(e.target.value)} className={inputCls} />
            </div>

            <RatingPicker label="Pre-Match Confidence" value={planConfidence} onChange={setPlanConfidence} />

            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 space-y-2">
              <p className="text-xs text-white/30 font-semibold">Need strategy ideas?</p>
              <div className="flex gap-2">
                <Link href="/playbook/singles" target="_blank"
                  className="flex-1 text-center py-2 rounded-xl bg-lime-400/10 border border-lime-400/20 text-lime-400 text-xs font-black hover:bg-lime-400/20 transition-all">
                  Singles →
                </Link>
                <Link href="/playbook/doubles" target="_blank"
                  className="flex-1 text-center py-2 rounded-xl bg-sky-400/10 border border-sky-400/20 text-sky-400 text-xs font-black hover:bg-sky-400/20 transition-all">
                  Doubles →
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* ── INFO ── */}
        {step === "info" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <SectionHeader title="Who'd you play?" sub="Basic match details" />

            <div>
              <label className="text-xs font-bold text-white/40 uppercase tracking-widest block mb-2">{isDoubles ? "Opponent 1" : "Opponent"}</label>
              <input autoFocus type="text" placeholder="e.g. Rafael Nadal"
                value={opponentName}
                onChange={e => setOpponentName(e.target.value)}
                onFocus={() => setNameFocused(true)}
                onBlur={() => setTimeout(() => setNameFocused(false), 150)}
                className={inputCls} />
              {nameFocused && opponentName.length >= 1 && prevOpponents.filter(n => n.toLowerCase().includes(opponentName.toLowerCase()) && n !== opponentName).length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {prevOpponents
                    .filter(n => n.toLowerCase().includes(opponentName.toLowerCase()) && n !== opponentName)
                    .slice(0, 5)
                    .map(n => (
                      <button key={n} type="button" onMouseDown={() => setOpponentName(n)}
                        className="px-3 py-1 rounded-full bg-white/[0.06] border border-white/10 text-white/60 text-xs font-semibold hover:bg-white/10 transition-all">
                        {n}
                      </button>
                    ))}
                </div>
              )}
              {nameFocused && opponentName.length === 0 && prevOpponents.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {prevOpponents.slice(0, 6).map(n => (
                    <button key={n} type="button" onMouseDown={() => setOpponentName(n)}
                      className="px-3 py-1 rounded-full bg-white/[0.06] border border-white/10 text-white/60 text-xs font-semibold hover:bg-white/10 transition-all">
                      {n}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {isDoubles && (
              <div>
                <label className="text-xs font-bold text-white/40 uppercase tracking-widest block mb-2">Opponent 2</label>
                <input type="text" placeholder="e.g. Roger Federer"
                  value={opponent2Name} onChange={e => setOpponent2Name(e.target.value)} className={inputCls} />
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-white/40 uppercase tracking-widest block mb-3">Surface</label>
              <div className="grid grid-cols-3 gap-2">
                {SURFACES.map(s => (
                  <button key={s.value} type="button" onClick={() => setSurface(s.value)}
                    className={`flex flex-col items-center gap-1.5 p-4 rounded-2xl border text-sm font-bold transition-all active:scale-95 ${surface === s.value ? s.color + " shadow-lg" : "border-white/10 text-white/40 bg-white/[0.02] hover:border-white/20 hover:text-white/60"}`}>
                    <span className="text-2xl">{s.emoji}</span>{s.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-white/40 uppercase tracking-widest block mb-3">Format</label>
              <div className="grid grid-cols-2 gap-2">
                {(["singles", "doubles"] as MatchType[]).map(t => (
                  <button key={t} type="button" onClick={() => setMatchType(t)}
                    className={`py-3.5 rounded-2xl border text-sm font-bold capitalize transition-all active:scale-95 ${matchType === t ? "bg-lime-400/10 border-lime-400/50 text-lime-400" : "border-white/10 text-white/40 bg-white/[0.02] hover:border-white/20 hover:text-white/60"}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── SCORE ── */}
        {step === "score" && (
          <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
            <SectionHeader title="Enter the score" sub="Log how many sets were played" />
            <div className="space-y-2">
              {score.sets.map((set, i) => (
                <SetInput key={i} setNum={i + 1} value={set} onChange={v => updateSet(i, v)} />
              ))}
            </div>
            {setsPlayed(score) > 0 && (
              <div className={`rounded-2xl p-4 text-center border ${isWin ? "bg-lime-400/10 border-lime-400/30 text-lime-300" : "bg-red-500/10 border-red-500/30 text-red-400"}`}>
                <div className="text-3xl font-black mb-0.5">{isWin ? "WIN" : "LOSS"}</div>
                <div className="text-sm opacity-60">{scoreLabel(score)}</div>
              </div>
            )}
          </div>
        )}

        {/* ── SCOUT ── */}
        {step === "scout" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <SectionHeader title="Build your dossier" sub="Strategic intel for the rematch" />
            {isDoubles && (
              <div className="flex gap-2 p-1 rounded-2xl bg-white/[0.04] border border-white/10">
                {([1, 2] as const).map(tab => (
                  <button key={tab} type="button" onClick={() => setScoutTab(tab)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${scoutTab === tab ? "bg-lime-400 text-black shadow" : "text-white/40 hover:text-white/70"}`}>
                    {tab === 1 ? opponentName || "Opponent 1" : opponent2Name || "Opponent 2"}
                  </button>
                ))}
              </div>
            )}
            <ScoutPanel
              scout={isDoubles && scoutTab === 2 ? scout2 : scout1}
              hand={isDoubles && scoutTab === 2 ? hand2 : hand1}
              setHand={isDoubles && scoutTab === 2 ? setHand2 : setHand1}
            />
          </div>
        )}

        {/* ── REFLECT ── */}
        {step === "reflect" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <SectionHeader title="Match Reflection" sub="Rate your performance — all fields optional" />

            <div className="space-y-4">
              <RatingPicker label="Energy"            value={reflEnergy}  onChange={setReflEnergy} />
              <RatingPicker label="Focus"             value={reflFocus}   onChange={setReflFocus} />
              <RatingPicker label="Emotional Control" value={reflEmoCtrl} onChange={setReflEmoCtrl} />
              <RatingPicker label="Confidence"        value={reflConf}    onChange={setReflConf} />
              <div className="h-px bg-white/[0.06]" />
              <RatingPicker label="Execution Score"   value={reflExec}    onChange={setReflExec} />
            </div>

            <div className="space-y-3">
              <label className="text-xs font-bold text-white/40 uppercase tracking-widest">Did you stick to your game plan?</label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setReflStuck(true)}
                  className={`py-3.5 rounded-2xl border text-sm font-bold transition-all active:scale-95 ${reflStuck === true ? "bg-lime-400/10 border-lime-400/40 text-lime-400" : "border-white/10 text-white/40 bg-white/[0.02] hover:border-white/20"}`}>
                  Yes ✓
                </button>
                <button type="button" onClick={() => setReflStuck(false)}
                  className={`py-3.5 rounded-2xl border text-sm font-bold transition-all active:scale-95 ${reflStuck === false ? "bg-red-500/10 border-red-500/40 text-red-400" : "border-white/10 text-white/40 bg-white/[0.02] hover:border-white/20"}`}>
                  Not quite
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-white/40 uppercase tracking-widest">Post-Match Notes</label>
              <textarea rows={3} placeholder="What worked? What would you change? Key takeaways…"
                value={reflNotes} onChange={e => setReflNotes(e.target.value)} className={taCls} />
            </div>
          </div>
        )}

        {/* ── REVIEW ── */}
        {step === "review" && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <SectionHeader title="Review & save" sub="Everything look right?" />

            <div className={`rounded-3xl p-5 border ${isWin ? "bg-gradient-to-br from-lime-400/15 to-lime-400/5 border-lime-400/30" : "bg-gradient-to-br from-red-500/15 to-red-500/5 border-red-500/30"}`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className={`text-xs font-black tracking-[0.2em] uppercase mb-1 ${isWin ? "text-lime-400" : "text-red-400"}`}>
                    {isWin ? "Victory" : "Defeat"}
                  </div>
                  <div className="text-2xl font-black text-white">
                    {isDoubles ? `${opponentName} & ${opponent2Name}` : opponentName}
                  </div>
                  <div className="text-white/40 text-sm mt-0.5">
                    {scoreLabel(score)} · {SURFACES.find(s => s.value === surface)?.emoji} {surface?.charAt(0).toUpperCase()}{surface?.slice(1)} · {matchType}
                  </div>
                </div>
                <div className={`text-5xl font-black ${isWin ? "text-lime-400" : "text-red-400"}`}>{isWin ? "W" : "L"}</div>
              </div>
            </div>

            {/* Plan summary */}
            {(planStrategy || planWeakness || planFocusWord || planConfidence !== null) && (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-2">
                <p className="text-xs font-black tracking-widest uppercase text-white/30">Game Plan</p>
                {planStrategy   && <div><span className="text-xs text-white/30">🎯 Strategy — </span><span className="text-sm text-white/80">{planStrategy}</span></div>}
                {planWeakness   && <div><span className="text-xs text-white/30">⚠️ Target — </span><span className="text-sm text-white/80">{planWeakness}</span></div>}
                {planFocusWord  && <div><span className="text-xs text-white/30">💬 Focus — </span><span className="text-sm text-white font-bold">{planFocusWord}</span></div>}
                {planConfidence !== null && <div><span className="text-xs text-white/30">💪 Confidence — </span><span className="text-sm text-white/80">{planConfidence}/10</span></div>}
              </div>
            )}

            {/* Reflection summary */}
            {(reflEnergy !== null || reflExec !== null) && (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-2">
                <p className="text-xs font-black tracking-widest uppercase text-white/30">Reflection</p>
                <div className="grid grid-cols-3 gap-2">
                  {reflEnergy  !== null && <div className="text-center"><p className="text-xs text-white/30">Energy</p><p className="text-lg font-black text-white">{reflEnergy}</p></div>}
                  {reflFocus   !== null && <div className="text-center"><p className="text-xs text-white/30">Focus</p><p className="text-lg font-black text-white">{reflFocus}</p></div>}
                  {reflEmoCtrl !== null && <div className="text-center"><p className="text-xs text-white/30">Emotion</p><p className="text-lg font-black text-white">{reflEmoCtrl}</p></div>}
                  {reflConf    !== null && <div className="text-center"><p className="text-xs text-white/30">Conf.</p><p className="text-lg font-black text-white">{reflConf}</p></div>}
                  {reflExec    !== null && <div className="text-center"><p className="text-xs text-white/30">Execution</p><p className="text-lg font-black text-white">{reflExec}</p></div>}
                  {reflStuck   !== null && <div className="text-center"><p className="text-xs text-white/30">Stuck to Plan</p><p className={`text-sm font-black ${reflStuck ? "text-lime-400" : "text-red-400"}`}>{reflStuck ? "Yes" : "No"}</p></div>}
                </div>
              </div>
            )}

            <ScoutReviewBlock label={isDoubles ? `Scouting — ${opponentName}` : "Scouting Intel"}
              weapon={scout1.weapon} hole={scout1.hole} keyToWin={scout1.keyToWin} styles={scout1.styles} handedness={hand1} />
            {isDoubles && (
              <ScoutReviewBlock label={`Scouting — ${opponent2Name}`}
                weapon={scout2.weapon} hole={scout2.hole} keyToWin={scout2.keyToWin} styles={scout2.styles} handedness={hand2} />
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="sticky bottom-0 bg-[#0c0c0e]/95 backdrop-blur-xl border-t border-white/[0.06] px-5 py-4">
        <div className="flex gap-3">
          {stepIndex > 0 && (
            <button type="button" onClick={() => setStep(STEPS[stepIndex - 1])}
              className="flex-1 py-4 rounded-2xl border border-white/10 text-white/60 font-bold text-sm transition-all active:scale-95 hover:border-white/20 hover:text-white/80">
              Back
            </button>
          )}
          {step !== "review" ? (
            <button type="button" disabled={!canAdvance()} onClick={() => setStep(STEPS[stepIndex + 1])}
              className="flex-[2] py-4 rounded-2xl font-black text-sm transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed bg-lime-400 text-black hover:bg-lime-300 shadow-lg shadow-lime-400/20">
              Continue →
            </button>
          ) : (
            <button type="button" onClick={handleSave}
              className={`flex-[2] py-4 rounded-2xl font-black text-sm transition-all active:scale-95 shadow-lg ${isWin ? "bg-lime-400 text-black hover:bg-lime-300 shadow-lime-400/20" : "bg-red-500 text-white hover:bg-red-400 shadow-red-500/20"}`}>
              {isEditing ? (isWin ? "Update Win 🏆" : "Update Match") : (isWin ? "Save Win 🏆" : "Save Match")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
