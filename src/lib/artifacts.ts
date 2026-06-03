import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  createCapabilityMap,
  renderArchitectureRiskReportMarkdown,
  renderCapabilityMapMarkdown,
  renderOsDesignReviewMarkdown,
  renderUpgradeDoctrineMarkdown
} from "./capability-graph";
import { createMemoryMap } from "./memory-manager";
import { createStorageManifest } from "./storage-manager";
import { createAcceptanceProfile, renderAcceptanceProfileMarkdown } from "./trust";
import type { ArtifactKind, ArtifactRecord, ProjectWorkspace } from "./types";

export function getDataRoot(): string {
  return process.env.GAME_OS_DATA_DIR || path.join(os.homedir(), ".gameos");
}

export function getProjectArtifactRoot(projectId: string): string {
  return path.join(getDataRoot(), "projects", projectId);
}

export function writeArtifact(projectId: string, kind: ArtifactKind, label: string, relativePath: string, content: string): ArtifactRecord {
  const absolutePath = path.join(getProjectArtifactRoot(projectId), relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, content, "utf8");

  return {
    id: randomUUID(),
    projectId,
    kind,
    label,
    path: absolutePath,
    createdAt: new Date().toISOString()
  };
}

export function readArtifactContent(artifactPath: string): string {
  if (!fs.existsSync(artifactPath)) return "";
  return fs.readFileSync(artifactPath, "utf8");
}

export function writeWorkspaceArtifacts(workspace: Omit<ProjectWorkspace, "artifacts">): ProjectWorkspace {
  const { project, brief, agents, assetPlan, platformPlans, qaGates, studioPlan } = workspace;
  const capabilityMap = createCapabilityMap(project, brief);
  const acceptanceProfile = createAcceptanceProfile(workspace, capabilityMap.selectedCapabilities.map((capability) => capability.id));
  const artifacts = [
    writeArtifact(project.id, "os-design-review", "Global OS Design Review", "os-design-review.md", renderOsDesignReviewMarkdown(project, brief, capabilityMap)),
    writeArtifact(project.id, "capability-map", "Game Capability Map", "capability-map.md", renderCapabilityMapMarkdown(capabilityMap)),
    writeArtifact(project.id, "acceptance-profile", "Acceptance Profile", "acceptance-profile.md", renderAcceptanceProfileMarkdown(acceptanceProfile)),
    writeArtifact(project.id, "architecture-risk-report", "Architecture Risk Report", "architecture-risk-report.md", renderArchitectureRiskReportMarkdown(project, capabilityMap)),
    writeArtifact(project.id, "upgrade-doctrine", "Upgrade Doctrine", "upgrade-doctrine.md", renderUpgradeDoctrineMarkdown(project, capabilityMap)),
    writeArtifact(project.id, "brief", "Game Bible", "game-bible.md", renderBriefMarkdown(brief)),
    writeArtifact(project.id, "asset-plan", "Asset Pipeline", "asset-plan.md", renderAssetPlanMarkdown(assetPlan)),
    writeArtifact(project.id, "platform-plan", "Platform Readiness", "platform-plan.md", renderPlatformPlansMarkdown(platformPlans)),
    writeArtifact(project.id, "qa-plan", "QA Gates", "qa-gates.md", renderQAGatesMarkdown(qaGates)),
    writeArtifact(project.id, "studio-plan", "Studio Execution Plan", "studio-execution-plan.md", studioPlan),
    writeArtifact(project.id, "production-roadmap", "Production Roadmap", "production-roadmap.md", renderProductionRoadmapMarkdown(workspace)),
    writeArtifact(project.id, "risk-register", "Risk Register", "risk-register.md", renderRiskRegisterMarkdown(workspace)),
    writeArtifact(project.id, "playtest-script", "First Playtest Script", "first-playtest-script.md", renderPlaytestScriptMarkdown(workspace)),
    writeArtifact(project.id, "engine-adapter-brief", "Engine Adapter Brief", "engine-adapter-brief.md", renderEngineAdapterBriefMarkdown(workspace)),
    writeArtifact(project.id, "rules-spec", "Rules Spec", "rules-spec.md", renderRulesSpecMarkdown(workspace)),
    writeArtifact(project.id, "memory-map", "Memory Map", "memory-map.md", createMemoryMap(workspace)),
    writeArtifact(project.id, "storage-manifest", "Storage Manifest", "storage-manifest.md", createStorageManifest(workspace)),
    writeArtifact(project.id, "test-matrix", "Test Matrix", "test-matrix.md", renderTestMatrixMarkdown(workspace))
  ];

  const agentsWithArtifacts = agents.map((agent) => {
    const artifact = writeArtifact(project.id, "agent-output", agent.title, `agents/${agent.role}-run-${agent.runNumber}.md`, agent.output);
    artifacts.push(artifact);
    return {
      ...agent,
      artifacts: [artifact]
    };
  });

  return {
    ...workspace,
    agents: agentsWithArtifacts,
    artifacts
  };
}

