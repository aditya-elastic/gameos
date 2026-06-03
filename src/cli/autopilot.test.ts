import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeDatabasesForTests } from "../lib/db";
import { createStudioProject } from "../lib/studio";
import { improveProjectWithAutopilot, routeFeedbackToAgents } from "./autopilot";

let dataDir = "";

beforeEach(() => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "game-os-autopilot-test-"));
  process.env.GAME_OS_DATA_DIR = dataDir;
});

afterEach(() => {
  closeDatabasesForTests();
  fs.rmSync(dataDir, { recursive: true, force: true });
  delete process.env.GAME_OS_DATA_DIR;
});

describe("autopilot improve", () => {
  it("routes natural feedback to the right specialist agents", () => {
    const roles = routeFeedbackToAgents("The rope is hard to cut, the mouse feels rough, the background is ugly, and save data should stay local.");

    expect(roles).toContain("physics-gameplay-engineer");
    expect(roles).toContain("game-feel-director");
    expect(roles).toContain("visual-quality-director");
    expect(roles).toContain("asset-pipeline-director");
    expect(roles).toContain("storage-manager");
    expect(roles).toContain("security-privacy-reviewer");
    expect(roles).toContain("advanced-player");
  });

  it("records feedback, reruns agents, rebuilds Web, runs QA, and writes a review", async () => {
    const workspace = createStudioProject({
      prompt: "A small Web puzzle game where creators test a quick timing challenge with clear retry feedback.",
      targetPlatforms: ["Web"],
      enginePreference: "Web first"
    });
    const result = await improveProjectWithAutopilot(workspace.project.id, "Make the retry feedback clearer and the visual layout more polished.", {
      browser: false
    });

    expect(result.roles).toContain("visual-quality-director");
    expect(result.workspace.artifacts.map((artifact) => artifact.kind)).toContain("user-feedback");
    expect(result.workspace.artifacts.map((artifact) => artifact.kind)).toContain("web-adapter");
    expect(result.workspace.artifacts.map((artifact) => artifact.kind)).toContain("web-playtest-report");
    expect(result.workspace.artifacts.map((artifact) => artifact.kind)).toContain("studio-scorecard");
    expect(result.workspace.agents.find((agent) => agent.role === "visual-quality-director")?.runNumber).toBe(2);
    expect(result.qaVerdict).toBe("STATIC_WEB_QA_PASS_BROWSER_REQUIRED_FOR_WORTH_PLAYING");
    expect(result.status).toBe("Still blocked by browser QA");
  });
});
