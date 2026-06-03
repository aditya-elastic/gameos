import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const cli = path.join(root, "dist", "cli.js");
const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "gameos-universal-trust-"));
const dataDir = path.join(workDir, "data");
const verdictTiers = new Set(["LOCAL_PROTOTYPE_READY", "CREATOR_TEST_READY", "NEEDS_IMPROVEMENT", "BLOCKED"]);

const promptFamilies = [
  {
    family: "arcade score loop",
    prompt: "A one-button arcade survival game where players dodge patterns, collect score shards, build streaks, and retry instantly."
  },
  {
    family: "deterministic rules strategy",
    prompt: "A turn-based strategy board game with deterministic legal moves, territory pressure, safe zones, captures, and local pass-and-play."
  },
  {
    family: "asset-led physics timing",
    prompt: "A physics timing puzzle where a hero object swings, collides, misses, resets, and reaches a readable goal through skillful input."
  },
  {
    family: "platform movement",
    prompt: "A compact platform movement challenge with jumps, collisions, hazards, checkpoints, retry, and readable momentum."
  },
  {
    family: "combat/survival loop",
    prompt: "A small combat survival arena where players kite threats, attack, dodge, manage health, score survival time, and retry."
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
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

    assert(artifactKinds.has("capability-map"), `${fixture.family}: capability map artifact missing.`);
    assert(artifactKinds.has("acceptance-profile"), `${fixture.family}: acceptance profile artifact missing.`);
    assert(fs.existsSync(path.join(webRoot, "index.html")), `${fixture.family}: Web build missing.`);
    assert(artifactKinds.has("web-playtest-report"), `${fixture.family}: QA artifact missing.`);
    assert(manifest.generatedBy === "Game OS", `${fixture.family}: manifest generatedBy is missing.`);
    assert(manifest.watermark?.required === true, `${fixture.family}: watermark policy is missing.`);
    assert(verdictTiers.has(diagnosis.diagnosis?.verdict), `${fixture.family}: dishonest or unknown verdict ${diagnosis.diagnosis?.verdict}.`);
    assert(diagnosis.diagnosis?.blocker && diagnosis.diagnosis?.owningAgent && diagnosis.diagnosis?.nextCommand, `${fixture.family}: diagnosis is missing blocker, owner, or next command.`);

    results.push({
      family: fixture.family,
      projectId,
      verdict: diagnosis.diagnosis.verdict,
      blocker: diagnosis.diagnosis.blocker
    });
  }

  console.log("GAMEOS_UNIVERSAL_TRUST_ACCEPTANCE: PASS");
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
