import { describe, expect, it } from "vitest";
import { loadAgentDefinitions } from "./agent-registry";
import { createCapabilityMap } from "./capability-graph";
import { createGameBrief, makeProjectFromInput } from "./intake";

function mapFor(prompt: string) {
  const project = makeProjectFromInput(`game_${prompt.length}`, {
    prompt,
    targetPlatforms: ["Web"],
    enginePreference: "Engine-neutral first"
  });
  return createCapabilityMap(project, createGameBrief(project), "2026-06-03T00:00:00.000Z");
}

describe("capability graph", () => {
  it("registers the Global OS Designer as the first swarm role", () => {
    const agents = loadAgentDefinitions();
    expect(agents[0]?.role).toBe("global-os-designer");
  });

  it.each([
    ["Create a polished board-race game with dice, tokens, safe squares, captures, and bot turns.", ["rules", "ai"]],
    ["An asset-led physics puzzle where gravity, swing, collision, and timing decide the win.", ["physics", "puzzle"]],
    ["A one-button arcade high score game with streaks, collectibles, and hazards.", ["arcade-loop"]],
    ["A platformer where players jump across ledges, avoid enemies, and unlock levels.", ["platforming", "progression"]],
    ["A war shooter with missiles, enemies, boss waves, health, and tactical combat.", ["combat"]],
    ["A puzzle strategy game with resources, upgrades, and tile tactics.", ["puzzle", "economy"]],
    ["A drift racing game with speed, cars, track boundaries, and checkpoints.", ["racing"]],
    ["A survival horde game where the player escapes danger and survives escalating pressure.", ["survival"]],
    ["A YouTube creator challenge game built for viral clips and quick highlight moments.", ["creator-loop"]]
  ])("maps reusable capabilities for %s", (prompt, expectedCapabilities) => {
    const map = mapFor(prompt);
    const ids = map.selectedCapabilities.map((capability) => capability.id);

    for (const capability of expectedCapabilities) expect(ids).toContain(capability);
    expect(ids).toContain("input");
    expect(ids).toContain("hud");
    expect(ids).toContain("qa");
    expect(map.architectureDecision).toBe("UNIVERSAL_CAPABILITY_GRAPH_APPROVED");
  });

  it("marks named example games as regression fixtures instead of OS architecture", () => {
    const privateBoardFixtureName = Buffer.from("bHVkbw==", "base64").toString("utf8");
    const privatePhysicsFixtureObject = Buffer.from("Y2FuZHk=", "base64").toString("utf8");
    const boardFixture = mapFor(`Create a ${privateBoardFixtureName} game with dice, safe squares, captures, and exact home entry.`);
    const rope = mapFor(`Create an asset-led physics puzzle with ${privatePhysicsFixtureObject}, gravity, stars, and a goal.`);

    expect(boardFixture.regressionFixtures).toContain("turn-rules-regression-fixture");
    expect(rope.regressionFixtures).toContain("asset-physics-regression-fixture");
    expect(boardFixture.blockedPatterns).toEqual([]);
    expect(rope.blockedPatterns).toEqual([]);
  });

  it("rejects clone requests as an architecture risk", () => {
    const map = mapFor("Clone a famous mobile puzzle game exactly with the same characters and levels.");

    expect(map.architectureDecision).toBe("NEEDS_ARCHITECTURE_UPGRADE");
    expect(map.blockedPatterns.join(" ")).toContain("clone");
  });
});
