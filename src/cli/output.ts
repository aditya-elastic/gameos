import path from "node:path";
import { readArtifactContent } from "../lib/artifacts";
import type { StudioScorecard } from "../lib/scorecard";
import type { ArtifactRecord, ProjectWorkspace, QAGate } from "../lib/types";
import { friendlyTier } from "./starter-ideas";

export type OutputMode = {
  json: boolean;
  full: boolean;
};

export function printResult(mode: OutputMode, payload: unknown, text: string): void {
  if (mode.json) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    return;
  }

  process.stdout.write(`${text.trimEnd()}\n`);
}

export function renderWorkspaceSummary(workspace: ProjectWorkspace): string {
  const qa = summarizeQa(workspace.qaGates);
  const next = getNextAction(workspace);

  return [
    `Game OS project: ${workspace.project.name}`,
    `Project id: ${workspace.project.id}`,
    `Genre: ${workspace.project.genre}`,
    `Targets: ${workspace.project.targetPlatforms.join(", ")}`,
    `Agents: ${workspace.agents.length} complete`,
    `Artifacts: ${workspace.artifacts.length}`,
    `QA: ${qa.pass} pass, ${qa.watch} watch, ${qa.blocked} blocked`,
    `Verdict: ${next.verdictLabel}`,
    `Blocker: ${next.blocker}`,
    `Confidence: ${next.confidenceReason}`,
    `Next best action: ${next.label}`,
    `Command: ${next.command}`
  ].join("\n");
}

export function renderProjectStatus(workspace: ProjectWorkspace): string {
  const blockers = workspace.qaGates.filter((gate) => gate.result === "blocked");
  const watch = workspace.qaGates.filter((gate) => gate.result === "watch");
  const latestArtifacts = [...workspace.artifacts].slice(-5);

  return [
    renderWorkspaceSummary(workspace),
    "",
    renderJourney(workspace),
    "",
    "Latest artifacts:",
    ...latestArtifacts.map((artifact) => `- ${artifact.label} (${artifact.kind})`),
    "",
    "Watch gates:",
    ...(watch.length ? watch.map((gate) => `- ${gate.name}`) : ["- none"]),
    "",
    "Blocked gates:",
    ...(blockers.length ? blockers.map((gate) => `- ${gate.name}`) : ["- none"])
  ].join("\n");
}

