import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";

const outdir = path.resolve("dist");
fs.rmSync(outdir, { recursive: true, force: true });
fs.mkdirSync(outdir, { recursive: true });

await build({
  entryPoints: ["src/cli/main.ts"],
  outfile: "dist/cli.js",
  bundle: true,
  splitting: false,
  platform: "node",
  target: ["node24"],
  format: "esm",
  sourcemap: false,
  external: ["playwright-core"]
});

fs.chmodSync("dist/cli.js", 0o755);
