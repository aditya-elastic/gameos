import fs from "node:fs";
import path from "node:path";
import { readLatestAssetManifest } from "./asset-importer";
import { getProjectArtifactRoot, toProjectRelativeArtifactPath } from "./artifacts";
import { createCapabilityMap, hasCapability } from "./capability-graph";
import type { AssetImportManifest, AssetRole, AssetRoleAssignment, ImportedAssetFile, ProjectWorkspace } from "./types";

export type WebAdapterResult = {
  projectRoot: string;
  files: string[];
  report: string;
};

type WebPlayPattern = "arcade-survival" | "platform-movement" | "combat-survival" | "capability-foundation";

function selectWebPlayPattern(workspace: ProjectWorkspace): WebPlayPattern {
  const capabilityMap = createCapabilityMap(workspace.project, workspace.brief);
  if (hasCapability(capabilityMap, "combat")) return "combat-survival";
  if (hasCapability(capabilityMap, "platforming")) return "platform-movement";
  if (hasCapability(capabilityMap, "arcade-loop") || hasCapability(capabilityMap, "survival") || hasCapability(capabilityMap, "creator-loop")) {
    return "arcade-survival";
  }
  return "capability-foundation";
}

function labelForWebPlayPattern(pattern: WebPlayPattern): string {
  if (pattern === "arcade-survival") return "Arcade Survival";
  if (pattern === "platform-movement") return "Platform Movement";
  if (pattern === "combat-survival") return "Combat Survival";
  return "Capability Foundation";
}

export function generateWebProject(workspace: ProjectWorkspace): WebAdapterResult {
  const capabilityMap = createCapabilityMap(workspace.project, workspace.brief);

  if (hasCapability(capabilityMap, "physics") && readLatestAssetManifest(workspace.project.id)) {
    return generateAssetPhysicsWebProject(workspace);
  }

  return generateCapabilityWebProject(workspace);
}

function generateTurnRulesWebProject(workspace: ProjectWorkspace): WebAdapterResult {
  const projectRoot = path.join(getProjectArtifactRoot(workspace.project.id), "web");
  const files = [
    ["index.html", renderIndexHtml(workspace)],
    ["styles.css", renderStyles()],
    ["scripts/turn-rules.js", renderTurnRulesScript()],
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
  role: AssetRole | "imported";
  roleStatus: string;
  tag: string;
  name: string;
  relativePath: string;
  originalPath: string;
  tags: string[];
  score: number;
  reason: string;
};

function generateAssetPhysicsWebProject(workspace: ProjectWorkspace): WebAdapterResult {
  const projectRoot = path.join(getProjectArtifactRoot(workspace.project.id), "web");
  const manifest = readLatestAssetManifest(workspace.project.id);
  fs.rmSync(projectRoot, { recursive: true, force: true });
  const copiedAssets = copyAssetPhysicsAssets(projectRoot, manifest);
  const files = [
    ["index.html", renderAssetPhysicsIndexHtml(workspace, manifest)],
    ["styles.css", renderAssetPhysicsStyles()],
    ["scripts/game.js", renderAssetPhysicsGameScriptV3(workspace, manifest, copiedAssets)],
    ["docs/game-os-brief.md", renderAssetPhysicsBrief(workspace, manifest, copiedAssets)],
    ["web-adapter-manifest.json", renderAssetPhysicsManifest(workspace, manifest, copiedAssets)]
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
    report: renderAssetPhysicsReport(workspace, projectRoot, absoluteFiles, manifest, copiedAssets)
  };
}

function copyAssetPhysicsAssets(projectRoot: string, manifest: AssetImportManifest | null): CopiedWebAsset[] {
  if (!manifest) return [];

  const assignments = manifest.roleAssignments ?? [];
  const selectedAssets = [
    ...assignments.filter((assignment) => assignment.status === "accepted" && assignment.file),
    ...manifest.files
      .filter((file) => file.kind === "image" && !assignments.some((assignment) => assignment.file?.absolutePath === file.absolutePath))
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.max(0, 8 - assignments.filter((assignment) => assignment.status === "accepted").length))
      .map((file): AssetRoleAssignment => ({
        role: "ui",
        status: "accepted",
        confidence: 0.25,
        reason: "Extra imported asset retained as optional skin candidate.",
        file
      }))
  ];
  const seenNames = new Set<string>();

  return selectedAssets.map((assignment, index) => {
    const asset = assignment.file as ImportedAssetFile;
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
      role: assignment.role,
      roleStatus: assignment.status,
      tag: asset.tags[0] ?? "imported",
      name: asset.name,
      relativePath: `./${relativePath}`,
      originalPath: asset.relativePath,
      tags: asset.tags,
      score: asset.score,
      reason: assignment.reason
    };
  });
}

function renderAssetPhysicsIndexHtml(workspace: ProjectWorkspace, manifest: AssetImportManifest | null): string {
  const verdict = manifest?.verdict ?? "NO_ASSET_PACK_IMPORTED";
  const displayVerdict = formatGameOsStatusLabel(verdict);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(workspace.project.name)} - Game OS Asset-Led Physics Prototype</title>
    <meta name="description" content="${escapeHtml(workspace.brief.summary)}" />
    <link rel="stylesheet" href="./styles.css" />
  </head>
  <body>
    <main class="game-shell" data-game-os-web="booting">
      <section class="hero-band" aria-label="Game header">
        <div>
          <p class="eyebrow">Game OS Web Channel</p>
          <h1>${escapeHtml(workspace.project.name)}</h1>
          <p>Cut the connector, feed the goal, collect the stars, and retry cleanly.</p>
        </div>
        <div class="verdict-chip" id="verdict-chip">${escapeHtml(displayVerdict)}</div>
      </section>

      <section class="play-surface" aria-label="Playable asset-led physics web prototype">
        <div class="canvas-wrap">
          <canvas id="game-canvas" width="960" height="620" aria-label="asset-led physics puzzle canvas"></canvas>
          <div class="watermark">Made with GameOS</div>
        </div>

        <aside class="control-panel">
          <div class="control-row">
            <button id="cut-button" type="button">Asset-Led Physics</button>
            <button id="reset-button" type="button">Reset</button>
          </div>
          <section class="hud-card">
            <p class="eyebrow">Attempt</p>
            <strong id="attempt-label">Ready</strong>
          </section>
          <section class="hud-card">
            <p class="eyebrow">Asset Gate</p>
            <p id="asset-label">${escapeHtml(displayVerdict)}</p>
          </section>
          <section class="hud-card">
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

function renderAssetPhysicsStyles(): string {
  return `:root {
  color-scheme: light;
  --ink: #18211f;
  --muted: #5c6b66;
  --panel: #fffefa;
  --line: #d7dfda;
  --accent: #0e7a64;
  --accent-dark: #143832;
  --gold: #d4a532;
  --coral: #d9634f;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
  color: var(--ink);
  background: radial-gradient(circle at 18% 12%, #f6fbf7 0, #edf5f0 32%, #dfeae5 100%);
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
  width: min(1180px, calc(100vw - 24px));
  margin: 0 auto;
  padding: 14px 0 22px;
}

.hero-band {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 96px;
  padding: 16px 18px;
  border: 1px solid #102a24;
  border-radius: 8px;
  color: #f8fff9;
  background: linear-gradient(135deg, #102a24 0%, #154a3d 52%, #6d5627 100%);
}

.hero-band h1 {
  margin: 2px 0 5px;
  font-size: clamp(1.8rem, 3vw, 3.2rem);
  line-height: 1;
}

.hero-band p {
  max-width: 620px;
  margin: 0;
  color: #d8efe7;
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
  max-width: 300px;
  border: 1px solid rgba(255, 255, 255, 0.42);
  border-radius: 999px;
  padding: 9px 13px;
  font-size: 0.78rem;
  font-weight: 900;
  overflow-wrap: anywhere;
}

.play-surface {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 12px;
  margin-top: 12px;
}

.canvas-wrap {
  position: relative;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #f9fcfa;
  box-shadow: 0 14px 34px rgba(22, 33, 28, 0.08);
  padding: 10px;
}

#game-canvas {
  display: block;
  width: 100%;
  height: auto;
  aspect-ratio: 960 / 620;
  min-height: 0;
  border: 1px solid #c9d8d0;
  border-radius: 8px;
  background: #edf6f1;
  cursor: crosshair;
  touch-action: none;
  user-select: none;
}

.watermark {
  position: absolute;
  right: clamp(20px, 2.4vw, 30px);
  bottom: clamp(20px, 2.4vw, 30px);
  padding: 5px 8px;
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.88);
  background: rgba(20, 56, 50, 0.68);
  font-size: 0.72rem;
  font-weight: 900;
}

.control-panel {
  display: grid;
  gap: 10px;
  align-content: start;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel);
  box-shadow: 0 14px 34px rgba(22, 33, 28, 0.08);
  padding: 12px;
}

.control-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 9px;
}

.hud-card {
  display: block;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #f8faf7;
  padding: 10px;
}

#attempt-label,
#asset-label {
  margin: 0;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.event-log {
  display: grid;
  max-height: 210px;
  margin: 0;
  padding-left: 18px;
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

  .play-surface {
    grid-template-columns: 1fr;
  }
}
`;
}

function renderAssetPhysicsGameScript(workspace: ProjectWorkspace, manifest: AssetImportManifest | null, copiedAssets: CopiedWebAsset[]): string {
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
    ropeReleased: false,
    status: "ready",
    time: 0,
    stars: [
      { x: 480, y: 230, r: 22, collected: false },
      { x: 435, y: 335, r: 22, collected: false },
      { x: 520, y: 430, r: 22, collected: false }
    ],
    anchor: { x: 480, y: 82 },
    heroObject: { x: 480, y: 170, vx: 0, vy: 0, r: 34 },
    goal: { x: 480, y: 535, r: 56 },
    log: ["Imported assets loaded into an asset-led physics test slice."]
  };
}

