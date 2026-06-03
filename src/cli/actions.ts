import { readArtifactContent } from "../lib/artifacts";
import type { ProjectWorkspace } from "../lib/types";

export type CockpitActionId =
  | "create"
  | "doctor"
  | "play"
  | "improve"
  | "add-assets"
  | "build-web"
  | "qa-web"
  | "view-verdict"
  | "view-artifacts"
  | "quit";

export type CockpitAction = {
  id: CockpitActionId;
  label: string;
  detail: string;
  hotkey: string;
};

export type CockpitState = {
  activeProject: ProjectWorkspace | null;
  verdict: string;
  blocker: string;
  actions: CockpitAction[];
};

export function getCockpitState(projects: ProjectWorkspace[]): CockpitState {
  const sorted = [...projects].sort((left, right) => Date.parse(right.project.updatedAt) - Date.parse(left.project.updatedAt));
  const activeProject = sorted[0] ?? null;
  const verdict = activeProject ? latestWebVerdict(activeProject) : "No project yet";
  const blocker = activeProject ? oneLineBlocker(activeProject, verdict) : "Create your first game to start the studio.";

  return {
    activeProject,
    verdict,
    blocker,
    actions: rankCockpitActions(activeProject, verdict).slice(0, 5)
  };
}

export function rankCockpitActions(workspace: ProjectWorkspace | null, verdict = ""): CockpitAction[] {
  if (!workspace) {
    return [
      action("create", "Create Game", "Start from one idea. Web is selected by default.", "n"),
      action("doctor", "Doctor", "Check local readiness without changing anything.", "d"),
      action("quit", "Quit", "Leave Game OS Cockpit.", "q")
    ];
  }

  const hasAssets = workspace.artifacts.some((artifact) => artifact.kind === "asset-pack-manifest");
  const hasWeb = workspace.artifacts.some((artifact) => artifact.kind === "web-adapter");
  const hasWebQa = workspace.artifacts.some((artifact) => artifact.kind === "web-playtest-report");
  const hasScorecard = workspace.artifacts.some((artifact) => artifact.kind === "studio-scorecard");
  const worthPlaying = verdict.startsWith("WORTH_PLAYING");
  const failedQa = hasWebQa && !worthPlaying;

  if (failedQa) {
    return [
      action("improve", "Fix With Autopilot", "Describe what feels wrong; agents rebuild and QA again.", "i"),
      action("view-verdict", "View Blocker", "Show the exact journey blocker.", "v"),
      action("add-assets", "Add Assets", "Import a better role-fit asset pack.", "a"),
      action("play", "Play Current Build", "Open the latest Web prototype for inspection.", "p"),
      action("quit", "Quit", "Leave Game OS Cockpit.", "q")
    ];
  }

  if (worthPlaying || hasScorecard) {
    return [
      action("play", "Play", "Open the latest Web prototype.", "p"),
      action("improve", "Improve", "Give feedback; Game OS reruns the right agents.", "i"),
      action("add-assets", "Add Assets", "Import or replace the asset pack.", "a"),
      action("view-verdict", "View Verdict", "See journey, QA, and blockers.", "v"),
      action("view-artifacts", "Open Artifacts", "List generated briefs, reports, and manifests.", "o")
    ];
  }

  return [
    action(hasAssets ? "build-web" : "add-assets", hasAssets ? "Build Web" : "Add Assets", hasAssets ? "Generate the playable Web lane." : "Import files before the asset-led build.", hasAssets ? "b" : "a"),
    action(hasWeb ? "qa-web" : "build-web", hasWeb ? "Run QA" : "Build Web", hasWeb ? "Run browser/static Web QA." : "Generate the playable Web lane.", hasWeb ? "r" : "b"),
    action("view-verdict", "View Plan", "Inspect the current journey and next blocker.", "v"),
    action("improve", "Improve", "Record feedback and let Autopilot decide the next pass.", "i"),
    action("create", "New Game", "Start another idea.", "n")
  ];
}

export function oneLineBlocker(workspace: ProjectWorkspace, verdict = latestWebVerdict(workspace)): string {
  const blockedGate = workspace.qaGates.find((gate) => gate.result === "blocked");
  if (blockedGate) return blockedGate.name;
  if (!workspace.artifacts.some((artifact) => artifact.kind === "asset-pack-manifest") && /cut.*rope|rope.*cut|physics puzzle/i.test(workspace.project.prompt)) {
    return "Asset-led physics game needs an asset pack.";
  }
  if (!workspace.artifacts.some((artifact) => artifact.kind === "web-adapter")) return "Web build has not been generated yet.";
  if (!workspace.artifacts.some((artifact) => artifact.kind === "web-playtest-report")) return "Web QA has not been run yet.";
  if (verdict && !verdict.startsWith("WORTH_PLAYING") && verdict !== "not run") return verdict;
  return "none";
}

function latestWebVerdict(workspace: ProjectWorkspace): string {
  const report = [...workspace.artifacts].reverse().find((artifact) => artifact.kind === "web-playtest-report");
  if (!report) return "not run";
  try {
    const content = readArtifactContent(report.path);
    return content.match(/- Verdict:\s*(.+)/)?.[1]?.trim() ?? "not run";
  } catch {
    return "not run";
  }
}

function action(id: CockpitActionId, label: string, detail: string, hotkey: string): CockpitAction {
  return { id, label, detail, hotkey };
}