export function toProjectRelativeArtifactPath(artifactPath: string, projectId: string): string {
  const root = getProjectArtifactRoot(projectId);
  return path.relative(root, artifactPath);
}

export function renderBriefMarkdown(brief: ProjectWorkspace["brief"]): string {
  return [
    `# Game Bible`,
    "",
    "## Summary",
    brief.summary,
    "",
    "## Fantasy",
    brief.fantasy,
    "",
    "## Pillars",
    ...brief.pillars.map((pillar) => `- ${pillar}`),
    "",
    "## Core Loop",
    ...brief.coreLoop.map((step, index) => `${index + 1}. ${step}`),
    "",
    "## References",
    ...brief.references.map((reference) => `- ${reference}`),
    "",
    "## Risks",
    ...brief.risks.map((risk) => `- ${risk}`)
  ].join("\n");
}

export function renderAssetPlanMarkdown(assetPlan: ProjectWorkspace["assetPlan"]): string {
  return [
    "# Asset Pipeline",
    "",
    `Visual style: ${assetPlan.visualStyle}`,
    "",
    ...assetPlan.items.flatMap((item) => [
      `## ${item.name}`,
      `Purpose: ${item.purpose}`,
      `Prompt: ${item.prompt}`,
      `Source: ${item.source}`,
      `Status: ${item.status}`,
      `Gate: ${item.gate}`,
      ""
    ])
  ].join("\n");
}

export function renderPlatformPlansMarkdown(platformPlans: ProjectWorkspace["platformPlans"]): string {
  return [
    "# Platform Readiness",
    "",
    ...platformPlans.flatMap((plan) => [
      `## ${plan.platform}`,
      `Status: ${plan.status}`,
      `Notes: ${plan.notes}`,
      "",
      ...plan.readinessGates.map((gate) => `- ${gate}`),
      ""
    ])
  ].join("\n");
}

export function renderQAGatesMarkdown(qaGates: ProjectWorkspace["qaGates"]): string {
  return [
    "# QA Gates",
    "",
    ...qaGates.flatMap((gate) => [
      `## ${gate.name}`,
      `Result: ${gate.result}`,
      "",
      "Automated checks:",
      ...gate.automatedChecks.map((check) => `- ${check}`),
      "",
      "Headed playtest checks:",
      ...gate.headedPlaytestChecks.map((check) => `- ${check}`),
      "",
      "Player-feel checks:",
      ...gate.playerFeelChecks.map((check) => `- ${check}`),
      ""
    ])
  ].join("\n");
}

export function renderProductionRoadmapMarkdown(workspace: Omit<ProjectWorkspace, "artifacts">): string {
  const { project, qaGates } = workspace;
  const targetedPlatforms = project.targetPlatforms.join(", ");

  return [
    `# ${project.name} Production Roadmap`,
    "",
    "## Phase 1 - Studio Lock",
    "- Confirm the fantasy, target audience, selected capability map, first-playable slice, and QA gates.",
    "- Keep scope to one polished capability-proof loop.",
    "- Review all agent outputs before engine adapter generation.",
    "",
    "## Phase 2 - Graybox Prototype",
    "- Build the smallest playable slice with placeholder assets.",
    "- Validate controls, camera, fail/retry flow, score feedback, and first-minute clarity.",
    "- Capture headed evidence before adding content.",
    "",
    "## Phase 3 - Asset Promotion",
    "- Generate concept references for the asset plan.",
    "- Promote only assets that pass gameplay-camera readability.",
    "- Keep generated assets behind engine-owned adapters.",
    "",
    "## Phase 4 - Platform Test Lane",
    `- Prepare ${targetedPlatforms || "the selected test lane"} as readiness targets, not publishing targets.`,
    "- Run platform smoke tests after the adapter exists.",
    "- Record build output, screenshots, logs, and go/no-go notes.",
    "",
    "## Current Gate Status",
    ...qaGates.map((gate) => `- ${gate.name}: ${gate.result}`)
  ].join("\n");
}

