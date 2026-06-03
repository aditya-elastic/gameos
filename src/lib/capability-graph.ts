import type { GameBrief, GameProject } from "./types";

export type GameCapabilityId =
  | "rules"
  | "physics"
  | "arcade-loop"
  | "platforming"
  | "combat"
  | "economy"
  | "progression"
  | "ai"
  | "camera"
  | "input"
  | "hud"
  | "assets"
  | "qa"
  | "storage"
  | "racing"
  | "survival"
  | "creator-loop"
  | "puzzle"
  | "multiplayer"
  | "narrative"
  | "monetization-readiness"
  | "accessibility"
  | "localization-readiness";

export type GameCapability = {
  id: GameCapabilityId;
  label: string;
  category: "mechanic" | "presentation" | "runtime" | "quality";
  priority: "core" | "supporting" | "watch";
  evidence: string[];
  adapterUse: string;
  qaGate: string;
};

export type CapabilityMap = {
  projectId: string;
  projectName: string;
  primaryArchetype: string;
  selectedCapabilities: GameCapability[];
  regressionFixtures: string[];
  blockedPatterns: string[];
  globalExpansionLens: string[];
  publicLanguagePolicy: string;
  architectureDecision: "UNIVERSAL_CAPABILITY_GRAPH_APPROVED" | "NEEDS_ARCHITECTURE_UPGRADE";
  generatedAt: string;
};

type CapabilityRule = {
  id: GameCapabilityId;
  label: string;
  category: GameCapability["category"];
  signals: string[];
  adapterUse: string;
  qaGate: string;
};

