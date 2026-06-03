import { randomUUID } from "node:crypto";
import { readArtifactContent, writeArtifact, writeWorkspaceArtifacts } from "./artifacts";
import { loadAgentDefinitions, getAgentDefinition } from "./agent-registry";
import { generateAgentRun, composeStudioPlan } from "./agents";
import { importStoredAssetPack, importUploadedAssetPack, type AssetImportResult } from "./asset-importer";
import { createAssetPlan } from "./assets";
import { addArtifact, getWorkspace, listWorkspaces, saveWorkspace, updateAgentRun } from "./db";
import { generateGodotProject } from "./godot-adapter";
import { createGameBrief, makeProjectFromInput, normalizeCreateProjectInput } from "./intake";
import { createPlatformPlans } from "./platforms";
import { createQAGates, workspaceAcceptanceResult } from "./qa";
import { generateStudioScorecard, renderStudioScorecardMarkdown, type StudioScorecard } from "./scorecard";
import { diagnoseTrust, renderTrustDiagnosisMarkdown } from "./trust";
import type { ArtifactKind, CreateProjectInput, ProjectWorkspace, TrustDiagnosis } from "./types";
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
  visual_verdict?: string;
  physics_verdict?: string;
  physics_model?: string;
  timing_skill_verdict?: string;
  agency_verdict?: string;
  mastery_verdict?: string;
  input_verdict?: string;
  slice_gesture_verdict?: string;
  slice_gesture_pass?: boolean;
  smooth_mouse_verdict?: string;
  smooth_mouse_pass?: boolean;
  slow_mouse_verdict?: string;
  slow_mouse_pass?: boolean;
  asset_fit_verdict?: string;
  reset_recut_pass?: boolean;
  role_assignments?: unknown;
  browser_interaction?: unknown;
  visual_screenshot?: string;
  trials?: number;
  best_cut_frame?: number | null;
  best_cut_angle?: number | null;
  best_stars?: number;
  best_bumper_contacts?: number;
  timing_windows?: unknown;
  early_miss_verified?: boolean;
  late_miss_verified?: boolean;
  completions?: number;
  stars_collected?: number;
  average_seconds?: number;
  average_score?: number;
  primary_archetype?: string;
  capabilities?: unknown;
  capability_verdict?: string;
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
    runNumber,
    feedbackNotes: readRecentFeedbackNotes(workspace)
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

export function recordUserFeedback(projectId: string, note: string): ProjectWorkspace {
  const workspace = getStudioProject(projectId);
  if (!workspace) {
    throw new Error(`Project not found: ${projectId}`);
  }

  const trimmed = note.trim();
  if (trimmed.length < 8) {
    throw new Error("Feedback note is too short. Add a concrete issue or desired change.");
  }

  const now = new Date().toISOString();
  const safeTime = now.replace(/[:.]/g, "-");
  const artifact = writeArtifact(
    projectId,
    "user-feedback",
    "Creator Feedback",
    `feedback/creator-feedback-${safeTime}.md`,
    [
      `# ${workspace.project.name} Creator Feedback`,
      "",
      `Recorded at: ${now}`,
      "",
      "## Note",
      trimmed,
      "",
      "## Routing",
      "- Global OS Designer: inspect whether this issue reveals a reusable OS capability gap.",
      "- Studio Director: decide whether this changes the go/no-go.",
      "- Visual Quality Director: inspect screenshot/readability complaints.",
      "- Physics Gameplay Engineer: inspect reset, input, collision, and dynamics complaints.",
      "- Asset Pipeline Director: inspect asset role-fit complaints.",
      "- Advanced Player: rerun only after blockers are addressed."
    ].join("\n")
  );
  addArtifact(artifact);

  const updatedWorkspace = getWorkspace(projectId);
  if (!updatedWorkspace) {
    throw new Error(`Project disappeared after feedback recording: ${projectId}`);
  }

  return updatedWorkspace;
}

