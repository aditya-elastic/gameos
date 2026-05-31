import type { AssetItem, AssetPlan, GameBrief, GameProject } from "./types";

export function createAssetPlan(project: GameProject, brief: GameBrief): AssetPlan {
  const visualStyle = createVisualStyle(project, brief);

  return {
    projectId: project.id,
    visualStyle,
    items: [
      {
        name: "Player Avatar / Primary Vehicle",
        purpose: "The first readable identity marker for the player.",
        prompt: `${visualStyle}, hero-controlled object for ${project.name}, clear silhouette, gameplay-readable, neutral background, production concept sheet`,
        source: "ComfyUI or Stable Diffusion with later manual approval",
        status: "needed",
        gate: "Must read clearly at gameplay camera distance before detail pass."
      },
      {
        name: "Core Challenge Set",
        purpose: "Obstacles, enemies, goals, or interactables that prove the loop.",
        prompt: `${visualStyle}, modular gameplay challenge assets, readable shapes, distinct threat categories, no UI text`,
        source: "Generated concepts, then engine-native simplified prefabs",
        status: "needed",
        gate: "No generated asset can own gameplay collision or behavior until adapted."
      },
      {
        name: "Environment Slice",
        purpose: "One compact arena or level segment for the first headed playtest.",
        prompt: `${visualStyle}, compact playable arena, strong path readability, foreground and background separated, test build friendly`,
        source: "Generated mood boards plus engine graybox",
        status: "needed",
        gate: "Environment supports navigation and does not hide the main mechanic."
      },
      {
        name: "Feedback Pack",
        purpose: "Hit, success, failure, score, retry, and mastery feedback.",
        prompt: `${visualStyle}, concise game feedback effects, success burst, danger cue, impact cue, readable at small size`,
        source: "Procedural placeholders first, generated polish after loop approval",
        status: "needed",
        gate: "Feedback must explain state changes without visual spam."
      }
    ],
    createdAt: new Date().toISOString()
  };
}

function createVisualStyle(project: GameProject, brief: GameBrief): string {
  if (project.genre.toLowerCase().includes("war")) {
    return "modern tactical arcade, crisp silhouettes, restrained cinematic combat, high-contrast readable lanes";
  }

  if (project.targetAudience.toLowerCase().includes("youtube")) {
    return "bold creator-challenge arcade, high readability, punchy colors, clip-friendly motion, expressive reactions";
  }

  return `${project.genre.toLowerCase()} arcade prototype, clean silhouettes, readable motion, polished but production-light`;
}