const capabilityRules: CapabilityRule[] = [
  {
    id: "rules",
    label: "Deterministic Rules System",
    category: "mechanic",
    signals: ["board game", "dice", "token", "turn-based", "turn based", "card", "chess"],
    adapterUse: "Generate legal actions, turn state, resolver checks, and replay-safe state transitions.",
    qaGate: "Legal actions, invalid actions, turn order, fairness, and save/resume must be testable."
  },
  {
    id: "physics",
    label: "Readable Physics System",
    category: "mechanic",
    signals: ["physics", "rope", "swing", "gravity", "bounce", "projectile", "ragdoll", "cut"],
    adapterUse: "Generate deterministic force, collision, timing, reset, and trajectory contracts.",
    qaGate: "Physics must prove timing agency, reset safety, collision, miss, and win/fail outcomes."
  },
  {
    id: "arcade-loop",
    label: "Arcade Score Loop",
    category: "mechanic",
    signals: ["arcade", "score", "streak", "dodge", "collect", "runner", "one-button", "high score", "quick"],
    adapterUse: "Generate fast input, hazard, collectible, score, streak, retry, and difficulty-ramp systems.",
    qaGate: "First run, restart, score gain, hazard failure, and second-run improvement must be visible."
  },
  {
    id: "platforming",
    label: "Platforming Movement",
    category: "mechanic",
    signals: ["platformer", "jump", "double jump", "enemy", "ledge", "side-scroller", "scroll"],
    adapterUse: "Generate movement, jump arcs, collision layers, camera follow, and level slices.",
    qaGate: "Jump, land, collide, fail, checkpoint, and retry behavior must be proven."
  },
  {
    id: "combat",
    label: "Combat Interaction",
    category: "mechanic",
    signals: ["war", "combat", "missile", "battle", "shoot", "shooter", "weapon", "enemy", "boss"],
    adapterUse: "Generate threat readability, projectiles, hit rules, cooldowns, health, and encounter loops.",
    qaGate: "Threat telegraph, hit/miss, damage, defeat, and survival clarity must be tested."
  },
  {
    id: "economy",
    label: "Resource Economy",
    category: "mechanic",
    signals: ["resource", "upgrade", "shop", "currency", "craft", "build", "management", "idle"],
    adapterUse: "Generate resources, spend/earn loops, upgrade constraints, and economy state.",
    qaGate: "Earn, spend, upgrade, invalid spend, and balance watch checks must be recorded."
  },
  {
    id: "progression",
    label: "Progression System",
    category: "runtime",
    signals: ["level", "unlock", "mission", "campaign", "progress", "quest", "rank"],
    adapterUse: "Generate session goals, unlock state, difficulty pacing, and next-goal affordances.",
    qaGate: "Completion, unlock, persistence, and next-goal readability must be checked."
  },
  {
    id: "ai",
    label: "AI Opponent Or Director",
    category: "runtime",
    signals: ["bot", "ai", "opponent", "enemy", "npc", "director"],
    adapterUse: "Generate simple deterministic agents, opponent choices, and reproducible simulations.",
    qaGate: "AI must use the same rules as humans and avoid impossible or cheating actions."
  },
  {
    id: "racing",
    label: "Racing Motion System",
    category: "mechanic",
    signals: ["race", "racing", "speed", "drift", "car", "bike", "track"],
    adapterUse: "Generate steering, speed, track boundaries, lap/checkpoint, and readable motion feedback.",
    qaGate: "Acceleration, steering, collision, checkpoint, and retry behavior must be proven."
  },
  {
    id: "survival",
    label: "Survival Pressure System",
    category: "mechanic",
    signals: ["survival", "survive", "horde", "escape", "danger", "rogue"],
    adapterUse: "Generate escalating pressure, health/fail state, resource tension, and run reset.",
    qaGate: "Pressure ramp, failure readability, recovery, and replay motivation must be checked."
  },
  {
    id: "creator-loop",
    label: "Creator Challenge Loop",
    category: "presentation",
    signals: ["youtube", "creator", "stream", "shorts", "viral", "clip"],
    adapterUse: "Generate short sessions, readable fail states, highlight moments, and fast retries.",
    qaGate: "A viewer must understand the run outcome without debug text."
  },
  {
    id: "puzzle",
    label: "Puzzle Logic System",
    category: "mechanic",
    signals: ["puzzle", "logic", "match", "solve", "tile", "strategy", "tactics"],
    adapterUse: "Generate puzzle state, legal moves, success/fail, hints, and deterministic level seeds.",
    qaGate: "Valid solution, invalid action, reset, and readable objective must be proven."
  },
  {
    id: "multiplayer",
    label: "Multiplayer Session System",
    category: "runtime",
    signals: ["multiplayer", "co-op", "coop", "versus", "pvp", "party", "local players", "online"],
    adapterUse: "Generate player identity, turn/session ownership, local-first modes, and deferred online readiness notes.",
    qaGate: "Player ownership, pass-and-play or local session flow, invalid cross-player actions, and future online limits must be clear."
  },
  {
    id: "narrative",
    label: "Narrative Context System",
    category: "presentation",
    signals: ["story", "narrative", "dialogue", "character arc", "world", "lore", "quest"],
    adapterUse: "Generate concise premise, character stakes, objective framing, and non-blocking story feedback.",
    qaGate: "Story text must clarify play goals without hiding controls, threats, or feedback."
  },
  {
    id: "monetization-readiness",
    label: "Monetization Readiness",
    category: "quality",
    signals: ["monetize", "ads", "iap", "shop", "battle pass", "premium", "subscription"],
    adapterUse: "Record monetization assumptions, fairness risks, offline fallback, and explicit V1 non-store boundaries.",
    qaGate: "Prototype cannot imply real purchases, accounts, ads, or store automation without explicit future-lane gates."
  }
];

const universalCapabilities: CapabilityRule[] = [
  {
    id: "input",
    label: "Input Contract",
    category: "runtime",
    signals: [],
    adapterUse: "Generate keyboard, pointer, touch, debounce, reset, and accessibility-aware input paths.",
    qaGate: "Primary action, restart, invalid action, and repeated input must be reliable."
  },
  {
    id: "hud",
    label: "HUD And Feedback",
    category: "presentation",
    signals: [],
    adapterUse: "Generate compact score/state/goal feedback without scattered instructional text.",
    qaGate: "Goal, current state, fail/retry, score, and GameOS watermark must be visible."
  },
  {
    id: "camera",
    label: "Camera And Composition",
    category: "presentation",
    signals: [],
    adapterUse: "Generate one focused play surface with responsive framing and readable actors.",
    qaGate: "Screenshot maturity, no overlap, and target actor readability must pass."
  },
  {
    id: "assets",
    label: "Asset Role Pipeline",
    category: "runtime",
    signals: [],
    adapterUse: "Map imported assets to gameplay roles before adapters use them.",
    qaGate: "Wrong-role assets must block asset-fit promotion."
  },
  {
    id: "qa",
    label: "QA And Player Agent",
    category: "quality",
    signals: [],
    adapterUse: "Generate static, browser, player-agent, and review evidence.",
    qaGate: "WORTH_PLAYING requires visible evidence, not render success alone."
  },
  {
    id: "storage",
    label: "Local Memory And Storage",
    category: "runtime",
    signals: [],
    adapterUse: "Store project memory, artifacts, save/resume state, and feedback locally.",
    qaGate: "Artifacts and save state must be local, inspectable, and recoverable."
  },
  {
    id: "accessibility",
    label: "Accessibility Baseline",
    category: "quality",
    signals: [],
    adapterUse: "Generate readable contrast, keyboard/pointer parity, restart access, and reduced-instruction interaction patterns.",
    qaGate: "Primary action, restart, goal, feedback, and watermark must remain usable without fragile precision or clutter."
  },
  {
    id: "localization-readiness",
    label: "Localization Readiness",
    category: "quality",
    signals: [],
    adapterUse: "Keep visible text compact, separated from game logic, and ready for later translation.",
    qaGate: "Generated UI should avoid text overflow, hardcoded instructional walls, and language-dependent game logic."
  }
];