export function renderJourney(workspace: ProjectWorkspace): string {
  const assetManifest = readLatestJsonArtifact<Record<string, unknown>>(workspace, "asset-pack-manifest");
  const previewManifest = readLatestJsonArtifact<Record<string, unknown>>(workspace, "asset-preview-manifest");
  const webReport = readLatestMarkdownArtifact(workspace, "web-playtest-report");
  const scorecard = readLatestMarkdownArtifact(workspace, "studio-scorecard");
  const osReview = readLatestMarkdownArtifact(workspace, "os-design-review");
  const capabilityMap = readLatestMarkdownArtifact(workspace, "capability-map");
  const assetVerdict = typeof assetManifest?.verdict === "string" ? assetManifest.verdict : "not imported";
  const roleAssignments = Array.isArray(previewManifest?.roleAssignments) ? (previewManifest.roleAssignments as Record<string, unknown>[]) : [];
  const webVerdict = readMarkdownValue(webReport, "Verdict") ?? "not run";
  const visualVerdict = readMarkdownValue(webReport, "Visual verdict") ?? "not run";
  const physicsVerdict = readMarkdownValue(webReport, "Physics verdict") ?? "not run";
  const inputVerdict = readMarkdownValue(webReport, "Input verdict") ?? "not run";
  const assetFitVerdict = readMarkdownValue(webReport, "Asset fit verdict") ?? "not run";
  const resetVerdict = readMarkdownValue(webReport, "Reset/recut pass") ?? "not run";
  const timingVerdict = readMarkdownValue(webReport, "Timing skill verdict") ?? "not run";
  const agencyVerdict = readMarkdownValue(webReport, "Agency verdict") ?? "not run";
  const masteryVerdict = readMarkdownValue(webReport, "Mastery verdict") ?? "not run";
  const sliceVerdict = readMarkdownValue(webReport, "Slice gesture verdict") ?? "not run";
  const smoothMouseVerdict = readMarkdownValue(webReport, "Smooth mouse verdict") ?? "not run";
  const studioScore = readMarkdownValue(scorecard, "Overall score") ?? "not run";
  const studioVerdict = readMarkdownValue(scorecard, "Verdict") ?? "not run";
  const osDecision = readMarkdownValue(osReview, "UNIVERSAL_CAPABILITY_GRAPH_APPROVED") ?? (/UNIVERSAL_CAPABILITY_GRAPH_APPROVED/.test(osReview) ? "UNIVERSAL_CAPABILITY_GRAPH_APPROVED" : "not run");

  const next = getNextAction(workspace);
  const stages = [
    stageLine("Idea", "pass", `${workspace.project.genre} for ${workspace.project.targetAudience}`),
    stageLine("OS Architecture", capabilityMap && osDecision === "UNIVERSAL_CAPABILITY_GRAPH_APPROVED" ? "pass" : "blocked", capabilityMap ? osDecision : "capability map missing"),
    stageLine("Swarm", workspace.agents.every((agent) => agent.status === "complete") ? "pass" : "watch", `${workspace.agents.length} agents`),
    stageLine("Assets", assetManifest ? assetVerdictStatus(assetVerdict) : "watch", friendlyVerdictLabel(assetVerdict)),
    stageLine("Build", workspace.artifacts.some((artifact) => artifact.kind === "web-adapter") ? "pass" : "watch", "Web lane"),
    stageLine("Visual QA", gateStatus(visualVerdict), friendlyVerdictLabel(visualVerdict)),
    stageLine("Physics QA", gateStatus(physicsVerdict), friendlyVerdictLabel(physicsVerdict)),
    stageLine("Player QA", webVerdict.startsWith("WORTH_PLAYING") ? "pass" : webVerdict === "not run" ? "watch" : "blocked", friendlyVerdictLabel(webVerdict)),
    stageLine("Trust Review", readinessStatus(studioVerdict), studioVerdict === "not run" ? studioScore : friendlyVerdictLabel(studioVerdict)),
    stageLine("Feedback", workspace.artifacts.some((artifact) => artifact.kind === "user-feedback") ? "pass" : "watch", "optional")
  ];
  const blockers = inferJourneyBlockers(workspace, {
    assetVerdict,
    roleAssignments,
    webVerdict,
    visualVerdict,
    physicsVerdict,
    timingVerdict,
    agencyVerdict,
    masteryVerdict,
    sliceVerdict,
    smoothMouseVerdict,
    studioScore,
    studioVerdict,
    inputVerdict,
    assetFitVerdict,
    resetVerdict
  });

  return [
    "Journey:",
    ...stages,
    "",
    "Current blockers:",
    ...(blockers.length ? blockers.map((blocker) => `- ${blocker}`) : ["- none"]),
    "",
    `Confidence: ${next.confidenceReason}`,
    `Next best action: ${next.label}`,
    `Next best command: ${next.command}`
  ].join("\n");
}

export function renderArtifactList(workspace: ProjectWorkspace): string {
  return [
    `${workspace.project.name} artifacts (${workspace.project.id})`,
    ...workspace.artifacts.map((artifact) => `- ${artifactSelector(artifact)} | ${artifact.label} | ${artifact.kind}`)
  ].join("\n");
}

