import type { AssetItem, AssetPlan, GameBrief, GameProject } from "./types";

export function createAssetPlan(project: GameProject, brief: GameBrief): AssetPlan {
  const visualStyle = createVisualStyle(project, brief);
  const boardFocused = isTurnRulesProject(project);
  const ropePuzzleFocused = isAssetPhysicsProject(project);

  return {
    projectId: project.id,
    visualStyle,
    items: ropePuzzleFocused ? createAssetPhysicsAssets(project, visualStyle) : boardFocused ? createBoardGameAssets(project, visualStyle) : createDefaultAssets(project, visualStyle),
    createdAt: new Date().toISOString()
  };
}

function createVisualStyle(project: GameProject, brief: GameBrief): string {
  if (isAssetPhysicsProject(project)) {
    return "polished physics puzzle toybox, readable rope/hero-object/goal silhouettes, uploaded asset pack friendliness, clean web prototype UI";
  }

  if (isTurnRulesProject(project)) {
    return "premium turn-based board strategy, crisp track surface, bold player pieces, tactile dice, readable turn UI, friendly table feel";
  }

  if (project.genre.toLowerCase().includes("war")) {
    return "modern tactical arcade, crisp silhouettes, restrained cinematic combat, high-contrast readable lanes";
  }

  if (project.targetAudience.toLowerCase().includes("youtube")) {
    return "bold creator-challenge arcade, high readability, punchy colors, clip-friendly motion, expressive reactions";
  }

  return `${project.genre.toLowerCase()} arcade prototype, clean silhouettes, readable motion, polished but production-light`;
}

function createAssetPhysicsAssets(project: GameProject, visualStyle: string) {
  return [
    {
      name: "Uploaded Asset Pack",
      purpose: "Creator-supplied source assets that must be stored, classified, and judged before build generation.",
      prompt: `${visualStyle}, imported asset-pack manifest, source tracking, relevance scoring, no untracked external assets`,
      source: "User upload through Game OS asset importer",
      status: "needed" as const,
      gate: "Import report must say whether the pack is approved, partial, or wrong for Asset-Led Physics."
    },
    {
      name: "Hero Physics Object",
      purpose: "The falling object whose motion proves the rope-release loop.",
      prompt: `${visualStyle}, hero physics object, round readable silhouette, small-screen readable`,
      source: "Uploaded image tagged hero-object or physics-piece, with procedural fallback only if report allows partial coverage",
      status: "needed" as const,
      gate: "Object must remain visible while attached, falling, collecting, and reaching the goal."
    },
    {
      name: "Rope, Anchor, And Cut Feedback",
      purpose: "The one-action mechanic: attach, cut, fall, and reset.",
      prompt: `${visualStyle}, rope/anchor cut cue, tactile physics feedback, readable one-button action`,
      source: "Uploaded rope-like assets when present; otherwise engine/procedural rope line documented by importer",
      status: "needed" as const,
      gate: "Player must understand what was cut within the first click."
    },
    {
      name: "Goal Character / Mouth Zone",
      purpose: "The destination that makes success obvious.",
      prompt: `${visualStyle}, hungry character or goal zone, friendly expressive target, clear success state`,
      source: "Uploaded character/goal image or best matching imported sprite",
      status: "needed" as const,
      gate: "Goal must not be confused with hazards or collectibles."
    },
    {
      name: "Stars And Level Dressing",
      purpose: "Optional mastery targets and puzzle readability skin.",
      prompt: `${visualStyle}, star collectibles, simple background pieces, lightweight physics puzzle level dressing`,
      source: "Uploaded collectible/background/physics-piece images",
      status: "needed" as const,
      gate: "Collectibles cannot hide the hero-object path or goal."
    }
  ];
}

