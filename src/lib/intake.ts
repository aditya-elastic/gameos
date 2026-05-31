import { z } from "zod";
import type { CreateProjectInput, GameBrief, GameProject, ProjectStatus } from "./types";

export const createProjectInputSchema = z.object({
  prompt: z.string().min(20, "Describe the game idea in at least 20 characters."),
  targetPlatforms: z.array(z.string()).min(1, "Choose at least one target platform."),
  enginePreference: z.string().optional(),
  genre: z.string().optional(),
  targetAudience: z.string().optional()
});

const genreSignals: Array<[string, string[]]> = [
  ["War Arcade", ["war", "missile", "naval", "battle", "combat", "soldier", "tank"]],
  ["Creator Challenge", ["youtube", "creator", "stream", "shorts", "viral", "clip"]],
  ["Racing", ["race", "speed", "drift", "car", "bike", "track"]],
  ["Survival", ["survival", "survive", "horde", "rogue", "danger", "escape"]],
  ["Puzzle Strategy", ["puzzle", "strategy", "tactics", "resource", "tower"]],
  ["Adventure", ["quest", "explore", "world", "story", "adventure"]]
];

const titleStopWords = new Set([
  "game",
  "where",
  "with",
  "that",
  "this",
  "about",
  "players",
  "player",
  "youtube",
  "style",
  "small",
  "test",
  "mode",
  "platform"
]);

export function normalizeCreateProjectInput(raw: CreateProjectInput): CreateProjectInput {
  const parsed = createProjectInputSchema.parse({
    ...raw,
    targetPlatforms: raw.targetPlatforms.map((platform) => platform.trim()).filter(Boolean)
  });

  return {
    prompt: parsed.prompt.trim(),
    targetPlatforms: [...new Set(parsed.targetPlatforms)],
    enginePreference: parsed.enginePreference?.trim() || "Engine-neutral first",
    genre: parsed.genre?.trim() || inferGenre(parsed.prompt),
    targetAudience: parsed.targetAudience?.trim() || inferAudience(parsed.prompt)
  };
}

export function inferGenre(prompt: string): string {
  const lowerPrompt = prompt.toLowerCase();
  const match = genreSignals.find(([, signals]) => signals.some((signal) => lowerPrompt.includes(signal)));
  return match?.[0] ?? "Arcade Prototype";
}

export function inferAudience(prompt: string): string {
  const lowerPrompt = prompt.toLowerCase();

  if (lowerPrompt.includes("youtube") || lowerPrompt.includes("creator") || lowerPrompt.includes("stream")) {
    return "creator and YouTube playtest audience";
  }

  if (lowerPrompt.includes("kid") || lowerPrompt.includes("family")) {
    return "family-friendly players";
  }

  if (lowerPrompt.includes("hardcore") || lowerPrompt.includes("esports")) {
    return "competitive players";
  }

  return "game enthusiasts and prototype testers";
}

export function inferProjectName(prompt: string, genre: string): string {
  const explicitName = prompt.match(/(?:called|named|title(?:d)?|as)\s+["']?([A-Z][A-Za-z0-9 :'-]{2,40})["']?/);
  if (explicitName?.[1]) {
    return cleanTitle(explicitName[1].replace(/\b(where|with|that|for|about)\b.*$/i, ""));
  }

  const words = prompt
    .replace(/[^a-zA-Z0-9 ]/g, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 3 && !titleStopWords.has(word.toLowerCase()));

  const signatureWords = [...new Set(words)].slice(0, 2);
  if (signatureWords.length > 0) {
    return cleanTitle(signatureWords.map(capitalize).join(" "));
  }

  return `${genre} Studio Test`;
}

export function createGameBrief(project: GameProject): GameBrief {
  const prompt = project.prompt.toLowerCase();
  const creatorFocused = prompt.includes("youtube") || prompt.includes("creator") || prompt.includes("stream");
  const combatFocused = prompt.includes("war") || prompt.includes("combat") || prompt.includes("missile");
  const platformPhrase = project.targetPlatforms.join(", ");

  return {
    projectId: project.id,
    summary: `${project.name} is a ${project.genre.toLowerCase()} concept for ${project.targetAudience}, planned for ${platformPhrase}.`,
    fantasy: creatorFocused
      ? "Players feel like they are inside a high-pressure creator challenge built for readable clips, clutch attempts, and fast retakes."
      : "Players feel immediate purpose, readable pressure, and a clear reason to try one more run.",
    pillars: [
      creatorFocused ? "Every run should produce a moment worth replaying." : "The first minute proves the fantasy quickly.",
      combatFocused ? "Threats must be readable before they are dangerous." : "Challenge must feel fair before it feels difficult.",
      "Controls need to feel trustworthy within the first attempt.",
      "The prototype should expose production risks early instead of hiding them."
    ],
    coreLoop: [
      "Enter a short, legible challenge.",
      "Make one meaningful decision every few seconds.",
      "See immediate feedback through score, motion, sound, or state change.",
      "Reach a clear result screen with a sharper next goal.",
      "Repeat with stronger mastery or a new scenario seed."
    ],
    references: [
      "Run the Strait production doctrine: staged QA, director gates, asset promotion, serialized heavy builds.",
      creatorFocused ? "YouTube challenge readability and highlight-friendly session length." : "Arcade-first prototype pacing.",
      "Engine-neutral project structure until a build lane is selected."
    ],
    risks: [
      "The concept becomes too broad before the first playable slice exists.",
      "Generated assets look exciting but do not serve gameplay readability.",
      "Platform planning drifts into publishing before a test build proves the loop.",
      "Agents produce impressive documents without a hard acceptance gate."
    ],
    createdAt: new Date().toISOString()
  };
}

export function makeProjectFromInput(id: string, input: CreateProjectInput, now = new Date().toISOString()): GameProject {
  const normalized = normalizeCreateProjectInput(input);
  const genre = normalized.genre ?? inferGenre(normalized.prompt);
  const status: ProjectStatus = "swarm-ready";

  return {
    id,
    name: inferProjectName(normalized.prompt, genre),
    prompt: normalized.prompt,
    genre,
    targetAudience: normalized.targetAudience ?? inferAudience(normalized.prompt),
    targetPlatforms: normalized.targetPlatforms,
    enginePreference: normalized.enginePreference ?? "Engine-neutral first",
    status,
    createdAt: now,
    updatedAt: now
  };
}

function cleanTitle(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/[.?!].*$/, "")
    .trim()
    .split(" ")
    .slice(0, 5)
    .map(capitalize)
    .join(" ");
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}
