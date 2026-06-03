import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { getProjectArtifactRoot } from "../lib/artifacts";
import { addArtifact } from "../lib/db";
import { getStudioProject } from "../lib/studio";
import type { ArtifactKind } from "../lib/types";

export type WebExportResult = {
  projectId: string;
  projectName: string;
  outputPath: string;
  fileCount: number;
  bytes: number;
};

type ZipEntry = {
  name: string;
  data: Buffer;
};

const EXPORT_ARTIFACT_KINDS = new Set<ArtifactKind>([
  "acceptance-profile",
  "capability-map",
  "web-adapter",
  "web-playtest-report",
  "studio-scorecard",
  "trust-diagnosis"
]);

export function exportWebProject(projectId: string, outputPath = ""): WebExportResult {
  const workspace = getStudioProject(projectId);
  if (!workspace) throw new Error(`Project not found: ${projectId}`);

  const projectRoot = getProjectArtifactRoot(projectId);
  const webRoot = path.join(projectRoot, "web");
  if (!fs.existsSync(path.join(webRoot, "index.html"))) throw new Error(`Web build not found for ${projectId}. Run gameos build web ${projectId}.`);

  const exportDir = path.join(projectRoot, "exports");
  const zipPath = outputPath ? path.resolve(outputPath) : path.join(exportDir, `${slug(workspace.project.name)}-${projectId}-web.zip`);
  const entries: ZipEntry[] = [
    ...collectFiles(webRoot).map((filePath) => ({
      name: `web/${toZipPath(path.relative(webRoot, filePath))}`,
      data: fs.readFileSync(filePath)
    })),
    ...workspace.artifacts
      .filter((artifact) => EXPORT_ARTIFACT_KINDS.has(artifact.kind) && fs.existsSync(artifact.path))
      .map((artifact) => ({
        name: `gameos-artifacts/${artifact.kind}-${path.basename(artifact.path)}`,
        data: fs.readFileSync(artifact.path)
      })),
    {
      name: "gameos-export-manifest.json",
      data: Buffer.from(
        JSON.stringify(
          {
            generatedBy: "Game OS",
            package: "gameos",
            projectId,
            projectName: workspace.project.name,
            target: "web-playable",
            exportedAt: new Date().toISOString(),
            watermark: { required: true, label: "Made with GameOS" },
            contents: ["web playable build", "Game OS artifacts", "provenance manifest"]
          },
          null,
          2
        )
      )
    }
  ];

  fs.mkdirSync(path.dirname(zipPath), { recursive: true });
  writeStoredZip(zipPath, entries);

  addArtifact({
    id: randomUUID(),
    projectId,
    kind: "web-export",
    label: "Web Export",
    path: zipPath,
    createdAt: new Date().toISOString()
  });

  return {
    projectId,
    projectName: workspace.project.name,
    outputPath: zipPath,
    fileCount: entries.length,
    bytes: fs.statSync(zipPath).size
  };
}

export function writeStoredZip(zipPath: string, entries: ZipEntry[]): void {
  const parts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;
  const { time, date } = dosTimeDate(new Date());

  for (const entry of entries) {
    const name = Buffer.from(toZipPath(entry.name));
    const crc = crc32(entry.data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(entry.data.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    parts.push(local, name, entry.data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(date, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(entry.data.length, 20);
    central.writeUInt32LE(entry.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);

    offset += local.length + name.length + entry.data.length;
  }

  const centralOffset = offset;
  const centralSize = centralParts.reduce((total, part) => total + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(centralOffset, 16);
  end.writeUInt16LE(0, 20);

  fs.writeFileSync(zipPath, Buffer.concat([...parts, ...centralParts, end]));
}

function collectFiles(root: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const absolutePath = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...collectFiles(absolutePath));
    else if (entry.isFile()) files.push(absolutePath);
  }
  return files.sort();
}

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff];
  return (crc ^ 0xffffffff) >>> 0;
}

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

function dosTimeDate(value: Date): { time: number; date: number } {
  const time = (value.getHours() << 11) | (value.getMinutes() << 5) | Math.floor(value.getSeconds() / 2);
  const date = ((value.getFullYear() - 1980) << 9) | ((value.getMonth() + 1) << 5) | value.getDate();
  return { time, date };
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "gameos";
}

function toZipPath(value: string): string {
  return value.split(path.sep).join("/");
}
