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
    releaseRope?: (source?: string) => boolean;
    start?: () => boolean;
    primaryAction?: () => boolean;
    moveForQa?: (dx: number, dy: number) => boolean;
    spawnProofObjectForQa?: () => Record<string, unknown>;
    forceFailureForQa?: () => Record<string, unknown>;
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
  const kind = detectWebBuildKind(projectRoot, html, script);
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
    throw new Error(`Browser QA needs Google Chrome. Install Google Chrome or set CHROME_PATH. Checked: ${chromePath}. Use --static only when you want structure-only QA.`);
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
    if (!smoke.watermark) throw new Error("GameOS watermark was missing from the Web build.");
    const kind = String(smoke.kind || "web");
    const screenshotPath = path.join(projectRoot, "qa", `${safeFileStem(kind)}-visual-qa.png`);
    fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
    await page.screenshot({ path: screenshotPath, fullPage: true });
    const visualQa = await evaluateVisualQuality(page);
    const interaction =
      smoke.kind === "asset-physics"
        ? await verifyAssetPhysicsBrowserInteraction(page)
        : smoke.kind === "capability-web"
          ? await verifyCapabilityBrowserInteraction(page)
          : {};
    const playerReport = (await page.evaluate(() => globalThis.__gameOsWebAdapter.runPlayerAgent({ matches: 8, seed: 20260601 }))) as Record<string, unknown>;
    const interactionScreenshotPath =
      smoke.kind === "asset-physics" || smoke.kind === "capability-web" ? path.join(projectRoot, "qa", `${safeFileStem(kind)}-interaction-qa.png`) : "";
    if (interactionScreenshotPath) await page.screenshot({ path: interactionScreenshotPath, fullPage: true });
    const finalPlayerReport = enrichPlayerReportWithQuality(playerReport, visualQa, interaction);
    const { recordWebPlaytest } = await import("../lib/studio");
    const workspace = recordWebPlaytest(projectId, {
      ...finalPlayerReport,
      browser_interaction: interaction,
      visual_screenshot: path.relative(projectRoot, screenshotPath),
      interaction_screenshot: interactionScreenshotPath ? path.relative(projectRoot, interactionScreenshotPath) : undefined,
      visual_qa: visualQa,
      visual_qa_verdict: visualQa.pass ? "VISUAL_BROWSER_QA_PASS" : "VISUAL_BROWSER_QA_FAIL"
    });
    const report = {
      kind: String(finalPlayerReport.kind || smoke.kind || "web"),
      verdict: String(finalPlayerReport.verdict || "unknown"),
      projectRoot,
      details: {
        smoke,
        interaction,
        visualQa,
        screenshot: path.relative(projectRoot, screenshotPath),
        interactionScreenshot: interactionScreenshotPath ? path.relative(projectRoot, interactionScreenshotPath) : null,
        ...finalPlayerReport
      }
    };

    return { workspace, report };
  } finally {
    await browser.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

async function evaluateVisualQuality(page: import("playwright-core").Page): Promise<Record<string, unknown> & { pass: boolean }> {
  return page.evaluate(() => {
    const visible = (element: Element | null): boolean => {
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none" && Number.parseFloat(style.opacity || "1") > 0.05;
    };
    const rectPayload = (element: Element | null) => {
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height), right: Math.round(rect.right), bottom: Math.round(rect.bottom) };
    };
    const canvas = document.querySelector("canvas");
    const watermark = document.querySelector(".watermark");
    const buttons = [...document.querySelectorAll("button")].filter(visible);
    const canvasRect = rectPayload(canvas);
    const watermarkRect = rectPayload(watermark);
    const bodyText = document.body.textContent || "";
    const noHorizontalOverflow = document.documentElement.scrollWidth <= window.innerWidth + 4;
    const canvasReadable = Boolean(canvasRect && canvasRect.width >= 480 && canvasRect.height >= 300);
    const watermarkVisible = visible(watermark) && Boolean(watermark?.textContent?.includes("GameOS"));
    const watermarkPadded = Boolean(
      watermarkRect &&
        watermarkRect.right <= window.innerWidth - 8 &&
        watermarkRect.bottom <= Math.max(window.innerHeight, document.documentElement.scrollHeight) - 8
    );
    const controlsVisible = buttons.length >= 1;
    const rawMachineVerdictHidden = !/(STATIC_WEB_QA_PASS|NEEDS_ARCHITECTURE_UPGRADE|WORTH_PLAYING_FOR_)/.test(bodyText);
    const pass = noHorizontalOverflow && canvasReadable && watermarkVisible && watermarkPadded && controlsVisible && rawMachineVerdictHidden;

    return {
      pass,
      verdict: pass ? "VISUAL_BROWSER_QA_PASS" : "VISUAL_BROWSER_QA_FAIL",
      noHorizontalOverflow,
      canvasReadable,
      watermarkVisible,
      watermarkPadded,
      controlsVisible,
      rawMachineVerdictHidden,
      buttonCount: buttons.length,
      canvasRect,
      watermarkRect,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      document: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight }
    };
  });
}

