import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeDatabasesForTests } from "./db";
import { createStudioProject, importProjectAssetsFromStoredFile } from "./studio";
import { assignAssetPhysicsAssetRoles, renderAssetPreview } from "./asset-importer";
import type { ImportedAssetFile } from "./types";

let dataDir = "";

beforeEach(() => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "game-os-asset-importer-test-"));
  process.env.GAME_OS_DATA_DIR = dataDir;
});

afterEach(() => {
  closeDatabasesForTests();
  fs.rmSync(dataDir, { recursive: true, force: true });
  delete process.env.GAME_OS_DATA_DIR;
});

describe("asset-led physics asset role classifier", () => {
  it("rejects UI buttons as the hero physics object", () => {
    const assignments = assignAssetPhysicsAssetRoles([
      image("button_round_depth_line.png", ["hero-object", "ui"]),
      image("panel_ui.png", ["ui"])
    ]);

    const hero = assignments.find((assignment) => assignment.role === "hero-object");
    const ui = assignments.find((assignment) => assignment.role === "ui");

    expect(hero?.status).toBe("missing");
    expect(hero?.file).toBeUndefined();
    expect(ui?.status).toBe("accepted");
  });

  it("maps a strong asset-led physics pack into gameplay roles", () => {
    const assignments = assignAssetPhysicsAssetRoles([
      image("hero-ball.png", ["hero-object"]),
      image("monster-mouth.png", ["character"]),
      image("star-gold.png", ["collectible"]),
      image("wood-background.png", ["background"]),
      image("button-ui.png", ["ui"])
    ]);

    expect(assignments.find((assignment) => assignment.role === "hero-object")?.file?.relativePath).toBe("hero-ball.png");
    expect(assignments.find((assignment) => assignment.role === "goal-character")?.file?.relativePath).toBe("monster-mouth.png");
    expect(assignments.find((assignment) => assignment.role === "collectible")?.file?.relativePath).toBe("star-gold.png");
    expect(assignments.find((assignment) => assignment.role === "rope-connector")?.status).toBe("procedural-required");
  });

  it("previews missing and imported asset role fit in friendly language", () => {
    const workspace = createStudioProject({
      prompt: "A physics timing puzzle that should use uploaded assets for hero object, goal, background, and collectibles.",
      targetPlatforms: ["Web"],
      enginePreference: "Web first"
    });
    const emptyPreview = renderAssetPreview(workspace);
    expect(emptyPreview.ok).toBe(false);
    expect(emptyPreview.text).toContain("No assets imported yet");

    const assetDir = path.join(dataDir, "uploaded-pack");
    fs.mkdirSync(assetDir, { recursive: true });
    fs.writeFileSync(path.join(assetDir, "hero-ball.png"), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    fs.writeFileSync(path.join(assetDir, "monster-goal.png"), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    fs.writeFileSync(path.join(assetDir, "star-collectible.png"), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    fs.writeFileSync(path.join(assetDir, "forest-background.png"), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));

    importProjectAssetsFromStoredFile(workspace.project.id, "uploaded-pack", assetDir);
    const preview = renderAssetPreview(workspace);

    expect(preview.ok).toBe(true);
    expect(preview.text).toContain("Asset Preview");
    expect(preview.text).toContain("Role Fit");
    expect(preview.roles.length).toBeGreaterThan(0);
  });
});

function image(relativePath: string, tags: ImportedAssetFile["tags"]): ImportedAssetFile {
  return {
    name: relativePath,
    relativePath,
    absolutePath: `/fixture/${relativePath}`,
    kind: "image",
    sizeBytes: 1200,
    tags,
    score: 64
  };
}