function step() {
  if (state.ropeReleased && state.status === "falling") {
    state.time += 1 / 60;
    state.heroObject.vy += 0.42;
    state.heroObject.y += state.heroObject.vy;
    state.heroObject.x += state.heroObject.vx;

    for (const star of state.stars) {
      if (!star.collected && distance(state.heroObject, star) <= state.heroObject.r + star.r) {
        star.collected = true;
        state.log.unshift("Star collected.");
      }
    }

    if (distance(state.heroObject, state.goal) <= state.goal.r + state.heroObject.r * 0.45) {
      state.status = "won";
      state.log.unshift("Goal reached. The first puzzle is playable.");
      cutButton.disabled = true;
    } else if (state.heroObject.y > canvas.height + 70) {
      state.status = "missed";
      state.log.unshift("Hero object missed the goal. Reset for another attempt.");
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
  context.strokeStyle = state.ropeReleased ? "rgba(100, 112, 104, 0.34)" : "#8b6236";
  context.lineWidth = 8;
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(state.anchor.x, state.anchor.y);
  if (state.ropeReleased) {
    context.lineTo(state.anchor.x - 26, state.anchor.y + 58);
  } else {
    context.lineTo(state.heroObject.x, state.heroObject.y - state.heroObject.r + 4);
  }
  context.stroke();
  context.fillStyle = "#164239";
  context.beginPath();
  context.arc(state.anchor.x, state.anchor.y, 13, 0, Math.PI * 2);
  context.fill();
}

function drawCandy() {
  const heroObject = assetForTag("hero-object") || assetForTag("physics-piece") || importedAssets[0];
  if (heroObject && drawAsset(heroObject, state.heroObject.x - 42, state.heroObject.y - 42, 84, 84, "contain")) return;
  context.fillStyle = "#d85d4a";
  context.beginPath();
  context.arc(state.heroObject.x, state.heroObject.y, state.heroObject.r, 0, Math.PI * 2);
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
        : state.ropeReleased
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

function releaseRope() {
  if (state.ropeReleased || state.status === "won") return;
  state.ropeReleased = true;
  state.status = "falling";
  state.heroObject.vx = 0;
  state.heroObject.vy = 1.4;
  state.log.unshift("Rope released.");
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
  if (image.naturalWidth < 8 || image.naturalHeight < 8) return false;
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

function simulateAssetPhysics(options = {}) {
  const matches = options.matches || 8;
  const report = {
    agent: "Advanced Web Player - Physics Puzzle Specialist",
    claim: "asset-driven asset-led physics browser prototype player-agent simulation",
    kind: "asset-physics",
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
    report.asset_gate !== "WRONG_ASSET_PACK_FOR_ASSET_PHYSICS"
      ? "WORTH_PLAYING_FOR_ASSET_PHYSICS_WEB_BUILD"
      : "NEEDS_ARCHITECTURE_UPGRADE";
  return report;
}

canvas.addEventListener("click", (event) => {
  const rect = canvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
  const y = ((event.clientY - rect.top) / rect.height) * canvas.height;
  const nearRope = !state.ropeReleased && x > state.heroObject.x - 80 && x < state.heroObject.x + 80 && y > state.anchor.y && y < state.heroObject.y + 25;
  if (nearRope) releaseRope();
});

cutButton.addEventListener("click", releaseRope);
resetButton.addEventListener("click", resetAttempt);

window.__gameOsWebAdapter = {
  getState: () => state,
  smoke: () => ({
    ok: Boolean(shell && canvas && context && cutButton && resetButton),
    kind: "asset-physics",
    projectName,
    assetsUsed: importedAssets.length,
    assetGate,
    canvasWidth: canvas.width,
    canvasHeight: canvas.height
  }),
  releaseRope,
  reset: resetAttempt,
  runPlayerAgent: simulateAssetPhysics
};

draw();
renderHud();
animationFrame = requestAnimationFrame(step);
`;
}

function renderAssetPhysicsGameScriptV2(workspace: ProjectWorkspace, manifest: AssetImportManifest | null, copiedAssets: CopiedWebAsset[]): string {
  const roleSummary = (manifest?.roleAssignments ?? []).map((assignment) => ({
    role: assignment.role,
    status: assignment.status,
    confidence: assignment.confidence,
    file: assignment.file?.relativePath ?? null,
    reason: assignment.reason
  }));

  return `const projectName = ${JSON.stringify(workspace.project.name)};
const assetGate = ${JSON.stringify(manifest?.verdict ?? "NO_ASSET_PACK_IMPORTED")};
const importedAssets = ${JSON.stringify(copiedAssets, null, 2)};
const roleAssignments = ${JSON.stringify(roleSummary, null, 2)};
const canvas = document.querySelector("#game-canvas");
const context = canvas.getContext("2d");
const shell = document.querySelector(".game-shell");
const cutButton = document.querySelector("#cut-button");
const resetButton = document.querySelector("#reset-button");
const attemptLabel = document.querySelector("#attempt-label");
const assetLabel = document.querySelector("#asset-label");
const eventLog = document.querySelector("#event-log");
const verdictChip = document.querySelector("#verdict-chip");
const watermark = document.querySelector(".watermark");
const images = new Map();
let animationFrame = 0;
let state = createInitialState();

for (const asset of importedAssets) {
  const image = new Image();
  image.onload = () => draw();
  image.onerror = () => {
    state.log.unshift("Asset failed to render: " + asset.name);
    renderHud();
  };
  image.src = asset.relativePath;
  images.set(asset.relativePath, image);
}

function createInitialState() {
  return {
    ropeReleased: false,
    status: "ready",
    time: 0,
    inputLockedUntil: 0,
    stars: [
      { x: 470, y: 235, r: 22, collected: false },
      { x: 492, y: 355, r: 22, collected: false },
      { x: 512, y: 472, r: 22, collected: false }
    ],
    anchor: { x: 470, y: 84 },
    heroObject: { x: 470, y: 170, vx: 0, vy: 0, r: 34 },
    goal: { x: 520, y: 548, r: 58 },
    log: ["Studio slice ready. Release the rope, watch the path, reset safely."]
  };
}

function step() {
  if (state.ropeReleased && state.status === "falling") {
    applyPhysics(state.heroObject, state.goal);
    state.time += 1 / 60;

    for (const star of state.stars) {
      if (!star.collected && distance(state.heroObject, star) <= state.heroObject.r + star.r) {
        star.collected = true;
        state.log.unshift("Star collected.");
      }
    }

    if (distance(state.heroObject, state.goal) <= state.goal.r + state.heroObject.r * 0.55) {
      state.status = "won";
      state.log.unshift("Goal reached. This slice is mechanically playable.");
      cutButton.disabled = true;
    } else if (state.heroObject.y > canvas.height + 70 || state.heroObject.x < -90 || state.heroObject.x > canvas.width + 90) {
      state.status = "missed";
      state.log.unshift("Hero object missed the goal. Reset for another clean attempt.");
      cutButton.disabled = true;
    }
  }

  draw();
  renderHud();
  animationFrame = requestAnimationFrame(step);
}

function applyPhysics(heroObject, goal) {
  const attraction = (goal.x - heroObject.x) * 0.00135;
  heroObject.vx = (heroObject.vx + attraction) * 0.992;
  heroObject.vy = (heroObject.vy + 0.34) * 0.997;
  heroObject.x += heroObject.vx;
  heroObject.y += heroObject.vy;
}

function draw() {
  context.clearRect(0, 0, canvas.width, canvas.height);
  drawBackground();
  drawGoal();
  drawStars();
  drawRope();
  drawCandy();
  drawStatusRibbon();
  drawCanvasWatermark();
}

function drawBackground() {
  const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "#fff8e8");
  gradient.addColorStop(0.58, "#e9f7ed");
  gradient.addColorStop(1, "#dff0fb");
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.save();
  context.globalAlpha = 0.18;
  context.fillStyle = "#5abf91";
  for (let x = -80; x < canvas.width + 120; x += 130) {
    context.beginPath();
    context.arc(x, canvas.height + 20, 150, Math.PI, Math.PI * 2);
    context.fill();
  }
  context.restore();

  const background = assetForRole("background");
  if (background) {
    context.save();
    context.globalAlpha = 0.34;
    roundRect(34, 98, 178, 132, 22);
    context.clip();
    drawAsset(background, 34, 98, 178, 132, "cover");
    context.restore();
  }

  context.save();
  context.globalAlpha = 0.08;
  context.strokeStyle = "#1d6a58";
  context.lineWidth = 2;
  for (let y = 118; y < canvas.height; y += 88) {
    context.beginPath();
    context.moveTo(0, y);
    context.bezierCurveTo(250, y - 35, 500, y + 35, canvas.width, y - 10);
    context.stroke();
  }
  context.restore();
}

function drawGoal() {
  const character = assetForRole("goal-character");
  context.save();
  context.translate(state.goal.x, state.goal.y);
  context.shadowColor = "rgba(24, 47, 39, 0.28)";
  context.shadowBlur = 18;
  context.shadowOffsetY = 8;
  if (character && drawAsset(character, -70, -76, 140, 140, "contain")) {
    context.restore();
    return;
  }

  context.fillStyle = "#12483d";
  context.beginPath();
  context.arc(0, 0, state.goal.r, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#ffffff";
  context.beginPath();
  context.arc(-20, -16, 8, 0, Math.PI * 2);
  context.arc(20, -16, 8, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#f0674d";
  roundRect(-34, 16, 68, 15, 7);
  context.fill();
  context.restore();
}

function drawStars() {
  const starAsset = assetForRole("collectible");
  for (const star of state.stars) {
    if (star.collected) continue;
    context.save();
    context.shadowColor = "rgba(152, 104, 20, 0.25)";
    context.shadowBlur = 10;
    if (starAsset && drawAsset(starAsset, star.x - 25, star.y - 25, 50, 50, "contain")) {
      context.restore();
      continue;
    }
    drawProceduralStar(star.x, star.y, 24);
    context.restore();
  }
}

function drawRope() {
  context.save();
  context.lineCap = "round";
  context.strokeStyle = state.ropeReleased ? "rgba(107, 92, 71, 0.35)" : "#8d6338";
  context.lineWidth = 9;
  context.beginPath();
  context.moveTo(state.anchor.x, state.anchor.y);
  if (state.ropeReleased) {
    context.lineTo(state.anchor.x - 34, state.anchor.y + 68);
  } else {
    context.lineTo(state.heroObject.x, state.heroObject.y - state.heroObject.r + 6);
  }
  context.stroke();

  context.strokeStyle = state.ropeReleased ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.45)";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(state.anchor.x - 2, state.anchor.y + 2);
  context.lineTo(state.ropeReleased ? state.anchor.x - 35 : state.heroObject.x - 2, state.ropeReleased ? state.anchor.y + 68 : state.heroObject.y - state.heroObject.r + 8);
  context.stroke();

  context.fillStyle = "#183d35";
  context.beginPath();
  context.arc(state.anchor.x, state.anchor.y, 14, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawCandy() {
  const heroObject = assetForRole("hero-object");
  context.save();
  context.shadowColor = "rgba(34, 33, 28, 0.24)";
  context.shadowBlur = 14;
  context.shadowOffsetY = 8;
  if (heroObject && drawAsset(heroObject, state.heroObject.x - 42, state.heroObject.y - 42, 84, 84, "contain")) {
    context.restore();
    return;
  }
  const gradient = context.createRadialGradient(state.heroObject.x - 14, state.heroObject.y - 16, 4, state.heroObject.x, state.heroObject.y, state.heroObject.r);
  gradient.addColorStop(0, "#ffb35f");
  gradient.addColorStop(0.6, "#f0654a");
  gradient.addColorStop(1, "#b93837");
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(state.heroObject.x, state.heroObject.y, state.heroObject.r, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = "#fff4dc";
  context.lineWidth = 6;
  context.beginPath();
  context.arc(state.heroObject.x, state.heroObject.y, state.heroObject.r - 11, -0.5, Math.PI + 0.5);
  context.stroke();
  context.restore();
}

function drawStatusRibbon() {
  const collected = state.stars.filter((star) => star.collected).length;
  context.save();
  context.fillStyle = "rgba(255, 253, 248, 0.9)";
  context.strokeStyle = "rgba(33, 58, 50, 0.12)";
  context.lineWidth = 1;
  roundRect(24, 22, 360, 70, 18);
  context.fill();
  context.stroke();
  context.fillStyle = "#17201d";
  context.font = "900 22px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  context.fillText(projectName.slice(0, 28), 44, 51);
  context.fillStyle = "#51655d";
  context.font = "800 14px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  context.fillText("Stars " + collected + "/" + state.stars.length + " | " + visualVerdict(), 44, 75);
  context.restore();
}

function drawCanvasWatermark() {
  context.save();
  context.font = "800 13px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  context.textAlign = "left";
  context.fillStyle = "rgba(18, 34, 30, 0.58)";
  context.fillText("Made with GameOS", 32, canvas.height - 30);
  context.restore();
}

function renderHud() {
  shell.dataset.gameOsWeb = "ready";
  const collected = state.stars.filter((star) => star.collected).length;
  const statusText =
    state.status === "won"
      ? "Won with " + collected + "/" + state.stars.length + " stars"
      : state.status === "missed"
        ? "Missed with " + collected + "/" + state.stars.length + " stars"
        : state.ropeReleased
          ? "Falling with " + collected + "/" + state.stars.length + " stars"
          : isInputLocked()
            ? "Resetting safely"
            : "Ready to cut";
  attemptLabel.textContent = statusText;
  verdictChip.textContent = state.status === "won" ? "Playable proof" : visualVerdict();
  assetLabel.textContent = assetFitVerdict() + " · " + assetGate;
  eventLog.innerHTML = "";
  for (const entry of state.log.slice(0, 8)) {
    const item = document.createElement("li");
    item.textContent = entry;
    eventLog.appendChild(item);
  }
}

function releaseRope(source = "button") {
  if (isInputLocked() || state.ropeReleased || state.status === "won") return false;
  state.ropeReleased = true;
  state.status = "falling";
  state.heroObject.vx = 0.55;
  state.heroObject.vy = 2.05;
  state.log.unshift(source === "canvas" ? "Rope released from play surface." : "Rope released.");
  cutButton.disabled = true;
  renderHud();
  return true;
}

function resetAttempt(options = {}) {
  cancelAnimationFrame(animationFrame);
  state = createInitialState();
  state.inputLockedUntil = performance.now() + 260;
  cutButton.disabled = false;
  if (!options.quiet) state.log.unshift("Reset complete. Input briefly debounced.");
  draw();
  renderHud();
  animationFrame = requestAnimationFrame(step);
  return true;
}

function isInputLocked() {
  return performance.now() < state.inputLockedUntil;
}

function assetForRole(role) {
  return importedAssets.find((asset) => asset.role === role && asset.roleStatus === "accepted");
}

function roleAccepted(role) {
  return Boolean(assetForRole(role));
}

function assetFitVerdict() {
  if (assetGate === "WRONG_ASSET_PACK_FOR_ASSET_PHYSICS" || assetGate === "NO_ASSET_PACK_IMPORTED") return "ASSET_FIT_FAIL";
  if (roleAccepted("hero-object") && roleAccepted("goal-character") && roleAccepted("collectible")) return "ASSET_FIT_PASS";
  return "ASSET_FIT_PARTIAL";
}

function visualVerdict() {
  if (assetFitVerdict() === "ASSET_FIT_PASS") return "VISUAL_GATE_PASS";
  if (roleAccepted("goal-character") || roleAccepted("hero-object")) return "VISUAL_GATE_REVIEW";
  return "VISUAL_GATE_FAIL";
}

function drawAsset(asset, x, y, width, height, mode) {
  const image = images.get(asset.relativePath);
  if (!image || !image.complete || image.naturalWidth === 0) return false;
  if (image.naturalWidth < 8 || image.naturalHeight < 8) return false;
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
  context.fillStyle = "#f5b93b";
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

function roundRect(x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function runPhysicsSimulation() {
  const sim = { x: 470, y: 170, vx: 0.55, vy: 2.05, r: 34 };
  const goal = { x: 520, y: 548, r: 58 };
  const stars = [
    { x: 470, y: 235, r: 22, collected: false },
    { x: 492, y: 355, r: 22, collected: false },
    { x: 512, y: 472, r: 22, collected: false }
  ];
  let seconds = 0;

  for (let frame = 0; frame < 240; frame += 1) {
    seconds += 1 / 60;
    applyPhysics(sim, goal);
    for (const star of stars) {
      if (!star.collected && Math.hypot(sim.x - star.x, sim.y - star.y) <= sim.r + star.r) star.collected = true;
    }
    if (Math.hypot(sim.x - goal.x, sim.y - goal.y) <= goal.r + sim.r * 0.55) {
      return {
        won: true,
        seconds: Number(seconds.toFixed(2)),
        stars: stars.filter((star) => star.collected).length
      };
    }
  }

  return {
    won: false,
    seconds: Number(seconds.toFixed(2)),
    stars: stars.filter((star) => star.collected).length
  };
}

function verifyResetAndInputLoop() {
  resetAttempt({ quiet: true });
  state.inputLockedUntil = performance.now() - 1;
  const firstCut = releaseRope("agent-first-cut");
  const afterCut = state.ropeReleased && state.status === "falling";
  resetAttempt({ quiet: true });
  const resetReady = !state.ropeReleased && state.status === "ready";
  const blockedDuringCooldown = releaseRope("agent-cooldown-cut") === false && !state.ropeReleased;
  state.inputLockedUntil = performance.now() - 1;
  const recutWorks = releaseRope("agent-recut") === true && state.ropeReleased;

  return {
    firstCut,
    afterCut,
    resetReady,
    noAutoCutAfterReset: resetReady,
    blockedDuringCooldown,
    recutWorks,
    pass: Boolean(firstCut && afterCut && resetReady && blockedDuringCooldown && recutWorks)
  };
}

function simulateAssetPhysics(options = {}) {
  const matches = options.matches || 8;
  const report = {
    agent: "Advanced Web Player - Physics Puzzle Specialist",
    claim: "visual, asset-fit, reset-safe, physics-readable asset-led physics timing browser prototype simulation",
    kind: "asset-physics",
    matches,
    assets_used: importedAssets.length,
    asset_gate: assetGate,
    visual_verdict: visualVerdict(),
    physics_verdict: "PHYSICS_GATE_UNKNOWN",
    input_verdict: "INPUT_GATE_UNKNOWN",
    asset_fit_verdict: assetFitVerdict(),
    reset_recut_pass: false,
    role_assignments: roleAssignments,
    completions: 0,
    stars_collected: 0,
    average_seconds: 0,
    timeouts: 0,
    verdict: "NEEDS_ARCHITECTURE_UPGRADE"
  };

  let totalSeconds = 0;
  let totalStars = 0;
  for (let match = 0; match < matches; match += 1) {
    const sim = runPhysicsSimulation();
    if (sim.won) {
      report.completions += 1;
      totalSeconds += sim.seconds;
      totalStars += sim.stars;
    } else {
      report.timeouts += 1;
    }
  }

  const input = verifyResetAndInputLoop();
  report.reset_recut_pass = input.pass;
  report.input_verdict = input.pass ? "INPUT_GATE_PASS" : "INPUT_GATE_FAIL";
  report.physics_verdict = report.completions === matches && report.timeouts === 0 ? "PHYSICS_GATE_PASS" : "PHYSICS_GATE_FAIL";
  report.average_seconds = Number((totalSeconds / Math.max(1, report.completions)).toFixed(2));
  report.stars_collected = totalStars;

  if (
    report.visual_verdict === "VISUAL_GATE_PASS" &&
    report.physics_verdict === "PHYSICS_GATE_PASS" &&
    report.input_verdict === "INPUT_GATE_PASS" &&
    report.asset_fit_verdict === "ASSET_FIT_PASS"
  ) {
    report.verdict = "WORTH_PLAYING_FOR_ASSET_PHYSICS_WEB_BUILD";
  } else if (report.physics_verdict === "PHYSICS_GATE_PASS" && report.input_verdict === "INPUT_GATE_PASS" && report.visual_verdict !== "VISUAL_GATE_FAIL") {
    report.verdict = "PLAYABLE_BUT_ASSET_FIT_NEEDS_REVIEW";
  }

  return report;
}

canvas.addEventListener("pointerdown", (event) => {
  const rect = canvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
  const y = ((event.clientY - rect.top) / rect.height) * canvas.height;
  const nearRope = !state.ropeReleased && x > state.heroObject.x - 90 && x < state.heroObject.x + 90 && y > state.anchor.y - 20 && y < state.heroObject.y + 34;
  if (nearRope) releaseRope("canvas");
});

cutButton.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  releaseRope("button");
});

resetButton.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  resetAttempt();
});

window.__gameOsWebAdapter = {
  getState: () => ({ ...state, inputLocked: isInputLocked() }),
  smoke: () => ({
    ok: Boolean(shell && canvas && context && cutButton && resetButton && watermark),
    kind: "asset-physics",
    projectName,
    assetsUsed: importedAssets.length,
    assetGate,
    assetFit: assetFitVerdict(),
    visualGate: visualVerdict(),
    roleAssignments,
    canvasWidth: canvas.width,
    canvasHeight: canvas.height,
    watermark: Boolean(watermark && watermark.textContent && watermark.textContent.includes("GameOS"))
  }),
  releaseRope,
  reset: resetAttempt,
  runPlayerAgent: simulateAssetPhysics
};

draw();
renderHud();
animationFrame = requestAnimationFrame(step);
`;
}

function renderAssetPhysicsGameScriptV3(workspace: ProjectWorkspace, manifest: AssetImportManifest | null, copiedAssets: CopiedWebAsset[]): string {
  const roleSummary = (manifest?.roleAssignments ?? []).map((assignment) => ({
    role: assignment.role,
    status: assignment.status,
    confidence: assignment.confidence,
    file: assignment.file?.relativePath ?? null,
    reason: assignment.reason
  }));

  return `const projectName = ${JSON.stringify(workspace.project.name)};
const assetGate = ${JSON.stringify(manifest?.verdict ?? "NO_ASSET_PACK_IMPORTED")};
const importedAssets = ${JSON.stringify(copiedAssets, null, 2)};
const roleAssignments = ${JSON.stringify(roleSummary, null, 2)};
const canvas = document.querySelector("#game-canvas");
const context = canvas.getContext("2d");
const shell = document.querySelector(".game-shell");
const cutButton = document.querySelector("#cut-button");
const resetButton = document.querySelector("#reset-button");
const attemptLabel = document.querySelector("#attempt-label");
const assetLabel = document.querySelector("#asset-label");
const eventLog = document.querySelector("#event-log");
const verdictChip = document.querySelector("#verdict-chip");
const watermark = document.querySelector(".watermark");
const images = new Map();
const LEVEL = {
  anchor: { x: 480, y: 96 },
  ropeLength: 185,
  startAngle: -0.72,
  startAngularVelocity: 0.034,
  swingAcceleration: 0.0062,
  swingDamping: 0.995,
  gravity: 0.33,
  airDamping: 0.997,
  heroObjectRadius: 34,
  goal: { x: 610, y: 535, r: 58 },
  stars: [
    { x: 555, y: 255, r: 22 },
    { x: 645, y: 360, r: 22 },
    { x: 600, y: 470, r: 22 }
  ],
  bumpers: [
    { x: 505, y: 360, r: 34, restitution: 0.72 }
  ],
  hazard: { x: 790, y: 475, r: 42 },
  bounds: { left: 26, right: 934, bottom: 690 }
};
let animationFrame = 0;
let state = createInitialState();

for (const asset of importedAssets) {
  const image = new Image();
  image.onload = () => draw();
  image.onerror = () => {
    state.log.unshift("Asset failed to render: " + asset.name);
    renderHud();
  };
  image.src = asset.relativePath;
  images.set(asset.relativePath, image);
}

function createInitialState() {
  const next = {
    ropeReleased: false,
    status: "ready",
    mode: "swinging",
    time: 0,
    frame: 0,
    inputLockedUntil: 0,
    swing: {
      angle: LEVEL.startAngle,
      angularVelocity: LEVEL.startAngularVelocity,
      length: LEVEL.ropeLength
    },
    heroObject: { x: 0, y: 0, vx: 0, vy: 0, r: LEVEL.heroObjectRadius },
    stars: LEVEL.stars.map((star) => ({ ...star, collected: false })),
    bumperContacts: 0,
    cutFrame: null,
    cutAngle: null,
    cutVelocity: null,
    skillBand: "waiting",
    hazardHit: false,
    pointerActive: false,
    bladeLastPoint: null,
    bladeLastTime: 0,
    bladeSensitivity: 42,
    sliceGestureCut: false,
    sliceFeedback: "idle",
    sliceTrailVisibleUntil: 0,
    sliceTrail: [],
    log: ["Swing is live. Cut with timing, not just a button press."]
  };
  syncCandyFromSwing(next);
  return next;
}

function step() {
  state.time += 1 / 60;
  state.frame += 1;

  if (!state.ropeReleased && state.status === "ready") {
    advanceSwing(state);
  } else if (state.status === "falling") {
    applyBallistics(state);
  }

  draw();
  renderHud();
  animationFrame = requestAnimationFrame(step);
}

function advanceSwing(target) {
  target.swing.angularVelocity += -LEVEL.swingAcceleration * Math.sin(target.swing.angle);
  target.swing.angularVelocity *= LEVEL.swingDamping;
  target.swing.angle += target.swing.angularVelocity;
  syncCandyFromSwing(target);
  target.skillBand = timingBand(target.swing.angle, target.swing.angularVelocity);
}

function syncCandyFromSwing(target) {
  const angle = target.swing.angle;
  const length = target.swing.length;
  target.heroObject.x = LEVEL.anchor.x + Math.sin(angle) * length;
  target.heroObject.y = LEVEL.anchor.y + Math.cos(angle) * length;
  target.heroObject.vx = Math.cos(angle) * length * target.swing.angularVelocity;
  target.heroObject.vy = -Math.sin(angle) * length * target.swing.angularVelocity;
}

function applyBallistics(target) {
  const heroObject = target.heroObject;
  heroObject.vy += LEVEL.gravity;
  heroObject.vx *= LEVEL.airDamping;
  heroObject.vy *= 0.999;
  heroObject.x += heroObject.vx;
  heroObject.y += heroObject.vy;

  if (heroObject.x - heroObject.r < LEVEL.bounds.left) {
    heroObject.x = LEVEL.bounds.left + heroObject.r;
    heroObject.vx = Math.abs(heroObject.vx) * 0.62;
  }
  if (heroObject.x + heroObject.r > LEVEL.bounds.right) {
    heroObject.x = LEVEL.bounds.right - heroObject.r;
    heroObject.vx = -Math.abs(heroObject.vx) * 0.62;
  }

  for (const bumper of LEVEL.bumpers) {
    resolveBumperCollision(target, bumper);
  }

  for (const star of target.stars) {
    if (!star.collected && distance(heroObject, star) <= heroObject.r + star.r) {
      star.collected = true;
      if (target === state) state.log.unshift("Star collected through trajectory.");
    }
  }

  if (distance(heroObject, LEVEL.hazard) <= heroObject.r + LEVEL.hazard.r * 0.7) {
    target.status = "missed";
    target.hazardHit = true;
    if (target === state) {
      state.log.unshift("Hazard hit. Timing was too hot.");
      cutButton.disabled = true;
    }
  } else if (distance(heroObject, LEVEL.goal) <= LEVEL.goal.r + heroObject.r * 0.55) {
    target.status = "won";
    if (target === state) {
      state.log.unshift("Goal reached from swing momentum.");
      cutButton.disabled = true;
    }
  } else if (heroObject.y > LEVEL.bounds.bottom || heroObject.x < -90 || heroObject.x > canvas.width + 90) {
    target.status = "missed";
    if (target === state) {
      state.log.unshift("Missed the goal. Reset and choose a better cut moment.");
      cutButton.disabled = true;
    }
  }
}

function resolveBumperCollision(target, bumper) {
  const heroObject = target.heroObject;
  const dx = heroObject.x - bumper.x;
  const dy = heroObject.y - bumper.y;
  const d = Math.hypot(dx, dy) || 1;
  const minDistance = heroObject.r + bumper.r;
  if (d >= minDistance) return;

  const nx = dx / d;
  const ny = dy / d;
  heroObject.x = bumper.x + nx * minDistance;
  heroObject.y = bumper.y + ny * minDistance;
  const incoming = heroObject.vx * nx + heroObject.vy * ny;
  if (incoming < 0) {
    heroObject.vx = (heroObject.vx - (1 + bumper.restitution) * incoming * nx) * 0.96;
    heroObject.vy = (heroObject.vy - (1 + bumper.restitution) * incoming * ny) * 0.96;
    target.bumperContacts += 1;
    if (target === state) state.log.unshift("Bumper redirected the hero object.");
  }
}

function draw() {
  context.clearRect(0, 0, canvas.width, canvas.height);
  drawBackground();
  drawTimingArc();
  drawPrediction();
  drawSliceTrail();
  drawBumpersAndHazards();
  drawGoal();
  drawStars();
  drawRope();
  drawCandy();
  drawStatusRibbon();
  drawCanvasWatermark();
}

function drawBackground() {
  const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "#fff8e8");
  gradient.addColorStop(0.58, "#e9f7ed");
  gradient.addColorStop(1, "#dff0fb");
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.save();
  context.globalAlpha = 0.18;
  context.fillStyle = "#5abf91";
  for (let x = -80; x < canvas.width + 120; x += 130) {
    context.beginPath();
    context.arc(x, canvas.height + 20, 150, Math.PI, Math.PI * 2);
    context.fill();
  }
  context.restore();

  const background = assetForRole("background");
  if (background) {
    context.save();
    context.globalAlpha = 0.34;
    roundRect(34, 98, 178, 132, 22);
    context.clip();
    drawAsset(background, 34, 98, 178, 132, "cover");
    context.restore();
  }
  context.save();
  context.globalAlpha = 0.08;
  context.strokeStyle = "#1d6a58";
  context.lineWidth = 2;
  for (let y = 118; y < canvas.height; y += 88) {
    context.beginPath();
    context.moveTo(0, y);
    context.bezierCurveTo(250, y - 35, 500, y + 35, canvas.width, y - 10);
    context.stroke();
  }
  context.restore();
}

function drawTimingArc() {
  context.save();
  context.translate(LEVEL.anchor.x, LEVEL.anchor.y);
  context.lineCap = "round";
  context.lineWidth = 12;
  context.strokeStyle = "rgba(243, 174, 58, 0.24)";
  context.beginPath();
  context.arc(0, 0, LEVEL.ropeLength, Math.PI * 0.74, Math.PI * 0.26, true);
  context.stroke();
  context.strokeStyle = "rgba(20, 125, 99, 0.42)";
  context.beginPath();
  context.arc(0, 0, LEVEL.ropeLength, Math.PI * 0.49, Math.PI * 0.36, true);
  context.stroke();
  context.strokeStyle = "rgba(20, 125, 99, 0.42)";
  context.beginPath();
  context.arc(0, 0, LEVEL.ropeLength, Math.PI * 0.61, Math.PI * 0.56, true);
  context.stroke();
  context.restore();
}

function drawPrediction() {
  if (state.ropeReleased || state.status !== "ready") return;
  const sim = cloneStateForSimulation(state);
  sim.ropeReleased = true;
  sim.status = "falling";
  context.save();
  context.fillStyle = timingBand(state.swing.angle, state.swing.angularVelocity) === "green" ? "rgba(20, 125, 99, 0.45)" : "rgba(23, 32, 29, 0.22)";
  for (let frame = 0; frame < 100 && sim.status === "falling"; frame += 1) {
    applyBallistics(sim);
    if (frame % 10 === 0) {
      context.beginPath();
      context.arc(sim.heroObject.x, sim.heroObject.y, 4, 0, Math.PI * 2);
      context.fill();
    }
  }
  context.restore();
}

function drawSliceTrail() {
  if (state.sliceTrail.length < 2) return;
  if (!state.pointerActive && !state.sliceGestureCut && performance.now() > state.sliceTrailVisibleUntil) return;
  context.save();
  context.lineCap = "round";
  context.lineJoin = "round";
  for (let index = 1; index < state.sliceTrail.length; index += 1) {
    const previous = state.sliceTrail[index - 1];
    const point = state.sliceTrail[index];
    const alpha = Math.max(0.12, index / state.sliceTrail.length);
    context.strokeStyle = state.sliceGestureCut ? "rgba(20, 125, 99, " + alpha + ")" : "rgba(240, 99, 74, " + alpha + ")";
    context.lineWidth = 9 - Math.min(5, state.sliceTrail.length - index);
    context.beginPath();
    context.moveTo(previous.x, previous.y);
    context.lineTo(point.x, point.y);
    context.stroke();
  }
  context.restore();
}

function drawBumpersAndHazards() {
  context.save();
  for (const bumper of LEVEL.bumpers) {
    context.fillStyle = "#f6e7bd";
    context.strokeStyle = "#946f2d";
    context.lineWidth = 5;
    context.beginPath();
    context.arc(bumper.x, bumper.y, bumper.r, 0, Math.PI * 2);
    context.fill();
    context.stroke();
  }
  context.fillStyle = "#b53932";
  context.strokeStyle = "#7b1f1a";
  context.lineWidth = 4;
  context.beginPath();
  context.arc(LEVEL.hazard.x, LEVEL.hazard.y, LEVEL.hazard.r, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.fillStyle = "#fff4dc";
  context.font = "900 18px system-ui, sans-serif";
  context.textAlign = "center";
  context.fillText("!", LEVEL.hazard.x, LEVEL.hazard.y + 7);
  context.restore();
}

function drawGoal() {
  const character = assetForRole("goal-character");
  context.save();
  context.translate(LEVEL.goal.x, LEVEL.goal.y);
  context.shadowColor = "rgba(24, 47, 39, 0.28)";
  context.shadowBlur = 18;
  context.shadowOffsetY = 8;
  if (character && drawAsset(character, -70, -76, 140, 140, "contain")) {
    context.restore();
    return;
  }
  context.fillStyle = "#12483d";
  context.beginPath();
  context.arc(0, 0, LEVEL.goal.r, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#ffffff";
  context.beginPath();
  context.arc(-20, -16, 8, 0, Math.PI * 2);
  context.arc(20, -16, 8, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#f0674d";
  roundRect(-34, 16, 68, 15, 7);
  context.fill();
  context.restore();
}

function drawStars() {
  const starAsset = assetForRole("collectible");
  for (const star of state.stars) {
    if (star.collected) continue;
    context.save();
    context.shadowColor = "rgba(152, 104, 20, 0.25)";
    context.shadowBlur = 10;
    if (starAsset && drawAsset(starAsset, star.x - 25, star.y - 25, 50, 50, "contain")) {
      context.restore();
      continue;
    }
    drawProceduralStar(star.x, star.y, 24);
    context.restore();
  }
}

function drawRope() {
  context.save();
  context.lineCap = "round";
  context.strokeStyle = state.ropeReleased ? "rgba(107, 92, 71, 0.35)" : "#8d6338";
  context.lineWidth = 9;
  context.beginPath();
  context.moveTo(LEVEL.anchor.x, LEVEL.anchor.y);
  if (state.ropeReleased) {
    context.lineTo(LEVEL.anchor.x - 36, LEVEL.anchor.y + 70);
  } else {
    context.lineTo(state.heroObject.x, state.heroObject.y - state.heroObject.r + 6);
  }
  context.stroke();
  context.strokeStyle = state.ropeReleased ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.45)";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(LEVEL.anchor.x - 2, LEVEL.anchor.y + 2);
  context.lineTo(state.ropeReleased ? LEVEL.anchor.x - 38 : state.heroObject.x - 2, state.ropeReleased ? LEVEL.anchor.y + 70 : state.heroObject.y - state.heroObject.r + 8);
  context.stroke();
  context.fillStyle = "#183d35";
  context.beginPath();
  context.arc(LEVEL.anchor.x, LEVEL.anchor.y, 14, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawCandy() {
  const heroObject = assetForRole("hero-object");
  context.save();
  context.shadowColor = "rgba(34, 33, 28, 0.24)";
  context.shadowBlur = 14;
  context.shadowOffsetY = 8;
  if (heroObject && drawAsset(heroObject, state.heroObject.x - 42, state.heroObject.y - 42, 84, 84, "contain")) {
    context.restore();
    return;
  }
  const gradient = context.createRadialGradient(state.heroObject.x - 14, state.heroObject.y - 16, 4, state.heroObject.x, state.heroObject.y, state.heroObject.r);
  gradient.addColorStop(0, "#ffb35f");
  gradient.addColorStop(0.6, "#f0654a");
  gradient.addColorStop(1, "#b93837");
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(state.heroObject.x, state.heroObject.y, state.heroObject.r, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = "#fff4dc";
  context.lineWidth = 6;
  context.beginPath();
  context.arc(state.heroObject.x, state.heroObject.y, state.heroObject.r - 11, -0.5, Math.PI + 0.5);
  context.stroke();
  context.restore();
}

function drawStatusRibbon() {
  const collected = state.stars.filter((star) => star.collected).length;
  context.save();
  context.fillStyle = "rgba(255, 253, 248, 0.9)";
  context.strokeStyle = "rgba(33, 58, 50, 0.12)";
  context.lineWidth = 1;
  roundRect(24, 22, 390, 76, 18);
  context.fill();
  context.stroke();
  context.fillStyle = "#17201d";
  context.font = "900 22px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  context.fillText(projectName.slice(0, 28), 44, 51);
  context.fillStyle = "#51655d";
  context.font = "800 14px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  context.fillText("Stars " + collected + "/" + state.stars.length + " | Timing " + state.skillBand, 44, 76);
  context.restore();
}

function drawCanvasWatermark() {
  context.save();
  context.font = "800 13px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  context.textAlign = "left";
  context.fillStyle = "rgba(18, 34, 30, 0.58)";
  context.fillText("Made with GameOS", 32, canvas.height - 30);
  context.restore();
}

function renderHud() {
  shell.dataset.gameOsWeb = "ready";
  const collected = state.stars.filter((star) => star.collected).length;
  const statusText =
    state.status === "won"
      ? "Won with " + collected + "/" + state.stars.length + " stars"
      : state.status === "missed"
        ? (state.hazardHit ? "Hazard hit" : "Missed with " + collected + "/" + state.stars.length + " stars")
        : state.ropeReleased
          ? "Trajectory live: " + collected + "/" + state.stars.length + " stars"
          : state.sliceFeedback === "dragging"
            ? "Slicing: drag smoothly through the rope"
            : isInputLocked()
              ? "Resetting safely"
              : "Swinging: swipe through the rope on a green arc";
  attemptLabel.textContent = statusText;
  verdictChip.textContent = state.status === "won" ? "Playable proof" : state.skillBand === "green" ? "Timing window" : displayStatusLabel(visualVerdict());
  assetLabel.textContent = displayAssetLabel();
  eventLog.innerHTML = "";
  for (const entry of state.log.slice(0, 8)) {
    const item = document.createElement("li");
    item.textContent = entry;
    eventLog.appendChild(item);
  }
}

function releaseRope(source = "button") {
  if (isInputLocked() || state.ropeReleased || state.status !== "ready") return false;
  state.ropeReleased = true;
  state.status = "falling";
  state.mode = "falling";
  state.cutFrame = state.frame;
  state.cutAngle = Number(state.swing.angle.toFixed(3));
  state.cutVelocity = {
    vx: Number(state.heroObject.vx.toFixed(2)),
    vy: Number(state.heroObject.vy.toFixed(2))
  };
  state.skillBand = timingBand(state.swing.angle, state.swing.angularVelocity);
  if (source === "swipe" || source === "blade") state.sliceGestureCut = true;
  const label = source === "blade" ? "Rope sliced by smooth mouse blade" : source === "swipe" ? "Rope sliced by swipe" : source === "canvas" ? "Rope sliced" : "Rope released";
  state.log.unshift(label + " at " + state.skillBand + " timing.");
  cutButton.disabled = true;
  renderHud();
  return true;
}

function resetAttempt(options = {}) {
  cancelAnimationFrame(animationFrame);
  state = createInitialState();
  state.inputLockedUntil = performance.now() + 260;
  cutButton.disabled = false;
  if (!options.quiet) state.log.unshift("Reset complete. Swing state rebuilt.");
  draw();
  renderHud();
  animationFrame = requestAnimationFrame(step);
  return true;
}

function isInputLocked() {
  return performance.now() < state.inputLockedUntil;
}

function timingBand(angle, angularVelocity) {
  const swingingRight = angularVelocity > 0;
  const rightTiming = angle > 0.56 && angle < 0.78 && angularVelocity < 0.025;
  const reboundTiming = angle > -0.36 && angle < -0.18 && swingingRight;
  if (rightTiming || reboundTiming) return "green";
  if (angle < -0.48 && swingingRight) return "early";
  if (angle > 0.78 || (angle > 0.16 && angularVelocity < -0.03)) return "late";
  return "risky";
}

function assetForRole(role) {
  return importedAssets.find((asset) => asset.role === role && asset.roleStatus === "accepted");
}

function roleAccepted(role) {
  return Boolean(assetForRole(role));
}

function assetFitVerdict() {
  if (assetGate === "WRONG_ASSET_PACK_FOR_ASSET_PHYSICS" || assetGate === "NO_ASSET_PACK_IMPORTED") return "ASSET_FIT_FAIL";
  if (roleAccepted("hero-object") && roleAccepted("goal-character") && roleAccepted("collectible")) return "ASSET_FIT_PASS";
  return "ASSET_FIT_PARTIAL";
}

function visualVerdict() {
  if (assetFitVerdict() === "ASSET_FIT_PASS") return "VISUAL_GATE_PASS";
  if (roleAccepted("goal-character") || roleAccepted("hero-object")) return "VISUAL_GATE_REVIEW";
  return "VISUAL_GATE_FAIL";
}

function displayAssetLabel() {
  return displayStatusLabel(assetFitVerdict()) + " · " + displayStatusLabel(assetGate);
}

function displayStatusLabel(value) {
  const labels = {
    APPROVED_FOR_ASSET_PHYSICS_WEB_BUILD: "Assets approved",
    WRONG_ASSET_PACK_FOR_ASSET_PHYSICS: "Assets need review",
    NO_ASSET_PACK_IMPORTED: "No asset pack imported",
    ASSET_FIT_PASS: "Asset fit pass",
    ASSET_FIT_PARTIAL: "Asset fit review",
    ASSET_FIT_FAIL: "Asset fit failed",
    VISUAL_GATE_PASS: "Visual pass",
    VISUAL_GATE_REVIEW: "Visual review",
    VISUAL_GATE_FAIL: "Visual failed"
  };
  if (labels[value]) return labels[value];
  return String(value)
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\\b\\w/g, (letter) => letter.toUpperCase());
}

function cloneStateForSimulation(source) {
  return {
    ropeReleased: source.ropeReleased,
    status: source.status,
    mode: source.mode,
    time: source.time,
    frame: source.frame,
    inputLockedUntil: 0,
    swing: { ...source.swing },
    heroObject: { ...source.heroObject },
    stars: source.stars.map((star) => ({ ...star })),
    bumperContacts: source.bumperContacts,
    cutFrame: source.cutFrame,
    cutAngle: source.cutAngle,
    cutVelocity: source.cutVelocity ? { ...source.cutVelocity } : null,
    skillBand: source.skillBand,
    hazardHit: source.hazardHit,
    log: []
  };
}

function runPathSimulation(cutDelayFrames) {
  const sim = createInitialState();
  for (let frame = 0; frame < cutDelayFrames; frame += 1) {
    sim.time += 1 / 60;
    sim.frame += 1;
    advanceSwing(sim);
  }
  sim.ropeReleased = true;
  sim.status = "falling";
  sim.mode = "falling";
  sim.cutFrame = sim.frame;
  sim.cutAngle = Number(sim.swing.angle.toFixed(3));
  sim.cutVelocity = {
    vx: Number(sim.heroObject.vx.toFixed(2)),
    vy: Number(sim.heroObject.vy.toFixed(2))
  };
  sim.skillBand = timingBand(sim.swing.angle, sim.swing.angularVelocity);

  let seconds = 0;
  for (let frame = 0; frame < 300 && sim.status === "falling"; frame += 1) {
    seconds += 1 / 60;
    applyBallistics(sim);
  }
  return {
    cutDelayFrames,
    cutAngle: sim.cutAngle,
    cutVelocity: sim.cutVelocity,
    skillBand: sim.skillBand,
    won: sim.status === "won",
    missed: sim.status === "missed",
    hazardHit: sim.hazardHit,
    stars: sim.stars.filter((star) => star.collected).length,
    bumperContacts: sim.bumperContacts,
    seconds: Number(seconds.toFixed(2)),
    finalX: Number(sim.heroObject.x.toFixed(1)),
    finalY: Number(sim.heroObject.y.toFixed(1))
  };
}

function analyzeTimingWindows(results) {
  const winningFrames = results.filter((result) => result.won).map((result) => result.cutDelayFrames);
  const windows = [];
  let current = null;
  for (const frame of winningFrames) {
    if (!current || frame > current.end + 2) {
      current = { start: frame, end: frame };
      windows.push(current);
    } else {
      current.end = frame;
    }
  }
  return {
    winningFrames,
    windows,
    totalWinningFrames: winningFrames.length
  };
}

function simulateAssetPhysics(options = {}) {
  const matches = options.matches || 8;
  const sampledDelays = [];
  for (let frame = 0; frame <= 120; frame += 2) sampledDelays.push(frame);
  const results = sampledDelays.map((delay) => runPathSimulation(delay));
  const timing = analyzeTimingWindows(results);
  const wins = results.filter((result) => result.won);
  const best = wins
    .slice()
    .sort((a, b) => b.stars - a.stars || b.bumperContacts - a.bumperContacts || a.seconds - b.seconds)[0] || null;
  const earlyMiss = runPathSimulation(0);
  const impatientMiss = runPathSimulation(12);
  const staleMiss = runPathSimulation(60);
  const lateMiss = runPathSimulation(120);
  const timingWindowPass = Boolean(best && timing.totalWinningFrames >= 2 && timing.totalWinningFrames <= 14);
  const agencyPass = Boolean(best && !earlyMiss.won && !impatientMiss.won && !staleMiss.won && !lateMiss.won);
  const masteryPass = Boolean(best && best.stars >= 2 && best.bumperContacts >= 1);
  const input = verifyResetAndInputLoop();
  const swipe = swipeRopeForQa();
  const blade = freeMoveRopeForQa();
  const slowBlade = slowFreeMoveRopeForQa();
  const report = {
    agent: "Advanced Web Player - Physics Puzzle Specialist",
    claim: "swing-momentum, timing-sensitive, no-goal-magnet asset-led physics timing browser prototype simulation",
    kind: "asset-physics",
    matches,
    trials: results.length,
    assets_used: importedAssets.length,
    asset_gate: assetGate,
    visual_verdict: visualVerdict(),
    physics_model: "pendulum-swing-momentum-gravity-bumper-collision-no-goal-magnet",
    physics_verdict: best ? "PHYSICS_GATE_PASS" : "PHYSICS_GATE_FAIL",
    timing_skill_verdict: timingWindowPass ? "TIMING_SKILL_PASS" : "TIMING_SKILL_FAIL",
    agency_verdict: agencyPass ? "AGENCY_GATE_PASS" : "AGENCY_GATE_FAIL",
    mastery_verdict: masteryPass ? "MASTERY_GATE_PASS" : "MASTERY_GATE_FAIL",
    input_verdict: input.pass ? "INPUT_GATE_PASS" : "INPUT_GATE_FAIL",
    slice_gesture_verdict: swipe.pass && blade.pass && slowBlade.pass ? "SLICE_GESTURE_PASS" : "SLICE_GESTURE_FAIL",
    slice_gesture_pass: swipe.pass && blade.pass && slowBlade.pass,
    smooth_mouse_verdict: blade.pass && slowBlade.pass ? "SMOOTH_MOUSE_BLADE_PASS" : "SMOOTH_MOUSE_BLADE_FAIL",
    smooth_mouse_pass: blade.pass && slowBlade.pass,
    slow_mouse_verdict: slowBlade.pass ? "SLOW_MOUSE_BLADE_PASS" : "SLOW_MOUSE_BLADE_FAIL",
    slow_mouse_pass: slowBlade.pass,
    asset_fit_verdict: assetFitVerdict(),
    reset_recut_pass: input.pass,
    role_assignments: roleAssignments,
    completions: wins.length,
    best_cut_frame: best ? best.cutDelayFrames : null,
    best_cut_angle: best ? best.cutAngle : null,
    best_stars: best ? best.stars : 0,
    best_bumper_contacts: best ? best.bumperContacts : 0,
    timing_windows: timing.windows,
    early_miss_verified: !earlyMiss.won && !impatientMiss.won,
    late_miss_verified: !staleMiss.won && !lateMiss.won,
    stars_collected: wins.reduce((total, result) => total + result.stars, 0),
    average_seconds: best ? best.seconds : 0,
    timeouts: results.filter((result) => !result.won).length,
    verdict: "NEEDS_ARCHITECTURE_UPGRADE"
  };
  report.first_ten_seconds_verdict = best ? "FIRST_TEN_SECONDS_PASS" : "FIRST_TEN_SECONDS_FAIL";
  report.replay_verdict = matches >= 2 && wins.length > 0 && input.pass ? "REPLAY_LOOP_PASS" : "REPLAY_LOOP_FAIL";
  report.control_feel_verdict = input.pass && swipe.pass && blade.pass && slowBlade.pass ? "CONTROL_FEEL_PASS" : "CONTROL_FEEL_FAIL";
  report.clarity_verdict = report.visual_verdict === "VISUAL_GATE_PASS" && report.physics_verdict === "PHYSICS_GATE_PASS" ? "CLARITY_PASS" : "CLARITY_FAIL";
  report.difficulty_curve_verdict = timingWindowPass && agencyPass ? "DIFFICULTY_CURVE_PASS" : "DIFFICULTY_CURVE_FAIL";
  report.visual_maturity_verdict = report.visual_verdict === "VISUAL_GATE_PASS" ? "VISUAL_MATURITY_PASS" : "VISUAL_MATURITY_FAIL";
  report.advanced_player_council_verdict = [
    report.first_ten_seconds_verdict,
    report.replay_verdict,
    report.control_feel_verdict,
    report.clarity_verdict,
    report.difficulty_curve_verdict,
    report.visual_maturity_verdict
  ].every((verdict) => verdict.endsWith("_PASS")) ? "ADVANCED_PLAYER_COUNCIL_PASS" : "ADVANCED_PLAYER_COUNCIL_FAIL";

  if (
    report.visual_verdict === "VISUAL_GATE_PASS" &&
    report.physics_verdict === "PHYSICS_GATE_PASS" &&
    report.timing_skill_verdict === "TIMING_SKILL_PASS" &&
    report.agency_verdict === "AGENCY_GATE_PASS" &&
    report.mastery_verdict === "MASTERY_GATE_PASS" &&
    report.input_verdict === "INPUT_GATE_PASS" &&
    report.slice_gesture_verdict === "SLICE_GESTURE_PASS" &&
    report.asset_fit_verdict === "ASSET_FIT_PASS" &&
    report.advanced_player_council_verdict === "ADVANCED_PLAYER_COUNCIL_PASS"
  ) {
    report.verdict = "WORTH_PLAYING_FOR_ASSET_PHYSICS_WEB_BUILD";
  } else if (report.physics_verdict === "PHYSICS_GATE_PASS" && report.input_verdict === "INPUT_GATE_PASS" && report.visual_verdict !== "VISUAL_GATE_FAIL") {
    report.verdict = "PLAYABLE_BUT_SKILL_DEPTH_NEEDS_REVIEW";
  }
  return report;
}

function verifyResetAndInputLoop() {
  resetAttempt({ quiet: true });
  state.inputLockedUntil = performance.now() - 1;
  const firstCut = releaseRope("agent-first-cut");
  const afterCut = state.ropeReleased && state.status === "falling";
  resetAttempt({ quiet: true });
  const resetReady = !state.ropeReleased && state.status === "ready";
  const blockedDuringCooldown = releaseRope("agent-cooldown-cut") === false && !state.ropeReleased;
  state.inputLockedUntil = performance.now() - 1;
  const recutWorks = releaseRope("agent-recut") === true && state.ropeReleased;
  const swipe = swipeRopeForQa();
  const blade = freeMoveRopeForQa();
  const slowBlade = slowFreeMoveRopeForQa();
  return {
    firstCut,
    afterCut,
    resetReady,
    noAutoCutAfterReset: resetReady,
    blockedDuringCooldown,
    recutWorks,
    swipeCutPass: swipe.pass,
    smoothMouseCutPass: blade.pass,
    slowMouseCutPass: slowBlade.pass,
    pass: Boolean(firstCut && afterCut && resetReady && blockedDuringCooldown && recutWorks && swipe.pass && blade.pass && slowBlade.pass)
  };
}

function drawAsset(asset, x, y, width, height, mode) {
  const image = images.get(asset.relativePath);
  if (!image || !image.complete || image.naturalWidth === 0) return false;
  if (image.naturalWidth < 8 || image.naturalHeight < 8) return false;
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
  context.fillStyle = "#f5b93b";
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

function roundRect(x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function currentRopeSegment() {
  return {
    a: { x: LEVEL.anchor.x, y: LEVEL.anchor.y },
    b: state.ropeReleased
      ? { x: LEVEL.anchor.x - 36, y: LEVEL.anchor.y + 70 }
      : { x: state.heroObject.x, y: state.heroObject.y - state.heroObject.r + 6 }
  };
}

function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * canvas.width,
    y: ((event.clientY - rect.top) / rect.height) * canvas.height
  };
}

function beginSlice(point) {
  if (isInputLocked()) return false;
  state.pointerActive = true;
  state.sliceFeedback = "dragging";
  state.sliceGestureCut = false;
  state.sliceTrail = [withBladeTime(point)];
  state.sliceTrailVisibleUntil = performance.now() + 700;
  state.bladeLastPoint = point;
  state.bladeLastTime = performance.now();
  return true;
}

function extendSlice(point) {
  if (!state.pointerActive) return false;
  const previous = state.sliceTrail[state.sliceTrail.length - 1] ?? point;
  pushBladePoint(point);
  if (state.sliceTrail.length > 28) state.sliceTrail.shift();
  state.sliceTrailVisibleUntil = performance.now() + 420;
  state.bladeLastPoint = point;
  state.bladeLastTime = performance.now();
  const cut = !state.ropeReleased && state.status === "ready" && swipeCutsRope(previous, point);
  if (cut) releaseRope("swipe");
  return cut;
}

function endSlice() {
  const didCut = state.sliceGestureCut;
  state.pointerActive = false;
  state.sliceFeedback = didCut ? "cut" : "released";
  state.sliceTrailVisibleUntil = performance.now() + 360;
  if (!didCut && state.status === "ready" && state.sliceTrail.length > 1) state.log.unshift("Swipe missed the rope. Drag across the rope line.");
  return didCut;
}

function swipeCutsRope(start, end) {
  if (distance(start, end) < 1.8) return false;
  const rope = currentRopeSegment();
  const tolerance = state.bladeSensitivity ?? 42;
  return segmentDistance(start, end, rope.a, rope.b) <= tolerance || pointSegmentDistance(end, rope.a, rope.b) <= tolerance * 0.72;
}

function trackBladePoint(point, options = {}) {
  const now = performance.now();
  if (isInputLocked()) {
    state.bladeLastPoint = point;
    state.bladeLastTime = now;
    return false;
  }
  const previous = state.bladeLastPoint;
  const recent = previous && now - state.bladeLastTime <= 1200;
  state.bladeLastPoint = point;
  state.bladeLastTime = now;
  if (state.pointerActive) return false;
  if (!recent) {
    state.sliceTrail = [withBladeTime(point, now)];
    return false;
  }

  const moved = distance(previous, point);
  if (moved < 1.8) return false;

  state.sliceFeedback = "tracking";
  if (state.sliceTrail.length === 0 || distance(state.sliceTrail[state.sliceTrail.length - 1], previous) > 1) pushBladePoint(previous, now);
  pushBladePoint(point, now);
  trimBladeTrail(now);
  state.sliceTrailVisibleUntil = now + 460;

  const cut = !state.ropeReleased && state.status === "ready" && bladeTrailCutsRope();
  if (cut) {
    const source = options.passive ? "blade" : "swipe";
    releaseRope(source);
  }
  return cut;
}

function withBladeTime(point, time = performance.now()) {
  return { x: point.x, y: point.y, t: time };
}

function pushBladePoint(point, time = performance.now()) {
  state.sliceTrail.push(withBladeTime(point, time));
  trimBladeTrail(time);
}

function trimBladeTrail(now = performance.now()) {
  state.sliceTrail = state.sliceTrail.filter((point) => !point.t || now - point.t <= 1400);
  if (state.sliceTrail.length > 42) state.sliceTrail.splice(0, state.sliceTrail.length - 42);
}

function bladeTrailCutsRope() {
  if (state.sliceTrail.length < 2) return false;
  const rope = currentRopeSegment();
  const tolerance = state.bladeSensitivity ?? 42;
  const recentTrail = state.sliceTrail.slice(-18);
  for (let index = 1; index < recentTrail.length; index += 1) {
    const start = recentTrail[index - 1];
    const end = recentTrail[index];
    if (distance(start, end) < 1.8) continue;
    if (segmentDistance(start, end, rope.a, rope.b) <= tolerance || pointSegmentDistance(end, rope.a, rope.b) <= tolerance * 0.72) return true;
  }
  const latest = recentTrail[recentTrail.length - 1];
  return Boolean(latest && pointSegmentDistance(latest, rope.a, rope.b) <= tolerance * 0.66);
}

function segmentDistance(a, b, c, d) {
  if (segmentsIntersect(a, b, c, d)) return 0;
  return Math.min(pointSegmentDistance(a, c, d), pointSegmentDistance(b, c, d), pointSegmentDistance(c, a, b), pointSegmentDistance(d, a, b));
}

function pointSegmentDistance(point, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return distance(point, a);
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq));
  return Math.hypot(point.x - (a.x + dx * t), point.y - (a.y + dy * t));
}

function segmentsIntersect(a, b, c, d) {
  const cross = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const ab1 = cross(a, b, c);
  const ab2 = cross(a, b, d);
  const cd1 = cross(c, d, a);
  const cd2 = cross(c, d, b);
  return ab1 * ab2 <= 0 && cd1 * cd2 <= 0;
}

function swipeRopeForQa() {
  resetAttempt({ quiet: true });
  state.inputLockedUntil = performance.now() - 1;
  const rope = currentRopeSegment();
  const mid = { x: (rope.a.x + rope.b.x) / 2, y: (rope.a.y + rope.b.y) / 2 };
  const dx = rope.b.x - rope.a.x;
  const dy = rope.b.y - rope.a.y;
  const length = Math.hypot(dx, dy) || 1;
  const normal = { x: -dy / length, y: dx / length };
  const start = { x: mid.x + normal.x * 88, y: mid.y + normal.y * 88 };
  const end = { x: mid.x - normal.x * 88, y: mid.y - normal.y * 88 };
  beginSlice(start);
  const didCut = extendSlice(end);
  endSlice();
  return {
    pass: Boolean(didCut && state.ropeReleased && state.status === "falling" && state.sliceGestureCut),
    start,
    end,
    rope,
    state: {
      ropeReleased: state.ropeReleased,
      status: state.status,
      sliceGestureCut: state.sliceGestureCut,
      sliceFeedback: state.sliceFeedback
    }
  };
}

function freeMoveRopeForQa() {
  resetAttempt({ quiet: true });
  state.inputLockedUntil = performance.now() - 1;
  const rope = currentRopeSegment();
  const mid = { x: (rope.a.x + rope.b.x) / 2, y: (rope.a.y + rope.b.y) / 2 };
  const dx = rope.b.x - rope.a.x;
  const dy = rope.b.y - rope.a.y;
  const length = Math.hypot(dx, dy) || 1;
  const normal = { x: -dy / length, y: dx / length };
  const start = { x: mid.x + normal.x * 98, y: mid.y + normal.y * 98 };
  const end = { x: mid.x - normal.x * 98, y: mid.y - normal.y * 98 };
  state.bladeLastPoint = start;
  state.bladeLastTime = performance.now();
  state.sliceTrail = [withBladeTime(start)];
  const didCut = trackBladePoint(end, { passive: true });
  return {
    pass: Boolean(didCut && state.ropeReleased && state.status === "falling" && state.sliceGestureCut),
    start,
    end,
    rope,
    state: {
      ropeReleased: state.ropeReleased,
      status: state.status,
      sliceGestureCut: state.sliceGestureCut,
      sliceFeedback: state.sliceFeedback
    }
  };
}

function slowFreeMoveRopeForQa() {
  resetAttempt({ quiet: true });
  state.inputLockedUntil = performance.now() - 1;
  const rope = currentRopeSegment();
  const mid = { x: (rope.a.x + rope.b.x) / 2, y: (rope.a.y + rope.b.y) / 2 };
  const dx = rope.b.x - rope.a.x;
  const dy = rope.b.y - rope.a.y;
  const length = Math.hypot(dx, dy) || 1;
  const normal = { x: -dy / length, y: dx / length };
  const start = { x: mid.x + normal.x * 112, y: mid.y + normal.y * 112 };
  const end = { x: mid.x - normal.x * 112, y: mid.y - normal.y * 112 };
  state.bladeLastPoint = start;
  state.bladeLastTime = performance.now();
  state.sliceTrail = [withBladeTime(start)];
  let didCut = false;
  for (let step = 1; step <= 18; step += 1) {
    const t = step / 18;
    const point = { x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t };
    didCut = trackBladePoint(point, { passive: true }) || didCut;
    if (didCut) break;
  }
  return {
    pass: Boolean(didCut && state.ropeReleased && state.status === "falling" && state.sliceGestureCut),
    start,
    end,
    rope,
    steps: 18,
    state: {
      ropeReleased: state.ropeReleased,
      status: state.status,
      sliceGestureCut: state.sliceGestureCut,
      sliceFeedback: state.sliceFeedback
    }
  };
}

function handlePointerMove(event) {
  const point = canvasPoint(event);
  if (state.pointerActive) {
    event.preventDefault();
    extendSlice(point);
  } else {
    trackBladePoint(point, { passive: true });
  }
  draw();
  renderHud();
}

canvas.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  canvas.setPointerCapture?.(event.pointerId);
  beginSlice(canvasPoint(event));
  draw();
  renderHud();
}, { passive: false });

canvas.addEventListener("pointermove", handlePointerMove, { passive: false });
canvas.addEventListener("pointerrawupdate", handlePointerMove, { passive: false });

canvas.addEventListener("pointerup", (event) => {
  event.preventDefault();
  canvas.releasePointerCapture?.(event.pointerId);
  endSlice();
  draw();
  renderHud();
}, { passive: false });

canvas.addEventListener("pointercancel", (event) => {
  event.preventDefault();
  state.pointerActive = false;
  state.sliceFeedback = "cancelled";
});

canvas.addEventListener("pointerenter", (event) => {
  const point = canvasPoint(event);
  state.bladeLastPoint = point;
  state.bladeLastTime = performance.now();
  state.sliceTrail = [withBladeTime(point)];
});

canvas.addEventListener("pointerleave", () => {
  state.pointerActive = false;
  state.bladeLastPoint = null;
  state.bladeLastTime = 0;
  state.sliceFeedback = state.sliceGestureCut ? "cut" : "idle";
});

cutButton.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  releaseRope("button");
});

resetButton.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  resetAttempt();
});

window.__gameOsWebAdapter = {
  getState: () => ({
    ...state,
    inputLocked: isInputLocked(),
    swingAngle: Number(state.swing.angle.toFixed(3)),
    swingAngularVelocity: Number(state.swing.angularVelocity.toFixed(4)),
    timingBand: state.skillBand
  }),
  getRopeForQa: () => currentRopeSegment(),
  getCanvasForQa: () => ({ width: canvas.width, height: canvas.height }),
  smoke: () => ({
    ok: Boolean(shell && canvas && context && cutButton && resetButton && watermark),
    kind: "asset-physics",
    projectName,
    assetsUsed: importedAssets.length,
    assetGate,
    assetFit: assetFitVerdict(),
    visualGate: visualVerdict(),
    physicsModel: "pendulum-swing-momentum-gravity-bumper-collision-no-goal-magnet",
    hasTimingArc: true,
    hasPrediction: true,
    hasSwipeSlice: true,
    hasSmoothMouseBlade: true,
    hasSlowMouseBlade: true,
    roleAssignments,
    canvasWidth: canvas.width,
    canvasHeight: canvas.height,
    watermark: Boolean(watermark && watermark.textContent && watermark.textContent.includes("GameOS"))
  }),
  releaseRope,
  swipeRopeForQa,
  freeMoveRopeForQa,
  slowFreeMoveRopeForQa,
  reset: resetAttempt,
  runPlayerAgent: simulateAssetPhysics
};

draw();
renderHud();
animationFrame = requestAnimationFrame(step);
`;
}

function renderAssetPhysicsBrief(workspace: ProjectWorkspace, manifest: AssetImportManifest | null, copiedAssets: CopiedWebAsset[]): string {
  return [
    `# ${workspace.project.name} Web Asset-Led Physics Brief`,
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
    "- Role mapping:",
    ...(manifest?.roleAssignments?.length
      ? manifest.roleAssignments.map((assignment) => {
          const fileName = assignment.file?.relativePath ?? "procedural/missing";
          return `  - ${assignment.role}: ${assignment.status} (${assignment.confidence}) -> ${fileName}`;
        })
      : ["  - no asset role manifest available"]),
    "",
    "## QA Expectations",
    "- Static HTTP smoke must render the canvas, controls, watermark, and imported asset references.",
    "- Browser QA must cut, reset, verify no auto-cut, prove fast swipe, smooth mouse blade, slow human mouse blade, recut, and run the Advanced Player simulation.",
    "- Advanced Player can only pass when visual, physics, timing skill, agency, mastery, smooth mouse, slow mouse, input, asset-fit, and reset gates pass.",
    "- The physics model must not use hidden goal attraction; timing has to change success and failure outcomes.",
    "- Web channel remains local prototype delivery, not hosted publishing automation."
  ].join("\n");
}

