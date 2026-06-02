import type { ProjectWorkspace } from "./types";

export function createMemoryMap(workspace: Omit<ProjectWorkspace, "artifacts">): string {
  const { project, brief, agents, qaGates } = workspace;

  return [
    `# ${project.name} Memory Map`,
    "",
    "## Durable Studio Memory",
    `- Project identity: ${project.name}, ${project.genre}, ${project.targetAudience}.`,
    `- Fantasy: ${brief.fantasy}`,
    `- Platforms: ${project.targetPlatforms.join(", ")}.`,
    "- Canonical artifacts: game bible, rules spec, asset plan, platform plan, QA gates, roadmap, risk register, playtest script, memory map, storage manifest, test matrix, engine adapter brief.",
    "",
    "## Agent Recall Index",
    ...agents.map((agent) => `- ${agent.title}: latest run #${agent.runNumber}, status ${agent.status}, confidence ${Math.round(agent.confidence * 100)}%.`),
    "",
    "## QA Memory",
    ...qaGates.map((gate) => `- ${gate.name}: ${gate.result}.`),
    "",
    "## Next Context Handoff",
    "- Load this memory map before regenerating agents or creating an engine adapter.",
    "- Treat rule decisions, QA gates, and storage manifest as hard context, not optional notes.",
    "- Append new playtest evidence instead of overwriting the prior decision trail."
  ].join("\n");
}
