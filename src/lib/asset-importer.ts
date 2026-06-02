import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { getProjectArtifactRoot } from "./artifacts";
import type {
  AssetImportManifest,
  AssetImportVerdict,
  AssetRelevanceTag,
  ImportedAssetFile,
  ImportedAssetKind,
  ProjectWorkspace
} from "./types";

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".svg"]);
const AUDIO_EXTENSIONS = new Set([".wav", ".mp3", ".ogg", ".m4a"]);
const DATA_EXTENSIONS = new Set([".json", ".xml", ".txt", ".tmx", ".csv"]);
const CUT_ROPE_TAGS: AssetRelevanceTag[] = ["rope", "candy", "character", "collectible", "ui", "background", "hazard", "physics-piece"];
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
  const relevantTags = [...new Set(files.flatMap((file) => file.tags))].sort((a, b) => CUT_ROPE_TAGS.indexOf(a) - CUT_ROPE_TAGS.indexOf(b));
  const missingCategories = CUT_ROPE_TAGS.filter((tag) => !relevantTags.includes(tag));
  const verdict = scoreCutRopeVerdict(files, relevantTags);
  const confidence = calculateConfidence(verdict, imageCount, relevantTags.length);
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
    notes: buildImportNotes(workspace, verdict, imageCount, relevantTags, missingCategories)
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

export function selectCutRopeImageAssets(manifest: AssetImportManifest | null): ImportedAssetFile[] {
  if (!manifest) return [];

  const selected = [
    selectAssetForTag(manifest, "background"),
    selectAssetForTag(manifest, "candy"),
    selectAssetForTag(manifest, "character", 1),
    selectAssetForTag(manifest, "collectible", 2),
    selectAssetForTag(manifest, "ui", 3),
    selectAssetForTag(manifest, "physics-piece", 4),
    selectAssetForTag(manifest, "hazard", 5)
  ].filter(Boolean) as ImportedAssetFile[];

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
      const tags = classifyCutRopeTags(entry);
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

  for (const tag of CUT_ROPE_TAGS) {
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
      // Some legacy Kenney archive paths contain non-UTF8 bytes. Skip the bad entry and keep the import moving.
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
      const tags = classifyCutRopeTags(relativePath);

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

function classifyCutRopeTags(relativePath: string): AssetRelevanceTag[] {
  const source = relativePath.toLowerCase().replace(/[_-]/g, " ");
  const tags: AssetRelevanceTag[] = [];

  if (/\b(rope|chain|string|cord|cable|line)\b/.test(source)) tags.push("rope");
  if (/\b(candy|sweet|treat|drop|bubble|ball|circle|round|cookie|cake|fruit)\b/.test(source)) tags.push("candy");
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
  const pathBonus = relativePath.toLowerCase().includes("kenney") || relativePath.toLowerCase().includes("kenny") ? 8 : 0;
  return base + tagScore + pathBonus;
}

function preferredTagScore(file: ImportedAssetFile, tag: AssetRelevanceTag): number {
  const name = file.relativePath.toLowerCase();
  const preferences: Record<AssetRelevanceTag, string[]> = {
    rope: ["rope", "chain", "string", "cord", "line"],
    candy: ["candy", "sweet", "ball", "coin", "button_round", "round"],
    character: ["monster", "mouth", "animal", "character", "face", "creature"],
    collectible: ["star", "coin", "gem", "medal"],
    ui: ["button", "ui", "hud", "panel", "icon"],
    background: ["background", "environment", "ground", "tile", "brick", "wood", "plank"],
    hazard: ["spike", "laser", "hazard", "trap"],
    "physics-piece": ["hook", "peg", "pin", "box", "block", "crate", "physics"]
  };

  return preferences[tag].reduce((score, token, index) => (name.includes(token) ? score + 100 - index : score), 0);
}

function scoreCutRopeVerdict(files: ImportedAssetFile[], relevantTags: AssetRelevanceTag[]): AssetImportVerdict {
  const imageCount = files.filter((file) => file.kind === "image").length;
  const hasCoreObject = relevantTags.includes("candy") || relevantTags.includes("physics-piece");
  const hasGoalOrReadableSkin = relevantTags.includes("character") || relevantTags.includes("ui") || imageCount >= 8;
  const hasLevelDecor = relevantTags.includes("background") || relevantTags.includes("collectible") || relevantTags.includes("hazard");

  if (imageCount >= 6 && relevantTags.length >= 3 && hasCoreObject && hasGoalOrReadableSkin && hasLevelDecor) {
    return "APPROVED_FOR_CUT_ROPE_WEB_PROTOTYPE";
  }

  if (imageCount >= 3 && (relevantTags.length >= 2 || hasCoreObject)) {
    return "PARTIAL_ASSET_MATCH_NEEDS_PLACEHOLDERS";
  }

  return "WRONG_ASSET_PACK_FOR_CUT_ROPE";
}

function calculateConfidence(verdict: AssetImportVerdict, imageCount: number, tagCount: number): number {
  const verdictBase =
    verdict === "APPROVED_FOR_CUT_ROPE_WEB_PROTOTYPE" ? 0.78 : verdict === "PARTIAL_ASSET_MATCH_NEEDS_PLACEHOLDERS" ? 0.52 : 0.22;
  const imageBoost = Math.min(0.12, imageCount * 0.01);
  const tagBoost = Math.min(0.1, tagCount * 0.018);
  return Number(Math.min(0.95, verdictBase + imageBoost + tagBoost).toFixed(2));
}

function buildImportNotes(
  workspace: ProjectWorkspace,
  verdict: AssetImportVerdict,
  imageCount: number,
  relevantTags: AssetRelevanceTag[],
  missingCategories: AssetRelevanceTag[]
): string[] {
  const notes = [
    `${imageCount} image asset(s) are available for the web prototype skin.`,
    `Detected Cut-the-Rope-relevant tags: ${relevantTags.length > 0 ? relevantTags.join(", ") : "none"}.`,
    `Missing categories: ${missingCategories.slice(0, 5).join(", ") || "none"}.`
  ];

  if (verdict === "APPROVED_FOR_CUT_ROPE_WEB_PROTOTYPE") {
    notes.push("Asset pack passes the V1 gate for a local Cut-the-Rope-style web prototype.");
  } else if (verdict === "PARTIAL_ASSET_MATCH_NEEDS_PLACEHOLDERS") {
    notes.push("Game OS can build a playable slice, but procedural rope/goal/readability helpers must cover missing categories.");
  } else {
    notes.push("Game OS should not treat this as a correct Cut-the-Rope pack without creator review.");
  }

  if (workspace.project.prompt.toLowerCase().includes("cut") && workspace.project.prompt.toLowerCase().includes("rope")) {
    notes.push("Project intent matches a rope-cut physics puzzle, so the importer applies the Cut Rope relevance gate.");
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
    "## Cut Rope Relevance",
    `- Tags found: ${manifest.relevantTags.length > 0 ? manifest.relevantTags.join(", ") : "none"}`,
    `- Missing categories: ${manifest.missingCategories.join(", ") || "none"}`,
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

  try {
    fs.renameSync(source, destination);
  } catch {
    fs.copyFileSync(source, destination);
    fs.rmSync(source, { force: true });
  }
}