export function renderScorecardSummary(scorecard: StudioScorecard): string {
  const blocked = scorecard.categories.filter((category) => category.verdict === "BLOCKED");
  const watch = scorecard.categories.filter((category) => category.verdict === "WATCH");

  return [
    `Studio review: ${scorecard.projectName}`,
    `Overall: ${formatScore(scorecard.overallScore)}/10`,
    `Minimum category: ${formatScore(scorecard.minimumCategoryScore)}/10`,
    `Verdict: ${friendlyVerdictLabel(scorecard.verdict)}`,
    `Agents reviewed: ${scorecard.agentCount}`,
    "",
    "Categories:",
    ...scorecard.categories.map((category) => `- ${category.verdict} ${category.name}: ${formatScore(category.score)}/10`),
    "",
    "Watch/blockers:",
    ...(blocked.length || watch.length
      ? [...blocked, ...watch].flatMap((category) => category.gaps.map((gap) => `- ${category.name}: ${gap}`))
      : ["- none"]),
    "",
    `Next: gameos diagnose ${scorecard.projectId}`
  ].join("\n");
}

export function summarizeArtifactContent(content: string, full: boolean): string {
  if (full || content.length <= 4800) return content;

  const lines = content.split("\n");
  const selected = lines.filter((line) => line.startsWith("#") || line.startsWith("- ") || /^\d+\./.test(line)).slice(0, 80);
  const summary = selected.length ? selected : lines.slice(0, 80);

  return [
    ...summary,
    "",
    `[summary only: ${content.length.toLocaleString()} characters total. Re-run with --full to print the complete artifact.]`
  ].join("\n");
}

export function artifactSelector(artifact: ArtifactRecord): string {
  return path.basename(artifact.path).replace(/\.[^.]+$/, "");
}

export function recommendNextCommand(workspace: ProjectWorkspace): string {
  return getNextAction(workspace).command;
}

export type NextAction = {
  label: string;
  command: string;
  reason: string;
  blocker: string;
  verdict: string;
  verdictLabel: string;
  confidenceReason: string;
};

export function renderNextAction(workspace: ProjectWorkspace): string {
  const next = getNextAction(workspace);
  return [
    `Next best action: ${next.label}`,
    `Command: ${next.command}`,
    `Verdict: ${next.verdictLabel}`,
    `Blocker: ${next.blocker}`,
    `Why: ${next.reason}`,
    `Confidence: ${next.confidenceReason}`
  ].join("\n");
}

export function getNextAction(workspace: ProjectWorkspace): NextAction {
  const hasWeb = workspace.artifacts.some((artifact) => artifact.kind === "web-adapter");
  const hasWebQa = workspace.artifacts.some((artifact) => artifact.kind === "web-playtest-report");
  const hasScorecard = workspace.artifacts.some((artifact) => artifact.kind === "studio-scorecard");
  const hasAssets = workspace.artifacts.some((artifact) => artifact.kind === "asset-pack-manifest");
  const webTargeted = workspace.platformPlans.some((plan) => plan.platform === "Web" && plan.status === "targeted");
  const wantsAssetLedPhysics = needsAssetLedPhysicsProof(workspace);
  const webVerdict = readMarkdownValue(readLatestMarkdownArtifact(workspace, "web-playtest-report"), "Verdict") ?? "not run";
  const scorecardVerdict = readMarkdownValue(readLatestMarkdownArtifact(workspace, "studio-scorecard"), "Verdict") ?? "not run";
  const verdict = scorecardVerdict !== "not run" ? scorecardVerdict : webVerdict;
  const blocker = inferFriendlyBlocker(workspace, verdict);
  const confidenceReason = confidenceFor(workspace, verdict);

  if (webTargeted && wantsAssetLedPhysics && !hasAssets) {
    return nextAction("Add assets", `gameos assets import ${workspace.project.id} ./assets.zip`, "This project selected physics/asset systems and needs role-fit files before stronger QA.", blocker, verdict, confidenceReason);
  }
  if (webTargeted && !hasWeb) return nextAction("Build Web", `gameos build web ${workspace.project.id}`, "The Web lane is the fastest playable proof path.", blocker, verdict, confidenceReason);
  if (hasWeb && !hasWebQa) return nextAction("Run Web QA", `gameos qa web ${workspace.project.id}`, "The build exists but no player-agent QA evidence has been recorded.", blocker, verdict, confidenceReason);
  if (hasWebQa) {
    if (webVerdict.startsWith("WORTH_PLAYING") && !hasScorecard) return nextAction("Run trust review", `gameos review ${workspace.project.id}`, "QA passed; the project now needs truth/scorecard review.", blocker, verdict, confidenceReason);
    if (webVerdict.startsWith("WORTH_PLAYING")) return nextAction("Play latest build", `gameos play ${workspace.project.id}`, "The latest evidence says the Web build is playable.", blocker, verdict, confidenceReason);
    if (webVerdict === "STATIC_WEB_QA_PASS_BROWSER_REQUIRED_FOR_WORTH_PLAYING") return nextAction("Run browser QA", `gameos qa web ${workspace.project.id}`, "Static QA passed, but browser QA is required for a stronger verdict.", blocker, verdict, confidenceReason);
    return nextAction("Improve with feedback", `gameos improve ${workspace.project.id}`, "The player-agent verdict is not strong enough yet.", blocker, verdict, confidenceReason);
  }
  return nextAction("Inspect artifacts", `gameos artifact list ${workspace.project.id}`, "Game OS has generated planning artifacts; inspect them or continue building.", blocker, verdict, confidenceReason);
}