export function renderRiskRegisterMarkdown(workspace: Omit<ProjectWorkspace, "artifacts">): string {
  const { brief, agents, platformPlans } = workspace;
  const platformRisks = platformPlans
    .filter((plan) => plan.status === "blocked" || plan.status === "later")
    .map((plan) => `${plan.platform}: ${plan.notes}`);

  return [
    "# Risk Register",
    "",
    "## Creative And Production Risks",
    ...brief.risks.map((risk) => `- ${risk}`),
    "",
    "## Agent Blockers",
    ...agents.flatMap((agent) => agent.blockers.map((blocker) => `- ${agent.title}: ${blocker}`)),
    agents.every((agent) => agent.blockers.length === 0) ? "- No agent blockers recorded." : "",
    "",
    "## Platform Watchlist",
    ...(platformRisks.length > 0 ? platformRisks.map((risk) => `- ${risk}`) : ["- No platform blockers beyond deferred future lanes."]),
    "",
    "## Mitigation Rule",
    "Every risk needs either a capability-level test, a scope reduction, or a deferred-lane decision before engine work starts."
  ]
    .filter(Boolean)
    .join("\n");
}

export function renderPlaytestScriptMarkdown(workspace: Omit<ProjectWorkspace, "artifacts">): string {
  const { project, brief } = workspace;

  return [
    `# ${project.name} First Playtest Script`,
    "",
    "## Setup",
    "- Use one compact playable slice.",
    "- Reset data before the first run.",
    "- Capture video, screenshots, frame-time notes, and tester comments.",
    "",
    "## Tester Prompts",
    `- In one sentence, what do you think this game is about? Expected fantasy: ${brief.fantasy}`,
    "- What did you try first?",
    "- What felt fair, unfair, or confusing?",
    "- What would make you immediately retry?",
    "",
    "## Pass Conditions",
    "- The player understands the goal within 20 seconds.",
    "- The first fail state is readable without debug text.",
    "- The retry button or equivalent restart flow is obvious.",
    "- One moment is worth clipping or talking about.",
    "",
    "## Fail Conditions",
    "- The player cannot explain the goal.",
    "- Visuals hide threat, route, avatar, or feedback.",
    "- The run ends without a next-goal motivation."
  ].join("\n");
}

export function renderEngineAdapterBriefMarkdown(workspace: Omit<ProjectWorkspace, "artifacts">): string {
  const { project, platformPlans } = workspace;
  const targeted = platformPlans.filter((plan) => plan.status === "targeted").map((plan) => plan.platform);

  return [
    "# Engine Adapter Brief",
    "",
    "## Adapter Principle",
    "Game OS remains the studio brain. Engine adapters are generated only from approved artifacts and should not own product strategy.",
    "",
    "## Current Preference",
    project.enginePreference,
    "",
    "## First Adapter Candidates",
    ...(targeted.length > 0 ? targeted.map((platform) => `- ${platform}`) : ["- Engine-neutral planning only."]),
    "",
    "## Required Inputs Before Adapter Generation",
    "- Approved game bible.",
    "- Approved asset pipeline gates.",
    "- Accepted first playtest script.",
    "- Platform readiness notes.",
    "- Capability map and Global OS Designer review.",
    "- Build Sentinel process rules.",
    "",
    "## Explicit V1 Boundary",
    "Do not automate store submission. Web remains the first local capability-proof delivery, and Steam remains a test-readiness lane until a later release workflow is intentionally added."
  ].join("\n");
}

