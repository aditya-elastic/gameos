import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "gameos-cli-smoke-"));
const cli = path.resolve("dist/cli.js");

try {
  run(["doctor", "--json"]);
  const make = JSON.parse(
    run([
      "make",
      "--prompt",
      "A one-button arcade game called Smoke Hopper where players swap lanes, dodge blockers, collect charge shards, build streaks, and chase a high score.",
      "--target",
      "web-playable",
      "--quality",
      "fast",
      "--yes",
      "--json"
    ])
  );
  const projectId = make.project.id;
  run(["status", projectId, "--json"]);
  const artifactList = JSON.parse(run(["artifact", "list", projectId, "--json"]));
  assert(artifactList.artifacts.some((artifact) => artifact.kind === "capability-map"), "make must generate a capability map artifact.");
  assert(artifactList.artifacts.some((artifact) => artifact.kind === "acceptance-profile"), "make must generate an acceptance profile artifact.");
  assert(artifactList.artifacts.some((artifact) => artifact.kind === "os-design-review"), "make must generate a Global OS design review artifact.");
  run(["artifact", "read", projectId, "game-bible", "--json"]);
  const review = runExpectFailure(["review", projectId, "--json"]);
  const reviewPayload = JSON.parse(review.stdout);
  assert(["LOCAL_PROTOTYPE_READY", "NEEDS_IMPROVEMENT", "BLOCKED"].includes(reviewPayload.scorecard.verdict), "fast/static smoke review must stay below creator-test readiness.");
  console.log(JSON.stringify({ ok: true, projectId, dataDir }, null, 2));
} finally {
  fs.rmSync(dataDir, { recursive: true, force: true });
}

function run(args) {
  return execFileSync(process.execPath, [cli, ...args, "--data-dir", dataDir], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      GAME_OS_DATA_DIR: dataDir,
      NODE_OPTIONS: "--disable-warning=ExperimentalWarning"
    }
  });
}

function runExpectFailure(args) {
  try {
    const stdout = run(args);
    throw new Error(`Expected command to fail but it passed: ${args.join(" ")}\n${stdout}`);
  } catch (error) {
    if (!error || typeof error !== "object" || !("status" in error)) throw error;
    if (error.status === 0) throw error;
    return {
      stdout: String(error.stdout || ""),
      stderr: String(error.stderr || "")
    };
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