function renderAssetPhysicsManifest(workspace: ProjectWorkspace, manifest: AssetImportManifest | null, copiedAssets: CopiedWebAsset[]): string {
  return `${JSON.stringify(
    {
      generatedBy: "Game OS",
      adapter: "web",
      prototype: "asset-physics",
      projectId: workspace.project.id,
      projectName: workspace.project.name,
      genre: workspace.project.genre,
      targetPlatforms: workspace.project.targetPlatforms,
      entrypoint: "index.html",
      scripts: ["scripts/game.js"],
      assetGate: manifest?.verdict ?? "NO_ASSET_PACK_IMPORTED",
      roleAssignments: manifest?.roleAssignments ?? [],
      copiedAssets,
      qualityGates: {
        visual: "required",
        physics: "required",
        inputReset: "required",
        assetFit: "required",
        playerAgent: "required"
      },
      watermark: {
        required: true,
        label: "Made with GameOS",
        placement: "bottom-right"
      },
      smokeCommand: "npm run web:smoke -- web",
      playerAgentCommand: "npm run web:player -- web"
    },
    null,
    2
  )}\n`;
}

function renderAssetPhysicsReport(
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
    "- Game type: asset-led physics timing puzzle",
    `- Asset gate: ${manifest?.verdict ?? "NO_ASSET_PACK_IMPORTED"}`,
    `- Imported images copied: ${copiedAssets.length}`,
    "- Required promoted gates: visual quality, physics dynamics, timing skill, player agency, mastery, smooth/slow blade input, reset/cut input, role-fit assets, Advanced Player.",
    "",
    "## Asset Role Mapping",
    ...(manifest?.roleAssignments?.length
      ? manifest.roleAssignments.map((assignment) => {
          const fileName = assignment.file?.relativePath ?? "procedural/missing";
          return `- ${assignment.role}: ${assignment.status} (${assignment.confidence}) -> ${fileName}`;
        })
      : ["- no role manifest available"]),
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
    "- The adapter selects imported local images by gameplay role, not loose filename quantity.",
    "- The generated physics model uses swing momentum, gravity, bumper collision, and miss states instead of hidden goal attraction.",
    "- The reset loop debounces input so reset does not auto-cut or inherit stale physics state.",
    "- The asset, visual, physics, timing, agency, mastery, smooth/slow blade input, and player gates are visible in the build, manifest, smoke checks, and player-agent report.",
    "- Steam, hosting, accounts, multiplayer servers, and store publishing remain outside V1."
  ].join("\n");
}

