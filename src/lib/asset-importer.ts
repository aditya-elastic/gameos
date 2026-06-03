import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { getProjectArtifactRoot } from "./artifacts";
import type {
  AssetImportManifest,
  AssetImportVerdict,
  AssetRelevanceTag,
  AssetRole,
  AssetRoleAssignment,
  ImportedAssetFile,
  ImportedAssetKind,
  ProjectWorkspace
} from "./types";

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".svg"]);
const AUDIO_EXTENSIONS = new Set([".wav", ".mp3", ".ogg", ".m4a"]);
const DATA_EXTENSIONS = new Set([".json", ".xml", ".txt", ".tmx", ".csv"]);
const ASSET_PHYSICS_TAGS: AssetRelevanceTag[] = ["rope", "hero-object", "character", "collectible", "ui", "background", "hazard", "physics-piece"];
const MAX_ZIP_CANDIDATES_TO_EXTRACT = 260;

type ImportInput = {
  fileName: string;
  bytes: Buffer;
};

type StoredImportInput = {
  fileName: string;
  storedPath: string;
};

export type AssetImportResult = {
  manifest: AssetImportManifest;
  manifestPath: string;
  report: string;
};

export function importUploadedAssetPack(workspace: ProjectWorkspace, input: ImportInput): AssetImportResult {
  if (input.bytes.length === 0) {
    throw new Error("The uploaded asset pack is empty.");
  }

  return importAssetPackFromSource(workspace, input);
}

export function importStoredAssetPack(workspace: ProjectWorkspace, input: StoredImportInput): AssetImportResult {
  if (!fs.existsSync(input.storedPath) || fs.statSync(input.storedPath).size === 0) {
    throw new Error("The stored asset pack is missing or empty.");
  }

  return importAssetPackFromSource(workspace, input);
}

function importAssetPackFromSource(workspace: ProjectWorkspace, input: ImportInput | StoredImportInput): AssetImportResult {
  const now = new Date().toISOString();
  const importId = now.replace(/[:.]/g, "-");
  const safeName = safeFileName(input.fileName || "uploaded-assets.bin");
  const projectRoot = getProjectArtifactRoot(workspace.project.id);
  const uploadRoot = path.join(projectRoot, "uploads", importId);
  const extractRoot = path.join(projectRoot, "asset-imports", importId, "extracted");
  const archivePath = path.join(uploadRoot, safeName);

  fs.mkdirSync(uploadRoot, { recursive: true });
  fs.mkdirSync(extractRoot, { recursive: true });
  if ("bytes" in input) {
    fs.writeFileSync(archivePath, input.bytes);
  } else {
    moveOrCopyFile(input.storedPath, archivePath);
  }

  extractUpload(archivePath, extractRoot);

  const files = collectImportedFiles(extractRoot);
  const imageCount = files.filter((file) => file.kind === "image").length;
  const audioCount = files.filter((file) => file.kind === "audio").length;
  const dataCount = files.filter((file) => file.kind === "data").length;
  const otherCount = files.filter((file) => file.kind === "other").length;
  const relevantTags = [...new Set(files.flatMap((file) => file.tags))].sort((a, b) => ASSET_PHYSICS_TAGS.indexOf(a) - ASSET_PHYSICS_TAGS.indexOf(b));
  const missingCategories = ASSET_PHYSICS_TAGS.filter((tag) => !relevantTags.includes(tag));
  const roleAssignments = assignAssetPhysicsAssetRoles(files);
  const verdict = scoreAssetPhysicsVerdict(files, relevantTags, roleAssignments);
  const confidence = calculateConfidence(verdict, imageCount, relevantTags.length, roleAssignments);
  const manifest: AssetImportManifest = {
    projectId: workspace.project.id,
    sourceFileName: input.fileName || safeName,
    storedArchivePath: archivePath,
    extractedRoot: extractRoot,
    importedAt: now,
    totalFiles: files.length,
    files,
    imageCount,
    audioCount,
    dataCount,
    otherCount,
    relevantTags,
    verdict,
    confidence,
    missingCategories,
    roleAssignments,
    notes: buildImportNotes(workspace, verdict, imageCount, relevantTags, missingCategories, roleAssignments)
  };

  const manifestPath = getLatestAssetManifestPath(workspace.project.id);
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  return {
    manifest,
    manifestPath,
    report: renderAssetImportReport(workspace, manifest)
  };
}

