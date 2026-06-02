import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { getProjectArtifactRoot } from "../lib/artifacts";
import type { ProjectWorkspace } from "../lib/types";

declare global {
  var __gameOsWebAdapter: {
    smoke: () => { ok: boolean; kind?: string; [key: string]: unknown };
    getState?: () => Record<string, unknown>;
    getRopeForQa?: () => { a: { x: number; y: number }; b: { x: number; y: number } };
    getCanvasForQa?: () => { width: number; height: number };
    cutRope?: (source?: string) => boolean;
    swipeRopeForQa?: () => Record<string, unknown>;
    freeMoveRopeForQa?: () => Record<string, unknown>;
    slowFreeMoveRopeForQa?: () => Record<string, unknown>;
    reset?: () => boolean;
    runPlayerAgent: (options: { matches: number; seed: number }) => Record<string, unknown>;
  };
}

type WebQaOptions = {
  browser: boolean;
};

type WebQaReport = {
  kind: string;
  verdict: string;
  projectRoot: string;
  details: Record<string, unknown>;
};

export async function runWebQa(projectId: string, options: WebQaOptions): Promise<{ workspace: ProjectWorkspace; report: WebQaReport }> {
  const projectRoot = path.join(getProjectArtifactRoot(projectId), "web");
  assertWebBuild(projectRoot);

  if (options.browser) {
    return runBrowserWebQa(projectId, projectRoot);
  }

  const html = fs.readFileSync(path.join(projectRoot, "index.html"), "utf8");
  const scriptPath = findGameScript(projectRoot);
  const script = fs.readFileSync(scriptPath, "utf8");
  const kind = script.includes("cut-rope") || html.includes("Cut Rope") ? "cut-rope" : "ludo";
  const report = {
    kind,
    verdict: "STATIC_WEB_QA_PASS_BROWSER_REQUIRED_FOR_WORTH_PLAYING",
    projectRoot,
    details: {
      indexHtml: true,
      gameScript: path.relative(projectRoot, scriptPath),
      runtimeHook: script.includes("__gameOsWebAdapter"),
      readyMarker: html.includes("data-game-os-web"),
      watermarkMarkup: html.includes("Made with GameOS")
    }
  };

  const { recordWebPlaytest } = await import("../lib/studio");
  const workspace = recordWebPlaytest(projectId, {
    agent: "Game OS CLI Static Web QA",
    claim: "static build structure validation",
    kind,
    matches: 0,
    timeouts: 0,
    verdict: report.verdict
  });

  return { workspace, report };
}

