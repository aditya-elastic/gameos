import { describe, expect, it } from "vitest";
import { parseArgv } from "./main";
import { parseMakeTarget, parseQuality } from "./quality";

describe("gameos cli parser", () => {
  it("parses repeated platform flags and positionals", () => {
    const parsed = parseArgv(["create", "--prompt", "A tiny racing game", "--platform", "Web", "--platform=Godot"]);

    expect(parsed.command).toEqual(["create"]);
    expect(parsed.flags.get("platform")).toEqual(["Web", "Godot"]);
    expect(parsed.flags.get("prompt")).toEqual(["A tiny racing game"]);
  });

  it("parses subcommands separately from project ids", () => {
    const parsed = parseArgv(["artifact", "read", "game_123", "game-bible", "--full"]);

    expect(parsed.command).toEqual(["artifact", "read"]);
    expect(parsed.positionals).toEqual(["game_123", "game-bible"]);
    expect(parsed.flags.get("full")).toEqual(["true"]);
  });

  it("validates quality and target values", () => {
    expect(parseQuality("fast")).toBe("fast");
    expect(parseQuality(undefined)).toBe("standard");
    expect(parseMakeTarget("web-playable")).toBe("web-playable");
    expect(() => parseQuality("reckless")).toThrow("Unknown quality");
    expect(() => parseMakeTarget("steam-publish")).toThrow("Unknown make target");
  });
});
