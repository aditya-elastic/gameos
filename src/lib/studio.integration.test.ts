import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeDatabasesForTests } from "./db";
import {
  createStudioProject,
  createStudioReview,
  generateGodotAdapter,
  generateUnityAdapter,
  generateWebAdapter,
  getStudioDashboard,
  importProjectAssets,
  recordUserFeedback,
  recordUnityAdvancedPlaytest,
  recordWebPlaytest,
  regenerateAgent
} from "./studio";

let dataDir = "";

beforeEach(() => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "game-os-test-"));
  process.env.GAME_OS_DATA_DIR = dataDir;
});

afterEach(() => {
  closeDatabasesForTests();
  fs.rmSync(dataDir, { recursive: true, force: true });
  delete process.env.GAME_OS_DATA_DIR;
});

describe("studio workflow", () => {
  it("creates a complete studio room from one prompt", () => {
    const workspace = createStudioProject({
      prompt:
        "A small game for YouTube players where creators survive fast challenge rooms, get funny fail moments, and prepare for Steam test readiness.",
      targetPlatforms: ["Steam Test", "PC Test"],
      enginePreference: "Engine-neutral first"
    });

    expect(workspace.project.status).toBe("swarm-ready");
    expect(workspace.agents.length).toBeGreaterThanOrEqual(21);
    expect(workspace.assetPlan.items.length).toBeGreaterThanOrEqual(4);
    expect(workspace.platformPlans.find((plan) => plan.platform === "Steam Test")?.status).toBe("targeted");
    expect(workspace.qaGates.length).toBeGreaterThanOrEqual(8);
    expect(workspace.studioPlan).toContain("Steam as test readiness only");
    expect(workspace.artifacts.length).toBeGreaterThanOrEqual(30);
    expect(workspace.artifacts.map((artifact) => artifact.kind)).toContain("playtest-script");
    expect(workspace.artifacts.map((artifact) => artifact.kind)).toContain("engine-adapter-brief");
    expect(workspace.artifacts.map((artifact) => artifact.kind)).toContain("rules-spec");
    expect(workspace.artifacts.map((artifact) => artifact.kind)).toContain("memory-map");
    expect(workspace.artifacts.map((artifact) => artifact.kind)).toContain("storage-manifest");
    expect(fs.existsSync(path.join(dataDir, "game-os.sqlite"))).toBe(true);
    expect(workspace.artifacts.every((artifact) => fs.existsSync(artifact.path))).toBe(true);
  });

  it("creates board-game aware artifacts for Ludo", () => {
    const workspace = createStudioProject({
      prompt:
        "Create a polished Ludo game called Royal Ludo Table for family players with local pass-and-play, bot turns, clear dice, safe squares, captures, home lanes, and save resume.",
      targetPlatforms: ["Web", "PC Test"],
      enginePreference: "Engine-neutral first"
    });

    expect(workspace.project.genre).toBe("Board Game Strategy");
    expect(workspace.brief.coreLoop.join(" ")).toContain("Roll the dice");
    expect(workspace.assetPlan.items.map((item) => item.name)).toContain("Ludo Board");
    expect(workspace.agents.map((agent) => agent.role)).toContain("rules-systems-designer");
    expect(workspace.agents.map((agent) => agent.role)).toContain("memory-manager");
    expect(workspace.agents.map((agent) => agent.role)).toContain("storage-manager");
    expect(workspace.agents.map((agent) => agent.role)).toContain("asset-pipeline-director");
    expect(workspace.agents.map((agent) => agent.role)).toContain("visual-quality-director");
    expect(workspace.agents.map((agent) => agent.role)).toContain("physics-gameplay-engineer");
    expect(workspace.agents.map((agent) => agent.role)).toContain("gameplay-developer");
    expect(workspace.agents.map((agent) => agent.role)).toContain("ux-flow-director");
    expect(workspace.agents.map((agent) => agent.role)).toContain("game-feel-director");
    expect(workspace.agents.map((agent) => agent.role)).toContain("security-privacy-reviewer");
    expect(workspace.agents.map((agent) => agent.role)).toContain("open-source-release-engineer");
    const rulesSpec = workspace.artifacts.find((artifact) => artifact.kind === "rules-spec");
    expect(rulesSpec && fs.readFileSync(rulesSpec.path, "utf8")).toContain("classic digital Ludo baseline");
  });

  it("generates a Godot adapter scaffold for Ludo", () => {
    const workspace = createStudioProject({
      prompt:
        "Create a polished Ludo game called Royal Ludo Table for family players with local pass-and-play, bot turns, clear dice, safe squares, captures, home lanes, and save resume.",
      targetPlatforms: ["Godot", "PC Test"],
      enginePreference: "Godot first"
    });

    const updated = generateGodotAdapter(workspace.project.id);
    const adapterArtifact = updated.artifacts.find((artifact) => artifact.kind === "godot-adapter");
    const godotRoot = path.join(dataDir, "projects", workspace.project.id, "godot");

    expect(adapterArtifact && fs.readFileSync(adapterArtifact.path, "utf8")).toContain("Godot Adapter");
    expect(fs.existsSync(path.join(godotRoot, "project.godot"))).toBe(true);
    expect(fs.readFileSync(path.join(godotRoot, "scripts", "ludo_rules.gd"), "utf8")).toContain("win_token_target");
    expect(fs.readFileSync(path.join(godotRoot, "scripts", "adapter_smoke.gd"), "utf8")).toContain("GODOT_ADAPTER_SMOKE");
    expect(fs.readFileSync(path.join(godotRoot, "scripts", "player_agent.gd"), "utf8")).toContain("WORTH_PLAYING_FOR_RULES_PROTOTYPE");

    const regenerated = generateGodotAdapter(workspace.project.id);
    const regeneratedArtifact = regenerated.artifacts.find((artifact) => artifact.kind === "godot-adapter");
    expect(regeneratedArtifact?.id).toBe(adapterArtifact?.id);
  });

  it("generates a Unity adapter scaffold for Ludo", () => {
    const workspace = createStudioProject({
      prompt:
        "Create a polished Ludo game called Royal Ludo Table for family players with local pass-and-play, bot turns, clear dice, safe squares, captures, home lanes, and save resume.",
      targetPlatforms: ["Unity", "PC Test"],
      enginePreference: "Unity first"
    });

    const updated = generateUnityAdapter(workspace.project.id);
    const adapterArtifact = updated.artifacts.find((artifact) => artifact.kind === "unity-adapter");
    const unityRoot = path.join(dataDir, "projects", workspace.project.id, "unity");

    expect(adapterArtifact && fs.readFileSync(adapterArtifact.path, "utf8")).toContain("Unity Adapter");
    expect(fs.existsSync(path.join(unityRoot, "ProjectSettings", "ProjectVersion.txt"))).toBe(true);
    expect(fs.readFileSync(path.join(unityRoot, "Assets", "Scripts", "LudoRules.cs"), "utf8")).toContain("WinTokenTarget");
    expect(fs.readFileSync(path.join(unityRoot, "Assets", "Editor", "GameOsUnitySmoke.cs"), "utf8")).toContain("UNITY_ADAPTER_SMOKE");
    expect(fs.readFileSync(path.join(unityRoot, "Assets", "Editor", "GameOsUnityPlayerAgent.cs"), "utf8")).toContain("WORTH_PLAYING_FOR_RULES_PROTOTYPE");
    expect(fs.readFileSync(path.join(unityRoot, "Assets", "Editor", "GameOsUnityAdvancedPlaytest.cs"), "utf8")).toContain(
      "UNITY_ADVANCED_PLAYTEST_REPORT"
    );

    const regenerated = generateUnityAdapter(workspace.project.id);
    const regeneratedArtifact = regenerated.artifacts.find((artifact) => artifact.kind === "unity-adapter");
    expect(regeneratedArtifact?.id).toBe(adapterArtifact?.id);
  });

  it("records a Unity advanced-player playtest as an OS artifact", () => {
    const workspace = createStudioProject({
      prompt:
        "Create a polished Ludo game called Royal Ludo Table for family players with local pass-and-play, bot turns, clear dice, safe squares, captures, home lanes, and save resume.",
      targetPlatforms: ["Unity", "PC Test"],
      enginePreference: "Unity first"
    });

    generateUnityAdapter(workspace.project.id);
    const updated = recordUnityAdvancedPlaytest(workspace.project.id, {
      agent: "Advanced Player - Unity Table Strategist",
      claim: "scene-aware advanced-player playtest",
      matches: 12,
      average_turns: 208.3,
      captures: 129,
      releases: 286,
      homes: 43,
      passes: 265,
      timeouts: 0,
      branching_decisions: 1849,
      finish_choices: 43,
      capture_choices: 129,
      safe_choices: 284,
      release_choices: 286,
      scene_loaded: true,
      controller_found: true,
      verdict: "ADVANCED_PLAYER_APPROVED_UNITY_SLICE"
    });
    const artifact = updated.artifacts.find((item) => item.kind === "unity-playtest-report");

    expect(artifact?.label).toBe("Unity Advanced Playtest");
    expect(artifact && fs.readFileSync(artifact.path, "utf8")).toContain("ADVANCED_PLAYER_APPROVED_UNITY_SLICE");
    expect(artifact && fs.readFileSync(artifact.path, "utf8")).toContain("Branching decisions: 1849");
  });

  it("generates and records the Web adapter lane for Ludo", () => {
    const workspace = createStudioProject({
      prompt:
        "Create a polished Ludo game called Royal Ludo Table for family players with local pass-and-play, bot turns, clear dice, safe squares, captures, home lanes, and save resume.",
      targetPlatforms: ["Web", "PC Test"],
      enginePreference: "Web first"
    });

    const updated = generateWebAdapter(workspace.project.id);
    const adapterArtifact = updated.artifacts.find((artifact) => artifact.kind === "web-adapter");
    const webRoot = path.join(dataDir, "projects", workspace.project.id, "web");

    expect(adapterArtifact && fs.readFileSync(adapterArtifact.path, "utf8")).toContain("Web Adapter");
    expect(fs.existsSync(path.join(webRoot, "index.html"))).toBe(true);
    expect(fs.readFileSync(path.join(webRoot, "scripts", "ludo-rules.js"), "utf8")).toContain("simulateMatches");
    expect(fs.readFileSync(path.join(webRoot, "scripts", "game.js"), "utf8")).toContain("__gameOsWebAdapter");

    const played = recordWebPlaytest(workspace.project.id, {
      agent: "Advanced Web Player - Browser Table Strategist",
      claim: "browser-playable web-channel player-agent simulation",
      matches: 8,
      average_turns: 205.2,
      captures: 84,
      releases: 180,
      homes: 28,
      passes: 160,
      timeouts: 0,
      branching_decisions: 1200,
      finish_choices: 28,
      capture_choices: 84,
      safe_choices: 180,
      release_choices: 180,
      verdict: "WORTH_PLAYING_FOR_WEB_RULES_PROTOTYPE"
    });
    const reportArtifact = played.artifacts.find((artifact) => artifact.kind === "web-playtest-report");

    expect(reportArtifact?.label).toBe("Web Player Agent Report");
    expect(reportArtifact && fs.readFileSync(reportArtifact.path, "utf8")).toContain("WORTH_PLAYING_FOR_WEB_RULES_PROTOTYPE");

    const reviewed = createStudioReview(workspace.project.id);
    const scorecardArtifact = reviewed.workspace.artifacts.find((artifact) => artifact.kind === "studio-scorecard");
    expect(reviewed.scorecard.overallScore).toBe(10);
    expect(reviewed.scorecard.verdict).toBe("10_OUT_OF_10_READY_FOR_LOCAL_USERS");
    expect(scorecardArtifact?.label).toBe("10/10 Studio Scorecard");
    expect(scorecardArtifact && fs.readFileSync(scorecardArtifact.path, "utf8")).toContain("Open Source Release Readiness");
  });

  it("imports a Kenney-like asset pack and generates an asset-driven Cut Rope web build", () => {
    const workspace = createStudioProject({
      prompt:
        "A physics puzzle game called Cut The Rope where the player cuts a rope, drops candy into a hungry character, collects stars, and proves the uploaded Kenney asset pipeline.",
      targetPlatforms: ["Web", "PC Test"],
      enginePreference: "Web first",
      genre: "Physics Puzzle"
    });
    const assetZip = createKenneyLikeZipFixture();

    const imported = importProjectAssets(workspace.project.id, "kenney-cut-rope-fixture.zip", fs.readFileSync(assetZip));
    const importReport = imported.artifacts.find((artifact) => artifact.kind === "asset-import-report");
    const manifest = imported.artifacts.find((artifact) => artifact.kind === "asset-pack-manifest");
    const preview = imported.artifacts.find((artifact) => artifact.kind === "asset-preview-manifest");

    expect(importReport && fs.readFileSync(importReport.path, "utf8")).toContain("APPROVED_FOR_CUT_ROPE_WEB_PROTOTYPE");
    expect(manifest && fs.readFileSync(manifest.path, "utf8")).toContain("candy-ball.png");
    expect(preview && fs.readFileSync(preview.path, "utf8")).toContain('"role": "hero-object"');

    const updated = generateWebAdapter(workspace.project.id);
    const webRoot = path.join(dataDir, "projects", workspace.project.id, "web");
    const adapterArtifact = updated.artifacts.find((artifact) => artifact.kind === "web-adapter");

    expect(adapterArtifact && fs.readFileSync(adapterArtifact.path, "utf8")).toContain("Cut Rope physics puzzle");
    expect(fs.existsSync(path.join(webRoot, "index.html"))).toBe(true);
    expect(fs.readFileSync(path.join(webRoot, "scripts", "game.js"), "utf8")).toContain("WORTH_PLAYING_FOR_CUT_ROPE_WEB_PROTOTYPE");
    expect(fs.readdirSync(path.join(webRoot, "assets")).length).toBeGreaterThanOrEqual(6);
  });

  it("regenerates one agent without losing the rest of the swarm", () => {
    const workspace = createStudioProject({
      prompt:
        "A small game for YouTube players where creators dodge traps, collect reactions, and test the idea before any store publishing.",
      targetPlatforms: ["Steam Test"],
      enginePreference: "Engine-neutral first"
    });
    const beforeAgents = workspace.agents;
    const beforeDesigner = beforeAgents.find((agent) => agent.role === "game-designer");

    const updated = regenerateAgent(workspace.project.id, "game-designer");
    const afterDesigner = updated.agents.find((agent) => agent.role === "game-designer");

    expect(updated.agents).toHaveLength(beforeAgents.length);
    expect(afterDesigner?.runNumber).toBe((beforeDesigner?.runNumber ?? 0) + 1);
    expect(updated.agents.find((agent) => agent.role === "studio-director")?.runNumber).toBe(1);
    expect(getStudioDashboard()).toHaveLength(1);
  });

  it("records creator feedback and routes it into regenerated agents", () => {
    const workspace = createStudioProject({
      prompt:
        "A rope cut physics puzzle for web players where the first prototype must use uploaded assets, clean reset behavior, and mature visual composition.",
      targetPlatforms: ["Web"],
      enginePreference: "Web first"
    });
    const note = "reset auto-cuts, background ugly, and uploaded assets are not role-fit";

    const feedbackWorkspace = recordUserFeedback(workspace.project.id, note);
    const feedbackArtifact = feedbackWorkspace.artifacts.find((artifact) => artifact.kind === "user-feedback");
    const updated = regenerateAgent(workspace.project.id, "visual-quality-director");
    const agent = updated.agents.find((run) => run.role === "visual-quality-director");

    expect(feedbackArtifact && fs.readFileSync(feedbackArtifact.path, "utf8")).toContain(note);
    expect(agent?.input).toContain(note);
    expect(agent?.output).toContain(note);
  });
});

function createKenneyLikeZipFixture(): string {
  const fixtureRoot = fs.mkdtempSync(path.join(dataDir, "kenney-fixture-"));
  const imageBytes = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
    "base64"
  );
  const names = ["candy-ball.png", "star-gold.png", "monster-mouth.png", "wood-background.png", "button-ui.png", "peg-hook.png"];
  for (const name of names) {
    fs.writeFileSync(path.join(fixtureRoot, name), imageBytes);
  }

  const zipPath = path.join(dataDir, "kenney-cut-rope-fixture.zip");
  execFileSync("zip", ["-qr", zipPath, "."], { cwd: fixtureRoot });
  return zipPath;
}
