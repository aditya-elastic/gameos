import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const problems = [];
const packageJson = readJson("package.json");
const agents = readJson("studio-agents/agents.json");

checkPackageMetadata();
checkCliBinary();
checkAgentRegistry();
checkDocs();
checkWorkflowsAndFormulae();
checkPackContents();
checkUniversalPackageLanguage();

if (problems.length > 0) {
  console.error("GAMEOS_RELEASE_AUDIT: FAIL");
  for (const problem of problems) console.error(`- ${problem}`);
  process.exitCode = 1;
} else {
  console.log("GAMEOS_RELEASE_AUDIT: PASS");
  console.log(
    JSON.stringify(
      {
        ok: true,
        package: `${packageJson.name}@${packageJson.version}`,
        agents: agents.length,
        binary: packageJson.bin?.gameos,
        privacy: "local-first/no-telemetry",
        tarball: "publish boundary verified"
      },
      null,
      2
    )
  );
}

function checkPackageMetadata() {
  assert(packageJson.private === false, "package.json must be publishable with private=false.");
  assert(packageJson.name === "gameos", "package name must be gameos for the public CLI package.");
  assert(/^\d+\.\d+\.\d+/.test(packageJson.version), "package version must be semver-like.");
  assert(packageJson.bin?.gameos === "dist/cli.js", "package bin must expose gameos -> dist/cli.js.");
  assert(packageJson.license === "MIT", "package license must be MIT.");
  assert(packageJson.engines?.node === ">=24.0.0", "Node 24+ engine requirement must be explicit.");
  assert(packageJson.scripts?.["acceptance:web-quality"] === "node scripts/web-quality-acceptance.mjs", "package scripts must expose acceptance:web-quality.");
  assert(packageJson.scripts?.["acceptance:universal-trust"] === "node scripts/universal-trust-acceptance.mjs", "package scripts must expose acceptance:universal-trust.");
  assert(packageJson.scripts?.["acceptance:universal-deep"] === "node scripts/universal-deep-acceptance.mjs", "package scripts must expose acceptance:universal-deep.");
  assert(packageJson.scripts?.["trust:audit"] === "node scripts/trust-audit.mjs", "package scripts must expose trust:audit.");
  assert(packageJson.scripts?.["goal:audit"] === "node scripts/goal-audit.mjs", "package scripts must expose goal:audit.");
  assert(packageJson.scripts?.["release:audit"] === "node scripts/release-audit.mjs", "package scripts must expose release:audit.");
  assert(packageJson.scripts?.["homebrew:audit"] === "node scripts/homebrew-audit.mjs", "package scripts must expose homebrew:audit.");
  assert(packageJson.scripts?.["homebrew:update"] === "node scripts/update-homebrew-formula.mjs", "package scripts must expose homebrew:update.");
  assert(Array.isArray(packageJson.files), "package files whitelist must be present.");

  for (const required of [
    "dist/",
    "docs/ARCHITECTURE.md",
    "docs/CLI.md",
    "docs/GOAL_AUDIT.md",
    "docs/PUBLISHING.md",
    "docs/RELEASE_CHECKLIST.md",
    "docs/TROUBLESHOOTING.md",
    "docs/V1_ACCEPTANCE.md",
    "studio-agents/",
    "README.md",
    "LICENSE",
    "CHANGELOG.md",
    "SECURITY.md",
    "CODE_OF_CONDUCT.md"
  ]) {
    assert(packageJson.files.includes(required), `package files whitelist must include ${required}.`);
  }
  assert(!packageJson.files.includes("docs/*.md"), "package files whitelist must not include docs/*.md; explicit docs prevent local scratch files from shipping.");

  for (const forbidden of ["src", "scripts", "data", "tmp", ".next", ".codex-plugin"]) {
    assert(!packageJson.files.includes(forbidden), `package files whitelist must not include ${forbidden}.`);
  }
}

