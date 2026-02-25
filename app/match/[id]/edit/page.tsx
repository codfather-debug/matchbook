"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Match } from "@/types";
import { supabase } from "@/lib/supabase";
import MatchEntry from "@/components/MatchEntry";

export default function EditMatchPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [match, setMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);

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

  if (!match) return null;

  return (
    <MatchEntry
      initialData={match}
      onSave={async (updated) => {
        await supabase
          .from("matches")
          .update({ data: updated })
          .eq("id", id);
        router.push(`/match/${id}`);
      }}
      onCancel={() => router.push(`/match/${id}`)}
    />
  );
}
