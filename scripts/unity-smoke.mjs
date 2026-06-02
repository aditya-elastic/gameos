import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const explicitProject = process.env.GAME_OS_UNITY_PROJECT || process.argv[2];
const projectRoot = explicitProject ? path.resolve(explicitProject) : findLatestUnityProject();
const unityEditor = findUnityEditor();

assert(projectRoot, "No Unity adapter project found. Generate one from Game OS first.");
assert(existsSync(path.join(projectRoot, "ProjectSettings", "ProjectVersion.txt")), `Missing Unity project settings at ${projectRoot}`);
assert(existsSync(path.join(projectRoot, "Assets", "Editor", "GameOsUnitySmoke.cs")), `Missing Unity smoke script at ${projectRoot}`);
assert(unityEditor, "Unity editor not found. Set UNITY_EDITOR=/path/to/Unity or install Unity through Unity Hub.");

runUnity(["-batchmode", "-nographics", "-quit", "-projectPath", projectRoot, "-executeMethod", "GameOS.Editor.GameOsUnitySmoke.Run", "-logFile", "-"]);

console.log(
  JSON.stringify(
    {
      ok: true,
      projectRoot,
      unityEditor
    },
    null,
    2
  )
);

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

  assert(result.status === 0, `Unity command failed: ${unityEditor} ${args.join(" ")}`);
}

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}
