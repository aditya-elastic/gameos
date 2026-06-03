export type StarterIdea = {
  id: string;
  title: string;
  prompt: string;
  expectedTier: "NEEDS_IMPROVEMENT" | "LOCAL_PROTOTYPE_READY" | "CREATOR_TEST_READY";
  nextCommand: string;
};

export const starterIdeas: StarterIdea[] = [
  {
    id: "arcade-survival",
    title: "One-button arcade survival",
    prompt: "A one-button arcade survival game where players dodge readable hazards, collect score shards, build streaks, and retry instantly.",
    expectedTier: "NEEDS_IMPROVEMENT",
    nextCommand: "gameos qa web <project-id>"
  },
  {
    id: "physics-timing",
    title: "Physics timing puzzle",
    prompt: "A physics timing puzzle where a hero object swings, collides, misses, resets, and reaches a readable goal through skillful input.",
    expectedTier: "NEEDS_IMPROVEMENT",
    nextCommand: "gameos make --prompt \"...\" --target web-playable --assets ./assets.zip --quality standard --yes"
  },
  {
    id: "turn-strategy",
    title: "Turn-based strategy",
    prompt: "A turn-based strategy game with deterministic legal moves, territory pressure, captures, safe positions, and local pass-and-play.",
    expectedTier: "NEEDS_IMPROVEMENT",
    nextCommand: "gameos qa web <project-id>"
  },
  {
    id: "platform-challenge",
    title: "Platform movement challenge",
    prompt: "A compact platform movement challenge with jumps, collisions, hazards, checkpoints, readable momentum, and fast retry.",
    expectedTier: "NEEDS_IMPROVEMENT",
    nextCommand: "gameos qa web <project-id>"
  },
  {
    id: "combat-survival",
    title: "Combat survival arena",
    prompt: "A small combat survival arena where players kite threats, attack, dodge, manage health, score survival time, and retry.",
    expectedTier: "NEEDS_IMPROVEMENT",
    nextCommand: "gameos qa web <project-id>"
  },
  {
    id: "narrative-puzzle",
    title: "Narrative puzzle",
    prompt: "A narrative choice puzzle where players inspect clues, make meaningful choices, remember consequences, solve a compact mystery, and retry.",
    expectedTier: "NEEDS_IMPROVEMENT",
    nextCommand: "gameos qa web <project-id>"
  }
];

export function renderExamplesText(): string {
  return [
    "Game OS starter ideas",
    "=====================",
    "",
    ...starterIdeas.slice(0, 5).flatMap((idea, index) => [
      `${index + 1}. ${idea.title}`,
      `Prompt: ${idea.prompt}`,
      `Expected first verdict: ${friendlyTier(idea.expectedTier)}`,
      `Next: ${idea.nextCommand}`,
      ""
    ])
  ].join("\n").trimEnd();
}

export function examplesPayload(): Record<string, unknown> {
  return {
    examples: starterIdeas.slice(0, 5).map((idea) => ({
      title: idea.title,
      prompt: idea.prompt,
      expectedTier: idea.expectedTier,
      expectedTierLabel: friendlyTier(idea.expectedTier),
      nextCommand: idea.nextCommand
    }))
  };
}

export function friendlyTier(tier: string): string {
  if (tier === "CREATOR_TEST_READY") return "Creator-test ready";
  if (tier === "LOCAL_PROTOTYPE_READY") return "Local prototype ready";
  if (tier === "NEEDS_IMPROVEMENT") return "Needs improvement";
  if (tier === "BLOCKED") return "Blocked";
  return tier;
}
