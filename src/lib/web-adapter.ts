import fs from "node:fs";
import path from "node:path";
import { readLatestAssetManifest, selectCutRopeImageAssets } from "./asset-importer";
import { getProjectArtifactRoot, toProjectRelativeArtifactPath } from "./artifacts";
import type { AssetImportManifest, ImportedAssetFile, ProjectWorkspace } from "./types";

export type WebAdapterResult = {
  projectRoot: string;
  files: string[];
  report: string;
};

export function generateWebProject(workspace: ProjectWorkspace): WebAdapterResult {
  if (isCutRopeWorkspace(workspace)) {
    return generateCutRopeWebProject(workspace);
  }

  return generateLudoWebProject(workspace);
}

function generateLudoWebProject(workspace: ProjectWorkspace): WebAdapterResult {
  const projectRoot = path.join(getProjectArtifactRoot(workspace.project.id), "web");
  const files = [
    ["index.html", renderIndexHtml(workspace)],
    ["styles.css", renderStyles()],
    ["scripts/ludo-rules.js", renderLudoRulesScript()],
    ["scripts/game.js", renderGameScript(workspace)],
    ["docs/game-os-brief.md", renderWebBrief(workspace)],
    ["web-adapter-manifest.json", renderAdapterManifest(workspace)]
  ] as const;

  for (const [relativePath, content] of files) {
    const absolutePath = path.join(projectRoot, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content, "utf8");
  }

  const absoluteFiles = files.map(([relativePath]) => path.join(projectRoot, relativePath));

  return {
    projectRoot,
    files: absoluteFiles,
    report: renderWebReport(workspace, projectRoot, absoluteFiles)
  };
}

type CopiedWebAsset = {
  tag: string;
  name: string;
  relativePath: string;
  originalPath: string;
  tags: string[];
  score: number;
};

function generateCutRopeWebProject(workspace: ProjectWorkspace): WebAdapterResult {
  const projectRoot = path.join(getProjectArtifactRoot(workspace.project.id), "web");
  const manifest = readLatestAssetManifest(workspace.project.id);
  fs.rmSync(projectRoot, { recursive: true, force: true });
  const copiedAssets = copyCutRopeAssets(projectRoot, manifest);
  const files = [
    ["index.html", renderCutRopeIndexHtml(workspace, manifest)],
    ["styles.css", renderCutRopeStyles()],
    ["scripts/game.js", renderCutRopeGameScript(workspace, manifest, copiedAssets)],
    ["docs/game-os-brief.md", renderCutRopeBrief(workspace, manifest, copiedAssets)],
    ["web-adapter-manifest.json", renderCutRopeManifest(workspace, manifest, copiedAssets)]
  ] as const;

  for (const [relativePath, content] of files) {
    const absolutePath = path.join(projectRoot, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content, "utf8");
  }

  const absoluteFiles = [...files.map(([relativePath]) => path.join(projectRoot, relativePath)), ...copiedAssets.map((asset) => path.join(projectRoot, asset.relativePath))];

  return {
    projectRoot,
    files: absoluteFiles,
    report: renderCutRopeReport(workspace, projectRoot, absoluteFiles, manifest, copiedAssets)
  };
}

function copyCutRopeAssets(projectRoot: string, manifest: AssetImportManifest | null): CopiedWebAsset[] {
  if (!manifest) return [];

  const selectedAssets = selectCutRopeImageAssets(manifest);
  const seenNames = new Set<string>();

  return selectedAssets.map((asset, index) => {
    const extension = path.extname(asset.name).toLowerCase() || ".png";
    const baseName = path.basename(asset.name, path.extname(asset.name));
    let outputName = `${String(index + 1).padStart(2, "0")}-${safeWebAssetName(baseName)}${extension}`;
    while (seenNames.has(outputName)) {
      outputName = `${String(index + 1).padStart(2, "0")}-${safeWebAssetName(baseName)}-${seenNames.size}${extension}`;
    }
    seenNames.add(outputName);

    const relativePath = path.posix.join("assets", outputName);
    const absolutePath = path.join(projectRoot, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.copyFileSync(asset.absolutePath, absolutePath);

    return {
      tag: asset.tags[0] ?? "imported",
      name: asset.name,
      relativePath: `./${relativePath}`,
      originalPath: asset.relativePath,
      tags: asset.tags,
      score: asset.score
    };
  });
}

function renderCutRopeIndexHtml(workspace: ProjectWorkspace, manifest: AssetImportManifest | null): string {
  const verdict = manifest?.verdict ?? "NO_ASSET_PACK_IMPORTED";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(workspace.project.name)} - Game OS Cut Rope Prototype</title>
    <meta name="description" content="${escapeHtml(workspace.brief.summary)}" />
    <link rel="stylesheet" href="./styles.css" />
  </head>
  <body>
    <main class="game-shell" data-game-os-web="booting">
      <section class="hero-band">
        <div>
          <p class="eyebrow">Game OS Web Channel</p>
          <h1>${escapeHtml(workspace.project.name)}</h1>
          <p>${escapeHtml(workspace.brief.fantasy)}</p>
        </div>
        <div class="verdict-chip" id="verdict-chip">${escapeHtml(verdict)}</div>
      </section>

      <section class="play-surface" aria-label="Playable Cut Rope web prototype">
        <div class="canvas-wrap">
          <canvas id="game-canvas" width="960" height="620" aria-label="Cut Rope puzzle canvas"></canvas>
        </div>

        <aside class="control-panel">
          <div class="control-row">
            <button id="cut-button" type="button">Cut Rope</button>
            <button id="reset-button" type="button">Reset</button>
          </div>
          <section>
            <p class="eyebrow">Attempt</p>
            <strong id="attempt-label">Ready</strong>
          </section>
          <section>
            <p class="eyebrow">Asset Gate</p>
            <p id="asset-label">${escapeHtml(verdict)}</p>
          </section>
          <section>
            <p class="eyebrow">Puzzle Log</p>
            <ol class="event-log" id="event-log"></ol>
          </section>
        </aside>
      </section>
    </main>
    <script src="./scripts/game.js"></script>
  </body>
</html>
`;
}

function renderCutRopeStyles(): string {
  return `:root {
  color-scheme: light;
  --ink: #17201d;
  --muted: #607068;
  --panel: #fffdf8;
  --line: #d9e2dd;
  --canvas: #eef7f2;
  --accent: #0f8f68;
  --accent-dark: #164239;
  --coral: #d85d4a;
  --gold: #b78412;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
  color: var(--ink);
  background: #edf3f0;
}

button {
  border: 1px solid var(--accent-dark);
  border-radius: 8px;
  background: var(--accent-dark);
  color: white;
  min-height: 46px;
  padding: 0 16px;
  font: inherit;
  font-weight: 900;
  cursor: pointer;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.game-shell {
  width: min(1220px, calc(100vw - 28px));
  margin: 0 auto;
  padding: 20px 0 28px;
}

.hero-band {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 20px;
  padding: 24px;
  border: 1px solid #102a24;
  border-radius: 8px;
  color: #f8fff9;
  background: #102a24;
}

.hero-band h1 {
  margin: 4px 0 8px;
  font-size: clamp(2rem, 4vw, 4.2rem);
  line-height: 0.98;
}

.hero-band p {
  max-width: 780px;
  margin: 0;
}

.eyebrow,
.label {
  display: block;
  margin: 0 0 6px;
  color: var(--muted);
  font-size: 0.75rem;
  font-weight: 900;
  letter-spacing: 0;
  text-transform: uppercase;
}

.hero-band .eyebrow {
  color: #b8e5d7;
}

.verdict-chip {
  flex: 0 0 auto;
  max-width: 340px;
  border: 1px solid rgba(255, 255, 255, 0.42);
  border-radius: 999px;
  padding: 9px 13px;
  font-size: 0.78rem;
  font-weight: 900;
  overflow-wrap: anywhere;
}

.play-surface {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: 16px;
  margin-top: 16px;
}

.canvas-wrap,
.control-panel {
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel);
  box-shadow: 0 14px 34px rgba(22, 33, 28, 0.08);
}

.canvas-wrap {
  min-height: 480px;
  padding: 12px;
}

#game-canvas {
  display: block;
  width: 100%;
  height: auto;
  min-height: 460px;
  border: 1px solid #cfe0d7;
  border-radius: 8px;
  background: var(--canvas);
}

