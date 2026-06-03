import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { VERSION } from "./version";

export const DEFAULT_DATA_DIR = path.join(os.homedir(), ".gameos");

export type DoctorReport = {
  ok: boolean;
  version: string;
  node: string;
  dataRoot: string;
  install: {
    activeBinary: string;
    firstOnPath: string;
    pathMatches: string[];
    npmGlobalFound: boolean;
    homebrewFound: boolean;
    shadowed: boolean;
    warning: string | null;
  };
  commands: {
    chrome: boolean;
    chromePath: string;
    godot: boolean;
    godotPath: string;
    unity: boolean;
    unityPath: string;
  };
  privacy: {
    telemetry: false;
    cloudCalls: false;
    hiddenNetwork: false;
  };
};

export function createDoctorReport(input: { dataRoot?: string; argv1?: string; env?: NodeJS.ProcessEnv } = {}): DoctorReport {
  const env = input.env ?? process.env;
  const activeBinary = resolveExistingPath(input.argv1 ?? process.argv[1] ?? "");
  const pathMatches = findAllCommands("gameos", env).map(resolveExistingPath);
  const install = detectInstallShadow(pathMatches, activeBinary);
  const chromePath = findChrome(env);
  const godotPath = commandPath("godot", env);
  const unityPath = findUnity(env);

  return {
    ok: true,
    version: VERSION,
    node: process.version,
    dataRoot: input.dataRoot ?? env.GAME_OS_DATA_DIR ?? DEFAULT_DATA_DIR,
    install,
    commands: {
      chrome: Boolean(chromePath),
      chromePath,
      godot: Boolean(godotPath),
      godotPath,
      unity: Boolean(unityPath),
      unityPath
    },
    privacy: {
      telemetry: false,
      cloudCalls: false,
      hiddenNetwork: false
    }
  };
}

export function renderDoctorReportText(report: DoctorReport): string {
  const installLines = [
    `Active binary: ${report.install.activeBinary || "unknown"}`,
    `First gameos on PATH: ${report.install.firstOnPath || "not found"}`,
    `PATH gameos matches: ${report.install.pathMatches.length ? report.install.pathMatches.join(", ") : "none"}`,
    `Install shadowing: ${report.install.shadowed ? "possible npm/Homebrew overlap" : "not detected"}`
  ];
  if (report.install.warning) installLines.push(`Install note: ${report.install.warning}`);

  return [
    `Game OS CLI ${report.version}`,
    `Node: ${report.node}`,
    `Data: ${report.dataRoot}`,
    ...installLines,
    `Chrome: ${report.commands.chrome ? report.commands.chromePath : "missing - install Google Chrome or set CHROME_PATH for browser QA"}`,
    `Godot: ${report.commands.godot ? report.commands.godotPath : "missing"}`,
    `Unity: ${report.commands.unity ? report.commands.unityPath : "missing"}`,
    "Telemetry: off",
    "Cloud calls: none",
    "Hidden network behavior: none"
  ].join("\n");
}

export function detectInstallShadow(pathMatches: string[], activeBinary = ""): DoctorReport["install"] {
  const uniqueMatches = [...new Set(pathMatches.filter(Boolean))];
  const npmGlobalFound = uniqueMatches.some(isLikelyNpmGlobal);
  const homebrewFound = uniqueMatches.some(isLikelyHomebrew);
  const shadowed = npmGlobalFound && homebrewFound;
  const firstOnPath = uniqueMatches[0] ?? "";
  const active = activeBinary || firstOnPath;
  const warning = shadowed
    ? `Both npm and Homebrew gameos binaries are on PATH. Your shell will run ${firstOnPath}; uninstall one or adjust PATH if that is not the version you expect.`
    : null;

  return {
    activeBinary: active,
    firstOnPath,
    pathMatches: uniqueMatches,
    npmGlobalFound,
    homebrewFound,
    shadowed,
    warning
  };
}

export function commandExists(command: string, env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(commandPath(command, env));
}

export function findChrome(env: NodeJS.ProcessEnv = process.env): string {
  const candidates = [
    env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser"
  ].filter(Boolean) as string[];
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? "";
}

export function findUnity(env: NodeJS.ProcessEnv = process.env): string {
  const candidates = [
    env.UNITY_PATH,
    "/Applications/Unity/Hub/Editor/6000.4.1f1/Unity.app/Contents/MacOS/Unity"
  ].filter(Boolean) as string[];
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? "";
}

function commandPath(command: string, env: NodeJS.ProcessEnv): string {
  try {
    return execFileSync("which", [command], { encoding: "utf8", env, stdio: ["ignore", "pipe", "ignore"] }).trim().split("\n")[0] ?? "";
  } catch {
    return "";
  }
}

function findAllCommands(command: string, env: NodeJS.ProcessEnv): string[] {
  try {
    return execFileSync("which", ["-a", command], { encoding: "utf8", env, stdio: ["ignore", "pipe", "ignore"] })
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function resolveExistingPath(candidate: string): string {
  if (!candidate) return "";
  try {
    return fs.realpathSync(candidate);
  } catch {
    return candidate;
  }
}

function isLikelyNpmGlobal(candidate: string): boolean {
  return /(?:node_modules|\.nvm|\.npm|\.volta|\.fnm|asdf|\/node\/|\/npm\/)/i.test(candidate);
}

function isLikelyHomebrew(candidate: string): boolean {
  return /(?:\/opt\/homebrew\/|\/usr\/local\/homebrew\/|\/homebrew\/|\/Cellar\/gameos)/i.test(candidate);
}
