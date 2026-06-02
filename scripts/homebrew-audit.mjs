import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const packageJson = readJson("package.json");
const formulaFiles = ["Formula/gameos.rb", "Formula/gameos@0.1.0.rb"];
const problems = [];
const reports = [];

for (const file of formulaFiles) {
  reports.push(await auditFormula(file));
}

const latestNpmVersion = npmView(["gameos", "version"]);
const stable = reports.find((report) => report.file === "Formula/gameos.rb");
assert(stable?.version === latestNpmVersion, `Formula/gameos.rb must track latest published npm version ${latestNpmVersion}; found ${stable?.version}.`);

const localPackagePublished = packageJson.version === latestNpmVersion;

if (problems.length > 0) {
  console.error("GAMEOS_HOMEBREW_AUDIT: FAIL");
  for (const problem of problems) console.error(`- ${problem}`);
  process.exitCode = 1;
} else {
  console.log("GAMEOS_HOMEBREW_AUDIT: PASS");
  console.log(
    JSON.stringify(
      {
        ok: true,
        npmLatest: latestNpmVersion,
        localPackage: packageJson.version,
        localPackagePublished,
        pendingFormulaUpdate: localPackagePublished ? null : `Publish npm ${packageJson.version}, then update Formula/gameos.rb to that tarball and sha256.`,
        formulas: reports
      },
      null,
      2
    )
  );
}

async function auditFormula(file) {
  assert(fs.existsSync(path.join(root, file)), `${file} is missing.`);
  const content = readText(file);
  const url = match(content, /url\s+"([^"]+)"/, `${file} must define url.`);
  const sha256 = match(content, /sha256\s+"([^"]+)"/, `${file} must define sha256.`);
  const className = match(content, /class\s+([A-Za-z0-9]+)\s+<\s+Formula/, `${file} must define a formula class.`);
  const version = match(url, /gameos-(\d+\.\d+\.\d+)\.tgz/, `${file} url must point to an npm gameos tarball.`);

  assert(content.includes('depends_on "node"'), `${file} must depend_on "node".`);
  assert(content.includes('system "npm", "install", *std_npm_args'), `${file} must install with std_npm_args.`);
  assert(content.includes("gameos --version"), `${file} test must run gameos --version.`);
  assert(content.includes("gameos doctor --json"), `${file} test must run gameos doctor --json.`);
  assert(content.includes('"telemetry": false'), `${file} test must assert telemetry=false.`);

  if (file.includes("@")) {
    const fileVersion = match(file, /gameos@(\d+\.\d+\.\d+)\.rb/, `${file} must be versioned as gameos@x.y.z.rb.`);
    assert(version === fileVersion, `${file} version ${version} must match filename ${fileVersion}.`);
    assert(className === classNameForVersion(version), `${file} class ${className} must be ${classNameForVersion(version)}.`);
  } else {
    assert(className === "Gameos", `${file} class must be Gameos.`);
  }

  const publishedVersion = npmView([`gameos@${version}`, "version"]);
  assert(publishedVersion === version, `${file} points to gameos@${version}, but npm registry returned ${publishedVersion}.`);

  const actualSha = await sha256ForUrl(url);
  assert(actualSha === sha256, `${file} sha256 mismatch. expected ${sha256}, actual ${actualSha}.`);

  return { file, className, version, url, sha256 };
}

function classNameForVersion(version) {
  return `GameosAT${version.replace(/\./g, "")}`;
}

function npmView(args) {
  return execFileSync("npm", ["view", ...args, "--json"], {
    cwd: root,
    encoding: "utf8"
  })
    .trim()
    .replace(/^"|"$/g, "");
}

async function sha256ForUrl(url) {
  const response = await fetch(url);
  assert(response.ok, `Unable to download ${url}: ${response.status} ${response.statusText}`);
  if (!response.ok) return "";
  const bytes = Buffer.from(await response.arrayBuffer());
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function readJson(file) {
  return JSON.parse(readText(file));
}

function readText(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function match(value, pattern, message) {
  const found = value.match(pattern)?.[1] ?? "";
  assert(Boolean(found), message);
  return found;
}

function assert(condition, message) {
  if (!condition) problems.push(message);
}
