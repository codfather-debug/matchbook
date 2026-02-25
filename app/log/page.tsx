"use client";
import MatchEntry from "@/components/MatchEntry";
import { useRouter } from "next/navigation";
import { Match } from "@/types";

export default function LogPage() {
  const router = useRouter();
  return (
    <MatchEntry
      onSave={(match) => {
        const existing: Match[] = JSON.parse(localStorage.getItem("matches") || "[]");
        const newMatch: Match = {
          ...match,
          id: crypto.randomUUID(),
          opponentId: match.opponentName,
        };
        localStorage.setItem("matches", JSON.stringify([newMatch, ...existing]));
        router.push("/");
      }}
      onCancel={() => router.push("/")}
    />
  );
}
