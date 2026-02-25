"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function AuthPage() {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode]         = useState<"login" | "signup">("login");
  const [error, setError]       = useState("");
  const [success, setSuccess]   = useState("");
  const [loading, setLoading]   = useState(false);
  const router = useRouter();

  async function handleSubmit() {
    if (!email || !password) return;
    setLoading(true);
    setError("");
    setSuccess("");

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      else router.push("/");
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setError(error.message);
      else setSuccess("Check your email to confirm your account, then log in.");
    }
    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-[#0c0c0e] flex flex-col items-center justify-center px-5">
      <div className="w-full max-w-sm space-y-8">

        {/* Logo */}
        <div className="text-center space-y-1">
          <h1 className="text-3xl font-black text-white">Matchbook</h1>
          <p className="text-white/40 text-sm">Your tennis scouting companion</p>
        </div>

        {/* Card */}
        <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-6 space-y-4">
          <h2 className="text-lg font-black text-white">
            {mode === "login" ? "Welcome back" : "Create account"}
          </h2>

          <div className="space-y-3">
            <input
              type="email"
              placeholder="Email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 text-white text-sm placeholder:text-white/25 outline-none focus:ring-2 focus:ring-lime-400/50 focus:border-lime-400/30 transition-all"
            />
            <input
              type="password"
              placeholder="Password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 text-white text-sm placeholder:text-white/25 outline-none focus:ring-2 focus:ring-lime-400/50 focus:border-lime-400/30 transition-all"
            />
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-2xl px-4 py-3">
              {error}
            </p>
          )}
          {success && (
            <p className="text-sm text-lime-400 bg-lime-400/10 border border-lime-400/20 rounded-2xl px-4 py-3">
              {success}
            </p>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading || !email || !password}
            className="w-full py-4 rounded-2xl font-black text-sm bg-lime-400 text-black hover:bg-lime-300 transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-lime-400/20"
          >
            {loading ? "…" : mode === "login" ? "Log In" : "Create Account"}
          </button>
        </div>

        <p className="text-center text-sm text-white/30">
          {mode === "login" ? "No account? " : "Already have one? "}
          <button
            onClick={() => {
              setMode(mode === "login" ? "signup" : "login");
              setError("");
              setSuccess("");
            }}
            className="text-lime-400 font-semibold hover:text-lime-300 transition-colors"
          >
            {mode === "login" ? "Sign up" : "Log in"}
          </button>
        </p>

      </div>
    </main>
  );
}
