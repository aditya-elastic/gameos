#!/usr/bin/env -S node --disable-warning=ExperimentalWarning
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readArtifactContent, toProjectRelativeArtifactPath } from "../lib/artifacts";
import type { ArtifactRecord, CreateProjectInput, ProjectWorkspace } from "../lib/types";
import {
  artifactSelector,
  printResult,
  recommendNextCommand,
  renderArtifactList,
  renderJourney,
  renderProjectStatus,
  renderScorecardSummary,
  renderWorkspaceSummary,
  summarizeArtifactContent
} from "./output";
import { parseMakeTarget, parseQuality, type QualityLevel } from "./quality";
import { runWebQa } from "./web-qa";

type ParsedArgv = {
  command: string[];
  flags: Map<string, string[]>;
  positionals: string[];
};

type CliOptions = {
  json: boolean;
  full: boolean;
  yes: boolean;
  allowHeavy: boolean;
  dataDir?: string;
};

const VERSION = "0.2.0";
const DEFAULT_DATA_DIR = path.join(os.homedir(), ".gameos");

process.on("warning", (warning) => {
  if (warning.name === "ExperimentalWarning" && warning.message.includes("SQLite")) return;
  process.stderr.write(`${warning.name}: ${warning.message}\n`);
});

export async function runCli(argv: string[]): Promise<void> {
  const parsed = parseArgv(argv);
  const options = getCliOptions(parsed);
  if (options.dataDir) process.env.GAME_OS_DATA_DIR = path.resolve(options.dataDir);

  if (hasFlag(parsed, "version") || hasFlag(parsed, "v") || parsed.command[0] === "--version") {
    printResult(options, { version: VERSION }, `gameos ${VERSION}`);
    return;
  }

  if (parsed.command.length === 0 || hasFlag(parsed, "help") || hasFlag(parsed, "h")) {
    printResult(options, { ok: true, help: helpText() }, helpText());
    return;
  }

  const [command, subcommand] = parsed.command;

  switch (command) {
    case "doctor":
      return doctor(parsed, options);
    case "create":
      return createProject(parsed, options);
    case "make":
      return makeProject(parsed, options);
    case "list":
      return listProjects(parsed, options);
    case "status":
      return projectStatus(parsed, options);
    case "journey":
      return journey(parsed, options);
    case "review":
      return review(parsed, options);
    case "feedback":
      return feedback(parsed, options);
    case "agents":
      return agents(parsed, options, subcommand);
    case "assets":
      return assets(parsed, options, subcommand);
    case "build":
      return build(parsed, options, subcommand);
    case "qa":
      return qa(parsed, options, subcommand);
    case "artifact":
      return artifact(parsed, options, subcommand);
    default:
      throw new Error(`Unknown command: ${command}\n\n${helpText()}`);
  }
}

export function parseArgv(argv: string[]): ParsedArgv {
  const flags = new Map<string, string[]>();
  const positionals: string[] = [];
  const command: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token.startsWith("--")) {
      const [rawName, inlineValue] = token.slice(2).split(/=(.*)/s).filter((part) => part !== undefined);
      const name = rawName.trim();
      const takesValue = valueFlags.has(name);
      const value = inlineValue ?? (takesValue ? argv[++index] : "true");
      if (takesValue && (!value || value.startsWith("--"))) throw new Error(`Missing value for --${name}`);
      flags.set(name, [...(flags.get(name) ?? []), value]);
      continue;
    }

    if (token.startsWith("-") && token.length > 1) {
      for (const shortName of token.slice(1)) flags.set(shortName, [...(flags.get(shortName) ?? []), "true"]);
      continue;
    }

    if (command.length < commandArity(command, token)) {
      command.push(token);
    } else {
      positionals.push(token);
    }
  }

  return { command, flags, positionals };
}

const valueFlags = new Set(["prompt", "platform", "engine", "genre", "audience", "target", "quality", "data-dir", "output", "name", "assets", "note"]);

function commandArity(command: string[], token: string): number {
  if (command.length === 0) return 1;
  const first = command[0];
  if (["agents", "assets", "build", "qa", "artifact"].includes(first)) return 2;
  return 1;
}

