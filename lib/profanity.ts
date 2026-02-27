const BLOCKED = [
  "fuck","shit","bitch","cunt","dick","pussy","asshole","bastard",
  "nigger","nigga","faggot","fag","retard","slut","whore","cock",
  "twat","piss","wanker","bollocks","arse","prick","crap","damn",
];

/** Returns true if the text contains common profanity. */
export function hasProfanity(text: string): boolean {
  const cleaned = text.toLowerCase().replace(/[^a-z]/g, "");
  return BLOCKED.some(w => cleaned.includes(w));
}