export function createCapabilityMap(project: GameProject, brief?: GameBrief, now = new Date().toISOString()): CapabilityMap {
  const haystack = `${project.prompt} ${project.genre} ${project.targetAudience} ${brief?.summary ?? ""} ${brief?.fantasy ?? ""}`.toLowerCase();
  const matched = capabilityRules
    .map((rule) => ({ rule, evidence: matchingSignals(haystack, rule.signals) }))
    .filter((entry) => entry.evidence.length > 0);
  if (hasPrivateTurnRulesTerm(haystack) && !matched.some((entry) => entry.rule.id === "rules")) {
    matched.push({ rule: capabilityRules.find((rule) => rule.id === "rules")!, evidence: ["private turn-rules fixture term"] });
  }
  const selected = [...matched.map((entry) => toCapability(entry.rule, entry.evidence, "core" as const)), ...universalCapabilities.map((rule) => toCapability(rule, [], "supporting" as const))];
  const hasCore = selected.some((capability) => capability.priority === "core");
  const capabilities = hasCore ? selected : [toCapability(capabilityRules.find((rule) => rule.id === "arcade-loop")!, ["default fast-playable loop"], "core"), ...selected];
  const regressionFixtures = detectRegressionFixtures(haystack);
  const blockedPatterns = detectBlockedPatterns(project, capabilities, regressionFixtures);

  return {
    projectId: project.id,
    projectName: project.name,
    primaryArchetype: primaryArchetypeFor(capabilities),
    selectedCapabilities: dedupeCapabilities(capabilities),
    regressionFixtures,
    blockedPatterns,
    globalExpansionLens: [
      "Creators need one-command playable proof with no command memorization.",
      "Indie studios need reusable capability systems that compound across many game genres.",
      "Education, agencies, and publishers need clear local privacy, inspectable artifacts, and repeatable QA.",
      "AI coding environments need concise CLI outputs, file-backed evidence, and no hidden service dependency.",
      "Global adoption depends on universal language, strong defaults, genre breadth, localization readiness, and trust.",
      "Every package change must strengthen the product category, not only one generated example."
    ],
    publicLanguagePolicy: "Public Game OS surfaces must describe capability families, platform outcomes, QA gates, creator value, and global developer trust. Historical example names stay inside non-shipped regression fixtures unless the creator explicitly typed them.",
    architectureDecision: blockedPatterns.length === 0 ? "UNIVERSAL_CAPABILITY_GRAPH_APPROVED" : "NEEDS_ARCHITECTURE_UPGRADE",
    generatedAt: now
  };
}

export function hasCapability(map: CapabilityMap, id: GameCapabilityId): boolean {
  return map.selectedCapabilities.some((capability) => capability.id === id);
}

