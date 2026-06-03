import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { chromium } from "playwright-core";

const explicitProject = process.env.GAME_OS_WEB_PROJECT || process.argv[2];
const projectRoot = explicitProject ? path.resolve(explicitProject) : findLatestWebProject();
const chromePath = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const outputDir = path.join(process.cwd(), "tmp", "web-smoke");

assert(projectRoot, "No Web adapter project found. Generate one from Game OS first.");
assert(fs.existsSync(path.join(projectRoot, "index.html")), `Missing Web prototype at ${projectRoot}`);
assert(fs.existsSync(chromePath), `Chrome executable not found at ${chromePath}`);

fs.mkdirSync(outputDir, { recursive: true });

const { server, url } = await startStaticServer(projectRoot);
const browser = await chromium.launch({ executablePath: chromePath, headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 1360, height: 980 } });
  const problems = [];
  page.on("console", (message) => {
    if (message.type() === "error") problems.push(`console error: ${message.text()}`);
  });
  page.on("pageerror", (error) => problems.push(`page error: ${error.message}`));

  await page.goto(url, { waitUntil: "networkidle" });
  await page.locator('[data-game-os-web="ready"]').waitFor({ state: "visible", timeout: 5000 });
  const visibleHudText = await page.evaluate(() =>
    [document.querySelector("#verdict-chip")?.textContent || "", document.querySelector("#asset-label")?.textContent || ""].join(" ")
  );
  assert(!/[A-Z]{2,}_[A-Z0-9_]+/.test(visibleHudText), "Visible HUD leaked machine verdict constants instead of player-facing labels.");
  const smoke = await page.evaluate(() => globalThis.__gameOsWebAdapter.smoke());
  assert(smoke.ok, "Web adapter runtime did not report ready.");
  if (smoke.kind === "turn-rules") {
    assert(smoke.cells === 52, `Expected 52 track cells, got ${smoke.cells}.`);
    assert(smoke.watermark === true, "Turn-rules Web build is missing the visible GameOS watermark.");
  } else if (smoke.kind === "asset-physics") {
    assert(smoke.canvasWidth >= 900 && smoke.canvasHeight >= 580, "asset-led physics canvas did not initialize at playable size.");
    assert(smoke.assetsUsed > 0, "asset-led physics build did not copy any imported image assets.");
    assert(smoke.watermark === true, "asset-led physics build is missing the visible GameOS watermark.");
    assert(["VISUAL_GATE_PASS", "VISUAL_GATE_REVIEW"].includes(smoke.visualGate), `asset-led physics visual gate is not acceptable for smoke: ${smoke.visualGate}.`);
    assert(smoke.physicsModel === "pendulum-swing-momentum-gravity-bumper-collision-no-goal-magnet", `asset-led physics model is too shallow: ${smoke.physicsModel}.`);
    assert(smoke.hasTimingArc === true && smoke.hasPrediction === true, "asset-led physics build lacks timing/prediction playability helpers.");
    assert(smoke.hasSwipeSlice === true, "asset-led physics build lacks smooth swipe slicing support.");
    assert(smoke.hasSmoothMouseBlade === true, "asset-led physics build lacks smooth mouse blade support.");
    assert(smoke.hasSlowMouseBlade === true, "asset-led physics build lacks slow human mouse blade support.");
  } else if (smoke.kind === "capability-web") {
    assert(smoke.canvasWidth >= 900 && smoke.canvasHeight >= 560, "Capability Web canvas did not initialize at playable size.");
    assert(smoke.watermark === true, "Capability Web build is missing the visible GameOS watermark.");
    assert(Array.isArray(smoke.capabilities) && smoke.capabilities.includes("input") && smoke.capabilities.includes("qa"), "Capability Web build did not expose the universal capability graph.");
  } else {
    throw new Error(`Unknown Web build kind: ${smoke.kind || "missing"}.`);
  }

  if (smoke.kind === "turn-rules") {
    await page.locator("#roll-button").click();
    await page.locator("#save-button").click();
    await page.locator("#load-button").click();
  } else if (smoke.kind === "asset-physics") {
    const swipeProof = await page.evaluate(() => globalThis.__gameOsWebAdapter.swipeRopeForQa());
    assert(swipeProof.pass === true, "Asset-Led Physics swipe gesture did not release the rope.");
    const afterCut = await page.evaluate(() => globalThis.__gameOsWebAdapter.getState());
    assert(afterCut.ropeReleased === true && afterCut.status === "falling" && afterCut.sliceGestureCut === true, "Asset-Led Physics swipe did not cut into falling state.");
    await page.locator("#reset-button").click();
    await page.waitForTimeout(120);
    const afterReset = await page.evaluate(() => globalThis.__gameOsWebAdapter.getState());
    assert(afterReset.ropeReleased === false && afterReset.status === "ready", "Asset-Led Physics reset did not restore ready state.");
    await page.waitForTimeout(340);
    const afterResetSettled = await page.evaluate(() => globalThis.__gameOsWebAdapter.getState());
    assert(afterResetSettled.ropeReleased === false && afterResetSettled.status === "ready", "Asset-Led Physics reset caused an automatic recut.");
    const bladeProof = await page.evaluate(() => globalThis.__gameOsWebAdapter.freeMoveRopeForQa());
    assert(bladeProof.pass === true, "Asset-Led Physics smooth mouse blade did not release the rope.");
    const afterBlade = await page.evaluate(() => globalThis.__gameOsWebAdapter.getState());
    assert(afterBlade.ropeReleased === true && afterBlade.status === "falling" && afterBlade.sliceGestureCut === true, "Asset-Led Physics smooth mouse blade did not cut into falling state.");
    await page.locator("#reset-button").click();
    await page.waitForTimeout(340);
    const afterBladeReset = await page.evaluate(() => globalThis.__gameOsWebAdapter.getState());
    assert(afterBladeReset.ropeReleased === false && afterBladeReset.status === "ready", "Asset-Led Physics reset after smooth mouse blade did not restore ready state.");
    const slowBladeProof = await page.evaluate(() => globalThis.__gameOsWebAdapter.slowFreeMoveRopeForQa());
    assert(slowBladeProof.pass === true, "Asset-Led Physics slow human mouse blade did not release the rope.");
    const afterSlowBlade = await page.evaluate(() => globalThis.__gameOsWebAdapter.getState());
    assert(afterSlowBlade.ropeReleased === true && afterSlowBlade.status === "falling" && afterSlowBlade.sliceGestureCut === true, "Asset-Led Physics slow human mouse blade did not cut into falling state.");
    await page.locator("#reset-button").click();
    await page.waitForTimeout(340);
    const afterSlowBladeReset = await page.evaluate(() => globalThis.__gameOsWebAdapter.getState());
    assert(afterSlowBladeReset.ropeReleased === false && afterSlowBladeReset.status === "ready", "Asset-Led Physics reset after slow human mouse blade did not restore ready state.");
    const recutSwipeProof = await page.evaluate(() => globalThis.__gameOsWebAdapter.swipeRopeForQa());
    assert(recutSwipeProof.pass === true, "Asset-Led Physics swipe gesture could not recut after reset.");
    const afterRecut = await page.evaluate(() => globalThis.__gameOsWebAdapter.getState());
    assert(afterRecut.ropeReleased === true && afterRecut.status === "falling" && afterRecut.sliceGestureCut === true, "Asset-Led Physics could not be swipe-cut again after reset debounce.");
  } else if (smoke.kind === "capability-web") {
    await page.locator("#start-button").click();
    await page.keyboard.press("Space");
    await page.waitForTimeout(180);
    const runningState = await page.evaluate(() => globalThis.__gameOsWebAdapter.getState());
    assert(runningState.running === true, "Capability Web build did not start from primary input.");
    await page.locator("#reset-button").click();
    const resetState = await page.evaluate(() => globalThis.__gameOsWebAdapter.getState());
    assert(resetState.running === false && resetState.score === 0 && resetState.lives === 3, "Capability Web reset did not restore initial state.");
  }
  await page.screenshot({ path: path.join(outputDir, "web-adapter-desktop.png"), fullPage: true });

  if (problems.length > 0) {
    throw new Error(problems.join("\n"));
  }

  console.log("WEB_ADAPTER_SMOKE: PASS");
  console.log(JSON.stringify({ ok: true, projectRoot, url, screenshot: path.join(outputDir, "web-adapter-desktop.png") }, null, 2));
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