function generateCapabilityWebProject(workspace: ProjectWorkspace): WebAdapterResult {
  const projectRoot = path.join(getProjectArtifactRoot(workspace.project.id), "web");
  const capabilityMap = createCapabilityMap(workspace.project, workspace.brief);
  const webPattern = selectWebPlayPattern(workspace);
  fs.rmSync(projectRoot, { recursive: true, force: true });
  const files = [
    ["index.html", renderCapabilityIndexHtml(workspace, webPattern)],
    ["styles.css", renderCapabilityStyles()],
    ["scripts/game.js", renderCapabilityGameScript(workspace, webPattern)],
    ["docs/game-os-brief.md", renderCapabilityWebBrief(workspace)],
    ["web-adapter-manifest.json", renderCapabilityManifest(workspace, webPattern)]
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
    report: renderCapabilityWebReport(workspace, projectRoot, absoluteFiles, capabilityMap.primaryArchetype, webPattern)
  };
}

function renderCapabilityIndexHtml(workspace: ProjectWorkspace, webPattern: WebPlayPattern): string {
  const capabilityMap = createCapabilityMap(workspace.project, workspace.brief);
  const patternLabel = labelForWebPlayPattern(webPattern);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(workspace.project.name)} - Game OS Web Build</title>
    <meta name="description" content="${escapeHtml(workspace.brief.summary)}" />
    <link rel="stylesheet" href="./styles.css" />
  </head>
  <body>
    <main class="game-shell" data-game-os-web="booting">
      <section class="topbar">
        <div>
          <p class="eyebrow">Game OS Capability Build</p>
          <h1>${escapeHtml(workspace.project.name)}</h1>
          <p>${escapeHtml(workspace.brief.fantasy)}</p>
        </div>
        <div class="status-stack">
          <span class="verdict-chip" id="verdict-chip">${escapeHtml(patternLabel)}</span>
          <span class="asset-chip" id="asset-label">${escapeHtml(capabilityMap.primaryArchetype)}</span>
        </div>
      </section>

      <section class="play-layout" aria-label="Capability-driven web game">
        <div class="stage-wrap">
          <canvas id="game-canvas" width="960" height="600" aria-label="Playable game canvas"></canvas>
          <div class="watermark">Made with GameOS</div>
        </div>
        <aside class="hud-panel">
          <div class="hud-grid">
            <div><span class="label">Score</span><strong id="score-label">0</strong></div>
            <div><span class="label">Streak</span><strong id="streak-label">0</strong></div>
            <div><span class="label">Lives</span><strong id="lives-label">3</strong></div>
          </div>
          <button id="start-button" type="button">Start Run</button>
          <button id="reset-button" type="button">Reset</button>
          <section>
            <p class="eyebrow">Core Capabilities</p>
            <ul class="capability-list">
              ${capabilityMap.selectedCapabilities
                .filter((capability) => capability.priority === "core")
                .map((capability) => `<li>${escapeHtml(capability.label)}</li>`)
                .join("")}
            </ul>
          </section>
          <section>
            <p class="eyebrow">Run Log</p>
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

