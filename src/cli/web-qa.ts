import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { getProjectArtifactRoot } from "../lib/artifacts";
import type { ProjectWorkspace } from "../lib/types";

declare global {
  var __gameOsWebAdapter: {
    smoke: () => { ok: boolean; kind?: string; [key: string]: unknown };
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
      readyMarker: html.includes("data-game-os-web")
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
    const playerReport = await page.evaluate(() => globalThis.__gameOsWebAdapter.runPlayerAgent({ matches: 8, seed: 20260601 }));
    const { recordWebPlaytest } = await import("../lib/studio");
    const workspace = recordWebPlaytest(projectId, playerReport);
    const report = {
      kind: String(playerReport.kind || smoke.kind || "web"),
      verdict: String(playerReport.verdict || "unknown"),
      projectRoot,
      details: playerReport as Record<string, unknown>
    };

    if (!report.verdict.startsWith("WORTH_PLAYING")) {
      throw new Error(`Web player agent verdict was ${report.verdict}. Upgrade architecture before accepting this prototype.`);
    }

    return { workspace, report };
  } finally {
    await browser.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
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