function nextAction(label: string, command: string, reason: string, blocker: string, verdict: string, confidenceReason: string): NextAction {
  return { label, command, reason, blocker, verdict, verdictLabel: friendlyVerdictLabel(verdict), confidenceReason };
}

export function friendlyVerdictLabel(verdict: string): string {
  if (!verdict || verdict === "not run") return "Not run yet";
  if (verdict === "STATIC_WEB_QA_PASS_BROWSER_REQUIRED_FOR_WORTH_PLAYING") return "Needs browser QA";
  if (verdict === "WRONG_ASSET_PACK_FOR_ASSET_PHYSICS") return "Needs asset fit";
  if (verdict === "PARTIAL_ASSET_MATCH_NEEDS_PLACEHOLDERS") return "Needs stronger asset fit";
  if (verdict === "INPUT_GATE_PASS") return "Input proof passed";
  if (verdict.includes("INPUT") && !verdict.endsWith("_PASS")) return "Needs input proof";
  if (verdict.startsWith("WORTH_PLAYING")) return "Worth playing locally";
  if (verdict.includes("PLAYER") || verdict.includes("QA")) return "Needs stronger player evidence";
  return friendlyTier(verdict);
}

function inferFriendlyBlocker(workspace: ProjectWorkspace, verdict: string): string {
  const blockedGate = workspace.qaGates.find((gate) => gate.result === "blocked");
  if (blockedGate) return blockedGate.name;
  if (!workspace.artifacts.some((artifact) => artifact.kind === "web-adapter")) return "Web build missing";
  if (!workspace.artifacts.some((artifact) => artifact.kind === "web-playtest-report")) return "Web QA missing";
  if (verdict === "STATIC_WEB_QA_PASS_BROWSER_REQUIRED_FOR_WORTH_PLAYING") return "Needs browser QA";
  if (verdict === "WRONG_ASSET_PACK_FOR_ASSET_PHYSICS" || verdict === "PARTIAL_ASSET_MATCH_NEEDS_PLACEHOLDERS") return "Needs asset fit";
  if (verdict === "NEEDS_IMPROVEMENT") return "Needs stronger player evidence";
  return "none";
}

function confidenceFor(workspace: ProjectWorkspace, verdict: string): string {
  if (verdict === "CREATOR_TEST_READY") return "Acceptance profile, browser QA, scorecard, and provenance agree.";
  if (verdict === "LOCAL_PROTOTYPE_READY") return "Playable local evidence exists, but creator-test proof is not complete.";
  if (verdict === "STATIC_WEB_QA_PASS_BROWSER_REQUIRED_FOR_WORTH_PLAYING") return "Static files are valid; browser/player proof is still needed.";
  if (!workspace.artifacts.some((artifact) => artifact.kind === "web-playtest-report")) return "No QA artifact yet.";
  return "Based on latest Game OS artifacts and QA evidence.";
}