async function runBrowserWebQa(projectId: string, projectRoot: string): Promise<{ workspace: ProjectWorkspace; report: WebQaReport }> {
  const chromePath = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  if (!fs.existsSync(chromePath)) {
    throw new Error(`Chrome executable not found at ${chromePath}. Use --static for structure-only QA or set CHROME_PATH.`);
  }

  const { chromium } = await import("playwright-core");
  const { server, url } = await startStaticServer(projectRoot);
  const browser = await chromium.launch({ executablePath: chromePath, headless: true });

  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(url, { waitUntil: "networkidle" });
    await page.locator('[data-game-os-web="ready"]').waitFor({ state: "visible", timeout: 5000 });
    const smoke = await page.evaluate(() => globalThis.__gameOsWebAdapter.smoke());
    if (!smoke.ok) throw new Error("Web adapter runtime did not report ready.");
    if (smoke.kind === "cut-rope" && !smoke.watermark) throw new Error("GameOS watermark was missing from the Web build.");
    const screenshotPath = smoke.kind === "cut-rope" ? path.join(projectRoot, "qa", "cut-rope-visual-qa.png") : "";
    if (screenshotPath) {
      fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
      await page.screenshot({ path: screenshotPath, fullPage: true });
    }
    const interaction = smoke.kind === "cut-rope" ? await verifyCutRopeBrowserInteraction(page) : {};
    const playerReport = await page.evaluate(() => globalThis.__gameOsWebAdapter.runPlayerAgent({ matches: 8, seed: 20260601 }));
    const interactionScreenshotPath = smoke.kind === "cut-rope" ? path.join(projectRoot, "qa", "cut-rope-interaction-qa.png") : "";
    if (interactionScreenshotPath) await page.screenshot({ path: interactionScreenshotPath, fullPage: true });
    const { recordWebPlaytest } = await import("../lib/studio");
    const workspace = recordWebPlaytest(projectId, {
      ...playerReport,
      browser_interaction: interaction,
      visual_screenshot: screenshotPath ? path.relative(projectRoot, screenshotPath) : undefined
    });
    const report = {
      kind: String(playerReport.kind || smoke.kind || "web"),
      verdict: String(playerReport.verdict || "unknown"),
      projectRoot,
      details: {
        smoke,
        interaction,
        screenshot: screenshotPath ? path.relative(projectRoot, screenshotPath) : null,
        interactionScreenshot: interactionScreenshotPath ? path.relative(projectRoot, interactionScreenshotPath) : null,
        ...(playerReport as Record<string, unknown>)
      }
    };

    return { workspace, report };
  } finally {
    await browser.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

async function verifyCutRopeBrowserInteraction(page: import("playwright-core").Page): Promise<Record<string, unknown>> {
  const firstSwipe = await performMouseSwipeCut(page);
  const afterCut = firstSwipe.after;

  await page.locator("#reset-button").click();
  await page.waitForTimeout(120);
  const afterReset = await page.evaluate(() => globalThis.__gameOsWebAdapter.getState?.() ?? {});

  await page.waitForTimeout(340);
  const afterResetSettled = await page.evaluate(() => globalThis.__gameOsWebAdapter.getState?.() ?? {});

  const smoothMouseBlade = await performMouseBladeCut(page);
  const afterSmoothMouseBlade = smoothMouseBlade.after;

  await page.locator("#reset-button").click();
  await page.waitForTimeout(340);
  const afterBladeResetSettled = await page.evaluate(() => globalThis.__gameOsWebAdapter.getState?.() ?? {});

  const slowMouseBlade = await performSlowMouseBladeCut(page);
  const afterSlowMouseBlade = slowMouseBlade.after;

  await page.locator("#reset-button").click();
  await page.waitForTimeout(340);
  const afterSlowBladeResetSettled = await page.evaluate(() => globalThis.__gameOsWebAdapter.getState?.() ?? {});

  const secondSwipe = await performMouseSwipeCut(page);
  const afterRecut = secondSwipe.after;

  const firstCutPass = firstSwipe.pass && afterCut.ropeCut === true && afterCut.status === "falling";
  const resetSafePass = afterReset.ropeCut === false && afterReset.status === "ready";
  const noAutoCutPass = afterResetSettled.ropeCut === false && afterResetSettled.status === "ready";
  const smoothMousePass = smoothMouseBlade.pass && afterSmoothMouseBlade.ropeCut === true && afterSmoothMouseBlade.status === "falling";
  const bladeResetSafePass = afterBladeResetSettled.ropeCut === false && afterBladeResetSettled.status === "ready";
  const slowMousePass = slowMouseBlade.pass && afterSlowMouseBlade.ropeCut === true && afterSlowMouseBlade.status === "falling";
  const slowBladeResetSafePass = afterSlowBladeResetSettled.ropeCut === false && afterSlowBladeResetSettled.status === "ready";
  const recutPass = secondSwipe.pass && afterRecut.ropeCut === true && afterRecut.status === "falling";

  if (!firstCutPass || !resetSafePass || !noAutoCutPass || !smoothMousePass || !bladeResetSafePass || !slowMousePass || !slowBladeResetSafePass || !recutPass) {
    throw new Error(
      `Cut Rope browser interaction failed: firstCut=${firstCutPass}, resetSafe=${resetSafePass}, noAutoCut=${noAutoCutPass}, smoothMouse=${smoothMousePass}, bladeResetSafe=${bladeResetSafePass}, slowMouse=${slowMousePass}, slowBladeResetSafe=${slowBladeResetSafePass}, recut=${recutPass}.`
    );
  }

  return {
    firstCutPass,
    resetSafePass,
    noAutoCutPass,
    smoothMousePass,
    bladeResetSafePass,
    slowMousePass,
    slowBladeResetSafePass,
    recutPass,
    firstSwipe,
    smoothMouseBlade,
    slowMouseBlade,
    secondSwipe,
    afterCut,
    afterReset,
    afterResetSettled,
    afterSmoothMouseBlade,
    afterBladeResetSettled,
    afterSlowMouseBlade,
    afterSlowBladeResetSettled,
    afterRecut
  };
}

async function performMouseSwipeCut(page: import("playwright-core").Page): Promise<Record<string, unknown> & { pass: boolean; after: Record<string, unknown> }> {
  const target = await page.evaluate(() => ({
    rope: globalThis.__gameOsWebAdapter.getRopeForQa?.(),
    canvas: globalThis.__gameOsWebAdapter.getCanvasForQa?.()
  }));
  const box = await page.locator("#game-canvas").boundingBox();
  if (!box || !target.rope || !target.canvas) {
    throw new Error("Cut Rope mouse swipe QA could not read canvas or rope geometry.");
  }
  const rope = target.rope;
  const canvasSize = target.canvas;

  const mid = {
    x: (rope.a.x + rope.b.x) / 2,
    y: (rope.a.y + rope.b.y) / 2
  };
  const dx = rope.b.x - rope.a.x;
  const dy = rope.b.y - rope.a.y;
  const length = Math.hypot(dx, dy) || 1;
  const normal = { x: -dy / length, y: dx / length };
  const start = { x: mid.x + normal.x * 96, y: mid.y + normal.y * 96 };
  const end = { x: mid.x - normal.x * 96, y: mid.y - normal.y * 96 };
  const toScreen = (point: { x: number; y: number }) => ({
    x: box.x + (point.x / canvasSize.width) * box.width,
    y: box.y + (point.y / canvasSize.height) * box.height
  });
  const screenStart = toScreen(start);
  const screenEnd = toScreen(end);

  await page.mouse.move(screenStart.x, screenStart.y);
  await page.mouse.down();
  for (let step = 1; step <= 8; step += 1) {
    const t = step / 8;
    await page.mouse.move(screenStart.x + (screenEnd.x - screenStart.x) * t, screenStart.y + (screenEnd.y - screenStart.y) * t);
  }
  await page.mouse.up();
  await page.waitForTimeout(180);

  const after = await page.evaluate(() => globalThis.__gameOsWebAdapter.getState?.() ?? {});
  return {
    pass: after.ropeCut === true && after.status === "falling" && after.sliceGestureCut === true,
    rope,
    start,
    end,
    after
  };
}

async function performSlowMouseBladeCut(page: import("playwright-core").Page): Promise<Record<string, unknown> & { pass: boolean; after: Record<string, unknown> }> {
  const target = await page.evaluate(() => ({
    rope: globalThis.__gameOsWebAdapter.getRopeForQa?.(),
    canvas: globalThis.__gameOsWebAdapter.getCanvasForQa?.()
  }));
  const box = await page.locator("#game-canvas").boundingBox();
  if (!box || !target.rope || !target.canvas) {
    throw new Error("Cut Rope slow mouse blade QA could not read canvas or rope geometry.");
  }
  const canvasSize = target.canvas;
  let latestRope = target.rope;
  const bladePointFor = (rope: { a: { x: number; y: number }; b: { x: number; y: number } }, side: 1 | -1, offset: number) => {
    const mid = {
      x: (rope.a.x + rope.b.x) / 2,
      y: (rope.a.y + rope.b.y) / 2
    };
    const dx = rope.b.x - rope.a.x;
    const dy = rope.b.y - rope.a.y;
    const length = Math.hypot(dx, dy) || 1;
    const normal = { x: -dy / length, y: dx / length };
    return { x: mid.x + normal.x * offset * side, y: mid.y + normal.y * offset * side };
  };
  const toScreen = (point: { x: number; y: number }) => ({
    x: box.x + (point.x / canvasSize.width) * box.width,
    y: box.y + (point.y / canvasSize.height) * box.height
  });
  const start = bladePointFor(latestRope, 1, 96);
  const screenStart = toScreen(start);

  await page.mouse.move(screenStart.x, screenStart.y);
  let end = start;
  for (let step = 1; step <= 8; step += 1) {
    await page.waitForTimeout(260);
    const liveTarget = await page.evaluate(() => ({
      rope: globalThis.__gameOsWebAdapter.getRopeForQa?.(),
      state: globalThis.__gameOsWebAdapter.getState?.() ?? {}
    }));
    if (liveTarget.state.ropeCut === true) break;
    if (!liveTarget.rope) throw new Error("Cut Rope slow mouse blade QA lost live rope geometry.");
    latestRope = liveTarget.rope;
    end = bladePointFor(latestRope, step % 2 === 1 ? -1 : 1, step === 1 ? 62 : 48);
    const screenPoint = toScreen(end);
    await page.mouse.move(screenPoint.x, screenPoint.y);
  }
  await page.waitForTimeout(180);

  const after = await page.evaluate(() => globalThis.__gameOsWebAdapter.getState?.() ?? {});
  return {
    pass: after.ropeCut === true && after.status === "falling" && after.sliceGestureCut === true,
    rope: latestRope,
    start,
    end,
    after
  };
}

async function performMouseBladeCut(page: import("playwright-core").Page): Promise<Record<string, unknown> & { pass: boolean; after: Record<string, unknown> }> {
  const target = await page.evaluate(() => ({
    rope: globalThis.__gameOsWebAdapter.getRopeForQa?.(),
    canvas: globalThis.__gameOsWebAdapter.getCanvasForQa?.()
  }));
  const box = await page.locator("#game-canvas").boundingBox();
  if (!box || !target.rope || !target.canvas) {
    throw new Error("Cut Rope smooth mouse blade QA could not read canvas or rope geometry.");
  }
  const rope = target.rope;
  const canvasSize = target.canvas;
  const mid = {
    x: (rope.a.x + rope.b.x) / 2,
    y: (rope.a.y + rope.b.y) / 2
  };
  const dx = rope.b.x - rope.a.x;
  const dy = rope.b.y - rope.a.y;
  const length = Math.hypot(dx, dy) || 1;
  const normal = { x: -dy / length, y: dx / length };
  const start = { x: mid.x + normal.x * 104, y: mid.y + normal.y * 104 };
  const end = { x: mid.x - normal.x * 104, y: mid.y - normal.y * 104 };
  const toScreen = (point: { x: number; y: number }) => ({
    x: box.x + (point.x / canvasSize.width) * box.width,
    y: box.y + (point.y / canvasSize.height) * box.height
  });
  const screenStart = toScreen(start);
  const screenEnd = toScreen(end);

  await page.mouse.move(screenStart.x, screenStart.y);
  for (let step = 1; step <= 10; step += 1) {
    const t = step / 10;
    await page.mouse.move(screenStart.x + (screenEnd.x - screenStart.x) * t, screenStart.y + (screenEnd.y - screenStart.y) * t);
  }
  await page.waitForTimeout(180);

  const after = await page.evaluate(() => globalThis.__gameOsWebAdapter.getState?.() ?? {});
  return {
    pass: after.ropeCut === true && after.status === "falling" && after.sliceGestureCut === true,
    rope,
    start,
    end,
    after
  };
}

function assertWebBuild(projectRoot: string): void {
  if (!fs.existsSync(path.join(projectRoot, "index.html"))) {
    throw new Error(`Missing Web build at ${projectRoot}. Run gameos build web <project-id> first.`);
  }
  findGameScript(projectRoot);
}

function findGameScript(projectRoot: string): string {
  const candidates = [path.join(projectRoot, "scripts", "game.js"), path.join(projectRoot, "scripts", "ludo-rules.js")];
  const script = candidates.find((candidate) => fs.existsSync(candidate));
  if (!script) throw new Error(`Missing Web runtime script under ${projectRoot}.`);
  return script;
}

async function startStaticServer(root: string): Promise<{ server: http.Server; url: string }> {
  const server = http.createServer((request, response) => {
    const requestUrl = new URL(request.url || "/", "http://127.0.0.1");
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

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Unable to start local Web QA server.");
  return { server, url: `http://127.0.0.1:${address.port}/` };
}

function contentType(filePath: string): string {
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
