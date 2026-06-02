import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { chromium } from "playwright-core";

const explicitProject = process.env.GAME_OS_WEB_PROJECT || process.argv[2];
const projectRoot = explicitProject ? path.resolve(explicitProject) : findLatestWebProject();
const chromePath = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

assert(projectRoot, "No Web adapter project found. Generate one from Game OS first.");
assert(fs.existsSync(path.join(projectRoot, "index.html")), `Missing Web prototype at ${projectRoot}`);
assert(fs.existsSync(chromePath), `Chrome executable not found at ${chromePath}`);

const { server, url } = await startStaticServer(projectRoot);
const browser = await chromium.launch({ executablePath: chromePath, headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(url, { waitUntil: "networkidle" });
  await page.locator('[data-game-os-web="ready"]').waitFor({ state: "visible", timeout: 5000 });
  const report = await page.evaluate(() => globalThis.__gameOsWebAdapter.runPlayerAgent({ matches: 8, seed: 20260531 }));

  console.log(`WEB_PLAYER_AGENT_REPORT: ${JSON.stringify(report)}`);
  await recordReport(report);
  assert(
    String(report.verdict || "").startsWith("WORTH_PLAYING"),
    "Web player agent verdict was not worth playing. Upgrade architecture before accepting this prototype."
  );
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

async function recordReport(report) {
  const projectId = inferProjectId(projectRoot);
  if (!projectId) return;

  const baseUrl = normalizeBaseUrl(process.env.GAME_OS_BASE_URL ?? "http://localhost:3000");
  try {
    const response = await fetch(`${baseUrl}/api/projects/${projectId}/adapters/web/playtest`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(report)
    });

    if (!response.ok) {
      const body = await response.text();
      console.error(`Unable to record Web player-agent report in Game OS: ${body}`);
      return;
    }

    console.log(`Recorded Web player-agent report in Game OS for ${projectId}.`);
  } catch (error) {
    console.error(`Unable to reach Game OS to record Web player-agent report: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function inferProjectId(candidate) {
  const parts = candidate.split(path.sep);
  const projectsIndex = parts.lastIndexOf("projects");
  if (projectsIndex === -1) return "";
  return parts[projectsIndex + 1] ?? "";
}

function normalizeBaseUrl(value) {
  try {
    return new URL(value).origin;
  } catch {
    return value.replace(/\/+$/, "");
  }
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
