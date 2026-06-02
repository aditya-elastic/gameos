import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const packageJson = readJson("package.json");
const agents = readJson("studio-agents/agents.json");
const agentRoles = new Set(agents.map((agent) => agent.role));
const problems = [];

const categories = [
  category("Agent Swarm And Skills", [
    check("21-agent registry exists", agents.length >= 21, `${agents.length} agents are registered.`, "Register at least 21 specialist agents."),
    checkRoles([
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
    ]),
    check(
      "Every agent has usable skills",
      agents.every((agent) => Array.isArray(agent.skills) && agent.skills.length >= 3 && agent.mission && agent.title),
      "Every registered agent has a title, mission, and at least three skills.",
      "One or more agents are too thin to be useful."
    ),
    fileCheck("Agent doctrines are implemented", "src/lib/agents.ts", [/Game Feel Doctrine/, /Physics Slice Doctrine/, /Security And Privacy Doctrine/, /Open Source Release Doctrine/])
  ]),
  category("Game Direction Design And Developer", [
    fileCheck("Scorecard covers direction and implementation", "src/lib/scorecard.ts", [/Game Direction And Design/, /Gameplay Developer owns implementation-slice contract/]),
    fileCheck("Prompt intake expands physics-puzzle intent", "src/lib/intake.ts", [/physics puzzle/i, /coreLoop/, /risks/]),
    fileCheck("Game rules spec records Cut Rope loop", "src/lib/artifacts.ts", [/Candy starts attached to a rope/, /Reset restores rope, candy, star, and goal state/]),
    fileCheck("Playable builds must be testable", "src/lib/agents.ts", [/No playable build is accepted unless the implementation can be tested by the QA Director and challenged by the Advanced Player/])
  ]),
  category("Creator UX Flow", [
    fileCheck("CLI exposes core creator commands", "src/cli/main.ts", [/case "make"/, /case "journey"/, /case "review"/, /case "feedback"/, /case "artifact"/]),
    fileCheck("CLI output explains blockers", "src/cli/output.ts", [/Current blockers/, /Next best command/, /Advanced Player did not approve/]),
    fileCheck("Docs explain the command journey", "docs/CLI.md", [/gameos make/, /gameos journey/, /gameos feedback/, /Studio Review/]),
    fileCheck("Artifact output is summary-first", "src/cli/main.ts", [/--full/, /summarizeArtifactContent/])
  ]),
  category("Asset Pipeline And Visual Quality", [
    fileCheck("Role-based asset classifier exists", "src/lib/asset-importer.ts", [/hero-object/, /goal-character/, /collectible/, /WRONG_ASSET_PACK_FOR_CUT_ROPE/]),
    fileCheck("Wrong-role asset tests exist", "src/lib/asset-importer.test.ts", [/rejects UI buttons as the hero physics object/, /goal-character/]),
    fileCheck("Visual quality director owns screenshot maturity", "src/lib/agents.ts", [/Visual Quality Doctrine/, /Do not promote a Web prototype as worth playing/]),
    fileCheck("Asset-led docs require role fit", "docs/V1_ACCEPTANCE.md", [/Asset packs produce role assignments/, /wrong-role assets block promotion/i])
  ]),
  category("Web Game Playability", [
    fileCheck("Web generator uses V3 physics prototype", "src/lib/web-adapter.ts", [/renderCutRopeGameScriptV3/, /pendulum-swing-momentum-gravity-bumper-collision-no-goal-magnet/]),
    fileCheck("No-goal-magnet physics gate is enforced", "scripts/web-player-agent.mjs", [/physics_model.*no-goal-magnet/, /Timing skill gate failed/, /Agency gate failed/]),
    fileCheck("Slow human blade input is implemented", "src/lib/web-adapter.ts", [/slowFreeMoveRopeForQa/, /pointerrawupdate/, /bladeTrailCutsRope/]),
    fileCheck("Web smoke requires watermark and slow blade", "scripts/web-smoke.mjs", [/GameOS watermark/, /hasSlowMouseBlade/, /slow human mouse blade/])
  ]),
  category("QA Player Agent Evidence", [
    scriptCheck("acceptance:cutrope", "node scripts/cutrope-acceptance.mjs"),
    fileCheck("Acceptance test proves 10/10 game", "scripts/cutrope-acceptance.mjs", [/10_OUT_OF_10_READY_FOR_LOCAL_USERS/, /WORTH_PLAYING_FOR_CUT_ROPE_WEB_PROTOTYPE/, /agentCount >= 21/]),
    fileCheck("Advanced Player blocks shallow games", "scripts/web-player-agent.mjs", [/WEB_PLAYER_AGENT_REPORT/, /MASTERY_GATE_PASS/, /SLOW_MOUSE_BLADE_PASS/]),
    fileCheck("CLI browser QA proves cut reset recut", "src/cli/web-qa.ts", [/firstCutPass/, /noAutoCutPass/, /slowMousePass/, /recutPass/])
  ]),
  category("Security Privacy And Storage", [
    fileCheck("Security policy is local-first", "SECURITY.md", [/No telemetry/, /No hidden network calls/, /GAME_OS_DATA_DIR/]),
    fileCheck("Doctor reports privacy posture", "src/cli/main.ts", [/telemetry: false/, /cloudCalls: false/, /hiddenNetwork: false/]),
    fileCheck("Storage and memory managers are scored", "src/lib/scorecard.ts", [/Memory And Storage/, /Security And Privacy/, /Artifacts live under project root/]),
    fileCheck("Build Sentinel gates heavy work", "src/lib/agents.ts", [/Only one heavy engine\/build lane may run at a time/, /Unity, Godot, Xcode, SteamCMD, and headed QA commands must be serialized/])
  ]),
  category("Open Source Release Readiness", [
    check("Package is public and CLI installable", packageJson.private === false && packageJson.name === "gameos" && packageJson.bin?.gameos === "dist/cli.js", "package.json exposes public gameos CLI.", "Package metadata is not public CLI-ready."),
    fileCheck("Release audit protects package boundary", "scripts/release-audit.mjs", [/checkPackContents/, /npm package must not include/, /privacy/]),
    fileCheck("Homebrew updater is deterministic", "scripts/update-homebrew-formula.mjs", [/npmViewTarball/, /sha256ForUrl/, /--check/]),
    fileCheck("CI and release workflows exist", ".github/workflows/ci.yml", [/npm run check/, /npm install -g \.\/gameos-\*\.tgz/]),
    fileCheck("Release workflow publishes through npm auth paths", ".github/workflows/release.yml", [/id-token: write/, /secrets.NPM_TOKEN/, /npm publish/])
  ]),
  category("Documentation And Contributor Trust", [
    fileExists("LICENSE"),
    fileExists("CODE_OF_CONDUCT.md"),
    fileExists("CHANGELOG.md"),
    fileCheck("README explains quickstart and privacy", "README.md", [/npm install -g gameos/, /V1 has no telemetry/, /Web Worth-Playing Gates/]),
    fileCheck("Publishing docs explain npm/Homebrew", "docs/PUBLISHING.md", [/trusted publishing/, /npm run homebrew:update/]),
    fileCheck("Goal audit docs exist", "docs/GOAL_AUDIT.md", [/10\/10 Goal Audit/, /Agent Swarm And Skills/])
  ]),
  category("Goal Completion Discipline", [
    scriptCheck("goal:audit", "node scripts/goal-audit.mjs"),
    check("npm run check includes goal:audit", packageJson.scripts?.check?.includes("npm run goal:audit"), "check runs goal:audit before release/build gates.", "npm run check does not include goal:audit."),
    fileCheck("Release audit requires goal audit", "scripts/release-audit.mjs", [/goal:audit/, /docs\/GOAL_AUDIT\.md/]),
    fileCheck("Architecture documents 10/10 doctrine", "docs/ARCHITECTURE.md", [/10\/10 Review Doctrine/, /npm run acceptance:cutrope/]),
    fileCheck("V1 acceptance documents goal audit", "docs/V1_ACCEPTANCE.md", [/npm run goal:audit/, /10\/10 local-readiness proof/])
  ])
];

