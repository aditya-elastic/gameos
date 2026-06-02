import { randomUUID } from "node:crypto";
import { writeArtifact, writeWorkspaceArtifacts } from "./artifacts";
import { loadAgentDefinitions, getAgentDefinition } from "./agent-registry";
import { generateAgentRun, composeStudioPlan } from "./agents";
import { importStoredAssetPack, importUploadedAssetPack, type AssetImportResult } from "./asset-importer";
import { createAssetPlan } from "./assets";
import { addArtifact, getWorkspace, listWorkspaces, saveWorkspace, updateAgentRun } from "./db";
import { generateGodotProject } from "./godot-adapter";
import { createGameBrief, makeProjectFromInput, normalizeCreateProjectInput } from "./intake";
import { createPlatformPlans } from "./platforms";
import { createQAGates, workspaceAcceptanceResult } from "./qa";
import type { ArtifactKind, CreateProjectInput, ProjectWorkspace } from "./types";
import { generateUnityProject } from "./unity-adapter";
import { generateWebProject } from "./web-adapter";

type UnityAdvancedPlaytestReport = {
  agent?: string;
  claim?: string;
  matches?: number;
  average_turns?: number;
  captures?: number;
  releases?: number;
  homes?: number;
  passes?: number;
  timeouts?: number;
  branching_decisions?: number;
  finish_choices?: number;
  capture_choices?: number;
  safe_choices?: number;
  release_choices?: number;
  scene_loaded?: boolean;
  controller_found?: boolean;
  verdict?: string;
};

type WebPlaytestReport = {
  agent?: string;
  claim?: string;
  kind?: string;
  assets_used?: number;
  asset_gate?: string;
  completions?: number;
  stars_collected?: number;
  average_seconds?: number;
  matches?: number;
  average_turns?: number;
  captures?: number;
  releases?: number;
  homes?: number;
  passes?: number;
  timeouts?: number;
  branching_decisions?: number;
  finish_choices?: number;
  capture_choices?: number;
  safe_choices?: number;
  release_choices?: number;
  verdict?: string;
};

export function createStudioProject(rawInput: CreateProjectInput): ProjectWorkspace {
  const input = normalizeCreateProjectInput(rawInput);
  const project = makeProjectFromInput(`game_${randomUUID().slice(0, 8)}`, input);
  const brief = createGameBrief(project);
  const assetPlan = createAssetPlan(project, brief);
  const platformPlans = createPlatformPlans(project);
  const agentDefinitions = loadAgentDefinitions();
  const agents = agentDefinitions.map((definition) =>
    generateAgentRun(definition, project, brief, {
      assetPlan,
      platformPlans,
      runNumber: 1
    })
  );
  const qaGates = createQAGates(project.id, agents, assetPlan, platformPlans);
  const studioPlan = composeStudioPlan({ project, brief, agents, assetPlan, platformPlans });
  const workspace = writeWorkspaceArtifacts({
    project,
    brief,
    agents,
    assetPlan,
    platformPlans,
    qaGates,
    studioPlan
  });

  saveWorkspace(workspace);
  return workspace;
}

export function getStudioDashboard(): ProjectWorkspace[] {
  return listWorkspaces().map(ensureWorkspaceComplete);
}

export function getStudioProject(projectId: string): ProjectWorkspace | null {
  const workspace = getWorkspace(projectId);
  return workspace ? ensureWorkspaceComplete(workspace) : null;
}

export function regenerateAgent(projectId: string, role: string): ProjectWorkspace {
  const workspace = getWorkspace(projectId);
  if (!workspace) {
    throw new Error(`Project not found: ${projectId}`);
  }

  const currentAgent = workspace.agents.find((agent) => agent.role === role);
  const definition = getAgentDefinition(role);
  const runNumber = (currentAgent?.runNumber ?? 0) + 1;
  const regenerated = generateAgentRun(definition, workspace.project, workspace.brief, {
    assetPlan: workspace.assetPlan,
    platformPlans: workspace.platformPlans,
    runNumber
  });
  const artifact = writeArtifact(
    projectId,
    "agent-output",
    regenerated.title,
    `agents/${regenerated.role}-run-${regenerated.runNumber}.md`,
    regenerated.output
  );

  updateAgentRun(projectId, { ...regenerated, artifacts: [artifact] }, artifact);

  const updatedWorkspace = getWorkspace(projectId);
  if (!updatedWorkspace) {
    throw new Error(`Project disappeared after agent regeneration: ${projectId}`);
  }

  return updatedWorkspace;
}

