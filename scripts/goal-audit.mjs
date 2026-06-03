import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const packageJson = readJson("package.json");
const agents = readJson("studio-agents/agents.json");
const agentRoles = new Set(agents.map((agent) => agent.role));
const problems = [];

const categories = [
  category("Agent Swarm And Skills", [
    check("ownership-grade agent registry exists", agents.length >= 27, `${agents.length} agents are registered.`, "Register the ownership-grade specialist agent stack."),
    check("Global OS Designer is first", agents[0]?.role === "global-os-designer", "Global OS Designer is the first registry role.", "Global OS Designer must be the first and highest-priority role."),
    check(
      "Ownership governance runs before Studio Director",
      agents.slice(0, 6).map((agent) => agent.role).join(",") === "global-os-designer,product-truth-officer,acceptance-architect,advanced-player-council,evidence-auditor,universal-capability-steward",
      "Truth, acceptance, player council, evidence, and capability governance precede Studio Director.",
      "Ownership governance agents must appear immediately after Global OS Designer and before Studio Director."
    ),
    checkRoles([
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
    ]),
    check(
      "Every agent has usable skills",
      agents.every((agent) => Array.isArray(agent.skills) && agent.skills.length >= 3 && agent.mission && agent.title),
      "Every registered agent has a title, mission, and at least three skills.",
      "One or more agents are too thin to be useful."
    ),
    fileCheck("Agent doctrines are implemented", "src/lib/agents.ts", [/Global Market Vision/, /Universal Product Direction/, /Business Expansion Lens/, /Public Language Approval/, /Game Feel Doctrine/, /Physics Slice Doctrine/, /Security And Privacy Doctrine/, /Open Source Release Doctrine/])
  ]),
  category("Global OS Architecture", [
    fileCheck("Global OS Designer has visionary market skills", "studio-agents/agents.json", [/ultra-global business expansion/, /category-defining product vision/, /global market strategy/, /ecosystem platform strategy/, /public package direction/, /release-blocking architecture governance/]),
    fileCheck("Capability graph maps reusable systems", "src/lib/capability-graph.ts", [/GameCapabilityId/, /createCapabilityMap/, /regressionFixtures/, /UNIVERSAL_CAPABILITY_GRAPH_APPROVED/]),
    fileCheck("OS artifacts are created with every workspace", "src/lib/artifacts.ts", [/os-design-review/, /capability-map/, /acceptance-profile/, /architecture-risk-report/, /upgrade-doctrine/]),
    fileCheck("Trust module owns acceptance and diagnosis", "src/lib/trust.ts", [/createAcceptanceProfile/, /diagnoseTrust/, /trustVerdictFromScore/, /LOCAL_PROTOTYPE_READY/, /CREATOR_TEST_READY/, /BLOCKED/]),
    fileCheck("Scorecard gates OS architecture", "src/lib/scorecard.ts", [/Global OS Architecture/, /global-os-designer/, /Capability graph approved/, /trustVerdictFromScore/]),
    fileCheck("OS design artifacts include expansion language", "src/lib/capability-graph.ts", [/Global Market Vision/, /Universal Product Direction/, /Public Language Approval/, /globally expandable developer platform/]),
    fileCheck("Web adapter uses capability routing", "src/lib/web-adapter.ts", [/createCapabilityMap/, /capability-web/, /Named game fixtures are bypassed/]),
    fileCheck("CLI smoke asserts capability artifacts", "scripts/cli-smoke.mjs", [/capability-map/, /os-design-review/]),
    fileCheck("Architecture docs forbid example lanes", "docs/ARCHITECTURE.md", [/Global OS Design Doctrine/, /regression fixtures only/, /reusable systems/])
  ]),
  category("Game Direction Design And Developer", [
    fileCheck("Scorecard covers direction and implementation", "src/lib/scorecard.ts", [/Game Direction And Design/, /Gameplay Developer owns implementation-slice contract/]),
    fileCheck("Prompt intake expands physics-puzzle intent", "src/lib/intake.ts", [/physics puzzle/i, /coreLoop/, /risks/]),
    fileCheck("Game rules spec records asset-physics loop", "src/lib/artifacts.ts", [/Hero object starts attached to a rope/, /Reset restores rope, hero object, mastery pickups, and goal state/]),
    fileCheck("Playable builds must be testable", "src/lib/agents.ts", [/No playable build is accepted unless the implementation can be tested by the QA Director and challenged by the Advanced Player/])
  ]),
  category("Creator UX Flow", [
    fileCheck("CLI exposes core creator commands", "src/cli/main.ts", [/case "init"/, /case "cockpit"/, /case "examples"/, /case "make"/, /case "journey"/, /case "next"/, /case "review"/, /case "diagnose"/, /case "feedback"/, /case "improve"/, /case "play"/, /case "artifact"/]),
    fileCheck("Starter examples stay universal", "src/cli/starter-ideas.ts", [/one-button arcade survival/, /physics timing puzzle/, /turn-based strategy/, /combat survival arena/, /Narrative puzzle/]),
    fileCheck("Cockpit keeps actions simple", "src/cli/actions.ts", [/slice\(0, 5\)/, /Create New Game/, /Use Starter Idea/, /Fix With Autopilot/]),
    fileCheck("Cockpit uses keyboard-first controls", "src/cli/cockpit.ts", [/Game OS Cockpit/, /↑\/↓ select/, /n new/, /i improve/]),
    fileCheck("CLI output explains blockers", "src/cli/output.ts", [/Current blockers/, /Next best command/, /Advanced Player did not approve/, /Needs browser QA/, /Needs asset fit/]),
    fileCheck("Docs explain the command journey", "docs/CLI.md", [/gameos init/, /gameos examples/, /gameos next/, /gameos cockpit/, /gameos improve/, /gameos play/, /Trust Review/, /gameos diagnose/]),
    fileCheck("Artifact output is summary-first", "src/cli/main.ts", [/--full/, /summarizeArtifactContent/]),
    fileCheck("Playable HUD labels are player-facing", "src/lib/web-adapter.ts", [/formatGameOsStatusLabel/, /displayStatusLabel/])
  ]),
  category("Asset Pipeline And Visual Quality", [
    fileCheck("Role-based asset classifier exists", "src/lib/asset-importer.ts", [/hero-object/, /goal-character/, /collectible/, /WRONG_ASSET_PACK_FOR_ASSET_PHYSICS/]),
    fileCheck("Friendly asset preview exists", "src/lib/asset-importer.ts", [/renderAssetPreview/, /Asset Preview/, /asset-fit diagnosis/i]),
    fileCheck("Wrong-role asset tests exist", "src/lib/asset-importer.test.ts", [/rejects UI buttons as the hero physics object/, /goal-character/]),
    fileCheck("Visual quality director owns screenshot maturity", "src/lib/agents.ts", [/Visual Quality Doctrine/, /Do not promote a Web prototype as worth playing/]),
    fileCheck("Asset-led docs require role fit", "docs/V1_ACCEPTANCE.md", [/Asset packs produce role assignments/, /wrong-role assets block promotion/i])
  ]),
  category("Web Game Playability", [
    fileCheck("Web generator uses V3 physics prototype", "src/lib/web-adapter.ts", [/renderAssetPhysicsGameScriptV3/, /pendulum-swing-momentum-gravity-bumper-collision-no-goal-magnet/]),
    fileCheck("No-goal-magnet physics gate is enforced", "scripts/web-player-agent.mjs", [/physics_model.*no-goal-magnet/, /Timing skill gate failed/, /Agency gate failed/]),
    fileCheck("Slow human blade input is implemented", "src/lib/web-adapter.ts", [/slowFreeMoveRopeForQa/, /pointerrawupdate/, /bladeTrailCutsRope/]),
    fileCheck("Web smoke requires watermark and slow blade", "scripts/web-smoke.mjs", [/GameOS watermark/, /hasSlowMouseBlade/, /slow human mouse blade/]),
    fileCheck("Web smoke rejects machine-verdict HUD leaks", "scripts/web-smoke.mjs", [/Visible HUD leaked machine verdict constants/])
  ]),
  category("QA Player Agent Evidence", [
    scriptCheck("acceptance:web-quality", "node scripts/web-quality-acceptance.mjs"),
    scriptCheck("acceptance:universal-trust", "node scripts/universal-trust-acceptance.mjs"),
    scriptCheck("acceptance:universal-deep", "node scripts/universal-deep-acceptance.mjs"),
    scriptCheck("trust:audit", "node scripts/trust-audit.mjs"),
    fileCheck("Acceptance tests prove trust evidence", "scripts/web-quality-acceptance.mjs", [/CREATOR_TEST_READY/, /WORTH_PLAYING_FOR_ASSET_PHYSICS_WEB_BUILD/, /acceptance-profile/]),
    fileCheck("Universal trust acceptance covers prompt families", "scripts/universal-trust-acceptance.mjs", [/arcade score loop/, /deterministic rules strategy/, /asset-led physics timing/, /platform movement/, /combat\/survival loop/, /diagnose/]),
    fileCheck("Universal deep acceptance covers ten families", "scripts/universal-deep-acceptance.mjs", [/arcade score loop/, /deterministic rules strategy/, /asset-led physics timing/, /platform movement/, /combat\/survival loop/, /racing motion/, /resource\/economy management/, /puzzle logic/, /narrative choice loop/, /local multiplayer\/pass-and-play/, /capability-web/]),
    fileCheck("Trust audit blocks overclaiming", "scripts/trust-audit.mjs", [/10\/10/, /publish-ready/, /diagnose/]),
    fileCheck("Advanced Player blocks shallow games", "scripts/web-player-agent.mjs", [/WEB_PLAYER_AGENT_REPORT/, /MASTERY_GATE_PASS/, /SLOW_MOUSE_BLADE_PASS/]),
    fileCheck("CLI browser QA proves release reset retry", "src/cli/web-qa.ts", [/firstCutPass/, /noAutoCutPass/, /slowMousePass/, /recutPass/])
  ]),
  category("Security Privacy And Storage", [
    fileCheck("Security policy is local-first", "SECURITY.md", [/No telemetry/, /No hidden network calls/, /GAME_OS_DATA_DIR/]),
    fileCheck("Doctor reports privacy posture", "src/cli/doctor.ts", [/telemetry: false/, /cloudCalls: false/, /hiddenNetwork: false/]),
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
    fileCheck("README explains quickstart and privacy", "README.md", [/npm install -g gameos/, /V1 has no telemetry/, /Web Worth-Playing Gates/, /Trust Review/]),
    fileCheck("Publishing docs explain npm/Homebrew", "docs/PUBLISHING.md", [/trusted publishing/, /npm run homebrew:update/]),
    fileCheck("Goal audit docs exist", "docs/GOAL_AUDIT.md", [/Goal Trust Audit/, /Agent Swarm And Skills/])
  ]),
  category("Goal Completion Discipline", [
    scriptCheck("goal:audit", "node scripts/goal-audit.mjs"),
    check("npm run check includes trust:audit", packageJson.scripts?.check?.includes("npm run trust:audit"), "check runs trust:audit before release/build gates.", "npm run check does not include trust:audit."),
    check("npm run check includes universal trust acceptance", packageJson.scripts?.check?.includes("npm run acceptance:universal-trust"), "check runs universal trust acceptance before release/build gates.", "npm run check does not include acceptance:universal-trust."),
    check("npm run check includes universal deep acceptance", packageJson.scripts?.check?.includes("npm run acceptance:universal-deep"), "check runs universal deep acceptance before release/build gates.", "npm run check does not include acceptance:universal-deep."),
    check("package exposes universal deep acceptance", Boolean(packageJson.scripts?.["acceptance:universal-deep"]), "package exposes acceptance:universal-deep for pre-publish breadth proof.", "package.json does not expose acceptance:universal-deep."),
    check("npm run check includes goal:audit", packageJson.scripts?.check?.includes("npm run goal:audit"), "check runs goal:audit before release/build gates.", "npm run check does not include goal:audit."),
    fileCheck("Release audit requires goal audit", "scripts/release-audit.mjs", [/goal:audit/, /docs\/GOAL_AUDIT\.md/]),
    fileCheck("Architecture documents trust doctrine", "docs/ARCHITECTURE.md", [/Trust Review Doctrine/, /npm run acceptance:universal-trust/, /npm run acceptance:web-quality/]),
    fileCheck("V1 acceptance documents goal audit", "docs/V1_ACCEPTANCE.md", [/npm run goal:audit/, /npm run trust:audit/, /honest trust tier/])
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
  verdict: problems.length === 0 ? "TRUST_ARCHITECTURE_READY" : "NEEDS_GOAL_EVIDENCE",
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
