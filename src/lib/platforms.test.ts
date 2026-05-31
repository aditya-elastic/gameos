import { describe, expect, it } from "vitest";
import { createPlatformPlans, normalizePlatformName, platformReadinessScore } from "./platforms";
import type { GameProject } from "./types";

const project: GameProject = {
  id: "game_test",
  name: "Clip Arena",
  prompt: "A creator challenge game.",
  genre: "Creator Challenge",
  targetAudience: "creator and YouTube playtest audience",
  targetPlatforms: ["Steam", "PC"],
  enginePreference: "Engine-neutral first",
  status: "swarm-ready",
  createdAt: "2026-05-31T00:00:00.000Z",
  updatedAt: "2026-05-31T00:00:00.000Z"
};

describe("platform planning", () => {
  it("normalizes known target names", () => {
    expect(normalizePlatformName("Steam build")).toBe("Steam Test");
    expect(normalizePlatformName("Gowda")).toBe("Godot");
    expect(normalizePlatformName("iPhone")).toBe("iOS");
  });

  it("marks selected platforms as targeted and future engines as planned", () => {
    const plans = createPlatformPlans(project);
    const steam = plans.find((plan) => plan.platform === "Steam Test");
    const unity = plans.find((plan) => plan.platform === "Unity");

    expect(steam?.status).toBe("targeted");
    expect(steam?.readinessGates.join(" ")).toContain("no direct publishing automation");
    expect(unity?.status).toBe("planned");
    expect(platformReadinessScore(plans)).toBeGreaterThan(0);
  });
});