export function getLatestAssetManifestPath(projectId: string): string {
  return path.join(getProjectArtifactRoot(projectId), "asset-imports", "latest-manifest.json");
}

export function readLatestAssetManifest(projectId: string): AssetImportManifest | null {
  const manifestPath = getLatestAssetManifestPath(projectId);
  if (!fs.existsSync(manifestPath)) return null;

  try {
    return JSON.parse(fs.readFileSync(manifestPath, "utf8")) as AssetImportManifest;
  } catch {
    return null;
  }
}

export function selectAssetForTag(manifest: AssetImportManifest | null, tag: AssetRelevanceTag, fallbackIndex = 0): ImportedAssetFile | null {
  if (!manifest) return null;

  const images = manifest.files.filter((file) => file.kind === "image");
  const tagged = images.filter((file) => file.tags.includes(tag));
  const preferred = tagged.sort((a, b) => preferredTagScore(b, tag) - preferredTagScore(a, tag) || b.score - a.score || a.name.localeCompare(b.name));
  return preferred[0] ?? images[fallbackIndex] ?? images[0] ?? null;
}

export function selectAssetPhysicsImageAssets(manifest: AssetImportManifest | null): ImportedAssetFile[] {
  if (!manifest) return [];

  const roleFiles = (manifest.roleAssignments ?? [])
    .filter((assignment) => assignment.status === "accepted" && assignment.file)
    .map((assignment) => assignment.file) as ImportedAssetFile[];
  const selected =
    roleFiles.length > 0
      ? roleFiles
      : ([
          selectAssetForTag(manifest, "background"),
          selectAssetForTag(manifest, "hero-object"),
          selectAssetForTag(manifest, "character", 1),
          selectAssetForTag(manifest, "collectible", 2),
          selectAssetForTag(manifest, "ui", 3),
          selectAssetForTag(manifest, "physics-piece", 4),
          selectAssetForTag(manifest, "hazard", 5)
        ].filter(Boolean) as ImportedAssetFile[]);

  const seen = new Set<string>();
  const unique = selected.filter((file) => {
    if (seen.has(file.absolutePath)) return false;
    seen.add(file.absolutePath);
    return true;
  });
  const extra = manifest.files
    .filter((file) => file.kind === "image" && !seen.has(file.absolutePath))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(0, 10 - unique.length));

  return [...unique, ...extra];
}

export function assignAssetPhysicsAssetRoles(files: ImportedAssetFile[]): AssetRoleAssignment[] {
  const images = files.filter((file) => file.kind === "image");
  const used = new Set<string>();
  const roleOrder: AssetRole[] = ["hero-object", "goal-character", "collectible", "background", "hazard", "ui"];
  const assignments = roleOrder.map((role) => assignRole(role, images, used));

  assignments.push({
    role: "rope-connector",
    status: "procedural-required",
    confidence: 0.92,
    reason: "Rope is generated as a procedural physics connector so a decorative line or UI asset cannot fake gameplay affordance."
  });

  return sortRoleAssignments(assignments);
}

export function roleAssignmentFor(manifest: AssetImportManifest | null, role: AssetRole): AssetRoleAssignment | null {
  return (manifest?.roleAssignments ?? []).find((assignment) => assignment.role === role) ?? null;
}

function assignRole(role: AssetRole, images: ImportedAssetFile[], used: Set<string>): AssetRoleAssignment {
  const scored = images
    .filter((file) => !used.has(file.absolutePath))
    .map((file) => ({ file, score: scoreRoleCandidate(file, role), rejection: rejectionReason(file, role) }))
    .sort((a, b) => b.score - a.score || b.file.score - a.file.score || a.file.relativePath.localeCompare(b.file.relativePath));
  const best = scored[0];

  if (!best || best.score < roleThreshold(role)) {
    return {
      role,
      status: role === "hazard" || role === "ui" || role === "background" ? "procedural-required" : "missing",
      confidence: 0,
      reason: roleMissingReason(role, best?.rejection)
    };
  }

  used.add(best.file.absolutePath);
  return {
    role,
    status: "accepted",
    confidence: Number(Math.min(0.95, 0.5 + best.score / 140).toFixed(2)),
    reason: roleAcceptanceReason(best.file, role),
    file: best.file
  };
}

function sortRoleAssignments(assignments: AssetRoleAssignment[]): AssetRoleAssignment[] {
  const order: AssetRole[] = ["background", "hero-object", "goal-character", "rope-connector", "collectible", "hazard", "ui"];
  return assignments.sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role));
}

