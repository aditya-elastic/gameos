import { describe, expect, it } from "vitest";
import { summarizeQAGates, workspaceAcceptanceResult } from "./qa";
import type { ProjectWorkspace, QAGate } from "./types";

const gates: QAGate[] = [
  {
    id: "a",
    projectId: "game_test",
    name: "A",
    automatedChecks: [],
    headedPlaytestChecks: [],
    playerFeelChecks: [],
    result: "pass"
  },
  {
    id: "b",
    projectId: "game_test",
    name: "B",
    automatedChecks: [],
    headedPlaytestChecks: [],
    playerFeelChecks: [],
    result: "watch"
  },
  {
    id: "c",
    projectId: "game_test",
    name: "C",
    automatedChecks: [],
    headedPlaytestChecks: [],
    playerFeelChecks: [],
    result: "blocked"
  }
];

describe("QA gates", () => {
  it("summarizes gate states", () => {
    expect(summarizeQAGates(gates)).toEqual({ pass: 1, watch: 1, blocked: 1 });
  });

  it("blocks acceptance when any gate is blocked", () => {
    const workspace = {
      qaGates: gates,
      agents: []
    } as ProjectWorkspace;

    expect(workspaceAcceptanceResult(workspace)).toBe("blocked");
  });
});
