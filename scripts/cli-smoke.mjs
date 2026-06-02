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