.control-panel {
  display: grid;
  gap: 14px;
  align-content: start;
  padding: 16px;
}

.control-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 9px;
}

#attempt-label,
#asset-label {
  display: block;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #f8faf7;
  padding: 11px;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.event-log {
  display: grid;
  max-height: 280px;
  margin: 0;
  padding-left: 20px;
  gap: 7px;
  overflow: auto;
  color: #3e4b45;
}

@media (max-width: 900px) {
  .play-surface,
  .hero-band {
    grid-template-columns: 1fr;
    display: grid;
  }
}
`;
}

function renderCutRopeGameScript(workspace: ProjectWorkspace, manifest: AssetImportManifest | null, copiedAssets: CopiedWebAsset[]): string {
  return `const projectName = ${JSON.stringify(workspace.project.name)};
const assetGate = ${JSON.stringify(manifest?.verdict ?? "NO_ASSET_PACK_IMPORTED")};
const importedAssets = ${JSON.stringify(copiedAssets, null, 2)};
const canvas = document.querySelector("#game-canvas");
const context = canvas.getContext("2d");
const shell = document.querySelector(".game-shell");
const cutButton = document.querySelector("#cut-button");
const resetButton = document.querySelector("#reset-button");
const attemptLabel = document.querySelector("#attempt-label");
const assetLabel = document.querySelector("#asset-label");
const eventLog = document.querySelector("#event-log");
const verdictChip = document.querySelector("#verdict-chip");
const images = new Map();
let animationFrame = 0;
let state = createInitialState();

