export type QualityLevel = "fast" | "standard" | "strict";
export type MakeTarget = "web-playable";

export function parseQuality(value: string | undefined): QualityLevel {
  if (!value) return "standard";
  if (value === "fast" || value === "standard" || value === "strict") return value;
  throw new Error(`Unknown quality level: ${value}. Use fast, standard, or strict.`);
}

export function parseMakeTarget(value: string | undefined): MakeTarget {
  if (!value || value === "web-playable") return "web-playable";
  throw new Error(`Unknown make target: ${value}. V1 supports web-playable.`);
}
