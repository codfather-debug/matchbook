import { supabase } from "@/lib/supabase";

export async function upsertProfile(user: { id: string; email?: string }) {
  const username = user.email?.split("@")[0] ?? user.id;
  await supabase
    .from("profiles")
    .upsert({ id: user.id, username }, { onConflict: "id", ignoreDuplicates: true });
}
