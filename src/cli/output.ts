import path from "node:path";
import type { ArtifactRecord, ProjectWorkspace, QAGate } from "../lib/types";

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
  const next = recommendNextCommand(workspace);

  return [
    `Game OS project: ${workspace.project.name}`,
    `Project id: ${workspace.project.id}`,
    `Genre: ${workspace.project.genre}`,
    `Targets: ${workspace.project.targetPlatforms.join(", ")}`,
    `Agents: ${workspace.agents.length} complete`,
    `Artifacts: ${workspace.artifacts.length}`,
    `QA: ${qa.pass} pass, ${qa.watch} watch, ${qa.blocked} blocked`,
    `Next: ${next}`
  ].join("\n");
}

export function renderProjectStatus(workspace: ProjectWorkspace): string {
  const blockers = workspace.qaGates.filter((gate) => gate.result === "blocked");
  const watch = workspace.qaGates.filter((gate) => gate.result === "watch");
  const latestArtifacts = [...workspace.artifacts].slice(-5);

  return [
    renderWorkspaceSummary(workspace),
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

export function renderArtifactList(workspace: ProjectWorkspace): string {
  return [
    `${workspace.project.name} artifacts (${workspace.project.id})`,
    ...workspace.artifacts.map((artifact) => `- ${artifactSelector(artifact)} | ${artifact.label} | ${artifact.kind}`)
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
  const hasWeb = workspace.artifacts.some((artifact) => artifact.kind === "web-adapter");
  const hasWebQa = workspace.artifacts.some((artifact) => artifact.kind === "web-playtest-report");
  const webTargeted = workspace.platformPlans.some((plan) => plan.platform === "Web" && plan.status === "targeted");

  if (webTargeted && !hasWeb) return `gameos build web ${workspace.project.id}`;
  if (hasWeb && !hasWebQa) return `gameos qa web ${workspace.project.id}`;
  return `gameos artifact list ${workspace.project.id}`;
}

function summarizeQa(gates: QAGate[]): { pass: number; watch: number; blocked: number } {
  return {
    pass: gates.filter((gate) => gate.result === "pass").length,
    watch: gates.filter((gate) => gate.result === "watch").length,
    blocked: gates.filter((gate) => gate.result === "blocked").length
  };
}
