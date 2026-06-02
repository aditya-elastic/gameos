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
      "A small Ludo game called Smoke Ludo for local creator playtesting with dice, tokens, captures, safe squares, and a fast web prototype.",
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
  run(["artifact", "list", projectId, "--json"]);
  run(["artifact", "read", projectId, "game-bible", "--json"]);
  const review = runExpectFailure(["review", projectId, "--json"]);
  const reviewPayload = JSON.parse(review.stdout);
  assert(reviewPayload.scorecard.verdict !== "10_OUT_OF_10_READY_FOR_LOCAL_USERS", "fast/static smoke review must not claim 10/10.");
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
