const baseUrl = process.env.GAME_OS_BASE_URL || "http://localhost:3000";

const demoPayload = {
  prompt:
    "ClipForge Gauntlet is a small creator challenge game for YouTube players. Creators sprint through shifting mini arenas, dodge reaction traps, grab risky highlight tokens, and bank a final clip score for Steam test readiness without store publishing.",
  targetPlatforms: ["PC Test", "Steam Test", "Web"],
  enginePreference: "Engine-neutral first",
  genre: "Creator Challenge",
  targetAudience: "creator and YouTube playtest audience"
};

async function main() {
  const home = await fetch(baseUrl);
  assert(home.ok, `home returned ${home.status}`);

  const invalid = await fetch(`${baseUrl}/api/projects`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prompt: "too short", targetPlatforms: [] })
  });
  assert(invalid.status === 400, `invalid create should return 400, got ${invalid.status}`);
  const invalidJson = await invalid.json();
  assert(Array.isArray(invalidJson.details), "invalid create should include validation details");

  const create = await fetch(`${baseUrl}/api/projects`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(demoPayload)
  });
  assert(create.status === 201, `demo create returned ${create.status}`);
  const createJson = await create.json();
  const project = createJson.project;

  assert(project.project.name, "project should have a name");
  assert(project.agents.length >= 13, `expected at least 13 agents, got ${project.agents.length}`);
  assert(project.qaGates.length >= 7, `expected at least 7 QA gates, got ${project.qaGates.length}`);
  assert(project.artifacts.length >= 25, `expected at least 25 artifacts, got ${project.artifacts.length}`);
  assert(project.artifacts.some((artifact) => artifact.kind === "playtest-script"), "playtest script artifact missing");
  assert(project.artifacts.some((artifact) => artifact.kind === "engine-adapter-brief"), "engine adapter brief artifact missing");
  assert(project.artifacts.some((artifact) => artifact.kind === "memory-map"), "memory map artifact missing");
  assert(project.artifacts.some((artifact) => artifact.kind === "storage-manifest"), "storage manifest artifact missing");

  const regenerate = await fetch(`${baseUrl}/api/projects/${project.project.id}/agents/game-designer`, { method: "POST" });
  assert(regenerate.ok, `agent regenerate returned ${regenerate.status}`);
  const regenerated = await regenerate.json();
  const designer = regenerated.project.agents.find((agent) => agent.role === "game-designer");
  assert(designer.runNumber === 2, `expected game designer run #2, got ${designer?.runNumber}`);

  const playtest = regenerated.project.artifacts.find((artifact) => artifact.kind === "playtest-script");
  const artifact = await fetch(`${baseUrl}/api/projects/${project.project.id}/artifacts/${playtest.id}`);
  assert(artifact.ok, `artifact preview returned ${artifact.status}`);
  const artifactJson = await artifact.json();
  assert(artifactJson.artifact.content.includes("First Playtest Script"), "artifact content should include playtest script");

  console.log(
    JSON.stringify(
      {
        ok: true,
        projectId: project.project.id,
        projectName: project.project.name,
        agents: project.agents.length,
        qaGates: project.qaGates.length,
        artifacts: project.artifacts.length,
        regeneratedDesignerRun: designer.runNumber
      },
      null,
      2
    )
  );
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
