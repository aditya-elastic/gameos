import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const cli = path.join(root, "dist", "cli.js");
const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "gameos-web-quality-acceptance-"));
const dataDir = path.join(workDir, "data");
const assetRoot = path.join(workDir, "assets");
const assetZip = path.join(workDir, "web-quality-assets.zip");
const imageBytes = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64"
);

try {
  assert(fs.existsSync(cli), "dist/cli.js is missing. Run npm run build:cli first.");
  assert(fs.existsSync(chromePath()), `Chrome executable not found at ${chromePath()}. Web quality acceptance requires browser QA.`);
  createAssetZip();

  const make = JSON.parse(
    runCli([
      "make",
      "--prompt",
      "An asset-led physics timing puzzle for web players where the player smoothly releases a swinging connector, drops a hero object into a goal, collects mastery pickups, uses timing and momentum, and proves uploaded assets create a beautiful mature playable web prototype.",
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
  const artifactList = JSON.parse(runCli(["artifact", "list", projectId, "--json"]));
  const artifactKinds = new Set((artifactList.artifacts ?? []).map((artifact) => artifact.kind));

  assert(make.qa.verdict === "WORTH_PLAYING_FOR_ASSET_PHYSICS_WEB_BUILD", `make QA verdict was ${make.qa.verdict}.`);
  assert(fs.existsSync(path.join(projectRoot, "index.html")), "Web build index.html was not created.");
  assert(fs.existsSync(path.join(projectRoot, "web-adapter-manifest.json")), "Web adapter manifest was not created.");
  assert(artifactKinds.has("acceptance-profile"), "Acceptance profile artifact was not created.");

  const review = JSON.parse(runCli(["review", projectId, "--json"]));
  assert(review.scorecard.overallScore === 10, `scorecard overall score was ${review.scorecard.overallScore}.`);
  assert(review.scorecard.minimumCategoryScore === 10, `scorecard minimum category score was ${review.scorecard.minimumCategoryScore}.`);
  assert(review.scorecard.verdict === "CREATOR_TEST_READY", `scorecard verdict was ${review.scorecard.verdict}.`);
  assert(review.scorecard.agentCount >= 27, `scorecard reviewed only ${review.scorecard.agentCount} agents.`);

  const diagnosis = JSON.parse(runCli(["diagnose", projectId, "--json"]));
  assert(diagnosis.diagnosis?.verdict === "CREATOR_TEST_READY", `diagnosis verdict was ${diagnosis.diagnosis?.verdict}.`);

  const statusText = runCli(["status", projectId]);
  assert(/QA: \d+ pass, 0 watch, 0 blocked/.test(statusText), "status did not promote all QA gates after creator-test review.");
  assert(statusText.includes("PASS Trust Review: Creator-test ready") || statusText.includes("PASS Trust Review: CREATOR_TEST_READY"), "journey did not show creator-test trust review pass.");

  runNpm("web:smoke", { GAME_OS_WEB_PROJECT: projectRoot });
  runNpm("web:player", { GAME_OS_WEB_PROJECT: projectRoot });

  console.log("GAMEOS_WEB_QUALITY_ACCEPTANCE: PASS");
  console.log(
    JSON.stringify(
      {
        ok: true,
        projectId,
        dataDir,
        webRoot: projectRoot,
        qaVerdict: make.qa.verdict,
        scorecard: review.scorecard.verdict,
        diagnosis: diagnosis.diagnosis.verdict,
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
  for (const name of ["hero-ball.png", "goal-mouth.png", "star-gold.png", "wood-background.png", "spike-hazard.png", "button-ui.png"]) {
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