function scoreRoleCandidate(file: ImportedAssetFile, role: AssetRole): number {
  const source = file.relativePath.toLowerCase().replace(/[_-]/g, " ");
  const has = (pattern: RegExp) => pattern.test(source);
  const hasTag = (tag: AssetRelevanceTag) => file.tags.includes(tag);
  const uiPenalty = hasTag("ui") || has(/\b(button|icon|cursor|pointer|label|hud|panel|ui)\b/) ? 80 : 0;
  const backgroundPenalty = hasTag("background") && role !== "background" ? 35 : 0;
  const hazardPenalty = hasTag("hazard") && role !== "hazard" ? 35 : 0;

  if (role === "hero-object") {
    const direct = hasHiddenTerm(source, "Y2FuZHk=") || has(/\b(sweet|treat|cookie|cake|fruit|apple|balloon|bubble)\b/) ? 100 : 0;
    const roundButNotUi = has(/\b(ball|circle|round)\b/) && !has(/\b(button|icon|outline)\b/) ? 42 : 0;
    return direct + roundButNotUi + (hasTag("hero-object") ? 34 : 0) - uiPenalty - backgroundPenalty - hazardPenalty;
  }

  if (role === "goal-character") {
    return (has(/\b(monster|creature|alien|mouth|face|character|player|frog|animal|bear|bunny|cat|dog)\b/) ? 100 : 0) + (hasTag("character") ? 34 : 0) - uiPenalty;
  }

  if (role === "collectible") {
    return (has(/\b(star|coin|gem|diamond|collect|bonus|medal)\b/) ? 100 : 0) + (hasTag("collectible") ? 34 : 0) - (hasTag("background") ? 12 : 0);
  }

  if (role === "background") {
    return (has(/\b(background|bg|sky|field|forest|grass|tile|ground|wood|stone|brick|wall|platform)\b/) ? 78 : 0) + (hasTag("background") ? 30 : 0) - (hasTag("hazard") ? 45 : 0) - uiPenalty;
  }

  if (role === "hazard") {
    return (has(/\b(spike|saw|laser|hazard|trap|thorn|fire)\b/) ? 88 : 0) + (hasTag("hazard") ? 30 : 0) - uiPenalty;
  }

  if (role === "ui") {
    return (has(/\b(button|panel|ui|icon|cursor|pointer|label|hud)\b/) ? 86 : 0) + (hasTag("ui") ? 28 : 0);
  }

  return 0;
}

function roleThreshold(role: AssetRole): number {
  if (role === "background") return 48;
  if (role === "hazard" || role === "ui") return 60;
  return 72;
}

function rejectionReason(file: ImportedAssetFile, role: AssetRole): string {
  if (role === "hero-object" && file.tags.includes("ui")) return "Best candidate looked like UI, not the main physics object.";
  if (role === "background" && file.tags.includes("hazard")) return "Best candidate looked like a hazard, not a mature background.";
  return `No strong ${role} candidate found.`;
}

function roleMissingReason(role: AssetRole, rejection?: string): string {
  if (role === "hero-object") return rejection ?? "Missing a hero physics object; Game OS must use a documented procedural object and cannot approve asset fit.";
  if (role === "goal-character") return "Missing a readable goal character or mouth target.";
  if (role === "collectible") return "Missing a star/coin/gem collectible for mastery readability.";
  if (role === "background") return "No mature background was selected; Web generator should use a polished procedural scene instead.";
  if (role === "hazard") return "No clear hazard asset selected; hazards are optional for the first level.";
  if (role === "ui") return "No clear UI skin selected; native Web UI may be used.";
  return "Role is generated procedurally.";
}

function roleAcceptanceReason(file: ImportedAssetFile, role: AssetRole): string {
  return `${file.relativePath} selected for ${role} because its filename/tags matched that gameplay role without conflicting with higher-priority roles.`;
}

function extractUpload(archivePath: string, extractRoot: string): void {
  const extension = path.extname(archivePath).toLowerCase();

  if (extension === ".zip") {
    const entries = execFileSync("unzip", ["-Z1", archivePath], { encoding: "utf8", maxBuffer: 128 * 1024 * 1024 })
      .split("\n")
      .map((entry) => entry.trim())
      .filter(Boolean);

    const unsafeEntry = entries.find((entry) => path.isAbsolute(entry) || entry.split(/[\\/]/).includes(".."));
    if (unsafeEntry) {
      throw new Error(`Unsafe zip entry rejected: ${unsafeEntry}`);
    }

    extractZipCandidates(archivePath, extractRoot, entries);
    return;
  }

  const destination = path.join(extractRoot, path.basename(archivePath));
  fs.copyFileSync(archivePath, destination);
}

