import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { ArtifactKind, ArtifactRecord, ProjectWorkspace } from "./types";

export function getDataRoot(): string {
  return process.env.GAME_OS_DATA_DIR || path.join(process.cwd(), "data");
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
  const artifacts = [
    writeArtifact(project.id, "brief", "Game Bible", "game-bible.md", renderBriefMarkdown(brief)),
    writeArtifact(project.id, "asset-plan", "Asset Pipeline", "asset-plan.md", renderAssetPlanMarkdown(assetPlan)),
    writeArtifact(project.id, "platform-plan", "Platform Readiness", "platform-plan.md", renderPlatformPlansMarkdown(platformPlans)),
    writeArtifact(project.id, "qa-plan", "QA Gates", "qa-gates.md", renderQAGatesMarkdown(qaGates)),
    writeArtifact(project.id, "studio-plan", "Studio Execution Plan", "studio-execution-plan.md", studioPlan),
    writeArtifact(project.id, "production-roadmap", "Production Roadmap", "production-roadmap.md", renderProductionRoadmapMarkdown(workspace)),
    writeArtifact(project.id, "risk-register", "Risk Register", "risk-register.md", renderRiskRegisterMarkdown(workspace)),
    writeArtifact(project.id, "playtest-script", "First Playtest Script", "first-playtest-script.md", renderPlaytestScriptMarkdown(workspace)),
    writeArtifact(project.id, "engine-adapter-brief", "Engine Adapter Brief", "engine-adapter-brief.md", renderEngineAdapterBriefMarkdown(workspace))
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
    "- Confirm the fantasy, target audience, first-playable slice, and QA gates.",
    "- Keep scope to one polished prototype loop.",
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
    "Every risk needs either a prototype test, a scope reduction, or a deferred-lane decision before engine work starts."
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
    "- Build Sentinel process rules.",
    "",
    "## Explicit V1 Boundary",
    "Do not automate store submission. Steam remains a test-readiness lane until a later release workflow is intentionally added."
  ].join("\n");
}
