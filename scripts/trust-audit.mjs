import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const agents = JSON.parse(fs.readFileSync(path.join(root, "studio-agents", "agents.json"), "utf8"));
const problems = [];

checkPackage();
checkAgents();
checkSource();
checkPublicLanguage();
checkCliDiagnosis();

if (problems.length) {
  console.error("GAMEOS_TRUST_AUDIT: FAIL");
  for (const problem of problems) console.error(`- ${problem}`);
  process.exit(1);
}

console.log("GAMEOS_TRUST_AUDIT: PASS");
console.log(JSON.stringify({ ok: true, package: `${packageJson.name}@${packageJson.version}`, verdicts: ["LOCAL_PROTOTYPE_READY", "CREATOR_TEST_READY", "NEEDS_IMPROVEMENT", "BLOCKED"], agents: agents.length }, null, 2));

function checkPackage() {
  assert(packageJson.version === "0.4.1", "package version must be 0.4.1 for the first-user polish patch release.");
  assert(packageJson.scripts?.["trust:audit"] === "node scripts/trust-audit.mjs", "package must expose trust:audit.");
  assert(packageJson.scripts?.["acceptance:universal-trust"] === "node scripts/universal-trust-acceptance.mjs", "package must expose acceptance:universal-trust.");
  assert(packageJson.scripts?.["acceptance:universal-deep"] === "node scripts/universal-deep-acceptance.mjs", "package must expose acceptance:universal-deep.");
}

function checkAgents() {
  for (const role of ["product-truth-officer", "acceptance-architect", "advanced-player-council", "evidence-auditor", "universal-capability-steward"]) {
    assert(agents.some((agent) => agent.role === role), `agent registry missing ${role}.`);
  }
}

function checkSource() {
  const types = read("src/lib/types.ts");
  const trust = read("src/lib/trust.ts");
  const scorecard = read("src/lib/scorecard.ts");
  const main = read("src/cli/main.ts");
  const output = read("src/cli/output.ts");
  const starterIdeas = read("src/cli/starter-ideas.ts").toLowerCase();
  assert(types.includes("AcceptanceProfile"), "types must define AcceptanceProfile.");
  assert(types.includes("TrustDiagnosis"), "types must define TrustDiagnosis.");
  assert(trust.includes("trustVerdictFromScore"), "trust module must own verdict tiers.");
  assert(scorecard.includes("trustVerdictFromScore"), "scorecard must use trust verdict tiers.");
  assert(main.includes('case "diagnose"'), "CLI must expose gameos diagnose.");
  assert(main.includes('case "next"') && main.includes('case "examples"') && main.includes('case "init"'), "CLI must expose init, examples, and next.");
  assert(output.includes("Needs browser QA") && output.includes("Needs asset fit"), "CLI output must use friendly blocker labels.");
  assert(starterIdeas.includes("one-button arcade survival") && starterIdeas.includes("narrative puzzle"), "starter ideas must cover universal prompt families.");
}

function checkPublicLanguage() {
  const publicFiles = ["README.md", "docs/CLI.md", "docs/ARCHITECTURE.md", "docs/V1_ACCEPTANCE.md", "docs/RELEASE_CHECKLIST.md"];
  for (const file of publicFiles) {
    const content = read(file).toLowerCase();
    assert(!/\b10\/10\b/.test(content), `${file} must not market 10/10 readiness.`);
    assert(!/\bpublish-ready\b/.test(content), `${file} must not claim publish-ready local Web proof.`);
    assert(!/\bstore-ready\b/.test(content), `${file} must not claim store-ready local Web proof.`);
  }
}

function checkCliDiagnosis() {
  const cli = path.join(root, "dist", "cli.js");
  if (!fs.existsSync(cli)) return;
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "gameos-trust-audit-"));
  try {
    const make = JSON.parse(execFileSync(process.execPath, [cli, "make", "--prompt", "A one-button arcade survival game with dodging, scoring, streaks, readable hazards, and fast retries.", "--target", "web-playable", "--quality", "fast", "--yes", "--json", "--data-dir", dataDir], { cwd: root, encoding: "utf8", env: { ...process.env, GAME_OS_DATA_DIR: dataDir, NODE_OPTIONS: "--disable-warning=ExperimentalWarning" } }));
    assert(make.project.artifactCount > 0 && !Array.isArray(make.project.artifacts), "default make --json must be summary-first and omit artifact lists.");
    const strictDiagnosis = runCliMaybeFail([cli, "diagnose", make.project.id, "--json", "--strict", "--data-dir", dataDir], dataDir);
    assert(strictDiagnosis.status !== 0, "diagnose --strict must fail for NEEDS_IMPROVEMENT.");
    const diagnosis = JSON.parse(execFileSync(process.execPath, [cli, "diagnose", make.project.id, "--json", "--full", "--data-dir", dataDir], { cwd: root, encoding: "utf8", env: { ...process.env, GAME_OS_DATA_DIR: dataDir, NODE_OPTIONS: "--disable-warning=ExperimentalWarning" } }));
    assert(["LOCAL_PROTOTYPE_READY", "CREATOR_TEST_READY", "NEEDS_IMPROVEMENT", "BLOCKED"].includes(diagnosis.diagnosis.verdict), "diagnose must return a trust verdict tier.");
    assert(diagnosis.project.artifacts.some((artifact) => artifact.kind === "acceptance-profile"), "diagnose project payload must include acceptance-profile artifact.");
  } finally {
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

function runCliMaybeFail(args, dataDir) {
  try {
    return {
      status: 0,
      stdout: execFileSync(process.execPath, args, { cwd: root, encoding: "utf8", env: { ...process.env, GAME_OS_DATA_DIR: dataDir, NODE_OPTIONS: "--disable-warning=ExperimentalWarning" } })
    };
  } catch (error) {
    return {
      status: typeof error.status === "number" ? error.status : 1,
      stdout: String(error.stdout || "")
    };
  }
}

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function assert(condition, message) {
  if (!condition) problems.push(message);
}