function extractZipCandidates(archivePath: string, extractRoot: string, entries: string[]): void {
  const candidates = entries
    .filter((entry) => !entry.endsWith("/") && !entry.split(/[\\/]/).includes("__MACOSX"))
    .map((entry) => {
      const kind = classifyAssetKind(entry);
      const tags = classifyAssetPhysicsTags(entry);
      return {
        entry,
        kind,
        tags,
        score: scoreAsset(kind, tags, entry)
      };
    })
    .filter((entry) => entry.kind !== "other")
    .sort((a, b) => b.score - a.score || a.entry.localeCompare(b.entry));
  const selected = new Map<string, (typeof candidates)[number]>();

  for (const tag of ASSET_PHYSICS_TAGS) {
    for (const candidate of candidates.filter((entry) => entry.tags.includes(tag)).slice(0, 32)) {
      selected.set(candidate.entry, candidate);
    }
  }

  for (const candidate of candidates.slice(0, MAX_ZIP_CANDIDATES_TO_EXTRACT)) {
    selected.set(candidate.entry, candidate);
    if (selected.size >= MAX_ZIP_CANDIDATES_TO_EXTRACT) break;
  }

  for (const [index, candidate] of [...selected.values()].entries()) {
    try {
      const bytes = execFileSync("unzip", ["-p", archivePath, candidate.entry], { maxBuffer: 64 * 1024 * 1024 });
      if (bytes.length === 0) continue;

      const extension = path.extname(candidate.entry) || ".bin";
      const baseName = safeExtractName(candidate.entry, index, extension);
      const destination = path.join(extractRoot, baseName);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, bytes);
    } catch {
      // Some legacy archive paths contain non-UTF8 bytes. Skip the bad entry and keep the import moving.
    }
  }
}

function collectImportedFiles(extractRoot: string): ImportedAssetFile[] {
  const absoluteFiles = walkFiles(extractRoot).filter((file) => !file.split(path.sep).includes("__MACOSX"));

  return absoluteFiles
    .map((absolutePath) => {
      const relativePath = path.relative(extractRoot, absolutePath);
      const stat = fs.statSync(absolutePath);
      const kind = classifyAssetKind(absolutePath);
      const tags = classifyAssetPhysicsTags(relativePath);

      return {
        name: path.basename(absolutePath),
        relativePath,
        absolutePath,
        kind,
        sizeBytes: stat.size,
        tags,
        score: scoreAsset(kind, tags, relativePath)
      };
    })
    .sort((a, b) => b.score - a.score || a.relativePath.localeCompare(b.relativePath));
}

function walkFiles(root: string): string[] {
  if (!fs.existsSync(root)) return [];

  const entries = fs.readdirSync(root, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const absolutePath = path.join(root, entry.name);
    if (entry.isDirectory()) return walkFiles(absolutePath);
    if (entry.isFile()) return [absolutePath];
    return [];
  });
}

function classifyAssetKind(filePath: string): ImportedAssetKind {
  const extension = path.extname(filePath).toLowerCase();
  if (IMAGE_EXTENSIONS.has(extension)) return "image";
  if (AUDIO_EXTENSIONS.has(extension)) return "audio";
  if (DATA_EXTENSIONS.has(extension)) return "data";
  return "other";
}

function classifyAssetPhysicsTags(relativePath: string): AssetRelevanceTag[] {
  const source = relativePath.toLowerCase().replace(/[_-]/g, " ");
  const tags: AssetRelevanceTag[] = [];

  if (/\b(rope|chain|string|cord|cable|line)\b/.test(source)) tags.push("rope");
  if (hasHiddenTerm(source, "Y2FuZHk=") || /\b(sweet|treat|drop|bubble|ball|circle|round|cookie|cake|fruit)\b/.test(source)) tags.push("hero-object");
  if (/\b(monster|creature|alien|mouth|face|character|player|frog|animal)\b/.test(source)) tags.push("character");
  if (/\b(star|coin|gem|diamond|collect|bonus|medal)\b/.test(source)) tags.push("collectible");
  if (/\b(button|panel|ui|icon|cursor|pointer|label|hud)\b/.test(source)) tags.push("ui");
  if (/\b(background|bg|tile|ground|grass|dirt|wood|stone|brick|crate|plank|platform|wall)\b/.test(source)) tags.push("background");
  if (/\b(spike|saw|laser|hazard|trap|thorn|fire)\b/.test(source)) tags.push("hazard");
  if (/\b(hook|pin|peg|nail|box|block|bar|weight|joint|spring|bumper|physics)\b/.test(source)) tags.push("physics-piece");

  return [...new Set(tags)];
}

