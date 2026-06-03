import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeDatabasesForTests } from "../lib/db";
import { createStudioProject, createStudioReview, generateWebAdapter, recordWebPlaytest } from "../lib/studio";
import { getCockpitState, rankCockpitActions } from "./actions";

let dataDir = "";

beforeEach(() => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "game-os-actions-test-"));
  process.env.GAME_OS_DATA_DIR = dataDir;
});

afterEach(() => {
  closeDatabasesForTests();
  fs.rmSync(dataDir, { recursive: true, force: true });
  delete process.env.GAME_OS_DATA_DIR;
});

describe("cockpit action ranking", () => {
  it("keeps the new-user action list short", () => {
    const actions = rankCockpitActions(null);

    expect(actions).toHaveLength(5);
    expect(actions.map((action) => action.label)).toEqual(["Create New Game", "Use Starter Idea", "Import Assets", "Open Recent Project", "Doctor"]);
  });

  it("shows no more than five project actions", () => {
    const workspace = createStudioProject({
      prompt: "A small Web puzzle game for creators with quick testing, simple assets, and a clear first playable loop.",
      targetPlatforms: ["Web"],
      enginePreference: "Web first"
    });
    const state = getCockpitState([workspace]);

    expect(state.actions.length).toBeLessThanOrEqual(5);
    expect(state.actions.map((action) => action.label)).toContain("Add Assets");
    expect(state.actions.map((action) => action.label)).toContain("View Plan");
  });

  it("prioritizes play and improve after a project is worth playing", () => {
    const workspace = createStudioProject({
      prompt: "Create a polished turn-based board-race game for family players with dice, tokens, captures, safe squares, and save resume.",
      targetPlatforms: ["Web"],
      enginePreference: "Web first"
    });
    generateWebAdapter(workspace.project.id);
    const played = recordWebPlaytest(workspace.project.id, {
      kind: "turn-rules",
      matches: 8,
      timeouts: 0,
      verdict: "WORTH_PLAYING_FOR_WEB_RULES_PROTOTYPE"
    });
    const reviewed = createStudioReview(played.project.id);
    const state = getCockpitState([reviewed.workspace]);

    expect(state.actions).toHaveLength(5);
    expect(state.actions.map((action) => action.label)).toEqual(["Play", "Improve", "Add Assets", "View Verdict", "Open Artifacts"]);
  });
});
