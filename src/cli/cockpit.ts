import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { createInterface } from "node:readline/promises";
import { getCockpitState, type CockpitAction, type CockpitActionId } from "./actions";
import { improveProjectWithAutopilot } from "./autopilot";
import { playProject, type PlayServer } from "./play";
import { renderArtifactList, renderJourney, renderWorkspaceSummary } from "./output";
import { createStudioProject, createStudioReview, generateWebAdapter, getStudioDashboard, importProjectAssetsFromStoredFile } from "../lib/studio";
import type { ProjectWorkspace } from "../lib/types";
import { runWebQa } from "./web-qa";
import { starterIdeas } from "./starter-ideas";

type CockpitOptions = {
  browser: boolean;
};

type CockpitSession = {
  selected: number;
  message: string;
  servers: PlayServer[];
};

export function isInteractiveTerminal(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

export async function startCockpit(options: CockpitOptions = { browser: true }): Promise<void> {
  if (!isInteractiveTerminal()) {
    throw new Error("Game OS Cockpit needs an interactive terminal. Run gameos --help or gameos make --prompt \"...\" for command mode.");
  }

  const session: CockpitSession = {
    selected: 0,
    message: "Use arrows, Enter, or hotkeys. Game OS keeps the action list short.",
    servers: []
  };

  try {
    let running = true;
    while (running) {
      const projects = getStudioDashboard();
      const state = getCockpitState(projects);
      session.selected = Math.min(session.selected, Math.max(0, state.actions.length - 1));
      const actionId = await selectAction(state.actions, session);

      try {
        switch (actionId) {
          case "create":
            session.message = await createGameFromCockpit(options);
            break;
          case "starter":
            session.message = await createStarterFromCockpit(options);
            break;
          case "import-assets":
            session.message = await createWithAssetsFromCockpit(options);
            break;
          case "open-recent":
            await showLongText(renderRecentProjects());
            session.message = "Recent projects viewed.";
            break;
          case "doctor":
            session.message = doctorMessage();
            break;
          case "play":
            session.message = await playFromCockpit(state.activeProject, session);
            break;
          case "improve":
            session.message = await improveFromCockpit(state.activeProject, options);
            break;
          case "add-assets":
            session.message = await addAssetsFromCockpit(state.activeProject);
            break;
          case "build-web":
            session.message = buildWebFromCockpit(state.activeProject);
            break;
          case "qa-web":
            session.message = await qaWebFromCockpit(state.activeProject, options);
            break;
          case "view-verdict":
            await showLongText(state.activeProject ? renderJourney(state.activeProject) : "No project yet.");
            session.message = "Verdict viewed.";
            break;
          case "view-artifacts":
            await showLongText(state.activeProject ? renderArtifactList(state.activeProject) : "No project yet.");
            session.message = "Artifacts viewed.";
            break;
          case "quit":
            running = false;
            break;
        }
      } catch (error) {
        session.message = error instanceof Error ? error.message : String(error);
      }
    }
  } finally {
    for (const playServer of session.servers) {
      await new Promise<void>((resolve) => playServer.server.close(() => resolve()));
    }
    process.stdout.write("\x1b[?25h\n");
  }
}

async function selectAction(actions: CockpitAction[], session: CockpitSession): Promise<CockpitActionId> {
  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdout.write("\x1b[?25l");

  return new Promise((resolve) => {
    const render = () => renderHome(actions, session);
    const cleanup = () => {
      process.stdin.off("keypress", onKey);
      process.stdin.setRawMode(false);
      process.stdout.write("\x1b[?25h");
    };
    const resolveAction = (id: CockpitActionId) => {
      cleanup();
      resolve(id);
    };
    const onKey = (_value: string, key: readline.Key) => {
      if (key.name === "up") {
        session.selected = (session.selected - 1 + actions.length) % actions.length;
        render();
        return;
      }
      if (key.name === "down") {
        session.selected = (session.selected + 1) % actions.length;
        render();
        return;
      }
      if (key.name === "return") {
        resolveAction(actions[session.selected]?.id ?? "quit");
        return;
      }
      if (key.ctrl && key.name === "c") {
        resolveAction("quit");
        return;
      }

      const selected = actions.find((action) => action.hotkey === key.name);
      if (selected) resolveAction(selected.id);
      else if (key.name === "n") resolveAction("create");
      else if (key.name === "p") resolveAction("play");
      else if (key.name === "i") resolveAction("improve");
      else if (key.name === "a") resolveAction("add-assets");
      else if (key.name === "v") resolveAction("view-verdict");
      else if (key.name === "q") resolveAction("quit");
    };

    process.stdin.on("keypress", onKey);
    render();
  });
}

function renderHome(actions: CockpitAction[], session: CockpitSession): void {
  const state = getCockpitState(getStudioDashboard());
  const active = state.activeProject;
  const lines = [
    "\x1Bc",
    "Game OS Cockpit",
    "================",
    "",
    active ? `Project: ${active.project.name} (${active.project.id})` : "Project: none yet",
    `Verdict: ${state.verdict}`,
    `Blocker: ${state.blocker}`,
    session.servers.length ? `Playing: ${session.servers.at(-1)?.url}` : "Playing: not running",
    "",
    "Next actions:",
    ...actions.map((action, index) => `${index === session.selected ? ">" : " "} [${action.hotkey}] ${action.label} - ${action.detail}`),
    "",
    session.message,
    "",
    "Keys: ↑/↓ select · Enter run · n new · p play · i improve · a assets · v verdict · q quit"
  ];

  process.stdout.write(lines.join("\n"));
}

async function createGameFromCockpit(options: CockpitOptions): Promise<string> {
  const prompt = await askLine("Describe the game idea: ");
  if (prompt.trim().length < 20) return "Needs your choice: describe the idea in at least 20 characters.";
  const addAssets = await askLine("Do you want to add assets now? (y/N): ");
  const assetPath = /^y(es)?$/i.test(addAssets.trim()) ? await askLine("Asset zip/folder path: ") : "";
  return createFromPromptAndOptionalAssets(prompt, assetPath, options);
}

async function createStarterFromCockpit(options: CockpitOptions): Promise<string> {
  const menu = starterIdeas.map((idea, index) => `${index + 1}. ${idea.title}`).join("\n");
  const choice = await askLine(`Choose a starter idea:\n${menu}\nNumber: `);
  const index = Number.parseInt(choice.trim(), 10) - 1;
  const idea = starterIdeas[index] ?? starterIdeas[0];
  const addAssets = await askLine("Do you want to add assets now? (y/N): ");
  const assetPath = /^y(es)?$/i.test(addAssets.trim()) ? await askLine("Asset zip/folder path: ") : "";
  return createFromPromptAndOptionalAssets(idea.prompt, assetPath, options);
}

async function createWithAssetsFromCockpit(options: CockpitOptions): Promise<string> {
  const prompt = await askLine("Describe the game idea: ");
  if (prompt.trim().length < 20) return "Needs your choice: describe the idea in at least 20 characters.";
  const assetPath = await askLine("Asset zip/folder path: ");
  if (!assetPath.trim()) return "Needs your choice: add an asset zip or folder path.";
  return createFromPromptAndOptionalAssets(prompt, assetPath, options);
}

async function createFromPromptAndOptionalAssets(prompt: string, assetPath: string, options: CockpitOptions): Promise<string> {
  let workspace = createStudioProject({
    prompt,
    targetPlatforms: ["Web"],
    enginePreference: "Web first"
  });

  if (assetPath.trim()) {
    const resolved = path.resolve(assetPath.trim());
    if (!fs.existsSync(resolved)) return `Needs your choice: asset path not found: ${resolved}`;
    workspace = importProjectAssetsFromStoredFile(workspace.project.id, path.basename(resolved), resolved);
  }

  workspace = generateWebAdapter(workspace.project.id);
  const qa = await runWebQa(workspace.project.id, { browser: options.browser });
  const review = createStudioReview(workspace.project.id);
  const status =
    review.scorecard.verdict === "CREATOR_TEST_READY" ? "Creator-test ready" : review.scorecard.verdict === "LOCAL_PROTOTYPE_READY" ? "Local prototype ready" : "Still blocked";
  return `${status}: ${workspace.project.name} · ${qa.report.verdict} · ${review.scorecard.verdict}`;
}

function renderRecentProjects(): string {
  const projects = getStudioDashboard();
  if (projects.length === 0) return "No recent Game OS projects yet.";
  return [
    "Recent Game OS projects",
    "=======================",
    "",
    ...projects.slice(0, 12).map((workspace) => `${workspace.project.id} | ${workspace.project.name} | ${workspace.project.status}`)
  ].join("\n");
}

async function improveFromCockpit(workspace: ProjectWorkspace | null, options: CockpitOptions): Promise<string> {
  if (!workspace) return "Needs your choice: create a game first.";
  const note = await askLine("What should Game OS improve? ");
  if (note.trim().length < 8) return "Needs your choice: add a concrete improvement note.";
  const result = await improveProjectWithAutopilot(workspace.project.id, note, { browser: options.browser });
  return `${result.status}: ${result.qaVerdict} · ${result.reviewVerdict} · Blocker: ${result.blocker}`;
}

async function playFromCockpit(workspace: ProjectWorkspace | null, session: CockpitSession): Promise<string> {
  if (!workspace) return "Needs your choice: create a game first.";
  const playServer = await playProject(workspace.project.id, { open: true });
  session.servers.push(playServer);
  return `Play URL: ${playServer.url}`;
}

async function addAssetsFromCockpit(workspace: ProjectWorkspace | null): Promise<string> {
  if (!workspace) return "Needs your choice: create a game first.";
  const assetPath = await askLine("Asset zip/folder path: ");
  const resolved = path.resolve(assetPath.trim());
  if (!fs.existsSync(resolved)) return `Needs your choice: asset path not found: ${resolved}`;
  const updated = importProjectAssetsFromStoredFile(workspace.project.id, path.basename(resolved), resolved);
  return `Assets imported for ${updated.project.name}.`;
}

function buildWebFromCockpit(workspace: ProjectWorkspace | null): string {
  if (!workspace) return "Needs your choice: create a game first.";
  const updated = generateWebAdapter(workspace.project.id);
  return `Web build generated for ${updated.project.name}.`;
}

async function qaWebFromCockpit(workspace: ProjectWorkspace | null, options: CockpitOptions): Promise<string> {
  if (!workspace) return "Needs your choice: create a game first.";
  const qa = await runWebQa(workspace.project.id, { browser: options.browser });
  return `QA verdict: ${qa.report.verdict}`;
}

async function showLongText(text: string): Promise<void> {
  process.stdout.write(`\x1Bc${text}\n\nPress Enter to return.`);
  await askLine("");
}

async function askLine(prompt: string): Promise<string> {
  process.stdout.write("\x1b[?25h");
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await rl.question(prompt);
  } finally {
    rl.close();
  }
}

function doctorMessage(): string {
  return [
    `Node: ${process.version}`,
    `Data: ${process.env.GAME_OS_DATA_DIR || path.join(os.homedir(), ".gameos")}`,
    "Telemetry: off",
    "Cloud calls: none"
  ].join(" · ");
}
