import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const args = process.argv.slice(2);
const checkOnly = args.includes("--check");
const printOnly = args.includes("--print");
const versionArg = args.find((arg) => !arg.startsWith("--"));
const packageJson = readJson("package.json");
const version = versionArg || packageJson.version;
const formulaPath = path.join(root, "Formula", "gameos.rb");

if (!/^\d+\.\d+\.\d+$/.test(version)) {
  fail(`Expected a semver version like 0.2.0; received ${version}.`);
}

if (!fs.existsSync(formulaPath)) {
  fail("Formula/gameos.rb is missing.");
}

const tarballUrl = npmViewTarball(version);
const sha256 = await sha256ForUrl(tarballUrl);
const current = fs.readFileSync(formulaPath, "utf8");
const next = updateFormula(current, tarballUrl, sha256);
const matches = current === next;
const result = {
  ok: checkOnly ? matches : true,
  mode: checkOnly ? "check" : printOnly ? "print" : "write",
  version,
  formula: path.relative(root, formulaPath),
  tarballUrl,
  sha256,
  changed: !matches
};

if (checkOnly) {
  if (!matches) {
    console.error("GAMEOS_HOMEBREW_UPDATE: FAIL");
    console.error(`Formula/gameos.rb does not match published gameos@${version}. Run: npm run homebrew:update${versionArg ? ` -- ${version}` : ""}`);
    console.error(JSON.stringify(result, null, 2));
    process.exit(1);
  }
  console.log("GAMEOS_HOMEBREW_UPDATE: PASS");
  console.log(JSON.stringify(result, null, 2));
} else if (printOnly) {
  console.log("GAMEOS_HOMEBREW_UPDATE: PRINT");
  console.log(JSON.stringify(result, null, 2));
} else {
  fs.writeFileSync(formulaPath, next, "utf8");
  console.log("GAMEOS_HOMEBREW_UPDATE: PASS");
  console.log(JSON.stringify(result, null, 2));
}

function npmViewTarball(version) {
  try {
    const raw = execFileSync("npm", ["view", `gameos@${version}`, "dist.tarball", "--json"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    }).trim();
    const value = JSON.parse(raw);
    if (typeof value !== "string" || !value.startsWith("https://")) {
      fail(`npm returned an invalid tarball URL for gameos@${version}.`);
    }
    return value;
  } catch (error) {
    fail(`gameos@${version} is not published on npm yet. Publish npm first, then update the Homebrew formula.`);
  }
}

async function sha256ForUrl(url) {
  const response = await fetch(url);
  if (!response.ok) fail(`Unable to download ${url}: ${response.status} ${response.statusText}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function updateFormula(content, url, sha256) {
  if (!/url\s+"[^"]+"/.test(content)) fail("Formula/gameos.rb must contain a url line.");
  if (!/sha256\s+"[^"]+"/.test(content)) fail("Formula/gameos.rb must contain a sha256 line.");
  return content.replace(/url\s+"[^"]+"/, `url "${url}"`).replace(/sha256\s+"[^"]+"/, `sha256 "${sha256}"`);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
}

function fail(message) {
  console.error(`GAMEOS_HOMEBREW_UPDATE: FAIL\n- ${message}`);
  process.exit(1);
}
