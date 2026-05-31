import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeDatabasesForTests } from "./db";
import { createStudioProject, getStudioDashboard, regenerateAgent } from "./studio";

let dataDir = "";

beforeEach(() => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "game-os-test-"));
  process.env.GAME_OS_DATA_DIR = dataDir;
});

afterEach(() => {
  closeDatabasesForTests();
  fs.rmSync(dataDir, { recursive: true, force: true });
  delete process.env.GAME_OS_DATA_DIR;
});

describe("studio workflow", () => {
  it("creates a complete studio room from one prompt", () => {
    const workspace = createStudioProject({
      prompt:
        "A small game for YouTube players where creators survive fast challenge rooms, get funny fail moments, and prepare for Steam test readiness.",
      targetPlatforms: ["Steam Test", "PC Test"],
      enginePreference: "Engine-neutral first"
    });

    expect(workspace.project.status).toBe("swarm-ready");
    expect(workspace.agents).toHaveLength(8);
    expect(workspace.assetPlan.items.length).toBeGreaterThanOrEqual(4);
    expect(workspace.platformPlans.find((plan) => plan.platform === "Steam Test")?.status).toBe("targeted");
    expect(workspace.qaGates).toHaveLength(5);
    expect(workspace.studioPlan).toContain("Steam as test readiness only");
    expect(workspace.artifacts.length).toBeGreaterThanOrEqual(17);
    expect(workspace.artifacts.map((artifact) => artifact.kind)).toContain("playtest-script");
    expect(workspace.artifacts.map((artifact) => artifact.kind)).toContain("engine-adapter-brief");
    expect(fs.existsSync(path.join(dataDir, "game-os.sqlite"))).toBe(true);
    expect(workspace.artifacts.every((artifact) => fs.existsSync(artifact.path))).toBe(true);
  });

  it("regenerates one agent without losing the rest of the swarm", () => {
    const workspace = createStudioProject({
      prompt:
        "A small game for YouTube players where creators dodge traps, collect reactions, and test the idea before any store publishing.",
      targetPlatforms: ["Steam Test"],
      enginePreference: "Engine-neutral first"
    });
    const beforeAgents = workspace.agents;
    const beforeDesigner = beforeAgents.find((agent) => agent.role === "game-designer");

    const updated = regenerateAgent(workspace.project.id, "game-designer");
    const afterDesigner = updated.agents.find((agent) => agent.role === "game-designer");

    expect(updated.agents).toHaveLength(beforeAgents.length);
    expect(afterDesigner?.runNumber).toBe((beforeDesigner?.runNumber ?? 0) + 1);
    expect(updated.agents.find((agent) => agent.role === "studio-director")?.runNumber).toBe(1);
    expect(getStudioDashboard()).toHaveLength(1);
  });
});
