import type { AgentRun, AssetPlan, PlatformPlan, ProjectWorkspace, QAGate } from "./types";
import { platformReadinessScore } from "./platforms";

export function createQAGates(projectId: string, agents: AgentRun[], assetPlan: AssetPlan, platformPlans: PlatformPlan[]): QAGate[] {
  const agentComplete = agents.length >= 8 && agents.every((agent) => agent.status === "complete");
  const assetReady = assetPlan.items.every((item) => item.status !== "rejected");
  const platformScore = platformReadinessScore(platformPlans);

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
      automatedChecks: ["All core agents generated outputs.", "Studio Director produced a merge plan."],
      headedPlaytestChecks: ["None until engine adapter exists."],
      playerFeelChecks: ["Advanced Player has named mastery and retention risks."],
      result: agentComplete ? "pass" : "watch"
    },
    {
      id: `${projectId}_assets`,
      projectId,
      name: "Asset Pipeline Gate",
      automatedChecks: ["Asset plan exists.", "Every asset has source, prompt, status, and approval gate."],
      headedPlaytestChecks: ["Visual assets must pass gameplay-camera readability before promotion."],
      playerFeelChecks: ["Assets support the core loop before spectacle."],
      result: assetReady ? "watch" : "blocked"
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
      automatedChecks: ["Prototype task list exists.", "QA Director produced acceptance criteria."],
      headedPlaytestChecks: ["First 60 seconds are readable.", "Retry loop works.", "No placeholder blockers in the main flow."],
      playerFeelChecks: ["Player understands goal, danger, feedback, and next attempt."],
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
