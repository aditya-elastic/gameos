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

  it("parses make assets and feedback notes", () => {
    const make = parseArgv(["make", "--prompt", "A rope cut physics puzzle for web players", "--target", "web-playable", "--assets", "./assets.zip"]);
    const feedback = parseArgv(["feedback", "game_123", "--note", "reset auto-cuts and asset roles are wrong"]);
    const review = parseArgv(["review", "game_123", "--json"]);

    expect(make.command).toEqual(["make"]);
    expect(make.flags.get("assets")).toEqual(["./assets.zip"]);
    expect(feedback.command).toEqual(["feedback"]);
    expect(feedback.positionals).toEqual(["game_123"]);
    expect(feedback.flags.get("note")).toEqual(["reset auto-cuts and asset roles are wrong"]);
    expect(review.command).toEqual(["review"]);
    expect(review.positionals).toEqual(["game_123"]);
    expect(review.flags.get("json")).toEqual(["true"]);
  });

  it("validates quality and target values", () => {
    expect(parseQuality("fast")).toBe("fast");
    expect(parseQuality(undefined)).toBe("standard");
    expect(parseMakeTarget("web-playable")).toBe("web-playable");
    expect(() => parseQuality("reckless")).toThrow("Unknown quality");
    expect(() => parseMakeTarget("steam-publish")).toThrow("Unknown make target");
  });
});