export function generateGodotAdapter(projectId: string): ProjectWorkspace {
  const workspace = getStudioProject(projectId);
  if (!workspace) {
    throw new Error(`Project not found: ${projectId}`);
  }

  if (!workspace.platformPlans.some((plan) => plan.platform === "Godot" && plan.status === "targeted")) {
    throw new Error("Godot must be selected as a target platform before generating this adapter.");
  }

  const adapter = generateGodotProject(workspace);
  const artifact = writeArtifact(projectId, "godot-adapter", "Godot Adapter", "godot-adapter.md", adapter.report);
  addArtifact(artifact);

  const updatedWorkspace = getWorkspace(projectId);
  if (!updatedWorkspace) {
    throw new Error(`Project disappeared after Godot adapter generation: ${projectId}`);
  }

  return updatedWorkspace;
}

export function generateUnityAdapter(projectId: string): ProjectWorkspace {
  const workspace = getStudioProject(projectId);
  if (!workspace) {
    throw new Error(`Project not found: ${projectId}`);
  }

  if (!workspace.platformPlans.some((plan) => plan.platform === "Unity" && plan.status === "targeted")) {
    throw new Error("Unity must be selected as a target platform before generating this adapter.");
  }

  const adapter = generateUnityProject(workspace);
  const artifact = writeArtifact(projectId, "unity-adapter", "Unity Adapter", "unity-adapter.md", adapter.report);
  addArtifact(artifact);

  const updatedWorkspace = getWorkspace(projectId);
  if (!updatedWorkspace) {
    throw new Error(`Project disappeared after Unity adapter generation: ${projectId}`);
  }

  return updatedWorkspace;
}

export function generateWebAdapter(projectId: string): ProjectWorkspace {
  const workspace = getStudioProject(projectId);
  if (!workspace) {
    throw new Error(`Project not found: ${projectId}`);
  }

  if (!workspace.platformPlans.some((plan) => plan.platform === "Web" && plan.status === "targeted")) {
    throw new Error("Web must be selected as a target platform before generating this adapter.");
  }

  const adapter = generateWebProject(workspace);
  const artifact = writeArtifact(projectId, "web-adapter", "Web Adapter", "web-adapter.md", adapter.report);
  addArtifact(artifact);

  const updatedWorkspace = getWorkspace(projectId);
  if (!updatedWorkspace) {
    throw new Error(`Project disappeared after Web adapter generation: ${projectId}`);
  }

  return updatedWorkspace;
}

export function importProjectAssets(projectId: string, fileName: string, bytes: Buffer): ProjectWorkspace {
  const workspace = getStudioProject(projectId);
  if (!workspace) {
    throw new Error(`Project not found: ${projectId}`);
  }

  const result = importUploadedAssetPack(workspace, { fileName, bytes });
  recordAssetImportArtifacts(projectId, result);

  const updatedWorkspace = getWorkspace(projectId);
  if (!updatedWorkspace) {
    throw new Error(`Project disappeared after asset import: ${projectId}`);
  }

  return updatedWorkspace;
}

export function importProjectAssetsFromStoredFile(projectId: string, fileName: string, storedPath: string): ProjectWorkspace {
  const workspace = getStudioProject(projectId);
  if (!workspace) {
    throw new Error(`Project not found: ${projectId}`);
  }

  const result = importStoredAssetPack(workspace, { fileName, storedPath });
  recordAssetImportArtifacts(projectId, result);

  const updatedWorkspace = getWorkspace(projectId);
  if (!updatedWorkspace) {
    throw new Error(`Project disappeared after stored asset import: ${projectId}`);
  }

  return updatedWorkspace;
}

export function recordUnityAdvancedPlaytest(projectId: string, report: UnityAdvancedPlaytestReport): ProjectWorkspace {
  const workspace = getStudioProject(projectId);
  if (!workspace) {
    throw new Error(`Project not found: ${projectId}`);
  }

  const artifact = writeArtifact(
    projectId,
    "unity-playtest-report",
    "Unity Advanced Playtest",
    "unity-advanced-playtest-report.md",
    renderUnityAdvancedPlaytestMarkdown(workspace, report)
  );
  addArtifact(artifact);

  const updatedWorkspace = getWorkspace(projectId);
  if (!updatedWorkspace) {
    throw new Error(`Project disappeared after Unity advanced playtest recording: ${projectId}`);
  }

  return updatedWorkspace;
}