function latestArtifact(workspace: ProjectWorkspace, kind: ArtifactRecord["kind"]): ArtifactRecord | undefined {
  return [...workspace.artifacts].reverse().find((artifact) => artifact.kind === kind);
}

function readLatestJsonArtifact<T>(workspace: ProjectWorkspace, kind: ArtifactRecord["kind"]): T | null {
  const artifact = latestArtifact(workspace, kind);
  if (!artifact) return null;
  try {
    return JSON.parse(readArtifactContent(artifact.path)) as T;
  } catch {
    return null;
  }
}

function readLatestMarkdownArtifact(workspace: ProjectWorkspace, kind: ArtifactRecord["kind"]): string {
  const artifact = latestArtifact(workspace, kind);
  if (!artifact) return "";
  try {
    return readArtifactContent(artifact.path);
  } catch {
    return "";
  }
}

function readMarkdownValue(content: string, label: string): string | null {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = content.match(new RegExp(`- ${escaped}:\\s*(.+)`));
  return match?.[1]?.trim() ?? null;
}

function stageLine(name: string, status: "pass" | "watch" | "blocked", detail: string): string {
  const marker = status === "pass" ? "PASS" : status === "blocked" ? "BLOCKED" : "WATCH";
  return `- ${marker} ${name}: ${detail}`;
}

function assetVerdictStatus(verdict: string): "pass" | "watch" | "blocked" {
  if (verdict === "APPROVED_FOR_ASSET_PHYSICS_WEB_BUILD") return "pass";
  if (verdict === "PARTIAL_ASSET_MATCH_NEEDS_PLACEHOLDERS") return "watch";
  return "blocked";
}

function gateStatus(verdict: string): "pass" | "watch" | "blocked" {
  if (verdict.endsWith("_PASS") || verdict === "true") return "pass";
  if (verdict === "not run" || verdict.endsWith("_REVIEW") || verdict.endsWith("_UNKNOWN") || verdict.endsWith("_PARTIAL")) return "watch";
  return "blocked";
}

function readinessStatus(verdict: string): "pass" | "watch" | "blocked" {
  if (verdict === "CREATOR_TEST_READY" || verdict === "LOCAL_PROTOTYPE_READY") return "pass";
  if (verdict === "not run" || verdict === "NEEDS_IMPROVEMENT") return "watch";
  return "blocked";
}