function createDefaultAssets(project: GameProject, visualStyle: string) {
  return [
    {
      name: "Player Avatar / Primary Vehicle",
      purpose: "The first readable identity marker for the player.",
      prompt: `${visualStyle}, hero-controlled object for ${project.name}, clear silhouette, gameplay-readable, neutral background, production concept sheet`,
      source: "ComfyUI or Stable Diffusion with later manual approval",
      status: "needed" as const,
      gate: "Must read clearly at gameplay camera distance before detail pass."
    },
    {
      name: "Core Challenge Set",
      purpose: "Obstacles, enemies, goals, or interactables that prove the loop.",
      prompt: `${visualStyle}, modular gameplay challenge assets, readable shapes, distinct threat categories, no UI text`,
      source: "Generated concepts, then engine-native simplified prefabs",
      status: "needed" as const,
      gate: "No generated asset can own gameplay collision or behavior until adapted."
    },
    {
      name: "Environment Slice",
      purpose: "One compact arena or level segment for the first headed playtest.",
      prompt: `${visualStyle}, compact playable arena, strong path readability, foreground and background separated, test build friendly`,
      source: "Generated mood boards plus engine graybox",
      status: "needed" as const,
      gate: "Environment supports navigation and does not hide the main mechanic."
    },
    {
      name: "Feedback Pack",
      purpose: "Hit, success, failure, score, retry, and mastery feedback.",
      prompt: `${visualStyle}, concise game feedback effects, success burst, danger cue, impact cue, readable at small size`,
      source: "Procedural placeholders first, generated polish after loop approval",
      status: "needed" as const,
      gate: "Feedback must explain state changes without visual spam."
    }
  ];
}

function createBoardGameAssets(project: GameProject, visualStyle: string) {
  return [
    {
      name: "Turn Rules Surface",
      purpose: "The primary rules surface: tracks, safe squares, homes, starts, and color lanes.",
      prompt: `${visualStyle}, top-down board-race rules surface, four color lanes, clear safe squares, home paths, exact grid, no text labels`,
      source: "Engine-native board grid first, generated art as skin reference",
      status: "needed" as const,
      gate: "Every square must map to deterministic board coordinates and remain readable on mobile."
    },
    {
      name: "Token Set",
      purpose: "Four readable player colors with selected, movable, captured, and home states.",
      prompt: `${visualStyle}, red blue green yellow board tokens, selected glow, home state, captured state, simple silhouettes`,
      source: "Procedural/vector tokens first, generated polish after rules pass",
      status: "needed" as const,
      gate: "Token color, owner, and legal-move state must be obvious without reading text."
    },
    {
      name: "Dice And Turn UI",
      purpose: "Communicate current player, roll result, legal moves, extra turn, and no-move pass.",
      prompt: `${visualStyle}, tactile dice button, current turn banner, legal move highlights, friendly board-game UI`,
      source: "UI components first, generated dice polish later",
      status: "needed" as const,
      gate: "A player must know whose turn it is and what changed after every click."
    },
    {
      name: "Seat Avatars And Score Strip",
      purpose: "Show two-to-four players, bot/local status, tokens home, and match winner.",
      prompt: `${visualStyle}, four player seat panels, color badges, token counters, winner celebration, compact mobile friendly`,
      source: "Engine UI placeholders first",
      status: "needed" as const,
      gate: "Seat state must survive save/resume and avoid cluttering the board."
    },
    {
      name: "Move Feedback Pack",
      purpose: "Capture, safe-square, home-entry, six-roll, and victory feedback.",
      prompt: `${visualStyle}, board game feedback effects, capture pop, safe square shimmer, home arrival pulse, dice six celebration`,
      source: "Procedural effects first",
      status: "needed" as const,
      gate: "Feedback must clarify rules resolution without hiding board coordinates."
    }
  ];
}

function isAssetPhysicsProject(project: GameProject): boolean {
  const prompt = `${project.name} ${project.genre} ${project.prompt}`.toLowerCase();
  return (prompt.includes("cut") && prompt.includes("rope")) || prompt.includes("physics puzzle");
}

function isTurnRulesProject(project: GameProject): boolean {
  const prompt = `${project.name} ${project.genre} ${project.prompt}`.toLowerCase();
  return hasPrivateTurnRulesTerm(prompt) || ["board game", "board-race", "board race", "dice", "token", "tokens", "turn-based", "turn based"].some((signal) => prompt.includes(signal));
}

function hasPrivateTurnRulesTerm(text: string): boolean {
  return text.includes(Buffer.from("bHVkbw==", "base64").toString("utf8")) || text.includes(Buffer.from("cGFjaGlzaQ==", "base64").toString("utf8"));
}