export function createStudioReview(projectId: string): { workspace: ProjectWorkspace; scorecard: StudioScorecard } {
  const workspace = getStudioProject(projectId);
  if (!workspace) {
    throw new Error(`Project not found: ${projectId}`);
  }

  const scorecard = generateStudioScorecard(workspace);
  const artifact = writeArtifact(
    projectId,
    "studio-scorecard",
    "Studio Trust Scorecard",
    "studio-scorecard.md",
    renderStudioScorecardMarkdown(scorecard)
  );
  addArtifact(artifact);

  const reviewedWorkspace = getWorkspace(projectId);
  if (!reviewedWorkspace) {
    throw new Error(`Project disappeared after studio review: ${projectId}`);
  }

  saveWorkspace({
    ...reviewedWorkspace,
    qaGates: reviewedWorkspace.qaGates.map((gate) => ({
      ...gate,
      result: scorecard.verdict === "CREATOR_TEST_READY" ? "pass" : gate.name === "Studio Trust Quality Gate" ? "blocked" : gate.result
    }))
  });

  const updatedWorkspace = getWorkspace(projectId);
  if (!updatedWorkspace) {
    throw new Error(`Project disappeared after studio review: ${projectId}`);
  }

  return { workspace: updatedWorkspace, scorecard };
}