function inferJourneyBlockers(
  workspace: ProjectWorkspace,
  state: {
    assetVerdict: string;
    roleAssignments: Record<string, unknown>[];
    webVerdict: string;
    visualVerdict: string;
    physicsVerdict: string;
    timingVerdict: string;
    agencyVerdict: string;
    masteryVerdict: string;
    sliceVerdict: string;
    smoothMouseVerdict: string;
    studioScore: string;
    studioVerdict: string;
    inputVerdict: string;
    assetFitVerdict: string;
    resetVerdict: string;
  }
): string[] {
  const blockers: string[] = [];
  const roleStatus = (role: string) => state.roleAssignments.find((assignment) => assignment.role === role)?.status;

  if (needsAssetLedPhysicsProof(workspace) && state.assetVerdict === "not imported") {
    blockers.push("No asset pack imported for an asset-led physics puzzle. Run make with --assets or use gameos assets import.");
  }

  if (state.assetVerdict === "WRONG_ASSET_PACK_FOR_ASSET_PHYSICS") {
    blockers.push("Wrong assets: the pack does not contain enough role-fit files for an asset-led physics puzzle.");
  }

  for (const role of ["hero-object", "goal-character", "collectible"]) {
    const status = roleStatus(role);
    if (status && status !== "accepted") blockers.push(`Missing game-critical asset role: ${role} is ${String(status)}.`);
  }

  if (!workspace.artifacts.some((artifact) => artifact.kind === "web-adapter")) {
    blockers.push("Web build has not been generated.");
  }

  if (!workspace.artifacts.some((artifact) => artifact.kind === "capability-map")) {
    blockers.push("Capability map is missing; rerun project creation or regenerate OS architecture artifacts.");
  }

  if (state.webVerdict === "STATIC_WEB_QA_PASS_BROWSER_REQUIRED_FOR_WORTH_PLAYING") {
    blockers.push("Browser QA unavailable or skipped; static checks cannot prove worth-playing quality.");
  } else if (state.webVerdict !== "not run" && !state.webVerdict.startsWith("WORTH_PLAYING")) {
    blockers.push(`Advanced Player did not approve: ${state.webVerdict}.`);
  }

  if (state.visualVerdict !== "not run" && state.visualVerdict !== "VISUAL_GATE_PASS") blockers.push(`Visual quality gate is not passing: ${state.visualVerdict}.`);
  if (state.physicsVerdict !== "not run" && state.physicsVerdict !== "PHYSICS_GATE_PASS") blockers.push(`Physics dynamics gate is not passing: ${state.physicsVerdict}.`);
  if (state.timingVerdict !== "not run" && state.timingVerdict !== "TIMING_SKILL_PASS") blockers.push(`Timing skill gate is not passing: ${state.timingVerdict}.`);
  if (state.agencyVerdict !== "not run" && state.agencyVerdict !== "AGENCY_GATE_PASS") blockers.push(`Player agency gate is not passing: ${state.agencyVerdict}.`);
  if (state.masteryVerdict !== "not run" && state.masteryVerdict !== "MASTERY_GATE_PASS") blockers.push(`Mastery gate is not passing: ${state.masteryVerdict}.`);
  if (state.sliceVerdict !== "not run" && state.sliceVerdict !== "SLICE_GESTURE_PASS") blockers.push(`Smooth slice gesture gate is not passing: ${state.sliceVerdict}.`);
  if (state.smoothMouseVerdict !== "not run" && state.smoothMouseVerdict !== "SMOOTH_MOUSE_BLADE_PASS") blockers.push(`Smooth mouse blade gate is not passing: ${state.smoothMouseVerdict}.`);
  if (state.studioVerdict === "not run" && state.webVerdict.startsWith("WORTH_PLAYING")) blockers.push("Trust review has not been run yet. Run gameos review.");
  if (state.studioVerdict !== "not run" && state.studioVerdict !== "CREATOR_TEST_READY" && state.studioVerdict !== "LOCAL_PROTOTYPE_READY") blockers.push(`Trust review is not ready yet: ${state.studioVerdict}.`);
  if (state.inputVerdict !== "not run" && state.inputVerdict !== "INPUT_GATE_PASS") blockers.push(`Input/reset gate is not passing: ${state.inputVerdict}.`);
  if (state.assetFitVerdict !== "not run" && state.assetFitVerdict !== "ASSET_FIT_PASS") blockers.push(`Asset-fit gate is not passing: ${state.assetFitVerdict}.`);
  if (state.resetVerdict !== "not run" && state.resetVerdict !== "true") blockers.push("Reset/recut proof did not pass.");

  return [...new Set(blockers)];
}

function needsAssetLedPhysicsProof(workspace: ProjectWorkspace): boolean {
  const capabilityMap = readLatestMarkdownArtifact(workspace, "capability-map");
  if (/- Id:\s*physics\b/i.test(capabilityMap) || /Readable Physics System/i.test(capabilityMap)) return true;

  const manifest = readLatestJsonArtifact<{ prototype?: string; capabilities?: string[] }>(workspace, "web-adapter");
  if (manifest?.prototype === "asset-physics" || manifest?.capabilities?.includes("physics")) return true;

  const prompt = `${workspace.project.name} ${workspace.project.genre} ${workspace.project.prompt}`.toLowerCase();
  return /\b(physics|rope|swing|gravity|pendulum|projectile|trajectory|collision)\b/.test(prompt);
}

function formatScore(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function summarizeQa(gates: QAGate[]): { pass: number; watch: number; blocked: number } {
  return {
    pass: gates.filter((gate) => gate.result === "pass").length,
    watch: gates.filter((gate) => gate.result === "watch").length,
    blocked: gates.filter((gate) => gate.result === "blocked").length
  };
}