function findLatestWebProject() {
  const projectsRoot = path.join(process.cwd(), "data", "projects");
  if (!fs.existsSync(projectsRoot)) return "";

  return fs
    .readdirSync(projectsRoot)
    .map((projectId) => path.join(projectsRoot, projectId, "web"))
    .filter((candidate) => fs.existsSync(path.join(candidate, "index.html")))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
}

async function startStaticServer(root) {
  const server = http.createServer((request, response) => {
    const requestUrl = new URL(request.url || "/", "http://127.0.0.1");
    if (requestUrl.pathname === "/favicon.ico") {
      response.writeHead(204);
      response.end();
      return;
    }
    const relative = requestUrl.pathname === "/" ? "index.html" : requestUrl.pathname.slice(1);
    const filePath = path.resolve(root, decodeURIComponent(relative));

    if (!filePath.startsWith(root) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    response.writeHead(200, { "content-type": contentType(filePath) });
    fs.createReadStream(filePath).pipe(response);
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  return { server, url: `http://127.0.0.1:${address.port}/` };
}

function contentType(filePath) {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (filePath.endsWith(".json")) return "application/json; charset=utf-8";
  if (filePath.endsWith(".png")) return "image/png";
  if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) return "image/jpeg";
  if (filePath.endsWith(".webp")) return "image/webp";
  if (filePath.endsWith(".svg")) return "image/svg+xml";
  return "text/plain; charset=utf-8";
}

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}
