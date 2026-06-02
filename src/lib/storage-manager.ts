import type { ProjectWorkspace } from "./types";

export function createStorageManifest(workspace: Omit<ProjectWorkspace, "artifacts">): string {
  const { project, agents } = workspace;

  return [
    `# ${project.name} Storage Manifest`,
    "",
    "## Local-First Storage",
    "- SQLite stores project records, brief fields, agent runs, asset plans, platform plans, QA gates, and artifact metadata.",
    "- Markdown files store human-readable generated memory under `data/projects/<project-id>/`.",
    "- Generated local data remains ignored by git so open-source contributors do not leak personal project runs.",
    "",
    "## Artifact Layout",
    "- `game-bible.md`",
    "- `rules-spec.md`",
    "- `asset-plan.md`",
    "- `platform-plan.md`",
    "- `qa-gates.md`",
    "- `production-roadmap.md`",
    "- `risk-register.md`",
    "- `memory-map.md`",
    "- `storage-manifest.md`",
    "- `test-matrix.md`",
    "- `first-playtest-script.md`",
    "- `engine-adapter-brief.md`",
    "- `agents/<role>-run-<n>.md`",
    "",
    "## Agent Run Storage",
    ...agents.map((agent) => `- ${agent.role}: latest run #${agent.runNumber}, persisted in SQLite and mirrored to Markdown.`),
    "",
    "## Integrity Checks",
    "- A workspace is incomplete if any canonical artifact is missing.",
    "- A regenerated agent must keep prior artifacts and increment only that role's run number.",
    "- API error responses must be JSON, never raw stack traces.",
    "- `npm run smoke` verifies create, invalid-input handling, regeneration, and artifact preview."
  ].join("\n");
}