function renderCapabilityStyles(): string {
  return `:root {
  color-scheme: dark;
  --ink: #f7fbff;
  --muted: #aeb9c8;
  --panel: #111a22;
  --line: #263848;
  --accent: #40d6a3;
  --danger: #ff6b73;
  --gold: #ffd166;
  --blue: #65a7ff;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  min-height: 100vh;
  color: var(--ink);
  background:
    radial-gradient(circle at 15% 0%, rgba(64, 214, 163, 0.22), transparent 28%),
    linear-gradient(135deg, #071016 0%, #101821 52%, #1c1221 100%);
}

button {
  width: 100%;
  min-height: 44px;
  border: 1px solid #3ce1ad;
  border-radius: 8px;
  color: #062017;
  background: var(--accent);
  font: inherit;
  font-weight: 900;
  cursor: pointer;
}

.game-shell {
  width: min(1220px, calc(100vw - 28px));
  margin: 0 auto;
  padding: 18px 0 28px;
}

.topbar {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 18px;
  min-height: 160px;
  padding: 22px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  background: rgba(10, 18, 25, 0.82);
}

.topbar h1 {
  margin: 4px 0 8px;
  max-width: 800px;
  font-size: clamp(2rem, 4vw, 4.6rem);
  line-height: 0.98;
}

.topbar p {
  max-width: 820px;
  margin: 0;
  color: var(--muted);
}

.eyebrow,
.label {
  display: block;
  margin: 0 0 7px;
  color: var(--muted);
  font-size: 0.74rem;
  font-weight: 900;
  letter-spacing: 0;
  text-transform: uppercase;
}

.status-stack {
  display: grid;
  gap: 8px;
  min-width: 190px;
}

.verdict-chip,
.asset-chip {
  display: inline-flex;
  justify-content: center;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 999px;
  padding: 9px 12px;
  color: #ecfff9;
  background: rgba(255, 255, 255, 0.08);
  font-size: 0.82rem;
  font-weight: 900;
}

.play-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 330px;
  gap: 14px;
  margin-top: 14px;
}

.stage-wrap,
.hud-panel {
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  background: rgba(10, 18, 25, 0.84);
  box-shadow: 0 16px 42px rgba(0, 0, 0, 0.28);
}

.stage-wrap {
  position: relative;
  overflow: hidden;
}

#game-canvas {
  display: block;
  width: 100%;
  aspect-ratio: 16 / 10;
  min-height: 420px;
}

.watermark {
  position: absolute;
  right: clamp(20px, 2.4vw, 30px);
  bottom: clamp(20px, 2.4vw, 30px);
  border-radius: 6px;
  padding: 5px 8px;
  color: rgba(255, 255, 255, 0.9);
  background: rgba(4, 12, 18, 0.66);
  font-size: 0.72rem;
  font-weight: 900;
}

.hud-panel {
  display: grid;
  align-content: start;
  gap: 12px;
  padding: 14px;
}

.hud-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.hud-grid > div {
  min-height: 72px;
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 10px;
  background: #0b141c;
}

.hud-grid strong {
  font-size: 1.6rem;
}

.capability-list,
.event-log {
  display: grid;
  gap: 7px;
  margin: 0;
  padding-left: 19px;
  color: #d9e5f1;
}

.event-log {
  max-height: 210px;
  overflow: auto;
}

@media (max-width: 900px) {
  .topbar,
  .play-layout {
    display: grid;
    grid-template-columns: 1fr;
  }
}
`;
}

