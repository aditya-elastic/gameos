import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const cli = path.join(root, "dist", "cli.js");
const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "gameos-capability-web-quality-"));
const dataDir = path.join(workDir, "data");

const fixtures = [
  {
    family: "arcade survival",
    expectedCapability: "arcade-loop",
    expectedPattern: "arcade-survival",
    prompt: "A one-button arcade survival game where players dodge readable hazards, collect score shards, build streaks, and retry instantly."
  },
  {
    family: "platform movement",
    expectedCapability: "platforming",
    expectedPattern: "platform-movement",
    prompt: "A compact platform movement challenge with jumps, collisions, hazards, checkpoints, readable momentum, and fast retry."
  },
  {
    family: "combat survival",
    expectedCapability: "combat",
    expectedPattern: "combat-survival",
    prompt: "A small combat survival arena where players kite threats, attack, dodge, manage health, score survival time, and retry."
  }
];

try {
  assert(fs.existsSync(cli), "dist/cli.js is missing. Run npm run build:cli first.");
  const results = [];

  for (const fixture of fixtures) {
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
    const qa = JSON.parse(runCli(["qa", "web", projectId, "--json"]));
    const review = JSON.parse(runCli(["review", projectId, "--json"]));
    const diagnosis = JSON.parse(runCli(["diagnose", projectId, "--json"]));
    const webRoot = path.join(dataDir, "projects", projectId, "web");
    const manifest = JSON.parse(fs.readFileSync(path.join(webRoot, "web-adapter-manifest.json"), "utf8"));
    const webReport = readArtifactContent(projectId, "web-playtest-report");

    assert(manifest.prototype === "capability-web", `${fixture.family}: expected capability-web, got ${manifest.prototype}.`);
    assert(manifest.webPattern === fixture.expectedPattern, `${fixture.family}: expected ${fixture.expectedPattern}, got ${manifest.webPattern}.`);
    assert(Array.isArray(manifest.capabilities) && manifest.capabilities.includes(fixture.expectedCapability), `${fixture.family}: manifest missing ${fixture.expectedCapability}.`);
    assert(manifest.watermark?.required === true && manifest.generatedBy === "Game OS", `${fixture.family}: provenance/watermark missing.`);
    assert(manifest.qaExpectations?.browserInteractionRequired === true, `${fixture.family}: browser interaction QA is not required by manifest.`);
    assert(qa.qa?.verdict === "WORTH_PLAYING_FOR_CAPABILITY_WEB_BUILD", `${fixture.family}: QA verdict was ${qa.qa?.verdict}.`);
    assert(qa.qa?.details?.interaction?.pass === true, `${fixture.family}: browser interaction did not pass.`);
    assert(qa.qa?.details?.visualQa?.pass === true, `${fixture.family}: visual browser QA did not pass.`);
    assert(webReport.includes(`Web pattern: ${fixture.expectedPattern}`), `${fixture.family}: report missing web pattern.`);
    assert(webReport.includes("Browser interaction verdict: BROWSER_INTERACTION_PASS"), `${fixture.family}: report missing browser interaction pass.`);
    assert(webReport.includes("Advanced Player Council verdict: ADVANCED_PLAYER_COUNCIL_PASS"), `${fixture.family}: report missing council pass.`);
    assert(review.scorecard?.verdict === "CREATOR_TEST_READY", `${fixture.family}: review verdict was ${review.scorecard?.verdict}.`);
    assert(diagnosis.diagnosis?.verdict === "CREATOR_TEST_READY", `${fixture.family}: diagnosis verdict was ${diagnosis.diagnosis?.verdict}.`);
    assert(!hasNarrowLane(manifest, webRoot), `${fixture.family}: Web build used a narrow named-game lane.`);

    results.push({
      family: fixture.family,
      projectId,
      webPattern: manifest.webPattern,
      qaVerdict: qa.qa.verdict,
      reviewVerdict: review.scorecard.verdict
    });
  }

  console.log("GAMEOS_CAPABILITY_WEB_QUALITY_ACCEPTANCE: PASS");
  console.log(JSON.stringify({ ok: true, dataDir, families: results }, null, 2));
} finally {
  if (process.env.GAME_OS_KEEP_ACCEPTANCE_DATA !== "1") fs.rmSync(workDir, { recursive: true, force: true });
}

function runCli(args) {
  return execFileSync(process.execPath, [cli, ...args, "--data-dir", dataDir], cliOptions());
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

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