function enrichPlayerReportWithQuality(report: Record<string, unknown>, visualQa: { pass: boolean }, interaction: Record<string, unknown>): Record<string, unknown> {
  const interactionPass = browserInteractionPassed(interaction);
  const enriched: Record<string, unknown> = {
    ...report,
    browser_interaction_verdict: interactionPass ? "BROWSER_INTERACTION_PASS" : "BROWSER_INTERACTION_FAIL",
    visual_qa_verdict: visualQa.pass ? "VISUAL_BROWSER_QA_PASS" : "VISUAL_BROWSER_QA_FAIL",
    visual_qa: visualQa,
    first_ten_seconds_verdict: String(report.first_ten_seconds_verdict || inferFirstTenSecondsVerdict(report)),
    replay_verdict: String(report.replay_verdict || inferReplayVerdict(report)),
    control_feel_verdict: String(report.control_feel_verdict || inferControlFeelVerdict(report)),
    clarity_verdict: String(report.clarity_verdict || inferClarityVerdict(report, visualQa)),
    difficulty_curve_verdict: String(report.difficulty_curve_verdict || inferDifficultyCurveVerdict(report)),
    visual_maturity_verdict: String(report.visual_maturity_verdict || (visualQa.pass ? "VISUAL_MATURITY_PASS" : "VISUAL_MATURITY_FAIL"))
  };
  const councilPass = [
    enriched.first_ten_seconds_verdict,
    enriched.replay_verdict,
    enriched.control_feel_verdict,
    enriched.clarity_verdict,
    enriched.difficulty_curve_verdict,
    enriched.visual_maturity_verdict,
    enriched.browser_interaction_verdict
  ].every((value) => String(value).endsWith("_PASS"));
  enriched.advanced_player_council_verdict = councilPass ? "ADVANCED_PLAYER_COUNCIL_PASS" : "ADVANCED_PLAYER_COUNCIL_FAIL";

  if (!visualQa.pass || !interactionPass || !councilPass) {
    enriched.visual_verdict = visualQa.pass ? enriched.visual_verdict || "VISUAL_GATE_PASS" : "VISUAL_GATE_FAIL";
    if (String(enriched.verdict || "").startsWith("WORTH_PLAYING")) {
      enriched.verdict = !visualQa.pass ? "NEEDS_VISUAL_COMPOSITION_REPAIR" : !interactionPass ? "NEEDS_BROWSER_INTERACTION_PROOF" : "NEEDS_ADVANCED_PLAYER_COUNCIL_REVIEW";
    }
  }

  return enriched;
}

function browserInteractionPassed(interaction: Record<string, unknown>): boolean {
  if (Object.keys(interaction).length === 0) return true;
  if (typeof interaction.pass === "boolean") return interaction.pass;
  const requiredKeys = ["firstCutPass", "resetSafePass", "recutPass"];
  return requiredKeys.every((key) => interaction[key] === true);
}

function inferFirstTenSecondsVerdict(report: Record<string, unknown>): string {
  return numberValue(report.average_score) >= 250 || numberValue(report.completions) > 0 ? "FIRST_TEN_SECONDS_PASS" : "FIRST_TEN_SECONDS_FAIL";
}

function inferReplayVerdict(report: Record<string, unknown>): string {
  return numberValue(report.matches) >= 2 && numberValue(report.timeouts) === 0 ? "REPLAY_LOOP_PASS" : "REPLAY_LOOP_FAIL";
}

function inferControlFeelVerdict(report: Record<string, unknown>): string {
  return String(report.input_verdict || "").endsWith("_PASS") && numberValue(report.branching_decisions) >= 8 ? "CONTROL_FEEL_PASS" : String(report.input_verdict || "").endsWith("_PASS") ? "CONTROL_FEEL_PASS" : "CONTROL_FEEL_FAIL";
}