function checkCliBinary() {
  const cliPath = path.join(root, "dist", "cli.js");
  assert(fs.existsSync(cliPath), "dist/cli.js is missing. Run npm run build:cli.");
  if (fs.existsSync(cliPath)) {
    const mode = fs.statSync(cliPath).mode;
    assert(Boolean(mode & 0o111), "dist/cli.js must be executable.");
  }

  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "gameos-release-audit-"));
  try {
    const version = runCli(["--version"], dataDir).trim();
    assert(version === `gameos ${packageJson.version}`, "--version output must match package version.");

    const help = runCli(["--help"], dataDir);
    assert(help.includes("gameos review <project-id>"), "CLI help must expose gameos review.");
    assert(help.includes("gameos diagnose <project-id>"), "CLI help must expose gameos diagnose.");
    assert(help.includes("gameos examples"), "CLI help must expose gameos examples.");
    assert(help.includes("gameos next <project-id>"), "CLI help must expose gameos next.");
    assert(help.includes("gameos assets preview <project-id>"), "CLI help must expose asset preview.");
    assert(help.includes("gameos export web <project-id>"), "CLI help must expose Web export.");
    assert(help.includes("--strict"), "CLI help must expose strict diagnosis mode.");
    assert(help.includes("--allow-heavy"), "CLI help must expose heavy-lane guardrails.");

    const doctor = JSON.parse(runCli(["doctor", "--json"], dataDir));
    assert(doctor.privacy?.telemetry === false, "doctor JSON must report telemetry=false.");
    assert(doctor.privacy?.cloudCalls === false, "doctor JSON must report cloudCalls=false.");
    assert(doctor.privacy?.hiddenNetwork === false, "doctor JSON must report hiddenNetwork=false.");
  } finally {
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

function checkAgentRegistry() {
  const requiredRoles = [
    "global-os-designer",
    "product-truth-officer",
    "acceptance-architect",
    "advanced-player-council",
    "evidence-auditor",
    "universal-capability-steward",
    "studio-director",
    "game-designer",
    "gameplay-developer",
    "technical-architect",
    "ux-flow-director",
    "rules-systems-designer",
    "art-director",
    "asset-pipeline-director",
    "visual-quality-director",
    "game-feel-director",
    "physics-gameplay-engineer",
    "advanced-player",
    "qa-director",
    "memory-manager",
    "storage-manager",
    "security-privacy-reviewer",
    "prototype-producer",
    "platform-producer",
    "swarm-orchestrator",
    "build-sentinel",
    "open-source-release-engineer"
  ];
  const roles = new Set(agents.map((agent) => agent.role));

  assert(agents.length >= requiredRoles.length, `agent registry must contain at least ${requiredRoles.length} agents.`);
  assert(agents[0]?.role === "global-os-designer", "Global OS Designer must be the first agent in the registry.");
  assert(
    agents.slice(0, 6).map((agent) => agent.role).join(",") ===
      "global-os-designer,product-truth-officer,acceptance-architect,advanced-player-council,evidence-auditor,universal-capability-steward",
    "Ownership governance agents must run before Studio Director."
  );
  for (const role of requiredRoles) assert(roles.has(role), `agent registry missing ${role}.`);
  const globalOsDesigner = agents[0];
  for (const skill of [
    "ultra-global business expansion",
    "category-defining product vision",
    "global market strategy",
    "ecosystem platform strategy",
    "universal product language",
    "public package direction",
    "release-blocking architecture governance"
  ]) {
    assert(globalOsDesigner.skills.includes(skill), `Global OS Designer must include ${skill}.`);
  }
  for (const agent of agents) {
    assert(agent.title && agent.mission && Array.isArray(agent.skills) && agent.skills.length > 0, `agent ${agent.role} must have title, mission, and skills.`);
  }
}

function checkUniversalPackageLanguage() {
  const shippedTextFiles = [
    "dist/cli.js",
    "README.md",
    "CHANGELOG.md",
    "docs/CLI.md",
    "docs/ARCHITECTURE.md",
    "docs/GOAL_AUDIT.md",
    "docs/PUBLISHING.md",
    "docs/RELEASE_CHECKLIST.md",
    "docs/TROUBLESHOOTING.md",
    "docs/V1_ACCEPTANCE.md",
    "studio-agents/agents.json"
  ];
  const forbidden = [
    "bHVkbw==",
    "cGFjaGlzaQ==",
    "Y3V0LXJvcGU=",
    "Y3V0IHJvcGU=",
    "Y3V0IHRoZSByb3Bl",
    "a2VubmV5",
    "Y2FuZHk=",
    "cHVsc2UgaG9wcGVy",
    "cnVuIHRoZSBzdHJhaXQ=",
    "cm95YWwgbHVkbw==",
    "b20gbm9t",
    "cm9wZSBwaHlzaWNz",
    "Ym9hcmQtcnVsZXM=",
    "YWNjZXB0YW5jZTphc3NldC1waHlzaWNz"
  ].map((encoded) => {
    const term = Buffer.from(encoded, "base64").toString("utf8");
    return { encoded, pattern: new RegExp(`\\b${escapeRegex(term)}\\b`, "i") };
  });

  for (const file of shippedTextFiles) {
    const absolute = path.join(root, file);
    if (!fs.existsSync(absolute)) continue;
    const content = fs.readFileSync(absolute, "utf8");
    assert(!/\b10\/10\b/.test(content), `${file} must not market numeric perfection.`);
    assert(!/\b10_OUT_OF_10\b/.test(content), `${file} must not ship obsolete readiness constants.`);
    assert(!/\bpublish-ready\b/i.test(content), `${file} must not claim publish-ready local Web proof.`);
    assert(!/\bstore-ready\b/i.test(content), `${file} must not claim store-ready local Web proof.`);
    for (const { encoded, pattern } of forbidden) {
      assert(!pattern.test(content), `${file} must use universal Game OS language; forbidden narrow term matched encoded:${encoded}.`);
    }
  }
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function checkDocs() {
  const requiredDocs = [
    "README.md",
    "LICENSE",
    "SECURITY.md",
    "CODE_OF_CONDUCT.md",
    "CHANGELOG.md",
    "docs/CLI.md",
    "docs/ARCHITECTURE.md",
    "docs/GOAL_AUDIT.md",
    "docs/PUBLISHING.md",
    "docs/RELEASE_CHECKLIST.md",
    "docs/TROUBLESHOOTING.md",
    "docs/V1_ACCEPTANCE.md"
  ];

  for (const file of requiredDocs) assert(fs.existsSync(path.join(root, file)), `${file} is required for release.`);

  const readme = readText("README.md");
  assert(readme.includes("npm install -g gameos"), "README must include npm install instructions.");
  assert(readme.includes("gameos review <project-id>"), "README must document gameos review.");
  assert(readme.includes("gameos diagnose <project-id>"), "README must document gameos diagnose.");
  assert(readme.includes("gameos examples"), "README must document gameos examples.");
  assert(readme.includes("gameos next <project-id>"), "README must document gameos next.");
  assert(readme.includes("gameos export web <project-id>"), "README must document gameos export web.");
  assert(readme.includes("gameos assets preview <project-id>"), "README must document asset preview.");
  assert(readme.includes("Universal Coverage Proof"), "README must explain universal coverage proof.");
  assert(readme.includes("Passing these gates means Game OS can build and honestly judge many kinds of local Web prototypes"), "README must explain the honest universal acceptance boundary.");
  assert(readme.includes("npm run acceptance:universal-trust"), "README must document acceptance:universal-trust.");
  assert(readme.includes("npm run acceptance:universal-deep"), "README must document acceptance:universal-deep.");
  assert(readme.includes("npm run trust:audit"), "README must document trust:audit.");
  assert(readme.includes("npm run acceptance:web-quality"), "README must document acceptance:web-quality.");
  assert(readme.includes("npm run goal:audit"), "README must document goal:audit.");
  assert(readme.includes("npm run homebrew:update"), "README must document homebrew:update.");
  assert(readme.includes("V1 has no telemetry"), "README must document privacy posture.");

  const cliDocs = readText("docs/CLI.md");
  assert(cliDocs.includes("Trust Review"), "CLI docs must document Trust Review.");
  assert(cliDocs.includes("gameos diagnose <project-id>"), "CLI docs must document diagnose.");
  assert(cliDocs.includes("gameos examples"), "CLI docs must document examples.");
  assert(cliDocs.includes("gameos next <project-id>"), "CLI docs must document next.");
  assert(cliDocs.includes("gameos export web <project-id>"), "CLI docs must document export web.");
  assert(cliDocs.includes("gameos assets preview <project-id>"), "CLI docs must document asset preview.");
  assert(cliDocs.includes("Universal Coverage Proof"), "CLI docs must explain universal coverage proof.");
  assert(cliDocs.includes("npm run acceptance:universal-trust"), "CLI docs must document acceptance:universal-trust.");
  assert(cliDocs.includes("npm run acceptance:universal-deep"), "CLI docs must document acceptance:universal-deep.");
  assert(cliDocs.includes("npm run trust:audit"), "CLI docs must document trust:audit.");
  assert(cliDocs.includes("npm run acceptance:web-quality"), "CLI docs must document acceptance:web-quality.");
  assert(cliDocs.includes("11-category score"), "CLI docs must explain the 11-category score.");

  const architecture = readText("docs/ARCHITECTURE.md");
  assert(architecture.includes("Trust Review Doctrine"), "Architecture docs must explain Trust Review Doctrine.");
  assert(architecture.includes("acceptance profile"), "Architecture docs must explain acceptance profiles.");
  assert(architecture.includes("Global OS Designer"), "Architecture docs must list Global OS Designer.");
  assert(architecture.includes("capability map"), "Architecture docs must explain capability mapping.");
  assert(architecture.includes("Security Privacy Reviewer"), "Architecture docs must list security/privacy agent.");
  assert(architecture.includes("Open Source Release Engineer"), "Architecture docs must list open-source release agent.");

  const goalAudit = readText("docs/GOAL_AUDIT.md");
  assert(goalAudit.includes("Goal Trust Audit"), "Goal audit docs must explain the trust audit.");
  assert(goalAudit.includes("Agent Swarm And Skills"), "Goal audit docs must list the agent swarm category.");
  assert(goalAudit.includes("npm run goal:audit"), "Goal audit docs must include the command.");
  assert(goalAudit.includes("npm run trust:audit"), "Goal audit docs must include trust:audit.");

  const publishing = readText("docs/PUBLISHING.md");
  assert(publishing.includes("npm run homebrew:update"), "Publishing docs must document deterministic Homebrew formula updates.");

  const releaseChecklist = readText("docs/RELEASE_CHECKLIST.md");
  assert(releaseChecklist.includes("npm run homebrew:update"), "Release checklist must document deterministic Homebrew formula updates.");
}

function checkWorkflowsAndFormulae() {
  const ci = readText(".github/workflows/ci.yml");
  const release = readText(".github/workflows/release.yml");
  const formula = readText("Formula/gameos.rb");
  const versionedFormula = readText("Formula/gameos@0.1.0.rb");

  assert(ci.includes("ubuntu-latest") && ci.includes("macos-latest"), "CI must run on Linux and macOS.");
  assert(ci.includes('node-version: "24"'), "CI must use Node 24.");
  assert(ci.includes("npm run check"), "CI must run npm run check.");
  assert(ci.includes("npm run homebrew:audit"), "CI must run Homebrew audit on macOS.");
  assert(ci.includes("npm install -g ./gameos-*.tgz"), "CI must smoke install the packed tarball.");

  assert(release.includes("id-token: write"), "Release workflow must grant OIDC id-token permission for trusted publishing.");
  assert(release.includes("npm run check"), "Release workflow must run npm run check.");
  assert(release.includes("Verify version is not already published"), "Release workflow must block duplicate npm versions.");
  assert(release.includes("npm install -g ./gameos-*.tgz"), "Release workflow must smoke install the packed tarball.");
  assert(release.includes("Publish auth mode"), "Release workflow must report npm publish authentication mode.");
  assert(release.includes("secrets.NPM_TOKEN"), "Release workflow must support NPM_TOKEN fallback.");
  assert(release.includes("npm publish"), "Release workflow must publish to npm.");
  assert(release.includes("Homebrew update instructions"), "Release workflow must print Homebrew update instructions.");
  assert(release.includes("npm run homebrew:update"), "Release workflow must mention homebrew:update.");

  for (const [file, content] of [
    ["Formula/gameos.rb", formula],
    ["Formula/gameos@0.1.0.rb", versionedFormula]
  ]) {
    assert(content.includes('depends_on "node"'), `${file} must depend on node.`);
    assert(content.includes('system "npm", "install", *std_npm_args'), `${file} must use std_npm_args.`);
    assert(content.includes("gameos --version"), `${file} must test gameos --version.`);
    assert(content.includes("gameos doctor --json"), `${file} must test gameos doctor --json.`);
  }
}

function checkPackContents() {
  const output = execFileSync("npm", ["pack", "--dry-run", "--json"], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, npm_config_cache: path.join(root, "tmp", "npm-cache") }
  });
  const packs = JSON.parse(output);
  const files = new Set(packs[0]?.files?.map((entry) => entry.path) ?? []);
  const requiredFiles = [
    "dist/cli.js",
    "studio-agents/agents.json",
    "README.md",
    "LICENSE",
    "SECURITY.md",
    "CODE_OF_CONDUCT.md",
    "CHANGELOG.md",
    "docs/CLI.md",
    "docs/ARCHITECTURE.md",
    "docs/GOAL_AUDIT.md",
    "docs/PUBLISHING.md",
    "docs/RELEASE_CHECKLIST.md",
    "docs/TROUBLESHOOTING.md",
    "docs/V1_ACCEPTANCE.md"
  ];
  const forbiddenPatterns = [
    /^src\//,
    /^scripts\//,
    /^data\//,
    /^tmp\//,
    /^\.next/,
    /^\.codex-plugin\//,
    /^projects\//,
    /game-os\.sqlite/,
    /assets\/.*\.(png|jpg|jpeg|webp)$/i
  ];

  for (const file of requiredFiles) assert(files.has(file), `npm package must include ${file}.`);
  for (const file of files) {
    for (const pattern of forbiddenPatterns) {
      assert(!pattern.test(file), `npm package must not include ${file}.`);
    }
  }
  assert(files.size <= 24, `npm package should stay tight; found ${files.size} files.`);
}

function runCli(args, dataDir) {
  return execFileSync(process.execPath, [path.join(root, "dist", "cli.js"), ...args, "--data-dir", dataDir], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      GAME_OS_DATA_DIR: dataDir,
      NODE_OPTIONS: "--disable-warning=ExperimentalWarning"
    }
  });
}

function readJson(file) {
  return JSON.parse(readText(file));
}

function readText(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function assert(condition, message) {
  if (!condition) problems.push(message);
}