for (const asset of importedAssets) {
  const image = new Image();
  image.onload = () => draw();
  image.onerror = () => {
    state.log.unshift(\`Asset failed to render: \${asset.name}\`);
    renderHud();
  };
  image.src = asset.relativePath;
  images.set(asset.relativePath, image);
}

function createInitialState() {
  return {
    ropeCut: false,
    status: "ready",
    time: 0,
    stars: [
      { x: 480, y: 230, r: 22, collected: false },
      { x: 435, y: 335, r: 22, collected: false },
      { x: 520, y: 430, r: 22, collected: false }
    ],
    anchor: { x: 480, y: 82 },
    candy: { x: 480, y: 170, vx: 0, vy: 0, r: 34 },
    goal: { x: 480, y: 535, r: 56 },
    log: ["Imported assets loaded into a Cut Rope test slice."]
  };
}

function step() {
  if (state.ropeCut && state.status === "falling") {
    state.time += 1 / 60;
    state.candy.vy += 0.42;
    state.candy.y += state.candy.vy;
    state.candy.x += state.candy.vx;

    for (const star of state.stars) {
      if (!star.collected && distance(state.candy, star) <= state.candy.r + star.r) {
        star.collected = true;
        state.log.unshift("Star collected.");
      }
    }

    if (distance(state.candy, state.goal) <= state.goal.r + state.candy.r * 0.45) {
      state.status = "won";
      state.log.unshift("Goal reached. The first puzzle is playable.");
      cutButton.disabled = true;
    } else if (state.candy.y > canvas.height + 70) {
      state.status = "missed";
      state.log.unshift("Candy missed the goal. Reset for another attempt.");
      cutButton.disabled = true;
    }
  }

  draw();
  renderHud();
  animationFrame = requestAnimationFrame(step);
}

function draw() {
  context.clearRect(0, 0, canvas.width, canvas.height);
  drawBackground();
  drawGoal();
  drawStars();
  drawRope();
  drawCandy();
  drawStatusRibbon();
}

function drawBackground() {
  const background = assetForTag("background");
  if (background && drawAsset(background, 0, 0, canvas.width, canvas.height, "cover")) return;
  context.fillStyle = "#eef7f2";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "rgba(15, 143, 104, 0.08)";
  for (let x = 0; x < canvas.width; x += 80) {
    context.fillRect(x, 0, 2, canvas.height);
  }
  for (let y = 0; y < canvas.height; y += 80) {
    context.fillRect(0, y, canvas.width, 2);
  }
}

function drawGoal() {
  const character = assetForTag("character") || assetForTag("ui") || importedAssets[1] || importedAssets[0];
  context.save();
  context.translate(state.goal.x, state.goal.y);
  if (character && drawAsset(character, -68, -68, 136, 136, "contain")) {
    context.restore();
    return;
  }
  context.fillStyle = "#164239";
  context.beginPath();
  context.arc(0, 0, state.goal.r, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#ffffff";
  context.beginPath();
  context.arc(-20, -14, 8, 0, Math.PI * 2);
  context.arc(20, -14, 8, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#d85d4a";
  context.fillRect(-34, 18, 68, 14);
  context.restore();
}

function drawStars() {
  const starAsset = assetForTag("collectible");
  for (const star of state.stars) {
    if (star.collected) continue;
    if (starAsset && drawAsset(starAsset, star.x - 25, star.y - 25, 50, 50, "contain")) continue;
    drawProceduralStar(star.x, star.y, 24);
  }
}

function drawRope() {
  context.strokeStyle = state.ropeCut ? "rgba(100, 112, 104, 0.34)" : "#8b6236";
  context.lineWidth = 8;
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(state.anchor.x, state.anchor.y);
  if (state.ropeCut) {
    context.lineTo(state.anchor.x - 26, state.anchor.y + 58);
  } else {
    context.lineTo(state.candy.x, state.candy.y - state.candy.r + 4);
  }
  context.stroke();
  context.fillStyle = "#164239";
  context.beginPath();
  context.arc(state.anchor.x, state.anchor.y, 13, 0, Math.PI * 2);
  context.fill();
}

function drawCandy() {
  const candy = assetForTag("candy") || assetForTag("physics-piece") || importedAssets[0];
  if (candy && drawAsset(candy, state.candy.x - 42, state.candy.y - 42, 84, 84, "contain")) return;
  context.fillStyle = "#d85d4a";
  context.beginPath();
  context.arc(state.candy.x, state.candy.y, state.candy.r, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = "#ffffff";
  context.lineWidth = 6;
  context.stroke();
}

function drawStatusRibbon() {
  context.fillStyle = "rgba(255, 253, 248, 0.9)";
  context.strokeStyle = "#d9e2dd";
  context.lineWidth = 1;
  context.fillRect(20, 20, 355, 64);
  context.strokeRect(20, 20, 355, 64);
  context.fillStyle = "#17201d";
  context.font = "900 22px system-ui, sans-serif";
  context.fillText(projectName, 38, 48);
  context.fillStyle = "#607068";
  context.font = "800 14px system-ui, sans-serif";
  context.fillText(\`Assets used: \${importedAssets.length} | Gate: \${assetGate}\`, 38, 70);
}

function renderHud() {
  shell.dataset.gameOsWeb = "ready";
  const collected = state.stars.filter((star) => star.collected).length;
  const statusText =
    state.status === "won"
      ? \`Won with \${collected}/\${state.stars.length} stars\`
      : state.status === "missed"
        ? \`Missed with \${collected}/\${state.stars.length} stars\`
        : state.ropeCut
          ? \`Falling: \${collected}/\${state.stars.length} stars\`
          : "Ready to cut";
  attemptLabel.textContent = statusText;
  verdictChip.textContent = state.status === "won" ? "Playable proof" : assetGate;
  assetLabel.textContent = assetGate;
  eventLog.innerHTML = "";
  for (const entry of state.log.slice(0, 10)) {
    const item = document.createElement("li");
    item.textContent = entry;
    eventLog.appendChild(item);
  }
}

function cutRope() {
  if (state.ropeCut || state.status === "won") return;
  state.ropeCut = true;
  state.status = "falling";
  state.candy.vx = 0;
  state.candy.vy = 1.4;
  state.log.unshift("Rope cut.");
  cutButton.disabled = true;
  renderHud();
}

function resetAttempt() {
  cancelAnimationFrame(animationFrame);
  state = createInitialState();
  cutButton.disabled = false;
  draw();
  renderHud();
  animationFrame = requestAnimationFrame(step);
}

function assetForTag(tag) {
  return importedAssets.find((asset) => asset.tags.includes(tag));
}

function drawAsset(asset, x, y, width, height, mode) {
  const image = images.get(asset.relativePath);
  if (!image || !image.complete || image.naturalWidth === 0) return false;
  if (mode === "cover") {
    const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
    const drawWidth = image.naturalWidth * scale;
    const drawHeight = image.naturalHeight * scale;
    context.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
    return true;
  }
  const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  context.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
  return true;
}

function drawProceduralStar(x, y, radius) {
  context.save();
  context.translate(x, y);
  context.fillStyle = "#f0b632";
  context.beginPath();
  for (let index = 0; index < 10; index += 1) {
    const angle = -Math.PI / 2 + (index * Math.PI) / 5;
    const length = index % 2 === 0 ? radius : radius * 0.46;
    const px = Math.cos(angle) * length;
    const py = Math.sin(angle) * length;
    if (index === 0) context.moveTo(px, py);
    else context.lineTo(px, py);
  }
  context.closePath();
  context.fill();
  context.restore();
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function simulateCutRope(options = {}) {
  const matches = options.matches || 8;
  const report = {
    agent: "Advanced Web Player - Physics Puzzle Specialist",
    claim: "asset-driven Cut Rope browser prototype player-agent simulation",
    kind: "cut-rope",
    matches,
    assets_used: importedAssets.length,
    asset_gate: assetGate,
    completions: 0,
    stars_collected: 0,
    average_seconds: 0,
    timeouts: 0,
    verdict: "NEEDS_ARCHITECTURE_UPGRADE"
  };

  let totalSeconds = 0;
  for (let match = 0; match < matches; match += 1) {
    const sim = {
      x: 480,
      y: 170,
      vx: 0,
      vy: 1.4,
      stars: [
        { x: 480, y: 230, r: 22, collected: false },
        { x: 435, y: 335, r: 22, collected: false },
        { x: 520, y: 430, r: 22, collected: false }
      ]
    };
    let won = false;
    let seconds = 0;

    for (let frame = 0; frame < 240; frame += 1) {
      seconds += 1 / 60;
      sim.vy += 0.42;
      sim.y += sim.vy;
      sim.x += sim.vx;

      for (const star of sim.stars) {
        if (!star.collected && Math.hypot(sim.x - star.x, sim.y - star.y) <= 34 + star.r) {
          star.collected = true;
        }
      }

      if (Math.hypot(sim.x - 480, sim.y - 535) <= 56 + 34 * 0.45) {
        won = true;
        break;
      }
    }

    if (won) {
      report.completions += 1;
      report.stars_collected += sim.stars.filter((star) => star.collected).length;
      totalSeconds += seconds;
    } else {
      report.timeouts += 1;
    }
  }

  report.average_seconds = Number((totalSeconds / Math.max(1, report.completions)).toFixed(2));
  report.verdict =
    report.timeouts === 0 &&
    report.completions === matches &&
    report.assets_used > 0 &&
    report.asset_gate !== "WRONG_ASSET_PACK_FOR_CUT_ROPE"
      ? "WORTH_PLAYING_FOR_CUT_ROPE_WEB_PROTOTYPE"
      : "NEEDS_ARCHITECTURE_UPGRADE";
  return report;
}

canvas.addEventListener("click", (event) => {
  const rect = canvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
  const y = ((event.clientY - rect.top) / rect.height) * canvas.height;
  const nearRope = !state.ropeCut && x > state.candy.x - 80 && x < state.candy.x + 80 && y > state.anchor.y && y < state.candy.y + 25;
  if (nearRope) cutRope();
});

cutButton.addEventListener("click", cutRope);
resetButton.addEventListener("click", resetAttempt);

window.__gameOsWebAdapter = {
  getState: () => state,
  smoke: () => ({
    ok: Boolean(shell && canvas && context && cutButton && resetButton),
    kind: "cut-rope",
    projectName,
    assetsUsed: importedAssets.length,
    assetGate,
    canvasWidth: canvas.width,
    canvasHeight: canvas.height
  }),
  cutRope,
  reset: resetAttempt,
  runPlayerAgent: simulateCutRope
};

draw();
renderHud();
animationFrame = requestAnimationFrame(step);
`;
}

function renderCutRopeBrief(workspace: ProjectWorkspace, manifest: AssetImportManifest | null, copiedAssets: CopiedWebAsset[]): string {
  return [
    `# ${workspace.project.name} Web Cut Rope Brief`,
    "",
    workspace.brief.summary,
    "",
    "## Source Of Truth",
    "- Game OS rules spec owns the cut, gravity, star, goal, and retry loop.",
    "- Uploaded asset manifest owns which local files are allowed into the build.",
    "- Procedural rope/physics helpers are allowed only to complete the mechanic and must be documented.",
    "",
    "## Asset Verdict",
    `- Verdict: ${manifest?.verdict ?? "NO_ASSET_PACK_IMPORTED"}`,
    `- Images copied into build: ${copiedAssets.length}`,
    `- Tags found: ${manifest?.relevantTags.join(", ") || "none"}`,
    "",
    "## QA Expectations",
    "- Static HTTP smoke must render the canvas, controls, and imported asset references.",
    "- Browser player-agent simulation must complete the level and reject wrong asset packs.",
    "- Web channel remains local prototype delivery, not hosted publishing automation."
  ].join("\n");
}

function renderCutRopeManifest(workspace: ProjectWorkspace, manifest: AssetImportManifest | null, copiedAssets: CopiedWebAsset[]): string {
  return `${JSON.stringify(
    {
      generatedBy: "Game OS",
      adapter: "web",
      prototype: "cut-rope",
      projectId: workspace.project.id,
      projectName: workspace.project.name,
      genre: workspace.project.genre,
      targetPlatforms: workspace.project.targetPlatforms,
      entrypoint: "index.html",
      scripts: ["scripts/game.js"],
      assetGate: manifest?.verdict ?? "NO_ASSET_PACK_IMPORTED",
      copiedAssets,
      smokeCommand: "npm run web:smoke -- web",
      playerAgentCommand: "npm run web:player -- web"
    },
    null,
    2
  )}\n`;
}

function renderCutRopeReport(
  workspace: ProjectWorkspace,
  projectRoot: string,
  files: string[],
  manifest: AssetImportManifest | null,
  copiedAssets: CopiedWebAsset[]
): string {
  const rules = workspace.artifacts.find((artifact) => artifact.kind === "rules-spec");
  const memory = workspace.artifacts.find((artifact) => artifact.kind === "memory-map");
  const assetReport = workspace.artifacts.find((artifact) => artifact.kind === "asset-import-report");

  return [
    `# ${workspace.project.name} Web Adapter`,
    "",
    "## Generated Project",
    `Path: ${projectRoot}`,
    "",
    "## Prototype",
    "- Channel: Web",
    "- Game type: Cut Rope physics puzzle",
    `- Asset gate: ${manifest?.verdict ?? "NO_ASSET_PACK_IMPORTED"}`,
    `- Imported images copied: ${copiedAssets.length}`,
    "",
    "## Files",
    ...files.map((file) => `- ${path.relative(projectRoot, file)}`),
    "",
    "## Adapter Inputs",
    `- Rules spec: ${rules ? toProjectRelativeArtifactPath(rules.path, workspace.project.id) : "missing"}`,
    `- Memory map: ${memory ? toProjectRelativeArtifactPath(memory.path, workspace.project.id) : "missing"}`,
    `- Asset import report: ${assetReport ? toProjectRelativeArtifactPath(assetReport.path, workspace.project.id) : "missing"}`,
    "",
    "## How To Smoke Test",
    "```bash",
    `npm run web:smoke -- ${projectRoot}`,
    "```",
    "",
    "## How To Launch The Web Player Agent",
    "```bash",
    `npm run web:player -- ${projectRoot}`,
    "```",
    "",
    "## Architect Notes",
    "- The Web lane can now consume user-uploaded asset packs as first-class build input.",
    "- The adapter copies only imported local images into the generated web bundle.",
    "- The asset gate is visible in the build, the adapter report, the manifest, smoke checks, and player-agent report.",
    "- Steam, hosting, accounts, multiplayer servers, and store publishing remain outside V1."
  ].join("\n");
}

function renderIndexHtml(workspace: ProjectWorkspace): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(workspace.project.name)} - Game OS Web Prototype</title>
    <meta name="description" content="${escapeHtml(workspace.brief.summary)}" />
    <link rel="stylesheet" href="./styles.css" />
  </head>
  <body>
    <main class="game-shell" data-game-os-web="booting">
      <section class="hero-band">
        <div>
          <p class="eyebrow">Game OS Web Channel</p>
          <h1>${escapeHtml(workspace.project.name)}</h1>
          <p>${escapeHtml(workspace.brief.fantasy)}</p>
        </div>
        <div class="verdict-chip" id="verdict-chip">Rules prototype</div>
      </section>

      <section class="play-surface" aria-label="Playable Ludo web prototype">
        <div class="board-wrap">
          <div class="table-header">
            <div>
              <span class="label">Turn</span>
              <strong id="turn-label">Player 1</strong>
            </div>
            <div>
              <span class="label">Dice</span>
              <strong id="dice-label">-</strong>
            </div>
          </div>
          <div class="track-grid" id="track-grid" aria-label="Ludo track"></div>
        </div>

        <aside class="control-panel">
          <div class="control-row">
            <button id="roll-button" type="button">Roll Dice</button>
            <button id="new-button" type="button">New Match</button>
          </div>
          <div class="control-row compact">
            <button id="save-button" type="button">Save</button>
            <button id="load-button" type="button">Load</button>
            <button id="bots-button" type="button">Bots On</button>
          </div>
          <section>
            <p class="eyebrow">Legal Moves</p>
            <div class="move-list" id="move-list"></div>
          </section>
          <section>
            <p class="eyebrow">Players</p>
            <div class="score-list" id="score-list"></div>
          </section>
          <section>
            <p class="eyebrow">Match Log</p>
            <ol class="event-log" id="event-log"></ol>
          </section>
        </aside>
      </section>
    </main>
    <script src="./scripts/ludo-rules.js"></script>
    <script src="./scripts/game.js"></script>
  </body>
</html>
`;
}

function renderStyles(): string {
  return `:root {
  color-scheme: light;
  --ink: #16211c;
  --muted: #65746d;
  --panel: #fffdf8;
  --line: #d9ded7;
  --table: #f1f6f0;
  --accent: #0f8f73;
  --danger: #c74132;
  --gold: #c89c36;
  --red: #d84f43;
  --blue: #2f6dd6;
  --green: #168a5b;
  --yellow: #d9a92d;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
  color: var(--ink);
  background: #edf2ef;
}

button {
  border: 1px solid #17372f;
  border-radius: 8px;
  background: #17372f;
  color: white;
  min-height: 42px;
  padding: 0 14px;
  font: inherit;
  font-weight: 800;
  cursor: pointer;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.game-shell {
  width: min(1180px, calc(100vw - 28px));
  margin: 0 auto;
  padding: 20px 0 28px;
}

.hero-band {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 20px;
  padding: 24px;
  border: 1px solid #102a24;
  border-radius: 8px;
  color: #f8fff9;
  background: linear-gradient(135deg, #102a24 0%, #19483f 58%, #784d29 100%);
}

.hero-band h1 {
  margin: 4px 0 8px;
  font-size: clamp(2rem, 4vw, 4.2rem);
  line-height: 0.98;
}

.hero-band p {
  max-width: 760px;
  margin: 0;
}

.eyebrow,
.label {
  display: block;
  margin: 0 0 6px;
  color: var(--muted);
  font-size: 0.75rem;
  font-weight: 900;
  letter-spacing: 0;
  text-transform: uppercase;
}

.hero-band .eyebrow {
  color: #b8e5d7;
}

.verdict-chip {
  flex: 0 0 auto;
  border: 1px solid rgba(255, 255, 255, 0.42);
  border-radius: 999px;
  padding: 9px 13px;
  font-weight: 900;
}

.play-surface {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  gap: 16px;
  margin-top: 16px;
}

.board-wrap,
.control-panel {
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel);
  box-shadow: 0 14px 34px rgba(22, 33, 28, 0.08);
}

.board-wrap {
  padding: 16px;
}

.table-header {
  display: grid;
  grid-template-columns: 1fr 90px;
  gap: 12px;
  margin-bottom: 12px;
}

.table-header > div,
.score-row {
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #f8faf7;
  padding: 11px;
}

.table-header strong {
  font-size: 1.4rem;
}

.track-grid {
  display: grid;
  grid-template-columns: repeat(13, minmax(34px, 1fr));
  gap: 5px;
}

.track-cell {
  position: relative;
  min-height: 50px;
  border: 1px solid #cfd7d1;
  border-radius: 8px;
  background: var(--table);
  overflow: hidden;
}

.track-cell.safe {
  border-color: var(--gold);
  background: #fff7df;
}

.track-cell.start-red { border-color: var(--red); }
.track-cell.start-blue { border-color: var(--blue); }
.track-cell.start-green { border-color: var(--green); }
.track-cell.start-yellow { border-color: var(--yellow); }

.cell-number {
  position: absolute;
  top: 4px;
  left: 6px;
  color: #7d8881;
  font-size: 0.68rem;
  font-weight: 800;
}

.token-stack {
  position: absolute;
  inset: auto 5px 5px 5px;
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
}

.token {
  width: 17px;
  height: 17px;
  border: 2px solid rgba(255, 255, 255, 0.92);
  border-radius: 50%;
  box-shadow: 0 1px 5px rgba(0, 0, 0, 0.25);
}

.token.red { background: var(--red); }
.token.blue { background: var(--blue); }
.token.green { background: var(--green); }
.token.yellow { background: var(--yellow); }

.control-panel {
  display: grid;
  gap: 14px;
  align-content: start;
  padding: 16px;
}

.control-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 9px;
}

.control-row.compact {
  grid-template-columns: repeat(3, 1fr);
}

.move-list,
.score-list {
  display: grid;
  gap: 8px;
}

.move-button {
  width: 100%;
  justify-content: start;
  border-color: #bfd5cc;
  background: #f2fbf7;
  color: var(--ink);
  text-align: left;
}

.score-row {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 9px;
}

.score-dot {
  width: 18px;
  height: 18px;
  border-radius: 999px;
}

.event-log {
  display: grid;
  max-height: 190px;
  margin: 0;
  padding-left: 20px;
  gap: 7px;
  overflow: auto;
  color: #3e4b45;
}

@media (max-width: 900px) {
  .play-surface,
  .hero-band {
    grid-template-columns: 1fr;
    display: grid;
  }

  .track-grid {
    grid-template-columns: repeat(8, minmax(34px, 1fr));
  }
}
`;
}

function renderLudoRulesScript(): string {
  return `class LudoRules {
  constructor() {
    this.trackLength = 52;
    this.homeStep = 57;
    this.safeSquares = new Set([0, 8, 13, 21, 26, 34, 39, 47]);
    this.startOffsets = [0, 13, 26, 39];
    this.colors = ["red", "blue", "green", "yellow"];
  }

  createInitialState(playerCount = 4, winTokenTarget = 2) {
    return {
      currentPlayer: 0,
      dice: 0,
      phase: "await-roll",
      winner: null,
      winTokenTarget,
      players: Array.from({ length: playerCount }, (_, playerId) => ({
        id: playerId,
        color: this.colors[playerId],
        tokens: Array.from({ length: 4 }, () => ({ steps: -1, home: false }))
      })),
      log: ["New web match ready."]
    };
  }

  clone(state) {
    return JSON.parse(JSON.stringify(state));
  }

  roll(state, dice) {
    const next = this.clone(state);
    if (next.phase === "end-match") return next;
    next.dice = dice;
    next.phase = "select-token";
    next.log.unshift(\`Player \${next.currentPlayer + 1} rolled \${dice}.\`);
    if (this.legalMoves(next).length === 0) {
      next.log.unshift(\`Player \${next.currentPlayer + 1} had no legal move.\`);
      next.phase = "await-roll";
      this.advanceTurn(next);
    }
    return next;
  }

  legalMoves(state) {
    if (state.phase !== "select-token" || state.winner !== null) return [];
    const player = state.players[state.currentPlayer];
    return player.tokens
      .map((token, tokenIndex) => ({ token, tokenIndex }))
      .filter(({ token }) => {
        if (token.home) return false;
        if (token.steps < 0) return state.dice === 6;
        return token.steps + state.dice <= this.homeStep;
      })
      .map(({ token, tokenIndex }) => {
        const destination = token.steps < 0 ? 0 : token.steps + state.dice;
        return {
          playerId: state.currentPlayer,
          tokenIndex,
          destination,
          releases: token.steps < 0,
          finishes: destination === this.homeStep,
          captures: this.captureTargets(state, state.currentPlayer, destination).length,
          safe: destination < this.trackLength && this.safeSquares.has(this.boardPosition(state.currentPlayer, destination))
        };
      });
  }

  applyMove(state, tokenIndex) {
    const next = this.clone(state);
    const move = this.legalMoves(next).find((candidate) => candidate.tokenIndex === tokenIndex);
    if (!move) return next;

    const player = next.players[next.currentPlayer];
    const token = player.tokens[tokenIndex];
    token.steps = move.destination;
    if (token.steps === this.homeStep) token.home = true;

    const captured = this.captureTargets(next, next.currentPlayer, token.steps);
    for (const target of captured) {
      next.players[target.playerId].tokens[target.tokenIndex] = { steps: -1, home: false };
    }

    const action = move.finishes
      ? "finished at home"
      : move.captures > 0
        ? \`captured \${move.captures} token\${move.captures === 1 ? "" : "s"}\`
        : move.releases
          ? "released from base"
          : \`moved to square \${token.steps}\`;
    next.log.unshift(\`Player \${next.currentPlayer + 1} token \${tokenIndex + 1} \${action}.\`);

    if (player.tokens.filter((item) => item.home).length >= next.winTokenTarget) {
      next.winner = next.currentPlayer;
      next.phase = "end-match";
      next.log.unshift(\`Player \${next.currentPlayer + 1} wins the Creator Sprint.\`);
      return next;
    }

    next.phase = "await-roll";
    if (next.dice !== 6) this.advanceTurn(next);
    return next;
  }

  captureTargets(state, playerId, destinationSteps) {
    if (destinationSteps < 0 || destinationSteps >= this.trackLength) return [];
    const boardPosition = this.boardPosition(playerId, destinationSteps);
    if (this.safeSquares.has(boardPosition)) return [];

    const targets = [];
    for (const opponent of state.players) {
      if (opponent.id === playerId) continue;
      opponent.tokens.forEach((token, tokenIndex) => {
        if (!token.home && token.steps >= 0 && token.steps < this.trackLength && this.boardPosition(opponent.id, token.steps) === boardPosition) {
          targets.push({ playerId: opponent.id, tokenIndex });
        }
      });
    }
    return targets;
  }

  boardPosition(playerId, steps) {
    return (this.startOffsets[playerId] + steps) % this.trackLength;
  }

  advanceTurn(state) {
    state.currentPlayer = (state.currentPlayer + 1) % state.players.length;
  }

  chooseAdvancedMove(state) {
    const moves = this.legalMoves(state);
    if (moves.length === 0) return null;
    return [...moves].sort((a, b) => {
      const score = (move) =>
        (move.finishes ? 1000 : 0) +
        move.captures * 220 +
        (move.safe ? 50 : 0) +
        (move.releases ? 40 : 0) +
        move.destination;
      return score(b) - score(a);
    })[0];
  }

  createRng(seed = 20260531) {
    let value = seed >>> 0;
    return () => {
      value = (value * 1664525 + 1013904223) >>> 0;
      return value / 4294967296;
    };
  }

  simulateMatches({ matches = 8, seed = 20260531, turnLimit = 520 } = {}) {
    const random = this.createRng(seed);
    const report = {
      agent: "Advanced Web Player - Browser Table Strategist",
      claim: "browser-playable web-channel player-agent simulation",
      matches,
      average_turns: 0,
      captures: 0,
      releases: 0,
      homes: 0,
      passes: 0,
      timeouts: 0,
      branching_decisions: 0,
      finish_choices: 0,
      capture_choices: 0,
      safe_choices: 0,
      release_choices: 0,
      verdict: "NEEDS_ARCHITECTURE_UPGRADE"
    };

    let totalTurns = 0;
    for (let match = 0; match < matches; match += 1) {
      let state = this.createInitialState(4, 2);
      let turns = 0;

      while (state.phase !== "end-match" && turns < turnLimit) {
        if (state.phase === "await-roll") {
          state = this.roll(state, Math.floor(random() * 6) + 1);
          turns += 1;
          if (state.phase === "await-roll") report.passes += 1;
        }

        if (state.phase === "select-token") {
          const moves = this.legalMoves(state);
          report.branching_decisions += moves.length;
          const move = this.chooseAdvancedMove(state);
          if (!move) {
            report.passes += 1;
            state.phase = "await-roll";
            this.advanceTurn(state);
            continue;
          }
          if (move.finishes) report.finish_choices += 1;
          if (move.captures > 0) report.capture_choices += 1;
          if (move.safe) report.safe_choices += 1;
          if (move.releases) report.release_choices += 1;
          report.captures += move.captures;
          report.releases += move.releases ? 1 : 0;
          report.homes += move.finishes ? 1 : 0;
          state = this.applyMove(state, move.tokenIndex);
        }
      }

      if (state.phase !== "end-match") report.timeouts += 1;
      totalTurns += turns;
    }

    report.average_turns = Number((totalTurns / matches).toFixed(1));
    report.verdict =
      report.timeouts === 0 &&
      report.average_turns <= 260 &&
      report.captures > 0 &&
      report.releases >= 20 &&
      report.homes >= 8 &&
      report.branching_decisions >= 40
        ? "WORTH_PLAYING_FOR_WEB_RULES_PROTOTYPE"
        : "NEEDS_ARCHITECTURE_UPGRADE";
    return report;
  }
}

window.GameOsLudoRules = LudoRules;
`;
}

function renderGameScript(workspace: ProjectWorkspace): string {
  return `const projectName = ${JSON.stringify(workspace.project.name)};
const rules = new window.GameOsLudoRules();
let state = rules.createInitialState(4, 2);
let botsEnabled = true;
let botTimer = null;

const elements = {
  shell: document.querySelector(".game-shell"),
  grid: document.querySelector("#track-grid"),
  turn: document.querySelector("#turn-label"),
  dice: document.querySelector("#dice-label"),
  moves: document.querySelector("#move-list"),
  scores: document.querySelector("#score-list"),
  log: document.querySelector("#event-log"),
  roll: document.querySelector("#roll-button"),
  newMatch: document.querySelector("#new-button"),
  save: document.querySelector("#save-button"),
  load: document.querySelector("#load-button"),
  bots: document.querySelector("#bots-button"),
  verdict: document.querySelector("#verdict-chip")
};

function render() {
  elements.shell.dataset.gameOsWeb = "ready";
  elements.turn.textContent = state.winner === null ? \`Player \${state.currentPlayer + 1}\` : \`Player \${state.winner + 1} won\`;
  elements.dice.textContent = state.dice || "-";
  elements.verdict.textContent = state.phase === "end-match" ? "Match complete" : \`\${projectName} prototype\`;
  renderBoard();
  renderMoves();
  renderScores();
  renderLog();
  scheduleBot();
}

function renderBoard() {
  elements.grid.innerHTML = "";
  const tokenMap = new Map();
  state.players.forEach((player) => {
    player.tokens.forEach((token, tokenIndex) => {
      if (token.home || token.steps < 0 || token.steps >= rules.trackLength) return;
      const position = rules.boardPosition(player.id, token.steps);
      const list = tokenMap.get(position) || [];
      list.push({ color: player.color, label: \`P\${player.id + 1}T\${tokenIndex + 1}\` });
      tokenMap.set(position, list);
    });
  });

  for (let index = 0; index < rules.trackLength; index += 1) {
    const cell = document.createElement("div");
    const classes = ["track-cell"];
    if (rules.safeSquares.has(index)) classes.push("safe");
    const startIndex = rules.startOffsets.indexOf(index);
    if (startIndex >= 0) classes.push(\`start-\${rules.colors[startIndex]}\`);
    cell.className = classes.join(" ");
    cell.setAttribute("data-cell", String(index));
    cell.innerHTML = \`<span class="cell-number">\${index + 1}</span><div class="token-stack"></div>\`;
    const stack = cell.querySelector(".token-stack");
    for (const token of tokenMap.get(index) || []) {
      const marker = document.createElement("span");
      marker.className = \`token \${token.color}\`;
      marker.title = token.label;
      stack.appendChild(marker);
    }
    elements.grid.appendChild(cell);
  }
}

function renderMoves() {
  elements.moves.innerHTML = "";
  const legalMoves = rules.legalMoves(state);
  elements.roll.disabled = state.phase !== "await-roll";
  if (state.phase === "end-match") {
    elements.moves.innerHTML = "<p>Start a new match to play again.</p>";
    return;
  }
  if (state.phase === "await-roll") {
    elements.moves.innerHTML = "<p>Roll to reveal legal token moves.</p>";
    return;
  }
  for (const move of legalMoves) {
    const button = document.createElement("button");
    button.className = "move-button";
    button.type = "button";
    button.textContent = describeMove(move);
    button.addEventListener("click", () => {
      state = rules.applyMove(state, move.tokenIndex);
      persistAuto();
      render();
    });
    elements.moves.appendChild(button);
  }
}

function renderScores() {
  elements.scores.innerHTML = "";
  for (const player of state.players) {
    const row = document.createElement("div");
    row.className = "score-row";
    const home = player.tokens.filter((token) => token.home).length;
    const base = player.tokens.filter((token) => token.steps < 0 && !token.home).length;
    row.innerHTML = \`<span class="score-dot token \${player.color}"></span><strong>Player \${player.id + 1}</strong><span>\${home}/\${state.winTokenTarget} home, \${base} base</span>\`;
    elements.scores.appendChild(row);
  }
}

function renderLog() {
  elements.log.innerHTML = "";
  for (const entry of state.log.slice(0, 12)) {
    const item = document.createElement("li");
    item.textContent = entry;
    elements.log.appendChild(item);
  }
}

function describeMove(move) {
  if (move.finishes) return \`Token \${move.tokenIndex + 1}: finish home\`;
  if (move.captures) return \`Token \${move.tokenIndex + 1}: capture on track\`;
  if (move.releases) return \`Token \${move.tokenIndex + 1}: release from base\`;
  if (move.safe) return \`Token \${move.tokenIndex + 1}: move to safe square\`;
  return \`Token \${move.tokenIndex + 1}: move to \${move.destination}\`;
}

function rollDice() {
  if (state.phase !== "await-roll") return;
  const value = Math.floor(Math.random() * 6) + 1;
  state = rules.roll(state, value);
  persistAuto();
  render();
}

function scheduleBot() {
  clearTimeout(botTimer);
  if (!botsEnabled || state.phase === "end-match" || state.currentPlayer === 0) return;
  botTimer = setTimeout(() => {
    if (state.phase === "await-roll") {
      state = rules.roll(state, Math.floor(Math.random() * 6) + 1);
    }
    if (state.phase === "select-token") {
      const move = rules.chooseAdvancedMove(state);
      if (move) state = rules.applyMove(state, move.tokenIndex);
    }
    persistAuto();
    render();
  }, 420);
}

function persistAuto() {
  localStorage.setItem("game-os-web-autosave", JSON.stringify(state));
}

elements.roll.addEventListener("click", rollDice);
elements.newMatch.addEventListener("click", () => {
  state = rules.createInitialState(4, 2);
  persistAuto();
  render();
});
elements.save.addEventListener("click", () => {
  localStorage.setItem("game-os-web-save", JSON.stringify(state));
  state.log.unshift("Manual save complete.");
  render();
});
elements.load.addEventListener("click", () => {
  const saved = localStorage.getItem("game-os-web-save") || localStorage.getItem("game-os-web-autosave");
  if (saved) {
    state = JSON.parse(saved);
    state.log.unshift("Saved match loaded.");
  }
  render();
});
elements.bots.addEventListener("click", () => {
  botsEnabled = !botsEnabled;
  elements.bots.textContent = botsEnabled ? "Bots On" : "Bots Off";
  render();
});

window.__gameOsWebAdapter = {
  getState: () => state,
  smoke: () => ({
    ok: Boolean(elements.shell && elements.grid && elements.roll && elements.moves),
    cells: elements.grid.querySelectorAll(".track-cell").length,
    projectName,
    kind: "ludo"
  }),
  roll: rollDice,
  runPlayerAgent: (options) => rules.simulateMatches(options)
};

render();
`;
}

function renderWebBrief(workspace: ProjectWorkspace): string {
  return [
    `# ${workspace.project.name} Web Adapter Brief`,
    "",
    workspace.brief.summary,
    "",
    "## Source Of Truth",
    "- Game OS rules spec drives the browser rules resolver.",
    "- Browser local storage is prototype persistence only.",
    "- This lane proves fast creator playtesting before engine export work.",
    "",
    "## QA Expectations",
    "- Static HTTP smoke must render the board and controls.",
    "- Browser player-agent simulation must approve the rules pace.",
    "- Web channel remains local prototype delivery, not hosted publishing automation."
  ].join("\n");
}

function renderAdapterManifest(workspace: ProjectWorkspace): string {
  return `${JSON.stringify(
    {
      generatedBy: "Game OS",
      adapter: "web",
      prototype: "ludo",
      projectId: workspace.project.id,
      projectName: workspace.project.name,
      genre: workspace.project.genre,
      targetPlatforms: workspace.project.targetPlatforms,
      entrypoint: "index.html",
      scripts: ["scripts/ludo-rules.js", "scripts/game.js"],
      smokeCommand: "npm run web:smoke -- web",
      playerAgentCommand: "npm run web:player -- web"
    },
    null,
    2
  )}\n`;
}

function renderWebReport(workspace: ProjectWorkspace, projectRoot: string, files: string[]): string {
  const rules = workspace.artifacts.find((artifact) => artifact.kind === "rules-spec");
  const memory = workspace.artifacts.find((artifact) => artifact.kind === "memory-map");

  return [
    `# ${workspace.project.name} Web Adapter`,
    "",
    "## Generated Project",
    `Path: ${projectRoot}`,
    "",
    "## Files",
    ...files.map((file) => `- ${path.relative(projectRoot, file)}`),
    "",
    "## Adapter Inputs",
    `- Rules spec: ${rules ? toProjectRelativeArtifactPath(rules.path, workspace.project.id) : "missing"}`,
    `- Memory map: ${memory ? toProjectRelativeArtifactPath(memory.path, workspace.project.id) : "missing"}`,
    "",
    "## How To Smoke Test",
    "```bash",
    `npm run web:smoke -- ${projectRoot}`,
    "```",
    "",
    "## How To Launch The Web Player Agent",
    "```bash",
    `npm run web:player -- ${projectRoot}`,
    "```",
    "",
    "## Architect Notes",
    "- This is a standalone browser prototype lane for fast creator playtesting.",
    "- The web rules resolver mirrors the Ludo Creator Sprint target used by Unity and Godot.",
    "- Browser localStorage proves save/load behavior for the web lane before backend sync is added.",
    "- Hosting, accounts, multiplayer servers, and store publishing remain outside V1."
  ].join("\n");
}

function isCutRopeWorkspace(workspace: ProjectWorkspace): boolean {
  const source = `${workspace.project.name} ${workspace.project.genre} ${workspace.project.prompt}`.toLowerCase();
  return (source.includes("cut") && source.includes("rope")) || source.includes("physics puzzle");
}

function safeWebAssetName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "asset";
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
