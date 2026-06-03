import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const cli = path.join(root, "dist", "cli.js");
const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "gameos-universal-deep-"));
const dataDir = path.join(workDir, "data");
const verdictTiers = new Set(["LOCAL_PROTOTYPE_READY", "CREATOR_TEST_READY", "NEEDS_IMPROVEMENT", "BLOCKED"]);

const promptFamilies = [
  {
    family: "arcade score loop",
    expectedCapability: "arcade-loop",
    prompt: "A one-button arcade survival game where players dodge patterns, collect score shards, build streaks, and retry instantly."
  },
  {
    family: "deterministic rules strategy",
    expectedCapability: "rules",
    prompt: "A deterministic turn-based strategy game with legal moves, territory pressure, captures, invalid-move guards, and local pass-and-play."
  },
  {
    family: "asset-led physics timing",
    expectedCapability: "physics",
    prompt: "A physics timing puzzle where a hero object swings, collides, misses, resets, and reaches a readable goal through skillful input."
  },
  {
    family: "platform movement",
    expectedCapability: "platforming",
    prompt: "A compact platform movement challenge with jumps, collisions, hazards, checkpoints, retry, and readable momentum."
  },
  {
    family: "combat/survival loop",
    expectedCapability: "combat",
    prompt: "A small combat survival arena where players kite threats, attack, dodge, manage health, score survival time, and retry."
  },
  {
    family: "racing motion",
    expectedCapability: "racing",
    prompt: "A racing motion challenge with steering, speed control, checkpoint gates, track collisions, recovery, and instant retry."
  },
  {
    family: "resource/economy management",
    expectedCapability: "economy",
    prompt: "A resource management game where players earn currency, spend on upgrades, avoid invalid purchases, and improve production."
  },
  {
    family: "puzzle logic",
    expectedCapability: "puzzle",
    prompt: "A puzzle logic game with valid solutions, invalid moves, hints, reset, and clear state feedback."
  },
  {
    family: "narrative choice loop",
    expectedCapability: "narrative",
    prompt: "A narrative choice game where decisions create consequences, state memory, branching story beats, and a compact replay loop."
  },
  {
    family: "local multiplayer/pass-and-play",
    expectedCapability: "multiplayer",
    prompt: "A local multiplayer pass-and-play game with player ownership, turn handoff, invalid cross-player actions, and shared score pressure."
  }
];

