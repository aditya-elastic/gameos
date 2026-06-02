import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";

const outdir = path.resolve("dist");
fs.rmSync(outdir, { recursive: true, force: true });
fs.mkdirSync(outdir, { recursive: true });

await build({
  entryPoints: ["src/cli/main.ts"],
  outdir: "dist",
  bundle: true,
  splitting: true,
  platform: "node",
  target: ["node24"],
  format: "esm",
  entryNames: "cli",
  chunkNames: "chunks/[name]-[hash]",
  sourcemap: false,
  external: ["playwright-core"]
});

fs.chmodSync("dist/cli.js", 0o755);
