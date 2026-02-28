"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace("/");
      else router.replace("/auth");
    });
  }, [router]);

  return (
    <main className="min-h-screen bg-[#1e1e2a] flex items-center justify-center">
      <p className="text-white/40 text-sm">Signing you in…</p>
    </main>
  );
}