export function renderCapabilityMapMarkdown(map: CapabilityMap): string {
  return [
    `# ${map.projectName} Capability Map`,
    "",
    `Primary archetype: ${map.primaryArchetype}`,
    `Architecture decision: ${map.architectureDecision}`,
    "",
    "## Selected Capabilities",
    ...map.selectedCapabilities.map((capability) => [
      `### ${capability.label}`,
      `- Id: ${capability.id}`,
      `- Category: ${capability.category}`,
      `- Priority: ${capability.priority}`,
      `- Evidence: ${capability.evidence.join(", ") || "universal OS requirement"}`,
      `- Adapter use: ${capability.adapterUse}`,
      `- QA gate: ${capability.qaGate}`
    ].join("\n")),
    "",
    "## Regression Fixtures",
    ...(map.regressionFixtures.length
      ? map.regressionFixtures.map((fixture) => `- ${fixture}`)
      : ["- none; this project should be generated from reusable capabilities."]),
    "",
    "## Global Market Vision",
    ...map.globalExpansionLens.map((item) => `- ${item}`),
    "",
    "## Universal Product Direction",
    "- Game OS is positioned as a local AI game studio runtime for many genres, teams, markets, and AI coding environments.",
    "- Builds, adapters, and agents must consume reusable capabilities instead of becoming product strategy.",
    "",
    "## Public Language Policy",
    map.publicLanguagePolicy,
    "",
    "## Blocked Patterns",
    ...(map.blockedPatterns.length ? map.blockedPatterns.map((pattern) => `- ${pattern}`) : ["- none"])
  ].join("\n");
}

export function renderOsDesignReviewMarkdown(project: GameProject, brief: GameBrief, map: CapabilityMap): string {
  return [
    `# ${project.name} Global OS Design Review`,
    "",
    "## Global Market Vision",
    "Game OS must improve as a universal local AI game studio runtime and globally expandable developer platform. Private regression fixtures may prove quality, but public product language must stay broad, premium, trusted, and capability-led.",
    "",
    "## Decision",
    `- ${map.architectureDecision}`,
    "",
    "## Why This Fits",
    `- Prompt intent: ${project.prompt}`,
    `- Game fantasy: ${brief.fantasy}`,
    `- Primary archetype: ${map.primaryArchetype}`,
    `- Core capabilities: ${map.selectedCapabilities.filter((capability) => capability.priority === "core").map((capability) => capability.label).join(", ")}`,
    "",
    "## Universal Product Direction",
    "- Own the product category before any specialist narrows the project.",
    "- Keep creator UX, AI coding workflows, local privacy, QA proof, package trust, and adapter expansion in one coherent direction.",
    "- Treat every game output as market learning for a reusable platform capability.",
    "",
    "## Business Expansion Lens",
    ...map.globalExpansionLens.map((item) => `- ${item}`),
    "",
    "## Capability-First Architecture Verdict",
    `- ${map.architectureDecision}`,
    "",
    "## Public Language Approval",
    `- ${map.publicLanguagePolicy}`,
    "",
    "## Direction Guardrails",
    "- Do not let a named test game define the product category.",
    "- Keep public docs, CLI outputs, and generated artifacts universal unless the user explicitly names a game.",
    "- Extract reusable mechanics, input, camera, HUD, asset, storage, and QA systems from every demo.",
    "- Web, Godot, and Unity adapters must consume capability maps rather than product strategy.",
    "- A polished example is useful only when it makes the next different game and the next customer segment easier to serve.",
    "",
    "## Global OS Designer Verdict",
    map.blockedPatterns.length === 0
      ? "Approved for capability-driven generation."
      : "Blocked until narrow routing is replaced with reusable capability handling."
  ].join("\n");
}

export function renderArchitectureRiskReportMarkdown(project: GameProject, map: CapabilityMap): string {
  const exampleRisk = map.regressionFixtures.length
    ? "This prompt matches a private regression fixture. Keep the fixture for compatibility, but do not let it define OS architecture or public product language."
    : "No private regression fixture matched; adapters should use reusable capabilities.";

  return [
    `# ${project.name} Architecture Risk Report`,
    "",
    "## Main Risk",
    exampleRisk,
    "",
    "## Blockers",
    ...(map.blockedPatterns.length ? map.blockedPatterns.map((pattern) => `- ${pattern}`) : ["- none"]),
    "",
    "## Required Architecture Behavior",
    "- Intake produces a capability map before adapters run.",
    "- Agents reason about selected capabilities, not only the game title.",
    "- Review fails if OS design evidence or capability mapping is missing.",
    "- Do not add a one-off named game lane unless it is private QA evidence.",
    "- Public docs, CLI examples, and generated OS artifacts must sell the global product category, not a historical fixture.",
    "- New game examples must add reusable systems or stay as private regression fixtures.",
    "",
    "## Watch Items",
    ...map.selectedCapabilities
      .filter((capability) => capability.priority === "core")
      .map((capability) => `- ${capability.label}: ${capability.qaGate}`)
  ].join("\n");
}

