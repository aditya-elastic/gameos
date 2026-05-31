import { randomUUID } from "node:crypto";
import { writeArtifact, writeWorkspaceArtifacts } from "./artifacts";
import { loadAgentDefinitions, getAgentDefinition } from "./agent-registry";
import { generateAgentRun, composeStudioPlan } from "./agents";
import { createAssetPlan } from "./assets";
import { getWorkspace, listWorkspaces, saveWorkspace, updateAgentRun } from "./db";
import { createGameBrief, makeProjectFromInput, normalizeCreateProjectInput } from "./intake";
import { createPlatformPlans } from "./platforms";
import { createQAGates, workspaceAcceptanceResult } from "./qa";
import type { ArtifactKind, CreateProjectInput, ProjectWorkspace } from "./types";

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
    "engine-adapter-brief"
  ]);
  const artifactKinds = new Set(workspace.artifacts.map((artifact) => artifact.kind));
  const missingRequiredArtifact = [...requiredKinds].some((kind) => !artifactKinds.has(kind));
  const missingAgentArtifact = workspace.agents.some((agent) => !workspace.artifacts.some((artifact) => artifact.path.endsWith(`agents/${agent.role}-run-${agent.runNumber}.md`)));

  if (!missingRequiredArtifact && !missingAgentArtifact) {
    return workspace;
  }

  const upgraded = writeWorkspaceArtifacts({
    project: workspace.project,
    brief: workspace.brief,
    agents: workspace.agents,
    assetPlan: workspace.assetPlan,
    platformPlans: workspace.platformPlans,
    qaGates: workspace.qaGates,
    studioPlan: workspace.studioPlan
  });
  saveWorkspace(upgraded);

  return getWorkspace(workspace.project.id) ?? upgraded;
}