try {
  assert(fs.existsSync(cli), "dist/cli.js is missing. Run npm run build:cli first.");
  const results = [];

  for (const fixture of promptFamilies) {
    const make = JSON.parse(
      runCli([
        "make",
        "--prompt",
        fixture.prompt,
        "--target",
        "web-playable",
        "--quality",
        "fast",
        "--yes",
        "--json"
      ])
    );
    const projectId = make.project.id;
    const projectRoot = path.join(dataDir, "projects", projectId);
    const webRoot = path.join(projectRoot, "web");
    const manifestPath = path.join(webRoot, "web-adapter-manifest.json");
    const artifactList = JSON.parse(runCli(["artifact", "list", projectId, "--json"]));
    const artifactKinds = new Set((artifactList.artifacts ?? []).map((artifact) => artifact.kind));
    const diagnosis = JSON.parse(runCliAllowingBlocked(["diagnose", projectId, "--json"]));
    const staticQa = JSON.parse(runCli(["qa", "web", projectId, "--static", "--json"]));
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    const webReport = readArtifactContent(projectId, "web-playtest-report");
    const capabilityMap = readArtifactContent(projectId, "capability-map");
    const acceptanceProfile = readArtifactContent(projectId, "acceptance-profile");

    assert(artifactKinds.has("capability-map"), `${fixture.family}: capability map artifact missing.`);
    assert(artifactKinds.has("acceptance-profile"), `${fixture.family}: acceptance profile artifact missing.`);
    assert(fs.existsSync(path.join(webRoot, "index.html")), `${fixture.family}: Web build missing.`);
    assert(artifactKinds.has("web-playtest-report"), `${fixture.family}: QA artifact missing.`);
    assert(staticQa.qa?.details?.runtimeHook === true, `${fixture.family}: static QA did not prove runtime hook.`);
    assert(staticQa.qa?.details?.watermarkMarkup === true, `${fixture.family}: static QA did not prove watermark markup.`);
    assert(manifest.generatedBy === "Game OS", `${fixture.family}: manifest generatedBy is missing.`);
    assert(manifest.watermark?.required === true, `${fixture.family}: watermark policy is missing.`);
    assert(manifest.prototype === "capability-web", `${fixture.family}: expected capability-web, got ${manifest.prototype}.`);
    assert(Array.isArray(manifest.capabilities) && manifest.capabilities.includes(fixture.expectedCapability), `${fixture.family}: manifest missing ${fixture.expectedCapability}.`);
    assert(new RegExp(`- Id:\\s*${escapeRegex(fixture.expectedCapability)}\\b`).test(capabilityMap), `${fixture.family}: capability map missing ${fixture.expectedCapability}.`);
    assert(acceptanceProfile.includes(fixture.expectedCapability) || acceptanceProfile.toLowerCase().includes(fixture.family.split("/")[0]), `${fixture.family}: acceptance profile is not capability-specific.`);
    assert(webReport.includes("Capability verdict"), `${fixture.family}: web player report is missing capability verdict.`);
    assert(webReport.includes("Selected core capabilities"), `${fixture.family}: web player report is missing selected capability evidence.`);
    assert(!hasNarrowLane(manifest, webRoot), `${fixture.family}: Web build used a narrow named-game lane.`);
    assert(verdictTiers.has(diagnosis.diagnosis?.verdict), `${fixture.family}: unknown verdict ${diagnosis.diagnosis?.verdict}.`);
    assert(diagnosis.diagnosis?.blocker && diagnosis.diagnosis?.failedCapability && diagnosis.diagnosis?.owningAgent && diagnosis.diagnosis?.nextCommand, `${fixture.family}: diagnosis is missing blocker, failed capability, owner, or next command.`);

    results.push({
      family: fixture.family,
      expectedCapability: fixture.expectedCapability,
      projectId,
      verdict: diagnosis.diagnosis.verdict,
      blocker: diagnosis.diagnosis.blocker
    });
  }

  console.log("GAMEOS_UNIVERSAL_DEEP_ACCEPTANCE: PASS");
  console.log(JSON.stringify({ ok: true, dataDir, families: results }, null, 2));
} finally {
  if (process.env.GAME_OS_KEEP_ACCEPTANCE_DATA !== "1") fs.rmSync(workDir, { recursive: true, force: true });
}

function runCli(args) {
  return execFileSync(process.execPath, [cli, ...args, "--data-dir", dataDir], cliOptions());
}

function runCliAllowingBlocked(args) {
  try {
    return runCli(args);
  } catch (error) {
    if (error.stdout) return error.stdout.toString();
    throw error;
  }
}

function readArtifactContent(projectId, kind) {
  const payload = JSON.parse(runCli(["artifact", "read", projectId, kind, "--full", "--json"]));
  assert(typeof payload.content === "string" && payload.content.length > 0, `${kind}: artifact content missing.`);
  return payload.content;
}

function hasNarrowLane(manifest, webRoot) {
  const scripts = Array.isArray(manifest.scripts) ? manifest.scripts : [];
  if (scripts.some((script) => script.includes("turn-rules"))) return true;
  if (fs.existsSync(path.join(webRoot, "scripts", "turn-rules.js"))) return true;
  return false;
}

function cliOptions() {
  return {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      GAME_OS_DATA_DIR: dataDir,
      NODE_OPTIONS: "--disable-warning=ExperimentalWarning"
    }
  };
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
