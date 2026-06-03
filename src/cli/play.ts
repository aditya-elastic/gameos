import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { spawn } from "node:child_process";
import { getProjectArtifactRoot } from "../lib/artifacts";

export type PlayServer = {
  server: http.Server;
  url: string;
  projectRoot: string;
};

export async function playProject(projectId: string, options: { port?: number; open: boolean }): Promise<PlayServer> {
  const projectRoot = findWebBuildRoot(projectId);
  const playServer = await startStaticWebServer(projectRoot, options.port ?? 0);
  if (options.open) openUrl(playServer.url);
  return playServer;
}

export function findWebBuildRoot(projectId: string): string {
  const projectRoot = path.join(getProjectArtifactRoot(projectId), "web");
  if (!fs.existsSync(path.join(projectRoot, "index.html"))) {
    throw new Error(`No Web build found for ${projectId}. Run gameos build web ${projectId} first.`);
  }
  return projectRoot;
}

export async function startStaticWebServer(projectRoot: string, port: number): Promise<PlayServer> {
  const root = path.resolve(projectRoot);
  const server = http.createServer((request, response) => {
    const requestUrl = new URL(request.url || "/", "http://127.0.0.1");
    if (requestUrl.pathname === "/favicon.ico") {
      response.writeHead(204);
      response.end();
      return;
    }

    const relative = requestUrl.pathname === "/" ? "index.html" : requestUrl.pathname.slice(1);
    const filePath = path.resolve(root, decodeURIComponent(relative));

    if (!isInsideRoot(root, filePath) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    response.writeHead(200, { "content-type": contentType(filePath) });
    fs.createReadStream(filePath).pipe(response);
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });

  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Could not resolve local play server address.");

  return {
    server,
    projectRoot: root,
    url: `http://127.0.0.1:${address.port}/`
  };
}

function isInsideRoot(root: string, filePath: string): boolean {
  return filePath === root || filePath.startsWith(`${root}${path.sep}`);
}

function openUrl(url: string): void {
  const command =
    process.platform === "darwin"
      ? ["open", url]
      : process.platform === "win32"
        ? ["cmd", "/c", "start", "", url]
        : ["xdg-open", url];

  try {
    const child = spawn(command[0], command.slice(1), { detached: true, stdio: "ignore" });
    child.unref();
  } catch {
    // Opening a browser is best-effort; the printed URL remains the reliable path.
  }
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
