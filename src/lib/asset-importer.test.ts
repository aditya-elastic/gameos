import { describe, expect, it } from "vitest";
import { assignAssetPhysicsAssetRoles } from "./asset-importer";
import type { ImportedAssetFile } from "./types";

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