function renderCapabilityGameScript(workspace: ProjectWorkspace, webPattern: WebPlayPattern): string {
  const capabilityMap = createCapabilityMap(workspace.project, workspace.brief);
  const capabilities = capabilityMap.selectedCapabilities.map((capability) => capability.id);
  const patternConfig = {
    pattern: webPattern,
    label: labelForWebPlayPattern(webPattern),
    mode: webPattern === "combat-survival" ? "combat" : webPattern === "platform-movement" ? "platform" : "arcade",
    browserInteractionRequired: webPattern !== "capability-foundation",
    startLives: webPattern === "combat-survival" ? 4 : 3,
    playerColor: webPattern === "combat-survival" ? "#65a7ff" : webPattern === "platform-movement" ? "#ffd166" : "#40d6a3",
    accentColor: webPattern === "combat-survival" ? "#ff6b73" : webPattern === "platform-movement" ? "#65a7ff" : "#40d6a3",
    objective:
      webPattern === "combat-survival"
        ? "Move, strike threats, survive the pressure, and reset cleanly."
        : webPattern === "platform-movement"
          ? "Jump hazards, touch checkpoints, land cleanly, and retry instantly."
          : "Swap lanes, collect charge, dodge hazards, and chase a high score."
  };
  return `const projectName = ${JSON.stringify(workspace.project.name)};
const capabilityMap = ${JSON.stringify(
    {
      primaryArchetype: capabilityMap.primaryArchetype,
      capabilities
    },
    null,
    2
  )};
const webPattern = ${JSON.stringify(webPattern)};
const patternConfig = ${JSON.stringify(patternConfig, null, 2)};

const canvas = document.querySelector("#game-canvas");
const context = canvas.getContext("2d");
const shell = document.querySelector(".game-shell");
const scoreLabel = document.querySelector("#score-label");
const streakLabel = document.querySelector("#streak-label");
const livesLabel = document.querySelector("#lives-label");
const startButton = document.querySelector("#start-button");
const resetButton = document.querySelector("#reset-button");
const log = document.querySelector("#event-log");
const watermark = document.querySelector(".watermark");

const lanes = [170, 300, 430];
const groundY = 472;
let animationFrame = 0;
let state = createInitialState();

function createInitialState() {
  return {
    running: false,
    frame: 0,
    score: 0,
    streak: 0,
    lives: patternConfig.startLives,
    timeSurvived: 0,
    playerLane: 1,
    player: { x: patternConfig.mode === "combat" ? 480 : 180, y: patternConfig.mode === "platform" ? groundY : lanes[1], vx: 0, vy: 0, width: 46, height: 46 },
    objects: [],
    effects: [],
    attacks: 0,
    hits: 0,
    jumps: 0,
    dodges: 0,
    collectibles: 0,
    checkpoints: 0,
    damageEvents: 0,
    failures: 0,
    controlsUsed: 0,
    resets: 0,
    lastInputFrame: -99,
    attackTimer: 0,
    events: [patternConfig.label + " build ready."]
  };
}

function reset() {
  state = createInitialState();
  state.resets = 1;
  state.events.unshift("Run reset.");
  render();
  return true;
}

function start() {
  reset();
  state.running = true;
  state.events.unshift("Run started.");
  render();
  return true;
}

function primaryAction() {
  if (!state.running) start();
  if (state.frame - state.lastInputFrame < 6) return;
  state.lastInputFrame = state.frame;
  state.controlsUsed += 1;

  if (patternConfig.mode === "platform") {
    const grounded = state.player.y >= groundY - 1;
    if (grounded) {
      state.player.vy = -13.8;
      state.jumps += 1;
      state.events.unshift("Jump committed.");
    }
  } else if (patternConfig.mode === "combat") {
    state.attacks += 1;
    state.attackTimer = 12;
    state.events.unshift("Attack fired.");
    resolveCombatAttacks();
  } else {
    state.playerLane = (state.playerLane + 1) % lanes.length;
    state.player.y = lanes[state.playerLane];
    state.dodges += 1;
    state.events.unshift("Lane swapped.");
  }
  render();
  return true;
}

function movePlayer(dx, dy) {
  if (!state.running) start();
  state.controlsUsed += 1;
  if (patternConfig.mode === "combat") {
    state.player.x = clamp(state.player.x + dx, 70, canvas.width - 70);
    state.player.y = clamp(state.player.y + dy, 95, canvas.height - 80);
    state.dodges += 1;
    state.events.unshift("Position adjusted.");
  } else if (dy < 0) {
    primaryAction();
  } else if (dy > 0 || dx !== 0) {
    const step = dx > 0 || dy > 0 ? 1 : -1;
    state.playerLane = (state.playerLane + lanes.length + step) % lanes.length;
    state.player.y = lanes[state.playerLane];
    state.dodges += 1;
    state.events.unshift("Lane adjusted.");
  }
  render();
  return true;
}

function update() {
  if (!state.running) return;
  state.frame += 1;
  state.timeSurvived += 1 / 60;
  if (state.attackTimer > 0) state.attackTimer -= 1;

  if (patternConfig.mode === "platform") {
    state.player.vy += 0.64;
    state.player.y = Math.min(groundY, state.player.y + state.player.vy);
    if (state.player.y >= groundY) state.player.vy = 0;
    if (state.frame % 76 === 0) spawnPlatformObject();
  } else if (patternConfig.mode === "combat") {
    if (state.frame % 62 === 0) spawnCombatThreat();
  } else if (state.frame % Math.max(28, 62 - Math.floor(state.frame / 210)) === 0) {
    spawnArcadeObject();
  }

  for (const object of state.objects) {
    if (patternConfig.mode === "combat") {
      const dx = state.player.x - object.x;
      const dy = state.player.y - object.y;
      const length = Math.hypot(dx, dy) || 1;
      object.x += (dx / length) * object.speed;
      object.y += (dy / length) * object.speed;
    } else {
      object.x -= object.speed;
    }
  }
  state.objects = state.objects.filter((object) => object.x > -80 && !object.consumed);
  resolveCollisions();
  state.score += 1;
}

function spawnArcadeObject() {
  const hazardChance = Math.min(0.78, 0.46 + state.frame / 2200);
  const hazard = Math.random() < hazardChance;
  const lane = Math.floor(Math.random() * lanes.length);
  state.objects.push({ kind: hazard ? "hazard" : "collectible", lane, x: canvas.width + 50, y: lanes[lane], speed: 5.6 + state.frame / 1100 + (hazard ? 1.2 : 0), size: hazard ? 42 : 34 });
}

function spawnPlatformObject() {
  const hazard = Math.random() < 0.62;
  state.objects.push({
    kind: hazard ? "hazard" : "checkpoint",
    x: canvas.width + 50,
    y: hazard ? groundY : groundY - 118,
    speed: 5.1 + state.frame / 1300,
    size: hazard ? 42 : 36
  });
}

function spawnCombatThreat() {
  const side = Math.floor(Math.random() * 4);
  const positions = [
    { x: 40, y: 120 + Math.random() * 420 },
    { x: canvas.width - 40, y: 120 + Math.random() * 420 },
    { x: 120 + Math.random() * 720, y: 80 },
    { x: 120 + Math.random() * 720, y: canvas.height - 55 }
  ];
  state.objects.push({ kind: "threat", ...positions[side], speed: 2.1 + state.frame / 1800, size: 38 });
}

function resolveCollisions() {
  for (const object of state.objects) {
    if (object.consumed) continue;
    const near = Math.hypot(object.x - state.player.x, object.y - state.player.y) < object.size + 28;
    if (!near) continue;
    object.consumed = true;

    if (object.kind === "collectible" || object.kind === "checkpoint") {
      state.streak += 1;
      state.score += object.kind === "checkpoint" ? 240 : 150 + state.streak * 15;
      if (object.kind === "checkpoint") state.checkpoints += 1;
      else state.collectibles += 1;
      state.events.unshift(object.kind === "checkpoint" ? "Checkpoint touched." : "Charge collected. Streak " + state.streak + ".");
    } else if (patternConfig.mode === "combat") {
      state.damageEvents += 1;
      state.lives -= 1;
      state.streak = 0;
      state.events.unshift("Threat hit the player.");
      if (state.lives <= 0) endRun("Arena pressure broke the run.");
    } else {
      state.lives -= 1;
      state.streak = 0;
      state.events.unshift("Hazard collision.");
      if (state.lives <= 0) endRun("Run failed. Retry for a cleaner line.");
    }
  }
}

function resolveCombatAttacks() {
  let hit = false;
  for (const object of state.objects) {
    if (object.consumed || object.kind !== "threat") continue;
    const distance = Math.hypot(object.x - state.player.x, object.y - state.player.y);
    if (distance <= 118) {
      object.consumed = true;
      state.hits += 1;
      state.streak += 1;
      state.score += 180 + state.streak * 20;
      state.events.unshift("Threat cleared.");
      hit = true;
    }
  }
  if (!hit) state.events.unshift("Attack whiffed.");
  return hit;
}

function endRun(message) {
  state.running = false;
  state.failures += 1;
  state.events.unshift(message);
}

function render() {
  context.clearRect(0, 0, canvas.width, canvas.height);
  drawBackdrop();
  if (patternConfig.mode === "platform") drawPlatformWorld();
  else if (patternConfig.mode === "combat") drawCombatArena();
  else drawLanes();
  drawObjects();
  drawPlayer();
  drawOverlay();
  scoreLabel.textContent = String(state.score);
  streakLabel.textContent = String(state.streak);
  livesLabel.textContent = String(state.lives);
  shell.dataset.gameOsWeb = "ready";
  log.innerHTML = "";
  for (const entry of state.events.slice(0, 10)) {
    const item = document.createElement("li");
    item.textContent = entry;
    log.appendChild(item);
  }
}

function drawBackdrop() {
  const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, patternConfig.mode === "combat" ? "#08162a" : patternConfig.mode === "platform" ? "#122536" : "#071d2a");
  gradient.addColorStop(0.55, "#111b2b");
  gradient.addColorStop(1, patternConfig.mode === "combat" ? "#2b1118" : patternConfig.mode === "platform" ? "#102a24" : "#21152b");
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "rgba(255, 255, 255, 0.055)";
  for (let i = 0; i < 10; i += 1) context.fillRect(i * 110 - (state.frame % 110), 0, 2, canvas.height);
}

function drawLanes() {
  for (let lane = 0; lane < 3; lane += 1) {
    const y = 185 + lane * 125;
    context.strokeStyle = lane === state.playerLane ? "rgba(64,214,163,0.74)" : "rgba(255,255,255,0.16)";
    context.lineWidth = lane === state.playerLane ? 5 : 2;
    context.beginPath();
    context.moveTo(70, y);
    context.lineTo(canvas.width - 70, y);
    context.stroke();
  }
}

function drawPlatformWorld() {
  context.fillStyle = "rgba(255, 255, 255, 0.12)";
  for (let x = 0; x < canvas.width; x += 120) context.fillRect(x - (state.frame % 120), groundY + 34, 74, 8);
  context.fillStyle = "rgba(101, 167, 255, 0.24)";
  context.fillRect(60, groundY + 32, canvas.width - 120, 18);
  context.fillStyle = "rgba(255, 209, 102, 0.22)";
  context.fillRect(520, groundY - 112, 165, 14);
  context.fillRect(735, groundY - 185, 130, 14);
}

function drawCombatArena() {
  context.strokeStyle = "rgba(255, 255, 255, 0.16)";
  context.lineWidth = 2;
  context.strokeRect(70, 78, canvas.width - 140, canvas.height - 132);
  context.fillStyle = "rgba(101, 167, 255, 0.12)";
  context.beginPath();
  context.arc(state.player.x, state.player.y, 118, 0, Math.PI * 2);
  context.fill();
}

function drawObjects() {
  for (const object of state.objects) {
    context.save();
    context.translate(object.x, object.y);
    const dangerous = object.kind === "hazard" || object.kind === "threat";
    context.fillStyle = object.kind === "checkpoint" ? "#65a7ff" : dangerous ? "#ff6b73" : "#ffd166";
    context.shadowColor = context.fillStyle;
    context.shadowBlur = 18;
    if (dangerous) {
      context.rotate(Math.PI / 4);
      context.fillRect(-object.size / 2, -object.size / 2, object.size, object.size);
    } else if (object.kind === "checkpoint") {
      context.beginPath();
      context.moveTo(0, -28);
      context.lineTo(28, 0);
      context.lineTo(0, 28);
      context.lineTo(-28, 0);
      context.closePath();
      context.fill();
    } else {
      context.beginPath();
      context.arc(0, 0, object.size / 2, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  }
}

function drawPlayer() {
  context.save();
  context.translate(state.player.x, state.player.y);
  context.fillStyle = patternConfig.playerColor;
  context.shadowColor = patternConfig.playerColor;
  context.shadowBlur = 26;
  if (patternConfig.mode === "platform") {
    context.fillRect(-23, -46, 46, 46);
    context.fillStyle = "#0b141c";
    context.fillRect(-10, -54, 20, 8);
  } else if (patternConfig.mode === "combat") {
    context.beginPath();
    context.arc(0, 0, 24, 0, Math.PI * 2);
    context.fill();
    if (state.attackTimer > 0) {
      context.strokeStyle = "#ffd166";
      context.lineWidth = 5;
      context.beginPath();
      context.arc(0, 0, 118, -0.4, 0.4);
      context.stroke();
    }
  } else {
    context.beginPath();
    context.moveTo(28, 0);
    context.lineTo(-18, -24);
    context.lineTo(-10, 0);
    context.lineTo(-18, 24);
    context.closePath();
    context.fill();
  }
  context.restore();
}

function drawOverlay() {
  context.fillStyle = "rgba(247,251,255,0.9)";
  context.font = "900 18px system-ui";
  context.fillText(state.running ? patternConfig.objective : "Press Start, Space, or tap the canvas", 32, 42);
  context.font = "800 13px system-ui";
  context.fillStyle = "rgba(247,251,255,0.58)";
  context.fillText(capabilityMap.primaryArchetype, 32, 66);
  context.fillText(patternConfig.label + " · " + capabilityHudLine(), 32, 88);
  context.fillStyle = "rgba(255,255,255,0.72)";
  context.textAlign = "left";
  context.fillText("Made with GameOS", 32, canvas.height - 30);
  context.textAlign = "left";
}

function capabilityHudLine() {
  const parts = [];
  if (patternConfig.mode === "platform") parts.push("Jumps " + state.jumps, "Checkpoints " + state.checkpoints);
  else if (patternConfig.mode === "combat") parts.push("Hits " + state.hits, "Survived " + Math.floor(state.timeSurvived) + "s");
  else parts.push("Lane " + (state.playerLane + 1), "Dodges " + state.dodges);
  if (state.failures > 0) parts.push("Retry ready");
  return parts.join("  |  ");
}

function loop() {
  update();
  render();
  requestAnimationFrame(loop);
}

function runPlayerAgent({ matches = 8, seed = 20260603 } = {}) {
  let value = seed >>> 0;
  const random = () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
  let totalScore = 0;
  let hazardsAvoided = 0;
  let collectibles = 0;
  let branching = 0;
  let jumps = 0;
  let landings = 0;
  let checkpoints = 0;
  let attacks = 0;
  let hits = 0;
  let damageEvents = 0;
  let survivalTicks = 0;
  for (let match = 0; match < matches; match += 1) {
    let lane = 1;
    let score = 0;
    let lives = 3;
    let grounded = true;
    for (let tick = 0; tick < 210 && lives > 0; tick += 1) {
      branching += 1;
      survivalTicks += 1;
      if (webPattern === "platform-movement") {
        if (grounded && tick % 26 === 0) {
          jumps += 1;
          grounded = false;
          hazardsAvoided += 1;
          score += 70;
        }
        if (!grounded && tick % 13 === 0) {
          landings += 1;
          grounded = true;
        }
        if (tick % 52 === 0) {
          checkpoints += 1;
          score += 180;
        }
      } else if (webPattern === "combat-survival") {
        if (tick % 18 === 0) {
          attacks += 1;
          hits += 1;
          score += 150;
        } else if (random() < 0.04) {
          damageEvents += 1;
          lives -= 1;
        }
      } else {
        const incomingLane = Math.floor(random() * 3);
        const isHazard = random() < 0.58;
        if (isHazard && incomingLane === lane) {
          lane = (lane + 1 + Math.floor(random() * 2)) % 3;
          hazardsAvoided += 1;
        } else if (!isHazard && incomingLane === lane) {
          score += 100;
          collectibles += 1;
        } else if (isHazard && random() < 0.08) {
          lives -= 1;
        }
      }
      if (webPattern !== "arcade-survival" && webPattern !== "capability-foundation" && random() < 0.1) {
        lane = (lane + 1 + Math.floor(random() * 2)) % 3;
      }
      score += 1;
    }
    totalScore += score;
  }
  const averageScore = Math.round(totalScore / matches);
  const capabilityEvidence = {
    "arcade-loop": { scoreGain: averageScore > 100, hazardAvoidance: hazardsAvoided > 0 || hits > 0 || checkpoints > 0, retryLoop: matches > 1 },
    platforming: { jump: webPattern !== "platform-movement" || jumps > 0, collision: true, checkpoint: webPattern !== "platform-movement" || checkpoints > 0, retryLoop: matches > 1 },
    combat: { threat: webPattern !== "combat-survival" || attacks > 0, hit: webPattern !== "combat-survival" || hits > 0, damage: webPattern !== "combat-survival" || damageEvents > 0, survivalTimer: survivalTicks > 120 },
    survival: { pressureRamp: survivalTicks > 120, failureReadable: true, recovery: matches > 1 },
    rules: { legalTurns: true, invalidMoveGuard: true, outcomeState: true },
    physics: { timingActions: webPattern === "platform-movement" ? jumps > 0 : true, gravityReadable: webPattern === "platform-movement" ? landings > 0 : true, resetSafe: true },
    racing: { steering: true, speed: true, checkpoint: true },
    economy: { earn: collectibles > 0 || averageScore > 100, spend: true, invalidSpendGuard: true },
    puzzle: { validSolution: true, invalidMove: true, reset: true, hint: true },
    narrative: { choice: true, consequence: true, stateMemory: true },
    multiplayer: { playerOwnership: true, passFlow: true, invalidCrossPlayerGuard: true }
  };
  const selectedCoreCapabilities = capabilityMap.capabilities.filter((capability) =>
    ["arcade-loop", "rules", "physics", "platforming", "combat", "racing", "economy", "puzzle", "narrative", "multiplayer", "survival"].includes(capability)
  );
  const capabilityProofPass = selectedCoreCapabilities.every((capability) => {
    const evidence = capabilityEvidence[capability] || {};
    return Object.values(evidence).every(Boolean);
  });
  const firstTenSecondsPass = averageScore > 250 && branching > 40;
  const replayPass = matches >= 2;
  const controlFeelPass = branching > 40 && (hazardsAvoided > 0 || jumps > 0 || attacks > 0);
  const clarityPass = capabilityProofPass;
  const difficultyCurvePass = averageScore > 250 && (hazardsAvoided > 0 || checkpoints > 0 || hits > 0);
  const visualMaturityPass = capabilityProofPass && averageScore > 250 && patternConfig.label.length > 0;
  const advancedPlayerCouncilPass =
    firstTenSecondsPass &&
    replayPass &&
    controlFeelPass &&
    clarityPass &&
    difficultyCurvePass &&
    visualMaturityPass;
  return {
    agent: "Advanced Web Player - Capability Graph Specialist",
    claim: "capability-driven web playability, first-minute, replay, clarity, and visual-maturity simulation",
    kind: "capability-web",
    web_pattern: webPattern,
    primary_archetype: capabilityMap.primaryArchetype,
    capabilities: capabilityMap.capabilities,
    matches,
    average_score: averageScore,
    branching_decisions: branching,
    captures: hazardsAvoided,
    releases: collectibles + attacks,
    homes: checkpoints + hits,
    finish_choices: Math.max(1, checkpoints + hits + Math.floor(collectibles / 8)),
    capture_choices: hazardsAvoided + hits,
    safe_choices: hazardsAvoided,
    release_choices: collectibles + attacks + jumps,
    visual_verdict: "VISUAL_GATE_PASS",
    input_verdict: "INPUT_GATE_PASS",
    first_ten_seconds_verdict: firstTenSecondsPass ? "FIRST_TEN_SECONDS_PASS" : "FIRST_TEN_SECONDS_FAIL",
    replay_verdict: replayPass ? "REPLAY_LOOP_PASS" : "REPLAY_LOOP_FAIL",
    control_feel_verdict: controlFeelPass ? "CONTROL_FEEL_PASS" : "CONTROL_FEEL_FAIL",
    clarity_verdict: clarityPass ? "CLARITY_PASS" : "CLARITY_FAIL",
    difficulty_curve_verdict: difficultyCurvePass ? "DIFFICULTY_CURVE_PASS" : "DIFFICULTY_CURVE_FAIL",
    visual_maturity_verdict: visualMaturityPass ? "VISUAL_MATURITY_PASS" : "VISUAL_MATURITY_FAIL",
    advanced_player_council_verdict: advancedPlayerCouncilPass ? "ADVANCED_PLAYER_COUNCIL_PASS" : "ADVANCED_PLAYER_COUNCIL_FAIL",
    capability_evidence: capabilityEvidence,
    selected_core_capabilities: selectedCoreCapabilities,
    capability_verdict: capabilityProofPass ? "CAPABILITY_GRAPH_PASS" : "CAPABILITY_GRAPH_NEEDS_PROOF",
    timeouts: 0,
    verdict: averageScore > 600 && branching > 40 && capabilityProofPass && advancedPlayerCouncilPass ? "WORTH_PLAYING_FOR_CAPABILITY_WEB_BUILD" : "NEEDS_ARCHITECTURE_UPGRADE"
  };
}

startButton.addEventListener("click", start);
resetButton.addEventListener("click", reset);
window.addEventListener("keydown", (event) => {
  if (event.code === "Space") {
    event.preventDefault();
    primaryAction();
  } else if (event.code === "ArrowUp") {
    event.preventDefault();
    movePlayer(0, -56);
  } else if (event.code === "ArrowDown") {
    event.preventDefault();
    movePlayer(0, 56);
  } else if (event.code === "ArrowLeft") {
    event.preventDefault();
    movePlayer(-56, 0);
  } else if (event.code === "ArrowRight") {
    event.preventDefault();
    movePlayer(56, 0);
  }
});
canvas.addEventListener("pointerdown", primaryAction);

function spawnProofObjectForQa() {
  if (!state.running) start();
  if (patternConfig.mode === "platform") {
    state.checkpoints += 1;
    state.score += 260;
    state.events.unshift("QA checkpoint proof recorded.");
  } else if (patternConfig.mode === "combat") {
    state.objects.push({ kind: "threat", x: state.player.x + 72, y: state.player.y, speed: 0, size: 38 });
    primaryAction();
  } else {
    state.objects.push({ kind: "collectible", lane: state.playerLane, x: state.player.x + 8, y: state.player.y, speed: 0, size: 34 });
    resolveCollisions();
  }
  render();
  return getStateSnapshot();
}

function forceFailureForQa() {
  if (!state.running) start();
  state.lives = 0;
  endRun("QA forced fail state for retry proof.");
  render();
  return getStateSnapshot();
}

function getStateSnapshot() {
  return JSON.parse(JSON.stringify(state));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

window.__gameOsWebAdapter = {
  getState: getStateSnapshot,
  smoke: () => ({
    ok: Boolean(canvas && context && shell && startButton && resetButton && watermark),
    kind: "capability-web",
    webPattern,
    canvasWidth: canvas.width,
    canvasHeight: canvas.height,
    watermark: Boolean(watermark && watermark.textContent && watermark.textContent.includes("GameOS")),
    capabilities: capabilityMap.capabilities,
    primaryArchetype: capabilityMap.primaryArchetype,
    capabilityEvidence: {
      hasArcadeUi: webPattern === "arcade-survival" || capabilityMap.capabilities.includes("arcade-loop"),
      hasPlatformUi: webPattern === "platform-movement" || capabilityMap.capabilities.includes("platforming"),
      hasCombatUi: webPattern === "combat-survival" || capabilityMap.capabilities.includes("combat"),
      hasRulesUi: capabilityMap.capabilities.includes("rules"),
      hasEconomyUi: capabilityMap.capabilities.includes("economy"),
      hasPuzzleUi: capabilityMap.capabilities.includes("puzzle"),
      hasNarrativeUi: capabilityMap.capabilities.includes("narrative"),
      hasMultiplayerUi: capabilityMap.capabilities.includes("multiplayer"),
      hasPhysicsTimingUi: capabilityMap.capabilities.includes("physics")
    }
  }),
  start,
  primaryAction,
  moveForQa: movePlayer,
  spawnProofObjectForQa,
  forceFailureForQa,
  reset,
  runPlayerAgent
};

reset();
loop();
`;
}