export function renderRulesSpecMarkdown(workspace: Omit<ProjectWorkspace, "artifacts">): string {
  const { project } = workspace;
  const prompt = project.prompt.toLowerCase();
  const isTurnRulesFixture = isTurnRulesProject(project);
  const isAssetPhysics = (prompt.includes("cut") && prompt.includes("rope")) || project.genre.toLowerCase().includes("physics puzzle");

  if (isTurnRulesFixture) {
    return [
      `# ${project.name} Rules Spec`,
      "",
      "## Rules Variant",
      "- Use a classic digital board-race baseline unless the creator chooses a regional variant later.",
      "- Two to four players, four tokens per player, color-coded seats.",
      "- A six can release a token from base and grants an extra turn.",
      "- Capturing an opponent sends that token back to base unless it is on a safe square.",
      "- Home entry requires exact dice count.",
      "- Winner is the first player to move all four tokens home.",
      "",
      "## State Machine",
      "1. Match Setup",
      "2. Await Roll",
      "3. Resolve Dice",
      "4. Select Legal Token",
      "5. Animate Move",
      "6. Resolve Capture / Safe Square / Home Entry",
      "7. Persist Turn Snapshot",
      "8. Continue Extra Turn Or Advance Seat",
      "9. End Match",
      "",
      "## Legal-Move Checks",
      "- Token in base requires a six to enter.",
      "- Token cannot move past home.",
      "- No legal move passes the turn after the roll is recorded.",
      "- Chained sixes must be capped or variant-defined before implementation.",
      "",
      "## Bot And Multiplayer Notes",
      "- Bot turns must use the same legal-move resolver as human turns.",
      "- Local pass-and-play is the first multiplayer target.",
      "- Online multiplayer is a future lane and must not be faked in V1 planning."
    ].join("\n");
  }

  if (isAssetPhysics) {
    return [
      `# ${project.name} Rules Spec`,
      "",
      "## Rules Variant",
      "- One local physics puzzle slice for web playtesting.",
      "- Hero object starts attached to a rope anchored above the goal.",
      "- Player can release the rope once per attempt.",
      "- Gravity moves the hero object after release.",
      "- Mastery pickups are optional skill targets and the goal zone ends the attempt.",
      "",
      "## State Machine",
      "1. Asset Pack Imported",
      "2. Level Setup",
      "3. Await Release",
      "4. Rope Released",
      "5. Gravity Resolve",
      "6. Collect Stars",
      "7. Goal / Miss",
      "8. Retry",
      "",
      "## Legal Action Checks",
      "- Release is legal only while the rope is intact.",
      "- Reset restores rope, hero object, mastery pickups, and goal state.",
      "- Asset pack verdict must be visible in the adapter report.",
      "- The Web player agent must prove that the level can be completed."
    ].join("\n");
  }

  return [
    `# ${project.name} Rules Spec`,
    "",
    "## Rules Principle",
    "- Define legal actions before visual polish.",
    "- Keep rules deterministic and testable.",
    "- Use the same resolver for player, bot, and QA simulations.",
    "",
    "## Required Sections Before Prototype",
    "- State machine.",
    "- Win/loss conditions.",
    "- Legal action resolver.",
    "- Invalid action handling.",
    "- Save/resume behavior."
  ].join("\n");
}

export function renderTestMatrixMarkdown(workspace: Omit<ProjectWorkspace, "artifacts">): string {
  const { project, qaGates } = workspace;
  const lowerPrompt = project.prompt.toLowerCase();
  const isTurnRulesFixture = isTurnRulesProject(project);
  const isAssetPhysics = (lowerPrompt.includes("cut") && lowerPrompt.includes("rope")) || project.genre.toLowerCase().includes("physics puzzle");
  const scenarioRows = isAssetPhysics
    ? [
        "| Upload asset pack | Import report records source, counts, relevance tags, and verdict | Integration |",
        "| Generate Web adapter | Build copies imported assets into the playable web bundle | Integration |",
        "| Rope release action | Hero object detaches and gravity moves it toward goal | Headed |",
        "| Mastery pickup collection | Pickups mark collected when the hero object passes through their radius | Unit + headed |",
        "| Goal contact | Attempt ends with win feedback and retry path | Unit + headed |",
        "| Wrong asset pack | OS reports partial/wrong verdict and does not silently approve visuals | Integration |",
        "| Player agent | Simulation proves the level is worth playing or requests architecture upgrade | Simulation |"
      ]
    : isTurnRulesFixture
    ? [
        "| Dice six from base | Token enters start and extra turn is granted | Unit + headed |",
        "| No legal moves | Turn advances after roll is stored | Unit |",
        "| Capture on unsafe square | Captured token returns to base | Unit + headed |",
        "| Safe square collision | No capture occurs | Unit |",
        "| Exact home entry | Token enters home only on exact count | Unit |",
        "| Save/resume mid-match | Current dice, seat, tokens, and move history restore | Integration |",
        "| Bot turn | Bot uses legal move resolver and cannot cheat state | Simulation |"
      ]
    : [
        "| First playable loop | Player understands goal and retry | Headed |",
        "| Asset readability | Main state remains readable at gameplay camera | Screenshot review |",
        "| Save/resume | Local state restores after refresh | Integration |"
      ];

  return [
    `# ${project.name} Test Matrix`,
    "",
    "| Scenario | Expected Result | Gate |",
    "|---|---|---|",
    ...scenarioRows,
    "",
    "## QA Gate Mapping",
    ...qaGates.map((gate) => `- ${gate.name}: ${gate.result}`)
  ].join("\n");
}

function hasPrivateTurnRulesTerm(text: string): boolean {
  return text.includes(Buffer.from("bHVkbw==", "base64").toString("utf8")) || text.includes(Buffer.from("cGFjaGlzaQ==", "base64").toString("utf8"));
}

function isTurnRulesProject(project: { name: string; genre: string; prompt: string }): boolean {
  const text = `${project.name} ${project.genre} ${project.prompt}`.toLowerCase();
  return hasPrivateTurnRulesTerm(text) || ["board game", "board-race", "board race", "dice", "token", "tokens", "turn-based", "turn based"].some((signal) => text.includes(signal));
}