export function renderUpgradeDoctrineMarkdown(project: GameProject, map: CapabilityMap): string {
  return [
    `# ${project.name} Upgrade Doctrine`,
    "",
    "## Package Learning Rule",
    "Every failed game test must upgrade a reusable Game OS capability, QA gate, creator journey, or platform positioning. It must not only patch the single generated game.",
    "",
    "## Current Reusable Targets",
    ...map.selectedCapabilities.map((capability) => `- ${capability.label}: ${capability.adapterUse}`),
    "",
    "## Feedback Routing",
    "- Visual complaints route to Visual Quality Director and Camera/HUD capabilities.",
    "- Physics/input complaints route to Physics Gameplay Engineer and Input Contract.",
    "- Asset complaints route to Asset Pipeline Director and Asset Role Pipeline.",
    "- Fun/replay complaints route to Advanced Player, Game Feel Director, and the core mechanic capability.",
    "- Architecture, public-language, or market-positioning complaints route to Global OS Designer before another adapter lane is added.",
    "",
    "## No-Blunder Rule",
    "Do not call an example game a platform capability. The platform capability is the reusable system extracted from it, packaged in language that can scale globally across creators, studios, education, agencies, publishers, and AI coding environments."
  ].join("\n");
}

function matchingSignals(haystack: string, signals: string[]): string[] {
  return signals.filter((signal) => haystack.includes(signal));
}

function toCapability(rule: CapabilityRule, evidence: string[], priority: GameCapability["priority"]): GameCapability {
  return {
    id: rule.id,
    label: rule.label,
    category: rule.category,
    priority,
    evidence,
    adapterUse: rule.adapterUse,
    qaGate: rule.qaGate
  };
}

function dedupeCapabilities(capabilities: GameCapability[]): GameCapability[] {
  const seen = new Set<GameCapabilityId>();
  return capabilities.filter((capability) => {
    if (seen.has(capability.id)) return false;
    seen.add(capability.id);
    return true;
  });
}

function primaryArchetypeFor(capabilities: GameCapability[]): string {
  const core = capabilities.filter((capability) => capability.priority === "core");
  if (core.some((capability) => capability.id === "physics")) return "Physics-led game";
  if (core.some((capability) => capability.id === "rules")) return "Rules-led game";
  if (core.some((capability) => capability.id === "platforming")) return "Platforming action game";
  if (core.some((capability) => capability.id === "combat")) return "Combat action game";
  if (core.some((capability) => capability.id === "racing")) return "Racing action game";
  if (core.some((capability) => capability.id === "survival")) return "Survival run game";
  if (core.some((capability) => capability.id === "puzzle")) return "Puzzle strategy game";
  return "Arcade score-loop game";
}

function detectRegressionFixtures(haystack: string): string[] {
  const fixtures: string[] = [];
  if (hasHiddenTerm(haystack, "bHVkbw==") || hasHiddenTerm(haystack, "cGFjaGlzaQ==")) fixtures.push("turn-rules-regression-fixture");
  if ((haystack.includes("cut") && haystack.includes("rope")) || hasHiddenTerm(haystack, "Y2FuZHk=")) fixtures.push("asset-physics-regression-fixture");
  return fixtures;
}

function detectBlockedPatterns(project: GameProject, capabilities: GameCapability[], regressionFixtures: string[]): string[] {
  const blockers: string[] = [];
  const prompt = project.prompt.toLowerCase();
  const mentionsNamedFixture = hasPrivateTurnRulesTerm(prompt) || hasHiddenTerm(prompt, "Y3V0IHRoZSByb3Bl") || hasHiddenTerm(prompt, "Y3V0LXJvcGU=");
  const hasCoreCapability = capabilities.some((capability) => capability.priority === "core");

  if (mentionsNamedFixture && regressionFixtures.length === 0) {
    blockers.push("Named example detected without a registered regression fixture.");
  }

  if (!hasCoreCapability) {
    blockers.push("No core gameplay capability selected; generation would drift into a generic demo.");
  }

  if (prompt.includes("clone") && !prompt.includes("style")) {
    blockers.push("Prompt asks for a clone instead of a capability-driven original or style-safe interpretation.");
  }

  return blockers;
}

function hasHiddenTerm(haystack: string, encoded: string): boolean {
  return haystack.includes(Buffer.from(encoded, "base64").toString("utf8"));
}

function hasPrivateTurnRulesTerm(haystack: string): boolean {
  return hasHiddenTerm(haystack, "bHVkbw==") || hasHiddenTerm(haystack, "cGFjaGlzaQ==");
}