export function recordWebPlaytest(projectId: string, report: WebPlaytestReport): ProjectWorkspace {
  const workspace = getStudioProject(projectId);
  if (!workspace) {
    throw new Error(`Project not found: ${projectId}`);
  }

  const artifact = writeArtifact(projectId, "web-playtest-report", "Web Player Agent Report", "web-player-agent-report.md", renderWebPlaytestMarkdown(workspace, report));
  addArtifact(artifact);

  const updatedWorkspace = getWorkspace(projectId);
  if (!updatedWorkspace) {
    throw new Error(`Project disappeared after Web playtest recording: ${projectId}`);
  }

  return updatedWorkspace;
}

export function createAcceptanceSnapshot(workspace: ProjectWorkspace): {
  result: ReturnType<typeof workspaceAcceptanceResult>;
  passCount: number;
  watchCount: number;
  blockedCount: number;
} {
  const result = workspaceAcceptanceResult(workspace);
  const passCount = workspace.qaGates.filter((gate) => gate.result === "pass").length;
  const watchCount = workspace.qaGates.filter((gate) => gate.result === "watch").length;
  const blockedCount = workspace.qaGates.filter((gate) => gate.result === "blocked").length;

  return {
    result,
    passCount,
    watchCount,
    blockedCount
  };
}

function ensureWorkspaceComplete(workspace: ProjectWorkspace): ProjectWorkspace {
  const requiredKinds = new Set<ArtifactKind>([
    "brief",
    "asset-plan",
    "platform-plan",
    "qa-plan",
    "studio-plan",
    "production-roadmap",
    "risk-register",
    "playtest-script",
    "engine-adapter-brief",
    "rules-spec",
    "memory-map",
    "storage-manifest",
    "test-matrix"
  ]);
  const agentDefinitions = loadAgentDefinitions();
  const missingDefinitions = agentDefinitions.filter((definition) => !workspace.agents.some((agent) => agent.role === definition.role));
  const agents =
    missingDefinitions.length > 0
      ? [
          ...workspace.agents,
          ...missingDefinitions.map((definition) =>
            generateAgentRun(definition, workspace.project, workspace.brief, {
              assetPlan: workspace.assetPlan,
              platformPlans: workspace.platformPlans,
              runNumber: 1
            })
          )
        ]
      : workspace.agents;
  const qaGates = missingDefinitions.length > 0 ? createQAGates(workspace.project.id, agents, workspace.assetPlan, workspace.platformPlans) : workspace.qaGates;
  const artifactKinds = new Set(workspace.artifacts.map((artifact) => artifact.kind));
  const missingRequiredArtifact = [...requiredKinds].some((kind) => !artifactKinds.has(kind));
  const missingAgentArtifact = agents.some((agent) => !workspace.artifacts.some((artifact) => artifact.path.endsWith(`agents/${agent.role}-run-${agent.runNumber}.md`)));

  if (missingDefinitions.length === 0 && !missingRequiredArtifact && !missingAgentArtifact) {
    return workspace;
  }

  const upgraded = writeWorkspaceArtifacts({
    project: workspace.project,
    brief: workspace.brief,
    agents,
    assetPlan: workspace.assetPlan,
    platformPlans: workspace.platformPlans,
    qaGates,
    studioPlan: workspace.studioPlan
  });
  saveWorkspace(upgraded);

  return getWorkspace(workspace.project.id) ?? upgraded;
}

function recordAssetImportArtifacts(projectId: string, result: AssetImportResult): void {
  const reportArtifact = writeArtifact(projectId, "asset-import-report", "Asset Import Report", "asset-import-report.md", result.report);
  const manifestArtifact = writeArtifact(
    projectId,
    "asset-pack-manifest",
    "Asset Pack Manifest",
    "asset-pack-manifest.json",
    `${JSON.stringify(result.manifest, null, 2)}\n`
  );
  addArtifact(reportArtifact);
  addArtifact(manifestArtifact);
}

