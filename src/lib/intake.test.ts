import { describe, expect, it } from "vitest";
import { inferAudience, inferGenre, inferProjectName, makeProjectFromInput } from "./intake";

describe("game intake", () => {
  it("infers creator challenge context from a single prompt", () => {
    const prompt =
      "A small game for YouTube creators where players survive fast challenge rooms, chase highlight moments, and test Steam readiness later.";

    expect(inferGenre(prompt)).toBe("Creator Challenge");
    expect(inferAudience(prompt)).toBe("creator and YouTube playtest audience");
  });

  it("creates a normalized project model", () => {
    const project = makeProjectFromInput("game_test", {
      prompt:
        "A small game for YouTube players where every attempt is a quick challenge room with one dramatic fail or clutch finish.",
      targetPlatforms: ["Steam Test", "Steam Test", "PC Test"],
      enginePreference: "Engine-neutral first"
    });

    expect(project.id).toBe("game_test");
    expect(project.status).toBe("swarm-ready");
    expect(project.targetPlatforms).toEqual(["Steam Test", "PC Test"]);
    expect(project.targetAudience).toContain("YouTube");
  });

  it("extracts explicit project names when present", () => {
    expect(inferProjectName("Create a game called Clip Arena where creators race through traps.", "Creator Challenge")).toBe("Clip Arena");
  });
});
