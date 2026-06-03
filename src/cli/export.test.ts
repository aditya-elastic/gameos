import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeDatabasesForTests } from "../lib/db";
import { createStudioProject, generateWebAdapter } from "../lib/studio";
import { exportWebProject, writeStoredZip } from "./export";

let dataDir = "";

beforeEach(() => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "game-os-export-test-"));
  process.env.GAME_OS_DATA_DIR = dataDir;
});

afterEach(() => {
  closeDatabasesForTests();
  fs.rmSync(dataDir, { recursive: true, force: true });
  delete process.env.GAME_OS_DATA_DIR;
});

describe("web export", () => {
  it("writes a valid zip file with local Web build and Game OS provenance", () => {
    const workspace = createStudioProject({
      prompt: "A one-button arcade survival game with score, hazards, streaks, and fast retry.",
      targetPlatforms: ["Web"],
      enginePreference: "Web first"
    });
    generateWebAdapter(workspace.project.id);

    const result = exportWebProject(workspace.project.id);
    const bytes = fs.readFileSync(result.outputPath);

    expect(result.fileCount).toBeGreaterThan(3);
    expect(bytes.readUInt32LE(0)).toBe(0x04034b50);
    expect(bytes.includes(Buffer.from("web/index.html"))).toBe(true);
    expect(bytes.includes(Buffer.from("gameos-export-manifest.json"))).toBe(true);
  });

  it("can write a dependency-free stored zip", () => {
    const output = path.join(dataDir, "sample.zip");
    writeStoredZip(output, [{ name: "hello.txt", data: Buffer.from("Made with GameOS") }]);
    const bytes = fs.readFileSync(output);

    expect(bytes.readUInt32LE(0)).toBe(0x04034b50);
    expect(bytes.includes(Buffer.from("hello.txt"))).toBe(true);
    expect(bytes.includes(Buffer.from("Made with GameOS"))).toBe(true);
  });
});