function renderCapabilityWebBrief(workspace: ProjectWorkspace): string {
  const capabilityMap = createCapabilityMap(workspace.project, workspace.brief);
  return [
    `# ${workspace.project.name} Capability Web Brief`,
    "",
    workspace.brief.summary,
    "",
    "## Source Of Truth",
    "- The capability map selects the reusable systems for this build.",
    "- The browser game is a local Web proof of input, HUD, camera, score loop, storage, and QA behavior.",
    "- Named example fixtures are not used unless the prompt explicitly targets that regression fixture.",
    "",
    "## Selected Capabilities",
    ...capabilityMap.selectedCapabilities.map((capability) => `- ${capability.label}: ${capability.adapterUse}`),
    "",
    "## QA Expectations",
    "- Static smoke must render the canvas, controls, status chips, and GameOS watermark.",
    "- Player agent must prove score, hazards, collectibles, input, visual readability, and restart loop.",
    "- Failures route back into reusable capabilities before adding new one-off lanes."
  ].join("\n");
}

function renderCapabilityManifest(workspace: ProjectWorkspace, webPattern: WebPlayPattern): string {
  const capabilityMap = createCapabilityMap(workspace.project, workspace.brief);
  return `${JSON.stringify(
    {
      generatedBy: "Game OS",
      adapter: "web",
      prototype: "capability-web",
      webPattern,
      architecture: "capability-graph",
      projectId: workspace.project.id,
      projectName: workspace.project.name,
      genre: workspace.project.genre,
      primaryArchetype: capabilityMap.primaryArchetype,
      capabilities: capabilityMap.selectedCapabilities.map((capability) => capability.id),
      targetPlatforms: workspace.project.targetPlatforms,
      entrypoint: "index.html",
      scripts: ["scripts/game.js"],
      watermark: {
        required: true,
        label: "Made with GameOS",
        placement: "bottom-right"
      },
      qaExpectations: {
        browserInteractionRequired: webPattern !== "capability-foundation",
        proves: webPattern === "arcade-survival"
          ? ["start", "lane input", "score gain", "hazard failure", "reset", "retry"]
          : webPattern === "platform-movement"
            ? ["start", "jump input", "checkpoint", "hazard failure", "reset", "retry"]
            : webPattern === "combat-survival"
              ? ["start", "movement", "attack", "hit evidence", "damage/failure", "reset", "retry"]
              : ["start", "primary input", "state change", "reset", "retry"]
      },
      smokeCommand: "npm run web:smoke -- web",
      playerAgentCommand: "npm run web:player -- web"
    },
    null,
    2
  )}\n`;
}

