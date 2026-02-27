"use client";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import MatchEntry from "@/components/MatchEntry";
import { supabase } from "@/lib/supabase";

function LogPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const opponent = params.get("opponent") ?? "";
  const challengeId = params.get("challengeId");
  const challengeType = params.get("challengeType") ?? "team";

  return (
    <MatchEntry
      initialOpponentName={opponent || undefined}
      onSave={async (match) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.push("/auth"); return; }

        const { data: saved } = await supabase
          .from("matches")
          .insert({ user_id: user.id, data: match })
          .select("id")
          .single();

        // Mark challenge completed if launched from a challenge
        if (challengeId && saved) {
          const table = challengeType === "group" ? "group_challenges" : "challenges";
          await supabase
            .from(table)
            .update({ status: "completed", match_id: saved.id })
            .eq("id", challengeId);
        }

        router.push("/");
      }}
      onCancel={() => router.push("/")}
    />
  );
}

export default function LogPage() {
  return (
    <Suspense>
      <LogPageInner />
    </Suspense>
  );
}
