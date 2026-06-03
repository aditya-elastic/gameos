import { createStudioReview, generateWebAdapter, recordUserFeedback, regenerateAgent } from "../lib/studio";
import type { ProjectWorkspace } from "../lib/types";
import { runWebQa } from "./web-qa";

export type ImproveResult = {
  workspace: ProjectWorkspace;
  roles: string[];
  qaVerdict: string;
  reviewVerdict: string;
  status: "Improved" | "Still blocked";
  blocker: string;
};

export async function improveProjectWithAutopilot(projectId: string, note: string, options: { browser: boolean }): Promise<ImproveResult> {
  let workspace = recordUserFeedback(projectId, note);
  const roles = routeFeedbackToAgents(note);

  for (const role of roles) {
    workspace = regenerateAgent(projectId, role);
  }

  workspace = generateWebAdapter(projectId);
  const qa = await runWebQa(projectId, { browser: options.browser });
  const review = createStudioReview(projectId);
  const improved = qa.report.verdict.startsWith("WORTH_PLAYING") && review.scorecard.verdict.startsWith("10_OUT_OF_10");

  return {
    workspace: review.workspace,
    roles,
    qaVerdict: qa.report.verdict,
    reviewVerdict: review.scorecard.verdict,
    status: improved ? "Improved" : "Still blocked",
    blocker: improved ? "none" : firstBlocker(review.workspace, qa.report.verdict)
  };
}

export function routeFeedbackToAgents(note: string): string[] {
  const text = note.toLowerCase();
  const roles = new Set<string>(["studio-director", "gameplay-developer", "qa-director", "advanced-player"]);

  if (/asset|sprite|kenney|image|background|art|visual|ugly|style|color|polish|hud|text|ui|readable/.test(text)) {
    roles.add("art-director");
    roles.add("asset-pipeline-director");
    roles.add("visual-quality-director");
    roles.add("ux-flow-director");
  }

  if (/physics|rope|cut|mouse|touch|drag|smooth|reset|collision|gravity|heavy|light|swing|momentum/.test(text)) {
    roles.add("physics-gameplay-engineer");
    roles.add("game-feel-director");
    roles.add("game-designer");
  }

  if (/rule|level|difficulty|fun|boring|goal|loop|progress|challenge/.test(text)) {
    roles.add("game-designer");
    roles.add("rules-systems-designer");
    roles.add("game-feel-director");
  }

  if (/security|privacy|storage|save|memory|local|file/.test(text)) {
    roles.add("memory-manager");
    roles.add("storage-manager");
    roles.add("security-privacy-reviewer");
  }

  return [...roles];
}

function firstBlocker(workspace: ProjectWorkspace, qaVerdict: string): string {
  const blockedGate = workspace.qaGates.find((gate) => gate.result === "blocked");
  if (blockedGate) return blockedGate.name;
  if (!qaVerdict.startsWith("WORTH_PLAYING")) return qaVerdict;
  return "Studio review did not reach 10/10.";
}