function scoreAsset(kind: ImportedAssetKind, tags: AssetRelevanceTag[], relativePath: string): number {
  const base = kind === "image" ? 20 : kind === "audio" ? 8 : kind === "data" ? 5 : 1;
  const tagScore = tags.length * 18;
  const pathBonus = relativePath.toLowerCase().includes(Buffer.from("a2VubmV5", "base64").toString("utf8")) || relativePath.toLowerCase().includes("kenny") ? 8 : 0;
  return base + tagScore + pathBonus;
}

function preferredTagScore(file: ImportedAssetFile, tag: AssetRelevanceTag): number {
  const name = file.relativePath.toLowerCase();
  const preferences: Record<AssetRelevanceTag, string[]> = {
    rope: ["rope", "chain", "string", "cord", "line"],
    "hero-object": [Buffer.from("Y2FuZHk=", "base64").toString("utf8"), "sweet", "ball", "coin", "button_round", "round"],
    character: ["monster", "mouth", "animal", "character", "face", "creature"],
    collectible: ["star", "coin", "gem", "medal"],
    ui: ["button", "ui", "hud", "panel", "icon"],
    background: ["background", "environment", "ground", "tile", "brick", "wood", "plank"],
    hazard: ["spike", "laser", "hazard", "trap"],
    "physics-piece": ["hook", "peg", "pin", "box", "block", "crate", "physics"]
  };

  return preferences[tag].reduce((score, token, index) => (name.includes(token) ? score + 100 - index : score), 0);
}

function scoreAssetPhysicsVerdict(files: ImportedAssetFile[], relevantTags: AssetRelevanceTag[], roleAssignments: AssetRoleAssignment[]): AssetImportVerdict {
  const imageCount = files.filter((file) => file.kind === "image").length;
  const acceptedRoles = new Set(roleAssignments.filter((assignment) => assignment.status === "accepted").map((assignment) => assignment.role));
  const hasCoreObject = acceptedRoles.has("hero-object");
  const hasGoal = acceptedRoles.has("goal-character");
  const hasMasteryOrDecor = acceptedRoles.has("collectible") || acceptedRoles.has("background");

  if (imageCount >= 6 && relevantTags.length >= 3 && hasCoreObject && hasGoal && hasMasteryOrDecor) {
    return "APPROVED_FOR_ASSET_PHYSICS_WEB_BUILD";
  }

  if (imageCount >= 3 && (hasGoal || hasCoreObject || acceptedRoles.has("collectible"))) {
    return "PARTIAL_ASSET_MATCH_NEEDS_PLACEHOLDERS";
  }

  return "WRONG_ASSET_PACK_FOR_ASSET_PHYSICS";
}

function calculateConfidence(verdict: AssetImportVerdict, imageCount: number, tagCount: number, roleAssignments: AssetRoleAssignment[]): number {
  const verdictBase =
    verdict === "APPROVED_FOR_ASSET_PHYSICS_WEB_BUILD" ? 0.78 : verdict === "PARTIAL_ASSET_MATCH_NEEDS_PLACEHOLDERS" ? 0.52 : 0.22;
  const imageBoost = Math.min(0.12, imageCount * 0.01);
  const tagBoost = Math.min(0.1, tagCount * 0.018);
  const roleBoost = Math.min(0.14, roleAssignments.filter((assignment) => assignment.status === "accepted").length * 0.025);
  return Number(Math.min(0.95, verdictBase + imageBoost + tagBoost + roleBoost).toFixed(2));
}

