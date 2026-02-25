"use client";
import MatchEntry from "@/components/MatchEntry";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LogPage() {
  const router = useRouter();
  return (
    <MatchEntry
      onSave={async (match) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.push("/auth"); return; }
        await supabase.from("matches").insert({
          user_id: user.id,
          data: match,
        });
        router.push("/");
      }}
      onCancel={() => router.push("/")}
    />
  );
}