for (const result of categories) {
  if (result.score !== 10) {
    for (const gap of result.gaps) problems.push(`${result.name}: ${gap}`);
  }
}

const summary = {
  ok: problems.length === 0,
  package: `${packageJson.name}@${packageJson.version}`,
  categories: categories.length,
  minimumCategoryScore: Math.min(...categories.map((result) => result.score)),
  verdict: problems.length === 0 ? "10_OUT_OF_10_LOCAL_GOAL_READY" : "NEEDS_GOAL_EVIDENCE",
  results: categories
};

if (problems.length > 0) {
  console.error("GAMEOS_GOAL_AUDIT: FAIL");
  for (const problem of problems) console.error(`- ${problem}`);
  console.error(JSON.stringify(summary, null, 2));
  process.exit(1);
}

console.log("GAMEOS_GOAL_AUDIT: PASS");
console.log(JSON.stringify(summary, null, 2));

function category(name, checks) {
  const passed = checks.filter((item) => item.pass);
  return {
    name,
    score: checks.length === 0 ? 0 : Math.round((passed.length / checks.length) * 10),
    checks: checks.length,
    evidence: passed.map((item) => item.evidence),
    gaps: checks.filter((item) => !item.pass).map((item) => item.gap)
  };
}

function check(label, pass, evidence, gap) {
  return { label, pass: Boolean(pass), evidence, gap };
}

function checkRoles(roles) {
  const missing = roles.filter((role) => !agentRoles.has(role));
  return check("Required specialist roles are registered", missing.length === 0, "All required specialist agent roles are present.", `Missing agent roles: ${missing.join(", ") || "none"}.`);
}

function scriptCheck(name, expected) {
  return check(`${name} script exists`, packageJson.scripts?.[name] === expected, `package.json exposes ${name}.`, `package.json script ${name} must be ${expected}.`);
}

function fileExists(relativePath) {
  return check(`${relativePath} exists`, fs.existsSync(path.join(root, relativePath)), `${relativePath} exists.`, `${relativePath} is missing.`);
}

function fileCheck(label, relativePath, patterns) {
  const filePath = path.join(root, relativePath);
  if (!fs.existsSync(filePath)) return check(label, false, `${relativePath} exists.`, `${relativePath} is missing.`);
  const content = fs.readFileSync(filePath, "utf8");
  const missing = patterns.filter((pattern) => !pattern.test(content));
  return check(label, missing.length === 0, `${relativePath} contains the expected evidence.`, `${relativePath} is missing evidence: ${missing.map(String).join(", ")}.`);
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}