async function doctor(parsed: ParsedArgv, options: CliOptions): Promise<void> {
  const dataRoot = process.env.GAME_OS_DATA_DIR || DEFAULT_DATA_DIR;
  const status = {
    ok: true,
    version: VERSION,
    node: process.version,
    dataRoot,
    commands: {
      chrome: Boolean(findChrome()),
      godot: commandExists("godot"),
      unity: Boolean(findUnity())
    },
    privacy: {
      telemetry: false,
      cloudCalls: false,
      hiddenNetwork: false
    }
  };

  const lines = [
    `Game OS CLI ${VERSION}`,
    `Node: ${process.version}`,
    `Data: ${dataRoot}`,
    `Chrome: ${status.commands.chrome ? "found" : "missing"}`,
    `Godot: ${status.commands.godot ? "found" : "missing"}`,
    `Unity: ${status.commands.unity ? "found" : "missing"}`,
    "Telemetry: off",
    "Cloud calls: none"
  ];

  printResult(options, status, lines.join("\n"));
}

async function createProject(parsed: ParsedArgv, options: CliOptions): Promise<void> {
  const { createStudioProject } = await import("../lib/studio");
  const workspace = createStudioProject(projectInputFromFlags(parsed, false));
  printResult(options, projectPayload(workspace), renderWorkspaceSummary(workspace));
}

async function makeProject(parsed: ParsedArgv, options: CliOptions): Promise<void> {
  const { createStudioProject, generateWebAdapter, importProjectAssetsFromStoredFile } = await import("../lib/studio");
  parseMakeTarget(firstFlag(parsed, "target"));
  const quality = parseQuality(firstFlag(parsed, "quality"));
  let workspace = createStudioProject(projectInputFromFlags(parsed, true));
  const rawAssetPath = firstFlag(parsed, "assets");
  const assetPath = rawAssetPath ? path.resolve(rawAssetPath) : "";
  if (assetPath) {
    if (!fs.existsSync(assetPath)) throw new Error(`Asset file not found: ${assetPath}`);
    workspace = importProjectAssetsFromStoredFile(workspace.project.id, path.basename(assetPath), assetPath);
  }
  const built = generateWebAdapter(workspace.project.id);
  const browser = quality !== "fast" && !hasFlag(parsed, "static");
  const qaResult = await runWebQa(built.project.id, { browser });

  const payload = {
    project: projectPayload(qaResult.workspace),
    quality,
    assets: assetPath || null,
    qa: qaResult.report
  };
  const text = [
    renderWorkspaceSummary(qaResult.workspace),
    "",
    `Autopilot: ${quality}`,
    `Asset import: ${assetPath || "none"}`,
    `Web build: ${qaResult.report.projectRoot}`,
    `QA verdict: ${qaResult.report.verdict}`,
    `Next: ${recommendNextCommand(qaResult.workspace)}`
  ].join("\n");

  printResult(options, payload, text);
  if (browser && !qaResult.report.verdict.startsWith("WORTH_PLAYING")) process.exitCode = 1;
}

async function listProjects(_parsed: ParsedArgv, options: CliOptions): Promise<void> {
  const { getStudioDashboard } = await import("../lib/studio");
  const projects = getStudioDashboard();
  const text = projects.length
    ? projects.map((workspace) => `${workspace.project.id} | ${workspace.project.name} | ${workspace.project.targetPlatforms.join(", ")}`).join("\n")
    : "No Game OS projects yet. Run gameos create --prompt \"...\" --platform Web";
  printResult(options, { projects: projects.map(projectPayload) }, text);
}

async function projectStatus(parsed: ParsedArgv, options: CliOptions): Promise<void> {
  const workspace = await requireProject(parsed.positionals[0]);
  printResult(options, projectPayload(workspace), renderProjectStatus(workspace));
}

async function journey(parsed: ParsedArgv, options: CliOptions): Promise<void> {
  const workspace = await requireProject(parsed.positionals[0]);
  printResult(options, { project: projectPayload(workspace), journey: renderJourney(workspace) }, renderJourney(workspace));
}

