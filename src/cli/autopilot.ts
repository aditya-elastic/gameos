import { createStudioReview, generateWebAdapter, recordUserFeedback, regenerateAgent } from "../lib/studio";
import type { ProjectWorkspace } from "../lib/types";
import { runWebQa } from "./web-qa";

export type ImproveResult = {
  workspace: ProjectWorkspace;
  roles: string[];
  qaVerdict: string;
  reviewVerdict: string;
  status: string;
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
  const blocker = firstBlocker(review.workspace, qa.report.verdict);
  const readyStatus =
    review.scorecard.verdict === "CREATOR_TEST_READY"
      ? "Improved to Creator-test ready"
      : review.scorecard.verdict === "LOCAL_PROTOTYPE_READY"
        ? "Improved to Local prototype ready"
        : blocker.toLowerCase().includes("asset")
          ? "Needs your choice: assets missing"
          : `Still blocked by ${friendlyBlockerName(blocker)}`;

  return {
    workspace: review.workspace,
    roles,
    qaVerdict: qa.report.verdict,
    reviewVerdict: review.scorecard.verdict,
    status: readyStatus,
    blocker: readyStatus.startsWith("Improved") ? "none" : blocker
  };
}

export function routeFeedbackToAgents(note: string): string[] {
  const text = note.toLowerCase();
  const roles = new Set<string>(["global-os-designer", "product-truth-officer", "acceptance-architect", "evidence-auditor", "studio-director", "gameplay-developer", "qa-director", "advanced-player-council", "advanced-player"]);

  if (/asset|sprite|image|background|art|visual|ugly|style|color|polish|hud|text|ui|readable|wrong/.test(text)) {
    roles.add("art-director");
    roles.add("asset-pipeline-director");
    roles.add("visual-quality-director");
    roles.add("ux-flow-director");
  }

  if (/physics|rope|cut|mouse|touch|drag|smooth|reset|retry|input|control|collision|gravity|heavy|light|swing|momentum/.test(text)) {
    roles.add("physics-gameplay-engineer");
    roles.add("game-feel-director");
    roles.add("game-designer");
  }

  if (/rule|level|difficulty|fun|boring|goal|loop|progress|challenge|better|improve/.test(text)) {
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
  if (qaVerdict === "STATIC_WEB_QA_PASS_BROWSER_REQUIRED_FOR_WORTH_PLAYING") return "browser QA";
  if (!qaVerdict.startsWith("WORTH_PLAYING")) return qaVerdict;
  const blockedGate = workspace.qaGates.find((gate) => gate.result === "blocked");
  if (blockedGate) return blockedGate.name;
  return "Trust review did not reach a ready verdict.";
}

function friendlyBlockerName(blocker: string): string {
  const text = blocker.toLowerCase();
  if (text.includes("input") || text.includes("reset") || text.includes("retry")) return "input proof";
  if (text.includes("asset")) return "asset fit";
  if (text.includes("browser")) return "browser QA";
  if (text.includes("player") || text.includes("worth")) return "stronger player evidence";
  if (text.includes("visual")) return "visual proof";
  return blocker || "trust proof";
}
