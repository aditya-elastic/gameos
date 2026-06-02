import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const explicitProject = process.env.GAME_OS_GODOT_PROJECT || process.argv[2];
const projectRoot = explicitProject ? path.resolve(explicitProject) : findLatestGodotProject();

assert(projectRoot, "No Godot adapter project found. Generate one from Game OS first.");
assert(existsSync(path.join(projectRoot, "project.godot")), `Missing project.godot at ${projectRoot}`);
assert(existsSync(path.join(projectRoot, "scripts", "adapter_smoke.gd")), `Missing adapter smoke script at ${projectRoot}`);

runGodot(["--headless", "--path", projectRoot, "-s", "res://scripts/adapter_smoke.gd"]);
runGodot(["--headless", "--path", projectRoot, "--quit-after", "1"]);

console.log(
  JSON.stringify(
    {
      ok: true,
      projectRoot
    },
    null,
    2
  )
);

function findLatestGodotProject() {
  const projectsRoot = path.join(process.cwd(), "data", "projects");
  if (!existsSync(projectsRoot)) return "";

  return readdirSync(projectsRoot)
    .map((projectId) => path.join(projectsRoot, projectId, "godot"))
    .filter((candidate) => existsSync(path.join(candidate, "project.godot")))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
}

function runGodot(args) {
  const result = spawnSync("godot", args, {
    cwd: process.cwd(),
    encoding: "utf8"
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  assert(result.status === 0, `Godot command failed: godot ${args.join(" ")}`);
}

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}