async function review(parsed: ParsedArgv, options: CliOptions): Promise<void> {
  const { createStudioReview } = await import("../lib/studio");
  const projectId = parsed.positionals[0];
  if (!projectId) throw new Error("Usage: gameos review <project-id>");
  const result = createStudioReview(projectId);
  printResult(
    options,
    { project: projectPayload(result.workspace), scorecard: result.scorecard },
    renderScorecardSummary(result.scorecard)
  );
  if (!result.scorecard.verdict.startsWith("10_OUT_OF_10")) process.exitCode = 1;
}

async function feedback(parsed: ParsedArgv, options: CliOptions): Promise<void> {
  const { recordUserFeedback } = await import("../lib/studio");
  const projectId = parsed.positionals[0];
  const note = firstFlag(parsed, "note") || parsed.positionals.slice(1).join(" ");
  if (!projectId || !note) throw new Error('Usage: gameos feedback <project-id> --note "what got stuck or should improve"');
  const workspace = recordUserFeedback(projectId, note);
  printResult(
    options,
    projectPayload(workspace),
    [`Feedback recorded for ${workspace.project.name}.`, `Next: gameos agents rerun ${workspace.project.id} visual-quality-director`].join("\n")
  );
}

async function agents(parsed: ParsedArgv, options: CliOptions, subcommand?: string): Promise<void> {
  const { regenerateAgent } = await import("../lib/studio");
  const projectId = parsed.positionals[0];
  if (!projectId) throw new Error("Usage: gameos agents run <project-id> OR gameos agents rerun <project-id> <role>");

  let workspace = await requireProject(projectId);
  if (subcommand === "run") {
    for (const agent of workspace.agents) workspace = regenerateAgent(projectId, agent.role);
  } else if (subcommand === "rerun") {
    const role = parsed.positionals[1];
    if (!role) throw new Error("Usage: gameos agents rerun <project-id> <role>");
    workspace = regenerateAgent(projectId, role);
  } else {
    throw new Error("Usage: gameos agents run <project-id> OR gameos agents rerun <project-id> <role>");
  }

  printResult(options, projectPayload(workspace), renderWorkspaceSummary(workspace));
}

async function assets(parsed: ParsedArgv, options: CliOptions, subcommand?: string): Promise<void> {
  if (subcommand !== "import") throw new Error("Usage: gameos assets import <project-id> ./assets.zip");
  const { importProjectAssetsFromStoredFile } = await import("../lib/studio");
  const [projectId, rawFile] = parsed.positionals;
  if (!projectId || !rawFile) throw new Error("Usage: gameos assets import <project-id> ./assets.zip");
  const filePath = path.resolve(rawFile);
  if (!fs.existsSync(filePath)) throw new Error(`Asset file not found: ${filePath}`);
  const workspace = importProjectAssetsFromStoredFile(projectId, path.basename(filePath), filePath);
  printResult(options, projectPayload(workspace), renderWorkspaceSummary(workspace));
}

async function build(parsed: ParsedArgv, options: CliOptions, lane?: string): Promise<void> {
  const projectId = parsed.positionals[0];
  if (!projectId || !lane) throw new Error("Usage: gameos build <web|godot|unity> <project-id>");
  const studio = await import("../lib/studio");
  let workspace: ProjectWorkspace;
  if (lane === "web") workspace = studio.generateWebAdapter(projectId);
  else if (lane === "godot") {
    requireHeavy(options, "Godot build generation");
    workspace = studio.generateGodotAdapter(projectId);
  } else if (lane === "unity") {
    requireHeavy(options, "Unity build generation");
    workspace = studio.generateUnityAdapter(projectId);
  } else {
    throw new Error("Usage: gameos build <web|godot|unity> <project-id>");
  }
  printResult(options, projectPayload(workspace), renderWorkspaceSummary(workspace));
}

