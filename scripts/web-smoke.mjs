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
  const smoke = await page.evaluate(() => globalThis.__gameOsWebAdapter.smoke());
  assert(smoke.ok, "Web adapter runtime did not report ready.");
  if (smoke.kind === "ludo") {
    assert(smoke.cells === 52, `Expected 52 track cells, got ${smoke.cells}.`);
    assert(smoke.watermark === true, "Ludo Web build is missing the visible GameOS watermark.");
  } else if (smoke.kind === "cut-rope") {
    assert(smoke.canvasWidth >= 900 && smoke.canvasHeight >= 580, "Cut Rope canvas did not initialize at playable size.");
    assert(smoke.assetsUsed > 0, "Cut Rope build did not copy any imported image assets.");
    assert(smoke.watermark === true, "Cut Rope build is missing the visible GameOS watermark.");
    assert(["VISUAL_GATE_PASS", "VISUAL_GATE_REVIEW"].includes(smoke.visualGate), `Cut Rope visual gate is not acceptable for smoke: ${smoke.visualGate}.`);
    assert(smoke.physicsModel === "pendulum-swing-momentum-gravity-bumper-collision-no-goal-magnet", `Cut Rope physics model is too shallow: ${smoke.physicsModel}.`);
    assert(smoke.hasTimingArc === true && smoke.hasPrediction === true, "Cut Rope build lacks timing/prediction playability helpers.");
    assert(smoke.hasSwipeSlice === true, "Cut Rope build lacks smooth swipe slicing support.");
    assert(smoke.hasSmoothMouseBlade === true, "Cut Rope build lacks smooth mouse blade support.");
    assert(smoke.hasSlowMouseBlade === true, "Cut Rope build lacks slow human mouse blade support.");
  } else {
    throw new Error(`Unknown Web prototype kind: ${smoke.kind || "missing"}.`);
  }

  if (smoke.kind === "ludo") {
    await page.locator("#roll-button").click();
    await page.locator("#save-button").click();
    await page.locator("#load-button").click();
  } else {
    const swipeProof = await page.evaluate(() => globalThis.__gameOsWebAdapter.swipeRopeForQa());
    assert(swipeProof.pass === true, "Cut Rope swipe gesture did not cut the rope.");
    const afterCut = await page.evaluate(() => globalThis.__gameOsWebAdapter.getState());
    assert(afterCut.ropeCut === true && afterCut.status === "falling" && afterCut.sliceGestureCut === true, "Cut Rope swipe did not cut into falling state.");
    await page.locator("#reset-button").click();
    await page.waitForTimeout(120);
    const afterReset = await page.evaluate(() => globalThis.__gameOsWebAdapter.getState());
    assert(afterReset.ropeCut === false && afterReset.status === "ready", "Cut Rope reset did not restore ready state.");
    await page.waitForTimeout(340);
    const afterResetSettled = await page.evaluate(() => globalThis.__gameOsWebAdapter.getState());
    assert(afterResetSettled.ropeCut === false && afterResetSettled.status === "ready", "Cut Rope reset caused an automatic recut.");
    const bladeProof = await page.evaluate(() => globalThis.__gameOsWebAdapter.freeMoveRopeForQa());
    assert(bladeProof.pass === true, "Cut Rope smooth mouse blade did not cut the rope.");
    const afterBlade = await page.evaluate(() => globalThis.__gameOsWebAdapter.getState());
    assert(afterBlade.ropeCut === true && afterBlade.status === "falling" && afterBlade.sliceGestureCut === true, "Cut Rope smooth mouse blade did not cut into falling state.");
    await page.locator("#reset-button").click();
    await page.waitForTimeout(340);
    const afterBladeReset = await page.evaluate(() => globalThis.__gameOsWebAdapter.getState());
    assert(afterBladeReset.ropeCut === false && afterBladeReset.status === "ready", "Cut Rope reset after smooth mouse blade did not restore ready state.");
    const slowBladeProof = await page.evaluate(() => globalThis.__gameOsWebAdapter.slowFreeMoveRopeForQa());
    assert(slowBladeProof.pass === true, "Cut Rope slow human mouse blade did not cut the rope.");
    const afterSlowBlade = await page.evaluate(() => globalThis.__gameOsWebAdapter.getState());
    assert(afterSlowBlade.ropeCut === true && afterSlowBlade.status === "falling" && afterSlowBlade.sliceGestureCut === true, "Cut Rope slow human mouse blade did not cut into falling state.");
    await page.locator("#reset-button").click();
    await page.waitForTimeout(340);
    const afterSlowBladeReset = await page.evaluate(() => globalThis.__gameOsWebAdapter.getState());
    assert(afterSlowBladeReset.ropeCut === false && afterSlowBladeReset.status === "ready", "Cut Rope reset after slow human mouse blade did not restore ready state.");
    const recutSwipeProof = await page.evaluate(() => globalThis.__gameOsWebAdapter.swipeRopeForQa());
    assert(recutSwipeProof.pass === true, "Cut Rope swipe gesture could not recut after reset.");
    const afterRecut = await page.evaluate(() => globalThis.__gameOsWebAdapter.getState());
    assert(afterRecut.ropeCut === true && afterRecut.status === "falling" && afterRecut.sliceGestureCut === true, "Cut Rope could not be swipe-cut again after reset debounce.");
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
