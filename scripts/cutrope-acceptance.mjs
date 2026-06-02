import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const cli = path.join(root, "dist", "cli.js");
const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "gameos-cutrope-acceptance-"));
const dataDir = path.join(workDir, "data");
const assetRoot = path.join(workDir, "assets");
const assetZip = path.join(workDir, "cutrope-assets.zip");
const imageBytes = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64"
);

try {
  assert(fs.existsSync(cli), "dist/cli.js is missing. Run npm run build:cli first.");
  assert(fs.existsSync(chromePath()), `Chrome executable not found at ${chromePath()}. Cut Rope acceptance requires browser QA.`);
  createAssetZip();

  const make = JSON.parse(
    runCli([
      "make",
      "--prompt",
      "A rope-cut physics puzzle for web players where the player smoothly cuts a swinging rope, drops candy into a hungry character, collects stars, uses timing and momentum, and proves uploaded assets create a beautiful mature playable web prototype.",
      "--target",
      "web-playable",
      "--assets",
      assetZip,
      "--quality",
      "standard",
      "--yes",
      "--json"
    ])
  );
  const projectId = make.project.id;
  const projectRoot = path.join(dataDir, "projects", projectId, "web");

  assert(make.qa.verdict === "WORTH_PLAYING_FOR_CUT_ROPE_WEB_PROTOTYPE", `make QA verdict was ${make.qa.verdict}.`);
  assert(fs.existsSync(path.join(projectRoot, "index.html")), "Web build index.html was not created.");
  assert(fs.existsSync(path.join(projectRoot, "web-adapter-manifest.json")), "Web adapter manifest was not created.");

  const review = JSON.parse(runCli(["review", projectId, "--json"]));
  assert(review.scorecard.overallScore === 10, `scorecard overall score was ${review.scorecard.overallScore}.`);
  assert(review.scorecard.minimumCategoryScore === 10, `scorecard minimum category score was ${review.scorecard.minimumCategoryScore}.`);
  assert(review.scorecard.verdict === "10_OUT_OF_10_READY_FOR_LOCAL_USERS", `scorecard verdict was ${review.scorecard.verdict}.`);
  assert(review.scorecard.agentCount >= 21, `scorecard reviewed only ${review.scorecard.agentCount} agents.`);

  const statusText = runCli(["status", projectId]);
  assert(statusText.includes("QA: 9 pass, 0 watch, 0 blocked"), "status did not promote all QA gates after review.");
  assert(statusText.includes("PASS Studio Review: 10/10"), "journey did not show 10/10 studio review pass.");

  runNpm("web:smoke", { GAME_OS_WEB_PROJECT: projectRoot });
  runNpm("web:player", { GAME_OS_WEB_PROJECT: projectRoot });

  console.log("GAMEOS_CUTROPE_ACCEPTANCE: PASS");
  console.log(
    JSON.stringify(
      {
        ok: true,
        projectId,
        dataDir,
        webRoot: projectRoot,
        qaVerdict: make.qa.verdict,
        scorecard: review.scorecard.verdict,
        agents: review.scorecard.agentCount
      },
      null,
      2
    )
  );
} finally {
  if (process.env.GAME_OS_KEEP_ACCEPTANCE_DATA !== "1") fs.rmSync(workDir, { recursive: true, force: true });
}

function createAssetZip() {
  execFileSync("zip", ["-v"], { stdio: "ignore" });
  fs.mkdirSync(assetRoot, { recursive: true });
  for (const name of ["candy-ball.png", "monster-mouth.png", "star-gold.png", "wood-background.png", "spike-hazard.png", "button-ui.png"]) {
    fs.writeFileSync(path.join(assetRoot, name), imageBytes);
  }
  execFileSync("zip", ["-qr", assetZip, "."], { cwd: assetRoot });
}

function runCli(args) {
  return execFileSync(process.execPath, [cli, ...args, "--data-dir", dataDir], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      GAME_OS_DATA_DIR: dataDir,
      NODE_OPTIONS: "--disable-warning=ExperimentalWarning"
    }
  });
}

function runNpm(script, extraEnv = {}) {
  execFileSync("npm", ["run", script], {
    cwd: root,
    stdio: "inherit",
    env: {
      ...process.env,
      ...extraEnv,
      NODE_OPTIONS: "--disable-warning=ExperimentalWarning"
    }
  });
}

function chromePath() {
  return process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