function renderUnityAdvancedPlaytestMarkdown(workspace: ProjectWorkspace, report: UnityAdvancedPlaytestReport): string {
  return [
    `# ${workspace.project.name} Unity Advanced Playtest`,
    "",
    "## Verdict",
    `- Agent: ${report.agent ?? "Advanced Player - Unity Table Strategist"}`,
    `- Claim: ${report.claim ?? "scene-aware advanced-player playtest"}`,
    `- Verdict: ${report.verdict ?? "unknown"}`,
    "",
    "## Scene Gate",
    `- Scene loaded: ${String(Boolean(report.scene_loaded))}`,
    `- Controller found: ${String(Boolean(report.controller_found))}`,
    "",
    "## Player Metrics",
    `- Matches: ${report.matches ?? 0}`,
    `- Average turns: ${report.average_turns ?? 0}`,
    `- Timeouts: ${report.timeouts ?? 0}`,
    `- Captures: ${report.captures ?? 0}`,
    `- Releases: ${report.releases ?? 0}`,
    `- Home events: ${report.homes ?? 0}`,
    `- Passes: ${report.passes ?? 0}`,
    `- Branching decisions: ${report.branching_decisions ?? 0}`,
    `- Finish choices: ${report.finish_choices ?? 0}`,
    `- Capture choices: ${report.capture_choices ?? 0}`,
    `- Safe-square choices: ${report.safe_choices ?? 0}`,
    `- Release choices: ${report.release_choices ?? 0}`,
    "",
    "## Architecture Decision",
    "Unity remains promoted as a local rules-prototype lane when the scene loads, the controller is present, and the advanced player approves the Creator Sprint pacing. Build export and store publishing remain behind later Build Sentinel gates."
  ].join("\n");
}

function renderWebPlaytestMarkdown(workspace: ProjectWorkspace, report: WebPlaytestReport): string {
  if (report.kind === "cut-rope") {
    return [
      `# ${workspace.project.name} Web Player Agent Report`,
      "",
      "## Verdict",
      `- Agent: ${report.agent ?? "Advanced Web Player - Physics Puzzle Specialist"}`,
      `- Claim: ${report.claim ?? "asset-driven Cut Rope browser prototype player-agent simulation"}`,
      `- Verdict: ${report.verdict ?? "unknown"}`,
      "",
      "## Asset And Puzzle Metrics",
      `- Asset gate: ${report.asset_gate ?? "unknown"}`,
      `- Assets used: ${report.assets_used ?? 0}`,
      `- Matches: ${report.matches ?? 0}`,
      `- Completions: ${report.completions ?? 0}`,
      `- Stars collected: ${report.stars_collected ?? 0}`,
      `- Average seconds: ${report.average_seconds ?? 0}`,
      `- Timeouts: ${report.timeouts ?? 0}`,
      "",
      "## Architecture Decision",
      "The Web lane is promoted as the fastest asset-pipeline proof channel when uploaded assets are copied into the build, the canvas loop renders, and the physics-puzzle player agent approves the level. Unity and Godot should inherit this only after asset relevance, storage, and QA reports are present."
    ].join("\n");
  }

  return [
    `# ${workspace.project.name} Web Player Agent Report`,
    "",
    "## Verdict",
    `- Agent: ${report.agent ?? "Advanced Web Player - Browser Table Strategist"}`,
    `- Claim: ${report.claim ?? "browser-playable web-channel player-agent simulation"}`,
    `- Verdict: ${report.verdict ?? "unknown"}`,
    "",
    "## Player Metrics",
    `- Matches: ${report.matches ?? 0}`,
    `- Average turns: ${report.average_turns ?? 0}`,
    `- Timeouts: ${report.timeouts ?? 0}`,
    `- Captures: ${report.captures ?? 0}`,
    `- Releases: ${report.releases ?? 0}`,
    `- Home events: ${report.homes ?? 0}`,
    `- Passes: ${report.passes ?? 0}`,
    `- Branching decisions: ${report.branching_decisions ?? 0}`,
    `- Finish choices: ${report.finish_choices ?? 0}`,
    `- Capture choices: ${report.capture_choices ?? 0}`,
    `- Safe-square choices: ${report.safe_choices ?? 0}`,
    `- Release choices: ${report.release_choices ?? 0}`,
    "",
    "## Architecture Decision",
    "The Web lane is promoted as the fastest local creator-playtest channel when the static prototype renders in a browser and the player agent approves rules pacing. Hosting, accounts, real-time multiplayer, and public publishing remain behind later adapter gates."
  ].join("\n");
}