async function qa(parsed: ParsedArgv, options: CliOptions, lane?: string): Promise<void> {
  const projectId = parsed.positionals[0];
  if (!projectId || !lane) throw new Error("Usage: gameos qa <web|godot|unity> <project-id>");

  if (lane === "web") {
    const result = await runWebQa(projectId, { browser: !hasFlag(parsed, "static") });
    printResult(
      options,
      { project: projectPayload(result.workspace), qa: result.report },
      [`QA verdict: ${result.report.verdict}`, `Project: ${result.workspace.project.id}`, `Next: gameos status ${result.workspace.project.id}`].join("\n")
    );
    if (!hasFlag(parsed, "static") && !result.report.verdict.startsWith("WORTH_PLAYING")) process.exitCode = 1;
    return;
  }

  requireHeavy(options, `${lane} QA`);
  const workspace = await requireProject(projectId);
  const projectRoot = path.join(process.env.GAME_OS_DATA_DIR || DEFAULT_DATA_DIR, "projects", projectId, lane);
  const command = lane === "godot" ? ["godot", "--headless", "--path", projectRoot, "-s", "res://scripts/adapter_smoke.gd"] : unitySmokeCommand(projectRoot);
  const result = spawnSync(command[0], command.slice(1), { encoding: "utf8" });
  const ok = result.status === 0;
  printResult(options, { ok, command, stdout: result.stdout, stderr: result.stderr }, `${lane} QA ${ok ? "passed" : "failed"} for ${workspace.project.name}`);
  if (!ok) process.exitCode = result.status ?? 1;
}

async function artifact(parsed: ParsedArgv, options: CliOptions, subcommand?: string): Promise<void> {
  const projectId = parsed.positionals[0];
  if (!projectId) throw new Error("Usage: gameos artifact list <project-id> OR gameos artifact read <project-id> <artifact>");
  const workspace = await requireProject(projectId);

  if (subcommand === "list") {
    printResult(options, { artifacts: workspace.artifacts.map(artifactPayload) }, renderArtifactList(workspace));
    return;
  }

  if (subcommand === "read") {
    const selector = parsed.positionals[1];
    if (!selector) throw new Error("Usage: gameos artifact read <project-id> <artifact>");
    const found = findArtifact(workspace, selector);
    if (!found) throw new Error(`Artifact not found: ${selector}`);
    const content = readArtifactContent(found.path);
    const text = summarizeArtifactContent(content, options.full);
    printResult(options, { artifact: artifactPayload(found), content: options.full ? content : text }, text);
    return;
  }

  throw new Error("Usage: gameos artifact list <project-id> OR gameos artifact read <project-id> <artifact>");
}

async function requireProject(projectId?: string): Promise<ProjectWorkspace> {
  if (!projectId) throw new Error("Project id is required.");
  const { getStudioProject } = await import("../lib/studio");
  const workspace = getStudioProject(projectId);
  if (!workspace) throw new Error(`Project not found: ${projectId}`);
  return workspace;
}

function projectInputFromFlags(parsed: ParsedArgv, includeWebDefault: boolean): CreateProjectInput {
  const prompt = firstFlag(parsed, "prompt") || parsed.positionals.join(" ");
  if (!prompt || prompt.trim().length < 20) throw new Error("Provide a game prompt with --prompt \"...\".");
  const targetPlatforms = allFlags(parsed, "platform");
  if (includeWebDefault && !targetPlatforms.includes("Web")) targetPlatforms.unshift("Web");
  if (targetPlatforms.length === 0) throw new Error("Choose at least one --platform.");
  return {
    prompt,
    targetPlatforms,
    enginePreference: firstFlag(parsed, "engine") || "Engine-neutral first",
    genre: firstFlag(parsed, "genre"),
    targetAudience: firstFlag(parsed, "audience")
  };
}

function getCliOptions(parsed: ParsedArgv): CliOptions {
  return {
    json: hasFlag(parsed, "json"),
    full: hasFlag(parsed, "full"),
    yes: hasFlag(parsed, "yes"),
    allowHeavy: hasFlag(parsed, "allow-heavy"),
    dataDir: firstFlag(parsed, "data-dir")
  };
}