function inferClarityVerdict(report: Record<string, unknown>, visualQa: { pass: boolean }): string {
  return visualQa.pass && (String(report.visual_verdict || "").endsWith("_PASS") || String(report.visual_verdict || "") === "not reported") ? "CLARITY_PASS" : "CLARITY_FAIL";
}

function inferDifficultyCurveVerdict(report: Record<string, unknown>): string {
  return numberValue(report.timeouts) === 0 && (numberValue(report.captures) > 0 || numberValue(report.completions) > 0 || numberValue(report.average_score) > 100) ? "DIFFICULTY_CURVE_PASS" : "DIFFICULTY_CURVE_FAIL";
}

function numberValue(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function safeFileStem(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "web";
}

async function verifyCapabilityBrowserInteraction(page: import("playwright-core").Page): Promise<Record<string, unknown> & { pass: boolean }> {
  const smoke = (await page.evaluate(() => globalThis.__gameOsWebAdapter.smoke())) as Record<string, unknown>;
  const webPattern = String(smoke.webPattern || "capability-foundation");
  const before = await readCapabilityState(page);

  await page.locator("#start-button").click();
  await page.waitForTimeout(180);
  const afterStart = await readCapabilityState(page);

  await page.keyboard.press("Space");
  await page.waitForTimeout(180);
  const afterPrimary = await readCapabilityState(page);

  if (webPattern === "combat-survival") {
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(100);
  }

  const afterProof = (await page.evaluate(() => globalThis.__gameOsWebAdapter.spawnProofObjectForQa?.() ?? {})) as Record<string, unknown>;
  await page.waitForTimeout(180);
  const afterProofSettled = await readCapabilityState(page);

  const afterFailure = (await page.evaluate(() => globalThis.__gameOsWebAdapter.forceFailureForQa?.() ?? {})) as Record<string, unknown>;
  await page.waitForTimeout(120);

  await page.locator("#reset-button").click();
  await page.waitForTimeout(180);
  const afterReset = await readCapabilityState(page);

  await page.locator("#start-button").click();
  await page.waitForTimeout(120);
  const afterRetry = await readCapabilityState(page);

  const startPass = afterStart.running === true;
  const primaryPass = stateNumber(afterPrimary, "controlsUsed") > stateNumber(before, "controlsUsed");
  const stateChangedPass =
    stateNumber(afterPrimary, "score") !== stateNumber(afterStart, "score") ||
    stateNumber(afterPrimary, "playerLane") !== stateNumber(afterStart, "playerLane") ||
    stateNumber(stateObject(afterPrimary, "player"), "y") !== stateNumber(stateObject(afterStart, "player"), "y") ||
    stateNumber(afterPrimary, "attacks") > stateNumber(afterStart, "attacks");
  const proofPass =
    webPattern === "arcade-survival"
      ? stateNumber(afterProofSettled, "collectibles") > stateNumber(afterPrimary, "collectibles") && stateNumber(afterProofSettled, "score") > stateNumber(afterPrimary, "score")
      : webPattern === "platform-movement"
        ? stateNumber(afterProofSettled, "checkpoints") > stateNumber(afterPrimary, "checkpoints") && stateNumber(afterProofSettled, "score") > stateNumber(afterPrimary, "score")
        : webPattern === "combat-survival"
          ? stateNumber(afterProofSettled, "hits") > stateNumber(afterPrimary, "hits") && stateNumber(afterProofSettled, "attacks") > stateNumber(afterPrimary, "attacks")
          : stateNumber(afterProofSettled, "score") >= stateNumber(afterPrimary, "score");
  const failurePass = afterFailure.running === false && stateNumber(afterFailure, "lives") === 0 && stateNumber(afterFailure, "failures") > 0;
  const resetPass = afterReset.running === false && stateNumber(afterReset, "score") === 0 && stateNumber(afterReset, "lives") >= 3;
  const retryPass = afterRetry.running === true;
  const pass = startPass && primaryPass && stateChangedPass && proofPass && failurePass && resetPass && retryPass;

  if (!pass) {
    throw new Error(
      `capability web browser interaction failed: pattern=${webPattern}, start=${startPass}, primary=${primaryPass}, stateChanged=${stateChangedPass}, proof=${proofPass}, failure=${failurePass}, reset=${resetPass}, retry=${retryPass}.`
    );
  }

  return {
    pass,
    webPattern,
    startPass,
    primaryPass,
    stateChangedPass,
    proofPass,
    failurePass,
    resetPass,
    retryPass,
    before,
    afterStart,
    afterPrimary,
    afterProof,
    afterProofSettled,
    afterFailure,
    afterReset,
    afterRetry
  };
}

async function readCapabilityState(page: import("playwright-core").Page): Promise<Record<string, unknown>> {
  return (await page.evaluate(() => globalThis.__gameOsWebAdapter.getState?.() ?? {})) as Record<string, unknown>;
}

function stateObject(source: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = source[key];
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function stateNumber(source: Record<string, unknown>, key: string): number {
  const value = source[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

async function verifyAssetPhysicsBrowserInteraction(page: import("playwright-core").Page): Promise<Record<string, unknown>> {
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

  const firstCutPass = firstSwipe.pass && afterCut.ropeReleased === true && afterCut.status === "falling";
  const resetSafePass = afterReset.ropeReleased === false && afterReset.status === "ready";
  const noAutoCutPass = afterResetSettled.ropeReleased === false && afterResetSettled.status === "ready";
  const smoothMousePass = smoothMouseBlade.pass && afterSmoothMouseBlade.ropeReleased === true && afterSmoothMouseBlade.status === "falling";
  const bladeResetSafePass = afterBladeResetSettled.ropeReleased === false && afterBladeResetSettled.status === "ready";
  const slowMousePass = slowMouseBlade.pass && afterSlowMouseBlade.ropeReleased === true && afterSlowMouseBlade.status === "falling";
  const slowBladeResetSafePass = afterSlowBladeResetSettled.ropeReleased === false && afterSlowBladeResetSettled.status === "ready";
  const recutPass = secondSwipe.pass && afterRecut.ropeReleased === true && afterRecut.status === "falling";

  if (!firstCutPass || !resetSafePass || !noAutoCutPass || !smoothMousePass || !bladeResetSafePass || !slowMousePass || !slowBladeResetSafePass || !recutPass) {
    throw new Error(
      `asset-led physics browser interaction failed: firstCut=${firstCutPass}, resetSafe=${resetSafePass}, noAutoCut=${noAutoCutPass}, smoothMouse=${smoothMousePass}, bladeResetSafe=${bladeResetSafePass}, slowMouse=${slowMousePass}, slowBladeResetSafe=${slowBladeResetSafePass}, recut=${recutPass}.`
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
    throw new Error("Asset-Led Physics mouse swipe QA could not read canvas or rope geometry.");
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
    pass: after.ropeReleased === true && after.status === "falling" && after.sliceGestureCut === true,
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
    throw new Error("Asset-Led Physics slow mouse blade QA could not read canvas or rope geometry.");
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
    if (liveTarget.state.ropeReleased === true) break;
    if (!liveTarget.rope) throw new Error("Asset-Led Physics slow mouse blade QA lost live rope geometry.");
    latestRope = liveTarget.rope;
    end = bladePointFor(latestRope, step % 2 === 1 ? -1 : 1, step === 1 ? 62 : 48);
    const screenPoint = toScreen(end);
    await page.mouse.move(screenPoint.x, screenPoint.y);
  }
  await page.waitForTimeout(180);

  const after = await page.evaluate(() => globalThis.__gameOsWebAdapter.getState?.() ?? {});
  return {
    pass: after.ropeReleased === true && after.status === "falling" && after.sliceGestureCut === true,
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
    throw new Error("Asset-Led Physics smooth mouse blade QA could not read canvas or rope geometry.");
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
    pass: after.ropeReleased === true && after.status === "falling" && after.sliceGestureCut === true,
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
  const candidates = [path.join(projectRoot, "scripts", "game.js"), path.join(projectRoot, "scripts", "turn-rules.js")];
  const script = candidates.find((candidate) => fs.existsSync(candidate));
  if (!script) throw new Error(`Missing Web runtime script under ${projectRoot}.`);
  return script;
}

function detectWebBuildKind(projectRoot: string, html: string, script: string): string {
  const manifestPath = path.join(projectRoot, "web-adapter-manifest.json");
  if (fs.existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as { prototype?: string };
      if (manifest.prototype) return manifest.prototype;
    } catch {
      // Fall back to source inspection below.
    }
  }

  if (script.includes("asset-physics") || html.includes("Asset-Led Physics")) return "asset-physics";
  if (script.includes("capability-web") || html.includes("Capability Build")) return "capability-web";
  return "capability-web";
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
