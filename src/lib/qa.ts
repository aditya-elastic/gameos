import type { AgentRun, AssetPlan, PlatformPlan, ProjectWorkspace, QAGate } from "./types";
import { loadAgentDefinitions } from "./agent-registry";
import { platformReadinessScore } from "./platforms";

export function createQAGates(projectId: string, agents: AgentRun[], assetPlan: AssetPlan, platformPlans: PlatformPlan[]): QAGate[] {
  const requiredRoles = loadAgentDefinitions().map((definition) => definition.role);
  const agentComplete = requiredRoles.every((role) => agents.some((agent) => agent.role === role && agent.status === "complete"));
  const assetReady = assetPlan.items.every((item) => item.status !== "rejected");
  const platformScore = platformReadinessScore(platformPlans);
  const hasMemoryAgent = agents.some((agent) => agent.role === "memory-manager" && agent.status === "complete");
  const hasStorageAgent = agents.some((agent) => agent.role === "storage-manager" && agent.status === "complete");
  const hasRulesAgent = agents.some((agent) => agent.role === "rules-systems-designer" && agent.status === "complete");
  const hasAssetPipelineAgent = agents.some((agent) => agent.role === "asset-pipeline-director" && agent.status === "complete");
  const hasVisualQualityAgent = agents.some((agent) => agent.role === "visual-quality-director" && agent.status === "complete");
  const hasPhysicsAgent = agents.some((agent) => agent.role === "physics-gameplay-engineer" && agent.status === "complete");
  const hasGameplayDeveloper = agents.some((agent) => agent.role === "gameplay-developer" && agent.status === "complete");
  const hasUxFlowDirector = agents.some((agent) => agent.role === "ux-flow-director" && agent.status === "complete");
  const hasGameFeelDirector = agents.some((agent) => agent.role === "game-feel-director" && agent.status === "complete");
  const hasSecurityReviewer = agents.some((agent) => agent.role === "security-privacy-reviewer" && agent.status === "complete");
  const hasReleaseEngineer = agents.some((agent) => agent.role === "open-source-release-engineer" && agent.status === "complete");

  return [
    {
      id: `${projectId}_intake`,
      projectId,
      name: "Intake Completeness",
      automatedChecks: ["Prompt is present.", "Audience is inferred or provided.", "At least one platform is selected."],
      headedPlaytestChecks: ["None until prototype exists."],
      playerFeelChecks: ["Fantasy can be explained in one sentence."],
      result: "pass"
    },
    {
      id: `${projectId}_swarm`,
      projectId,
      name: "Agent Swarm Coverage",
      automatedChecks: [
        "All registered agents generated outputs.",
        "Studio Director produced a merge plan.",
        "Swarm includes gameplay developer, UX flow, game feel, security/privacy, and open-source release roles."
      ],
      headedPlaytestChecks: ["None until engine adapter exists."],
      playerFeelChecks: ["Advanced Player has named mastery and retention risks."],
      result: agentComplete ? "pass" : "watch"
    },
    {
      id: `${projectId}_assets`,
      projectId,
      name: "Asset Pipeline Gate",
      automatedChecks: ["Asset plan exists.", "Every asset has source, prompt, status, and approval gate.", "Uploaded packs create role assignments before Web generation."],
      headedPlaytestChecks: ["Visual assets must pass gameplay-camera readability before promotion.", "Selected asset roles must be visible in the playable build."],
      playerFeelChecks: ["Assets support the core loop before spectacle.", "Wrong-role assets block worth-playing promotion."],
      result: assetReady && hasAssetPipelineAgent ? "watch" : "blocked"
    },
    {
      id: `${projectId}_rules`,
      projectId,
      name: "Rules Integrity Gate",
      automatedChecks: ["Rules Systems Designer generated a state contract.", "Legal action and invalid action behavior are named."],
      headedPlaytestChecks: ["Headed playtest must show legal moves and turn resolution clearly."],
      playerFeelChecks: ["Players can explain why a move is legal or illegal."],
      result: hasRulesAgent ? "watch" : "blocked"
    },
    {
      id: `${projectId}_memory_storage`,
      projectId,
      name: "Memory And Storage Gate",
      automatedChecks: ["Memory Manager exists.", "Storage Manager exists.", "Canonical artifacts are file-backed."],
      headedPlaytestChecks: ["Save/resume proof required after prototype adapter exists."],
      playerFeelChecks: ["The game can recover state without surprising the player."],
      result: hasMemoryAgent && hasStorageAgent ? "watch" : "blocked"
    },
    {
      id: `${projectId}_platforms`,
      projectId,
      name: "Platform Readiness Gate",
      automatedChecks: ["Target platforms are mapped.", "Steam is test readiness only.", "Unity/Godot adapters are deferred until selected."],
      headedPlaytestChecks: ["Run a headed smoke test after the first engine adapter is generated."],
      playerFeelChecks: ["Target controls match the intended player session."],
      result: platformScore >= 0.4 ? "watch" : "blocked"
    },
    {
      id: `${projectId}_playtest`,
      projectId,
      name: "First Playtest Gate",
      automatedChecks: ["Prototype task list exists.", "QA Director produced acceptance criteria.", "Visual and physics specialist agents exist."],
      headedPlaytestChecks: ["First 60 seconds are readable.", "Retry loop works.", "No placeholder blockers in the main flow."],
      playerFeelChecks: ["Player understands goal, danger, feedback, and next attempt."],
      result: hasVisualQualityAgent && hasPhysicsAgent ? "watch" : "blocked"
    },
    {
      id: `${projectId}_studio_quality_10`,
      projectId,
      name: "10/10 Studio Quality Gate",
      automatedChecks: [
        "Studio review scorecard exists before release claims.",
        "Gameplay Developer owns implementation-slice quality.",
        "UX Flow Director owns creator command journey.",
        "Game Feel Director owns first-minute playability.",
        "Security Privacy Reviewer owns local-first safety.",
        "Open Source Release Engineer owns npm/Homebrew readiness."
      ],
      headedPlaytestChecks: ["Browser or engine QA evidence must support the scorecard.", "Screenshots and interaction proof must back visual/game-feel claims."],
      playerFeelChecks: ["No 10/10 claim is allowed unless every scorecard category has explicit evidence."],
      result: hasGameplayDeveloper && hasUxFlowDirector && hasGameFeelDirector && hasSecurityReviewer && hasReleaseEngineer ? "watch" : "blocked"
    },
    {
      id: `${projectId}_web_quality`,
      projectId,
      name: "Web Worth Playing Gate",
      automatedChecks: [
        "Web smoke reports the GameOS watermark.",
        "Browser QA cuts, resets, verifies no auto-cut, proves fast swipe, smooth mouse blade, slow human mouse blade, recuts, and runs the Advanced Player.",
        "Player report includes visual, physics, timing skill, agency, mastery, input, smooth mouse, slow mouse, asset-fit, and reset/recut verdicts."
      ],
      headedPlaytestChecks: ["Screenshot composition must be mature enough for creator feedback.", "Physics motion must be readable without debug text.", "Slow human mouse movement across the rope must cut reliably.", "Early and late actions must visibly fail."],
      playerFeelChecks: ["Advanced Player blocks promotion unless visual, physics, timing, agency, mastery, fast swipe, smooth mouse, slow mouse, asset-fit, and fun gates pass."],
      result: "watch"
    }
  ];
}

export function summarizeQAGates(gates: QAGate[]): { pass: number; watch: number; blocked: number } {
  return gates.reduce(
    (summary, gate) => {
      summary[gate.result] += 1;
      return summary;
    },
    { pass: 0, watch: 0, blocked: 0 }
  );
}

export function workspaceAcceptanceResult(workspace: ProjectWorkspace): "ready-for-engine-adapter" | "needs-studio-review" | "blocked" {
  const summary = summarizeQAGates(workspace.qaGates);

  if (summary.blocked > 0) return "blocked";
  if (summary.watch <= 2 && workspace.agents.every((agent) => agent.status === "complete")) return "ready-for-engine-adapter";
  return "needs-studio-review";
}
