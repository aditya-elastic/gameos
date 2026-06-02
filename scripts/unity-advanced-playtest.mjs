import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const explicitProject = process.env.GAME_OS_UNITY_PROJECT || process.argv[2];
const projectRoot = explicitProject ? path.resolve(explicitProject) : findLatestUnityProject();
const unityEditor = findUnityEditor();

assert(projectRoot, "No Unity adapter project found. Generate one from Game OS first.");
assert(existsSync(path.join(projectRoot, "ProjectSettings", "ProjectVersion.txt")), `Missing Unity project settings at ${projectRoot}`);
assert(existsSync(path.join(projectRoot, "Assets", "Editor", "GameOsUnityAdvancedPlaytest.cs")), `Missing Unity advanced playtest at ${projectRoot}`);
assert(unityEditor, "Unity editor not found. Set UNITY_EDITOR=/path/to/Unity or install Unity through Unity Hub.");

const result = runUnity([
  "-batchmode",
  "-nographics",
  "-quit",
  "-projectPath",
  projectRoot,
  "-executeMethod",
  "GameOS.Editor.GameOsUnityAdvancedPlaytest.Run",
  "-logFile",
  "-"
]);
const report = parseReport(`${result.stdout}\n${result.stderr}`);

if (report) {
  await recordReport(report);
}

assert(result.status === 0, "Unity advanced player did not approve this slice. Upgrade architecture before accepting the prototype.");

function findLatestUnityProject() {
  const projectsRoot = path.join(process.cwd(), "data", "projects");
  if (!existsSync(projectsRoot)) return "";

  return readdirSync(projectsRoot)
    .map((projectId) => path.join(projectsRoot, projectId, "unity"))
    .filter((candidate) => existsSync(path.join(candidate, "ProjectSettings", "ProjectVersion.txt")))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
}

function findUnityEditor() {
  if (process.env.UNITY_EDITOR && existsSync(process.env.UNITY_EDITOR)) {
    return process.env.UNITY_EDITOR;
  }

  const editorsRoot = "/Applications/Unity/Hub/Editor";
  if (!existsSync(editorsRoot)) return "";

  return readdirSync(editorsRoot)
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
    .map((version) => path.join(editorsRoot, version, "Unity.app", "Contents", "MacOS", "Unity"))
    .find((candidate) => existsSync(candidate));
}

function runUnity(args) {
  const result = spawnSync(unityEditor, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 20
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  return result;
}

function parseReport(output) {
  const match = output.match(/UNITY_ADVANCED_PLAYTEST_REPORT:\s*(\{[^\n]+\})/);
  if (!match) return null;

  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

async function recordReport(report) {
  const projectId = inferProjectId(projectRoot);
  if (!projectId) return;

  const baseUrl = normalizeBaseUrl(process.env.GAME_OS_BASE_URL ?? "http://localhost:3000");
  try {
    const response = await fetch(`${baseUrl}/api/projects/${projectId}/adapters/unity/playtest`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(report)
    });

    if (!response.ok) {
      const body = await response.text();
      console.error(`Unable to record Unity advanced playtest in Game OS: ${body}`);
      return;
    }

    console.log(`Recorded Unity advanced playtest in Game OS for ${projectId}.`);
  } catch (error) {
    console.error(`Unable to reach Game OS to record Unity advanced playtest: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function normalizeBaseUrl(value) {
  try {
    return new URL(value).origin;
  } catch {
    return value.replace(/\/+$/, "");
  }
}

function inferProjectId(candidate) {
  const parts = candidate.split(path.sep);
  const projectsIndex = parts.lastIndexOf("projects");
  if (projectsIndex === -1) return "";
  return parts[projectsIndex + 1] ?? "";
}

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}