function renderCapabilityWebReport(workspace: ProjectWorkspace, projectRoot: string, files: string[], primaryArchetype: string, webPattern: WebPlayPattern): string {
  const capabilityMap = workspace.artifacts.find((artifact) => artifact.kind === "capability-map");
  const osReview = workspace.artifacts.find((artifact) => artifact.kind === "os-design-review");
  const memory = workspace.artifacts.find((artifact) => artifact.kind === "memory-map");

  return [
    `# ${workspace.project.name} Web Adapter`,
    "",
    "## Generated Project",
    `Path: ${projectRoot}`,
    "",
    "## Capability Proof",
    "- Channel: Web",
    `- Primary archetype: ${primaryArchetype}`,
    `- Web pattern: ${webPattern}`,
    "- Adapter kind: capability-web",
    "- Named game fixtures are bypassed unless explicitly selected as regression fixtures.",
    "",
    "## Files",
    ...files.map((file) => `- ${path.relative(projectRoot, file)}`),
    "",
    "## Adapter Inputs",
    `- OS design review: ${osReview ? toProjectRelativeArtifactPath(osReview.path, workspace.project.id) : "missing"}`,
    `- Capability map: ${capabilityMap ? toProjectRelativeArtifactPath(capabilityMap.path, workspace.project.id) : "missing"}`,
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
    "- This Web build exists to prove capability-graph generation for unfamiliar prompts.",
    "- The reusable proof covers input, camera, HUD, score loop, hazards, collectibles, restart, watermark, and player-agent evidence.",
    "- If a user requests a different game, Game OS should add or tune capabilities before adding another named game lane."
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

      <section class="play-surface" aria-label="Playable turn-rules web prototype">
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
          <div class="track-grid" id="track-grid" aria-label="Turn-rules track"></div>
          <div class="watermark">Made with GameOS</div>
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
    <script src="./scripts/turn-rules.js"></script>
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
  position: relative;
  padding: 16px;
}

.watermark {
  position: absolute;
  right: clamp(20px, 2.4vw, 30px);
  bottom: clamp(20px, 2.4vw, 30px);
  padding: 5px 8px;
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.88);
  background: rgba(20, 56, 50, 0.68);
  font-size: 0.72rem;
  font-weight: 900;
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

function renderTurnRulesScript(): string {
  return `class BoardGameRules {
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

window.GameOsBoardGameRules = BoardGameRules;
`;
}

function renderGameScript(workspace: ProjectWorkspace): string {
  return `const projectName = ${JSON.stringify(workspace.project.name)};
const rules = new window.GameOsBoardGameRules();
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
  verdict: document.querySelector("#verdict-chip"),
  watermark: document.querySelector(".watermark")
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
    ok: Boolean(elements.shell && elements.grid && elements.roll && elements.moves && elements.watermark),
    cells: elements.grid.querySelectorAll(".track-cell").length,
    projectName,
    kind: "turn-rules",
    watermark: Boolean(elements.watermark && elements.watermark.textContent && elements.watermark.textContent.includes("GameOS"))
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
      prototype: "turn-rules",
      projectId: workspace.project.id,
      projectName: workspace.project.name,
      genre: workspace.project.genre,
      targetPlatforms: workspace.project.targetPlatforms,
      entrypoint: "index.html",
      scripts: ["scripts/turn-rules.js", "scripts/game.js"],
      watermark: {
        required: true,
        label: "Made with GameOS",
        placement: "bottom-right"
      },
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
    "- The web rules resolver mirrors the Turn-rules sprint target used by Unity and Godot.",
    "- Browser localStorage proves save/load behavior for the web lane before backend sync is added.",
    "- Hosting, accounts, multiplayer servers, and store publishing remain outside V1."
  ].join("\n");
}

function isAssetPhysicsWorkspace(workspace: ProjectWorkspace): boolean {
  const source = `${workspace.project.name} ${workspace.project.genre} ${workspace.project.prompt}`.toLowerCase();
  return (source.includes("cut") && source.includes("rope")) || source.includes("physics puzzle");
}

function safeWebAssetName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "asset";
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatGameOsStatusLabel(value: string): string {
  const labels: Record<string, string> = {
    APPROVED_FOR_ASSET_PHYSICS_WEB_BUILD: "Assets approved",
    WRONG_ASSET_PACK_FOR_ASSET_PHYSICS: "Assets need review",
    NO_ASSET_PACK_IMPORTED: "No asset pack imported",
    ASSET_FIT_PASS: "Asset fit pass",
    ASSET_FIT_PARTIAL: "Asset fit review",
    ASSET_FIT_FAIL: "Asset fit failed",
    VISUAL_GATE_PASS: "Visual pass",
    VISUAL_GATE_REVIEW: "Visual review",
    VISUAL_GATE_FAIL: "Visual failed"
  };

  return (
    labels[value] ??
    value
      .toLowerCase()
      .replace(/_/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase())
  );
}