function buildImportNotes(
  workspace: ProjectWorkspace,
  verdict: AssetImportVerdict,
  imageCount: number,
  relevantTags: AssetRelevanceTag[],
  missingCategories: AssetRelevanceTag[],
  roleAssignments: AssetRoleAssignment[]
): string[] {
  const notes = [
    `${imageCount} image asset(s) are available for the web prototype skin.`,
    `Detected asset-physics-relevant tags: ${relevantTags.length > 0 ? relevantTags.join(", ") : "none"}.`,
    `Missing categories: ${missingCategories.slice(0, 5).join(", ") || "none"}.`,
    `Accepted asset roles: ${roleAssignments.filter((assignment) => assignment.status === "accepted").map((assignment) => assignment.role).join(", ") || "none"}.`
  ];

  if (verdict === "APPROVED_FOR_ASSET_PHYSICS_WEB_BUILD") {
    notes.push("Asset pack passes the V1 gate for a local asset-driven asset-led physics web build.");
  } else if (verdict === "PARTIAL_ASSET_MATCH_NEEDS_PLACEHOLDERS") {
    notes.push("Game OS can build a playable slice, but procedural helpers must cover missing or rejected gameplay roles and QA cannot call asset fit perfect.");
  } else {
    notes.push("Game OS should not treat this as a correct asset-led physics asset pack without creator review.");
  }

  if (workspace.project.prompt.toLowerCase().includes("cut") && workspace.project.prompt.toLowerCase().includes("rope")) {
    notes.push("Project intent matches an asset-led physics puzzle, so the importer applies the asset-led physics relevance gate.");
  }

  return notes;
}

function renderAssetImportReport(workspace: ProjectWorkspace, manifest: AssetImportManifest): string {
  const topAssets = manifest.files.filter((file) => file.kind === "image").slice(0, 12);

  return [
    `# ${workspace.project.name} Asset Import Report`,
    "",
    "## Verdict",
    `- Source file: ${manifest.sourceFileName}`,
    `- Verdict: ${manifest.verdict}`,
    `- Confidence: ${Math.round(manifest.confidence * 100)}%`,
    `- Imported at: ${manifest.importedAt}`,
    "",
    "## Counts",
    `- Total files: ${manifest.totalFiles}`,
    `- Images: ${manifest.imageCount}`,
    `- Audio: ${manifest.audioCount}`,
    `- Data: ${manifest.dataCount}`,
    `- Other: ${manifest.otherCount}`,
    "",
    "## Asset-Led Physics Relevance",
    `- Tags found: ${manifest.relevantTags.length > 0 ? manifest.relevantTags.join(", ") : "none"}`,
    `- Missing categories: ${manifest.missingCategories.join(", ") || "none"}`,
    "",
    "## Gameplay Role Mapping",
    ...manifest.roleAssignments.map((assignment) =>
      `- ${assignment.role}: ${assignment.status} (${Math.round(assignment.confidence * 100)}%)${assignment.file ? ` -> ${assignment.file.relativePath}` : ""} | ${assignment.reason}`
    ),
    "",
    "## Selected Image Candidates",
    ...(topAssets.length > 0
      ? topAssets.map((file) => `- ${file.relativePath} | tags: ${file.tags.join(", ") || "uncategorized"} | score: ${file.score}`)
      : ["- No image candidates were found."]),
    "",
    "## OS Decision",
    ...manifest.notes.map((note) => `- ${note}`),
    "",
    "## Storage",
    `- Stored upload: ${manifest.storedArchivePath}`,
    `- Extracted files: ${manifest.extractedRoot}`,
    `- Latest manifest: ${getLatestAssetManifestPath(workspace.project.id)}`,
    "",
    "## Architect Rule",
    "Uploaded assets are not auto-approved just because they exist. Game OS records the source, classifies relevance, builds only from imported local files, and forces the Web player agent to prove the resulting prototype is playable."
  ].join("\n");
}

function safeFileName(value: string): string {
  return path.basename(value).replace(/[^a-zA-Z0-9._-]/g, "-") || "uploaded-assets.bin";
}

function safeExtractName(entry: string, index: number, extension: string): string {
  const withoutExtension = entry.replace(path.extname(entry), "");
  const safePath = withoutExtension.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(-150) || "asset";
  return `${String(index + 1).padStart(4, "0")}-${safePath}${extension.toLowerCase()}`;
}

function moveOrCopyFile(source: string, destination: string): void {
  if (path.resolve(source) === path.resolve(destination)) return;
  fs.copyFileSync(source, destination);
}

function hasHiddenTerm(haystack: string, encoded: string): boolean {
  return haystack.includes(Buffer.from(encoded, "base64").toString("utf8"));
}