export function createTrustDiagnosis(projectId: string): { workspace: ProjectWorkspace; diagnosis: TrustDiagnosis } {
  const workspace = getStudioProject(projectId);
  if (!workspace) {
    throw new Error(`Project not found: ${projectId}`);
  }
  const diagnosis = diagnoseTrust(workspace);
  const artifact = writeArtifact(projectId, "trust-diagnosis", "Trust Diagnosis", "trust-diagnosis.md", renderTrustDiagnosisMarkdown(diagnosis));
  addArtifact(artifact);
  const updatedWorkspace = getWorkspace(projectId);
  if (!updatedWorkspace) {
    throw new Error(`Project disappeared after trust diagnosis: ${projectId}`);
  }
  return { workspace: updatedWorkspace, diagnosis };
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
    "os-design-review",
    "capability-map",
    "acceptance-profile",
    "architecture-risk-report",
    "upgrade-doctrine",
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
              runNumber: 1,
              feedbackNotes: readRecentFeedbackNotes(workspace)
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
  const previewArtifact = writeArtifact(
    projectId,
    "asset-preview-manifest",
    "Asset Preview Manifest",
    "asset-preview-manifest.json",
    `${JSON.stringify(
      {
        projectId,
        sourceFileName: result.manifest.sourceFileName,
        verdict: result.manifest.verdict,
        confidence: result.manifest.confidence,
        roleAssignments: result.manifest.roleAssignments.map((assignment) => ({
          role: assignment.role,
          status: assignment.status,
          confidence: assignment.confidence,
          selectedFile: assignment.file?.relativePath ?? null,
          tags: assignment.file?.tags ?? [],
          reason: assignment.reason
        })),
        selectedFiles: result.manifest.roleAssignments
          .filter((assignment) => assignment.file)
          .map((assignment) => ({
            role: assignment.role,
            file: assignment.file?.relativePath,
            reason: assignment.reason
          }))
      },
      null,
      2
    )}\n`
  );
  addArtifact(reportArtifact);
  addArtifact(manifestArtifact);
  addArtifact(previewArtifact);
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
  if (report.kind === "asset-physics") {
    return [
      `# ${workspace.project.name} Web Player Agent Report`,
      "",
      "## Verdict",
      `- Agent: ${report.agent ?? "Advanced Web Player - Physics Puzzle Specialist"}`,
      `- Claim: ${report.claim ?? "asset-driven asset-led physics browser prototype player-agent simulation"}`,
      `- Verdict: ${report.verdict ?? "unknown"}`,
      "",
      "## Asset And Puzzle Metrics",
      `- Asset gate: ${report.asset_gate ?? "unknown"}`,
      `- Asset fit verdict: ${report.asset_fit_verdict ?? "unknown"}`,
      `- Visual verdict: ${report.visual_verdict ?? "unknown"}`,
      `- Physics model: ${report.physics_model ?? "unknown"}`,
      `- Physics verdict: ${report.physics_verdict ?? "unknown"}`,
      `- Timing skill verdict: ${report.timing_skill_verdict ?? "unknown"}`,
      `- Agency verdict: ${report.agency_verdict ?? "unknown"}`,
      `- Mastery verdict: ${report.mastery_verdict ?? "unknown"}`,
      `- Input verdict: ${report.input_verdict ?? "unknown"}`,
      `- Slice gesture verdict: ${report.slice_gesture_verdict ?? "unknown"}`,
      `- Slice gesture pass: ${String(Boolean(report.slice_gesture_pass))}`,
      `- Smooth mouse verdict: ${report.smooth_mouse_verdict ?? "unknown"}`,
      `- Smooth mouse pass: ${String(Boolean(report.smooth_mouse_pass))}`,
      `- Slow mouse verdict: ${report.slow_mouse_verdict ?? "unknown"}`,
      `- Slow mouse pass: ${String(Boolean(report.slow_mouse_pass))}`,
      `- Reset/recut pass: ${String(Boolean(report.reset_recut_pass))}`,
      `- Visual screenshot: ${report.visual_screenshot ?? "not captured"}`,
      `- Assets used: ${report.assets_used ?? 0}`,
      `- Matches: ${report.matches ?? 0}`,
      `- Timing trials: ${report.trials ?? 0}`,
      `- Completions: ${report.completions ?? 0}`,
      `- Best cut frame: ${report.best_cut_frame ?? "none"}`,
      `- Best cut angle: ${report.best_cut_angle ?? "none"}`,
      `- Best stars: ${report.best_stars ?? 0}`,
      `- Best bumper contacts: ${report.best_bumper_contacts ?? 0}`,
      `- Early miss verified: ${String(Boolean(report.early_miss_verified))}`,
      `- Late miss verified: ${String(Boolean(report.late_miss_verified))}`,
      `- Stars collected: ${report.stars_collected ?? 0}`,
      `- Average seconds: ${report.average_seconds ?? 0}`,
      `- Timeouts: ${report.timeouts ?? 0}`,
      "",
      "## Architecture Decision",
      "The Web lane is promoted only when uploaded assets are role-fit, the screenshot is coherent, smooth and slow mouse blade movement works, reset/recut is reliable, physics is readable, and the Advanced Player approves the level. Unity and Godot should inherit this only after asset relevance, storage, and QA reports are present."
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
    `- Kind: ${report.kind ?? "rules"}`,
    `- Primary archetype: ${report.primary_archetype ?? "rules-led game"}`,
    `- Matches: ${report.matches ?? 0}`,
    `- Average score: ${report.average_score ?? 0}`,
    `- Average turns: ${report.average_turns ?? 0}`,
    `- Timeouts: ${report.timeouts ?? 0}`,
    `- Visual verdict: ${report.visual_verdict ?? "not reported"}`,
    `- Input verdict: ${report.input_verdict ?? "not reported"}`,
    `- Capability verdict: ${report.capability_verdict ?? "not reported"}`,
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

function readRecentFeedbackNotes(workspace: ProjectWorkspace): string[] {
  return workspace.artifacts
    .filter((artifact) => artifact.kind === "user-feedback")
    .slice(-3)
    .map((artifact) => {
      try {
        const content = readArtifactContent(artifact.path);
        const noteSection = content.split("## Note")[1]?.split("## Routing")[0]?.trim();
        return noteSection || content.split("\n").filter(Boolean).slice(0, 4).join(" ");
      } catch {
        return "";
      }
    })
    .filter(Boolean);
}
