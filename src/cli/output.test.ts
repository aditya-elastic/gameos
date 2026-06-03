import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeDatabasesForTests } from "../lib/db";
import { createStudioProject, generateWebAdapter, recordWebPlaytest } from "../lib/studio";
import { getNextAction, renderNextAction } from "./output";

let dataDir = "";

beforeEach(() => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "game-os-output-test-"));
  process.env.GAME_OS_DATA_DIR = dataDir;
});

afterEach(() => {
  closeDatabasesForTests();
  fs.rmSync(dataDir, { recursive: true, force: true });
  delete process.env.GAME_OS_DATA_DIR;
});

describe("next action output", () => {
  it("points fresh Web projects to the build command", () => {
    const workspace = createStudioProject({
      prompt: "A one-button arcade survival game with score, hazards, streaks, and fast retry.",
      targetPlatforms: ["Web"],
      enginePreference: "Web first"
    });

    const next = getNextAction(workspace);

    expect(next.label).toBe("Build Web");
    expect(next.command).toBe(`gameos build web ${workspace.project.id}`);
    expect(renderNextAction(workspace)).toContain("Next best action: Build Web");
  });

  it("uses friendly browser QA language after static proof", () => {
    const workspace = createStudioProject({
      prompt: "A compact platform movement challenge with jumps, hazards, checkpoints, and retry.",
      targetPlatforms: ["Web"],
      enginePreference: "Web first"
    });
    generateWebAdapter(workspace.project.id);
    const played = recordWebPlaytest(workspace.project.id, {
      kind: "capability-web",
      matches: 0,
      timeouts: 0,
      verdict: "STATIC_WEB_QA_PASS_BROWSER_REQUIRED_FOR_WORTH_PLAYING"
    });

    const next = getNextAction(played);

    expect(next.verdictLabel).toBe("Needs browser QA");
    expect(next.label).toBe("Run browser QA");
    expect(next.command).toBe(`gameos qa web ${workspace.project.id}`);
  });
});
