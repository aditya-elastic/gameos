import { describe, expect, it } from "vitest";
import { examplesPayload, friendlyTier, renderExamplesText, starterIdeas } from "./starter-ideas";

describe("starter ideas", () => {
  it("renders universal starter prompts without named demo language", () => {
    const text = renderExamplesText();

    expect(starterIdeas.length).toBeGreaterThanOrEqual(6);
    expect(text).toContain("one-button arcade survival");
    expect(text).toContain("physics timing puzzle");
    expect(text).toContain("turn-based strategy");
    expect(text).toContain("gameos make --prompt");
    expect(text).not.toMatch(/\bludo\b|\bcut the rope\b|\bcandy\b/i);
  });

  it("provides automation-safe example payloads and friendly tiers", () => {
    const payload = examplesPayload();

    expect(Array.isArray(payload.examples)).toBe(true);
    expect(friendlyTier("CREATOR_TEST_READY")).toBe("Creator-test ready");
    expect(friendlyTier("LOCAL_PROTOTYPE_READY")).toBe("Local prototype ready");
  });
});