function projectPayload(workspace: ProjectWorkspace): Record<string, unknown> {
  return {
    id: workspace.project.id,
    name: workspace.project.name,
    genre: workspace.project.genre,
    targetPlatforms: workspace.project.targetPlatforms,
    artifacts: workspace.artifacts.length,
    agents: workspace.agents.length,
    qa: {
      pass: workspace.qaGates.filter((gate) => gate.result === "pass").length,
      watch: workspace.qaGates.filter((gate) => gate.result === "watch").length,
      blocked: workspace.qaGates.filter((gate) => gate.result === "blocked").length
    }
  };
}

function artifactPayload(artifact: ArtifactRecord): Record<string, unknown> {
  return {
    id: artifact.id,
    selector: artifactSelector(artifact),
    kind: artifact.kind,
    label: artifact.label,
    path: toProjectRelativeArtifactPath(artifact.path, artifact.projectId),
    createdAt: artifact.createdAt
  };
}

function findArtifact(workspace: ProjectWorkspace, selector: string): ArtifactRecord | null {
  const normalized = selector.toLowerCase();
  return (
    workspace.artifacts.find((artifactItem) =>
      [artifactItem.id, artifactItem.kind, artifactItem.label, artifactSelector(artifactItem), path.basename(artifactItem.path)]
        .map((value) => value.toLowerCase())
        .includes(normalized)
    ) ?? null
  );
}

function requireHeavy(options: CliOptions, action: string): void {
  if (!options.allowHeavy) throw new Error(`${action} can be long-running. Re-run with --allow-heavy.`);
}

function firstFlag(parsed: ParsedArgv, name: string): string | undefined {
  return parsed.flags.get(name)?.at(-1);
}

function allFlags(parsed: ParsedArgv, name: string): string[] {
  return parsed.flags.get(name) ?? [];
}

function hasFlag(parsed: ParsedArgv, name: string): boolean {
  return parsed.flags.has(name);
}

function commandExists(command: string): boolean {
  try {
    execFileSync("which", [command], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function findChrome(): string {
  const candidates = [
    process.env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium"
  ].filter(Boolean) as string[];
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? "";
}

function findUnity(): string {
  const candidates = [
    process.env.UNITY_PATH,
    "/Applications/Unity/Hub/Editor/6000.4.1f1/Unity.app/Contents/MacOS/Unity"
  ].filter(Boolean) as string[];
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? "";
}

function unitySmokeCommand(projectRoot: string): string[] {
  const unity = findUnity();
  if (!unity) throw new Error("Unity executable not found. Set UNITY_PATH.");
  return [unity, "-batchmode", "-nographics", "-quit", "-projectPath", projectRoot, "-executeMethod", "GameOS.Editor.GameOsUnitySmoke.Run", "-logFile", "-"];
}

function helpText(): string {
  return `
Game OS CLI

Usage:
  gameos doctor [--json]
  gameos create --prompt "..." --platform Web
  gameos make --prompt "..." --target web-playable --assets ./assets.zip --quality fast|standard|strict
  gameos list
  gameos status <project-id>
  gameos journey <project-id>
  gameos review <project-id>
  gameos feedback <project-id> --note "what got stuck or should improve"
  gameos agents run <project-id>
  gameos agents rerun <project-id> <role>
  gameos assets import <project-id> ./assets.zip
  gameos build web <project-id>
  gameos build godot <project-id> --allow-heavy
  gameos build unity <project-id> --allow-heavy
  gameos qa web <project-id> [--static]
  gameos artifact list <project-id>
  gameos artifact read <project-id> <artifact> [--full]

Global options:
  --json          Print structured JSON.
  --data-dir DIR  Store Game OS data in DIR. Defaults to ~/.gameos.
  --full          Print complete artifact content.
  --allow-heavy   Allow long-running Godot/Unity work.
`.trim();
}

if (isEntrypoint()) {
  runCli(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`Game OS error: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}

function isEntrypoint(): boolean {
  if (!process.argv[1]) return false;
  try {
    return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(process.argv[1]);
  } catch {
    return import.meta.url === `file://${process.argv[1]}`;
  }
}
