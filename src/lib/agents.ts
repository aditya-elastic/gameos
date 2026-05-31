import { randomUUID } from "node:crypto";
import type { AgentDefinition, AgentRun, AssetPlan, GameBrief, GameProject, PlatformPlan } from "./types";

export function generateAgentRun(
  definition: AgentDefinition,
  project: GameProject,
  brief: GameBrief,
  context: {
    assetPlan?: AssetPlan;
    platformPlans?: PlatformPlan[];
    runNumber?: number;
  } = {}
): AgentRun {
  const runNumber = context.runNumber ?? 1;
  const output = renderAgentOutput(definition, project, brief, context.assetPlan, context.platformPlans, runNumber);
  const blockers = inferBlockers(definition.role, project, context.platformPlans);

  return {
    id: randomUUID(),
    projectId: project.id,
    role: definition.role,
    title: definition.title,
    input: project.prompt,
    output,
    status: blockers.length > 2 ? "blocked" : "complete",
    artifacts: [],
    confidence: confidenceFor(definition.role, blockers.length),
    blockers,
    runNumber,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

export function deriveStyleSkills(project: GameProject): string[] {
  const prompt = project.prompt.toLowerCase();
  const skills = ["single-prompt expansion", "production artifact writing", "acceptance gate design"];

  if (prompt.includes("youtube") || prompt.includes("creator") || prompt.includes("stream")) {
    skills.push("creator-retention design", "spectator readability", "clip-friendly pacing");
  }

  if (prompt.includes("war") || prompt.includes("combat") || prompt.includes("missile")) {
    skills.push("threat readability", "combat pressure tuning", "tactical visual hierarchy");
  }

  if (project.targetPlatforms.some((platform) => platform.toLowerCase().includes("steam"))) {
    skills.push("steam test readiness");
  }

  if (project.enginePreference.toLowerCase().includes("neutral")) {
    skills.push("engine-neutral adapter planning");
  }

  return [...new Set(skills)];
}

export function composeStudioPlan(input: {
  project: GameProject;
  brief: GameBrief;
  agents: AgentRun[];
  assetPlan: AssetPlan;
  platformPlans: PlatformPlan[];
}): string {
  const { project, brief, agents, assetPlan, platformPlans } = input;
  const targetedPlatforms = platformPlans.filter((plan) => plan.status === "targeted").map((plan) => plan.platform);
  const watchPlatforms = platformPlans.filter((plan) => plan.status === "planned").map((plan) => plan.platform);

  return [
    `# ${project.name} Studio Execution Plan`,
    "",
    "## Director Summary",
    brief.summary,
    "",
    "## First Playable Slice",
    "- Build one compact session that proves the fantasy before expanding content.",
    "- Use placeholder assets until the core loop and camera readability pass.",
    "- Treat Steam as test readiness only; do not add publishing automation in V1.",
    "",
    "## Agent Merge",
    ...agents.map((agent) => `- ${agent.title}: ${agent.status.toUpperCase()} at ${Math.round(agent.confidence * 100)}% confidence.`),
    "",
    "## Asset Direction",
    `Visual style: ${assetPlan.visualStyle}.`,
    ...assetPlan.items.map((item) => `- ${item.name}: ${item.gate}`),
    "",
    "## Platform Direction",
    `Target now: ${targetedPlatforms.join(", ") || "engine-neutral prototype planning"}.`,
    `Prepare next: ${watchPlatforms.join(", ") || "none"}.`,
    "",
    "## Next Actions",
    "- Convert this plan into an engine adapter only after the brief, asset plan, and QA gates are accepted.",
    "- Generate the smallest playable prototype before adding platform-specific release work.",
    "- Record every build, playtest, screenshot, and agent decision as a project artifact."
  ].join("\n");
}

function renderAgentOutput(
  definition: AgentDefinition,
  project: GameProject,
  brief: GameBrief,
  assetPlan?: AssetPlan,
  platformPlans?: PlatformPlan[],
  runNumber = 1
): string {
  const relevantSkills = deriveStyleSkills(project);
  const platforms = platformPlans?.filter((plan) => plan.status === "targeted").map((plan) => plan.platform) ?? project.targetPlatforms;

  const commonHeader = [
    `# ${definition.title}`,
    "",
    `Run: #${runNumber}`,
    `Mission: ${definition.mission}`,
    `Project: ${project.name}`,
    `Relevant skills: ${[...definition.skills, ...relevantSkills].join(", ")}`,
    ""
  ].join("\n");

  if (definition.role === "studio-director") {
    return `${commonHeader}${[
      "## Verdict",
      `${project.name} should stay engine-neutral until the first playable slice is precisely defined.`,
      "",
      "## Creative Thesis",
      brief.fantasy,
      "",
      "## Scope Lock",
      "- One prototype loop.",
      "- One camera and control scheme.",
      "- One asset language.",
      "- One headed playtest gate before Unity, Godot, or Steam-specific work.",
      "",
      "## Go / No-Go",
      "GO for studio planning. NO-GO for publishing automation."
    ].join("\n")}`;
  }

  if (definition.role === "game-designer") {
    return `${commonHeader}${[
      "## Mechanics",
      ...brief.coreLoop.map((step) => `- ${step}`),
      "",
      "## Player Motivation",
      "- Make the first attempt understandable.",
      "- Make the second attempt feel smarter.",
      "- Make the best attempt worth showing.",
      "",
      "## Prototype Rule",
      "Do not add extra modes until the retry loop proves a measurable skill gain."
    ].join("\n")}`;
  }

  if (definition.role === "technical-architect") {
    return `${commonHeader}${[
      "## Architecture",
      "- Keep the Game OS project model separate from engine adapters.",
      "- Generate engine-specific files only from approved artifacts.",
      "- Store agent outputs, QA evidence, and asset prompts outside engine folders.",
      "",
      "## Data Flow",
      "Prompt -> Brief -> Agent Swarm -> Studio Plan -> Adapter Plan -> Prototype Build -> QA Evidence.",
      "",
      "## Runtime Risks",
      ...brief.risks.map((risk) => `- ${risk}`)
    ].join("\n")}`;
  }

  if (definition.role === "art-director") {
    return `${commonHeader}${[
      "## Visual Direction",
      assetPlan?.visualStyle ?? "Readable arcade prototype style.",
      "",
      "## Asset Gates",
      ...(assetPlan?.items.map((item) => `- ${item.name}: ${item.prompt}`) ?? ["- Define player, challenge, environment, and feedback assets."]),
      "",
      "## Promotion Rule",
      "Generated assets are references until they pass gameplay-camera readability and adapter cleanup."
    ].join("\n")}`;
  }

  if (definition.role === "advanced-player") {
    return `${commonHeader}${[
      "## Stress Test",
      "- Can a skilled player express mastery in under 60 seconds?",
      "- Can a viewer understand why a run failed without reading debug text?",
      "- Is there a meaningful risk-reward choice in every short session?",
      "",
      "## Retention Bet",
      project.targetAudience.toLowerCase().includes("youtube")
        ? "Creator playtests need a fast reset, a visible fail state, and one highlight moment per session."
        : "Prototype testers need a sharper next goal after every result."
    ].join("\n")}`;
  }

  if (definition.role === "qa-director") {
    return `${commonHeader}${[
      "## QA Gates",
      "- Static artifact completeness check.",
      "- First 60-second headed playtest.",
      "- Retry loop verification.",
      "- Asset readability screenshot review.",
      "- Platform-specific smoke test only after an adapter exists.",
      "",
      "## Evidence",
      "Every gate must produce a report, screenshots where visual feel matters, and a director verdict."
    ].join("\n")}`;
  }

  if (definition.role === "platform-producer") {
    return `${commonHeader}${[
      "## Platform Map",
      `Target platforms: ${platforms.join(", ") || "engine-neutral planning"}.`,
      "",
      "## V1 Boundary",
      "- Steam is readiness tracking only.",
      "- Unity and Godot are adapter lanes, not assumptions.",
      "- Mobile and console require separate compliance gates.",
      "",
      "## Producer Call",
      "Do not let store work start before the game loop has a headed PASS."
    ].join("\n")}`;
  }

  return `${commonHeader}${[
    "## Build Rule",
    "- Only one heavy engine/build lane may run at a time.",
    "- Record process status before and after every heavy command.",
    "- Keep generated project artifacts separate from local caches and build output.",
    "",
    "## Future Commands",
    "Unity, Godot, Xcode, SteamCMD, and headed QA commands must be serialized behind this role."
  ].join("\n")}`;
}

function inferBlockers(role: string, project: GameProject, platformPlans?: PlatformPlan[]): string[] {
  const blockers: string[] = [];

  if (role === "platform-producer" && platformPlans?.some((plan) => plan.platform === "Console" && plan.status === "blocked")) {
    blockers.push("Console platform access is not available in V1.");
  }

  if (role === "build-sentinel" && !project.enginePreference.toLowerCase().includes("unity") && !project.enginePreference.toLowerCase().includes("godot")) {
    blockers.push("No heavy engine lane is selected yet, so build serialization remains a future gate.");
  }

  return blockers;
}

function confidenceFor(role: string, blockerCount: number): number {
  const base = role === "build-sentinel" ? 0.76 : 0.86;
  return Number(Math.max(0.45, base - blockerCount * 0.1).toFixed(2));
}
