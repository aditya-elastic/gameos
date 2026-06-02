import { randomUUID } from "node:crypto";
import type { AgentDefinition, AgentRun, AssetPlan, GameBrief, GameProject, PlatformPlan } from "./types";

export function generateAgentRun(
  definition: AgentDefinition,
  project: GameProject,
  brief: GameBrief,
  context: {
    assetPlan?: AssetPlan;
    platformPlans?: PlatformPlan[];
    feedbackNotes?: string[];
    runNumber?: number;
  } = {}
): AgentRun {
  const runNumber = context.runNumber ?? 1;
  const output = renderAgentOutput(definition, project, brief, context.assetPlan, context.platformPlans, runNumber, context.feedbackNotes);
  const blockers = inferBlockers(definition.role, project, context.platformPlans);
  const feedbackInput = context.feedbackNotes?.length ? `\n\nRecent creator feedback:\n${context.feedbackNotes.map((note) => `- ${note}`).join("\n")}` : "";

  return {
    id: randomUUID(),
    projectId: project.id,
    role: definition.role,
    title: definition.title,
    input: `${project.prompt}${feedbackInput}`,
    output,
    status: blockers.length > 2 ? "blocked" : "complete",
    artifacts: [],
    confidence: confidenceFor(definition.role, blockers.length),
    blockers,
    runNumber,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

export function deriveStyleSkills(project: GameProject): string[] {
  const prompt = project.prompt.toLowerCase();
  const skills = ["single-prompt expansion", "production artifact writing", "acceptance gate design"];

  if (prompt.includes("youtube") || prompt.includes("creator") || prompt.includes("stream")) {
    skills.push("creator-retention design", "spectator readability", "clip-friendly pacing");
  }

  if (prompt.includes("war") || prompt.includes("combat") || prompt.includes("missile")) {
    skills.push("threat readability", "combat pressure tuning", "tactical visual hierarchy");
  }

  if (prompt.includes("ludo") || prompt.includes("pachisi") || prompt.includes("board game") || prompt.includes("dice")) {
    skills.push("rules-state modeling", "turn-order validation", "local multiplayer UX", "save-resume integrity");
  }

  if (project.targetPlatforms.some((platform) => platform.toLowerCase().includes("steam"))) {
    skills.push("steam test readiness");
  }

  if (project.enginePreference.toLowerCase().includes("neutral")) {
    skills.push("engine-neutral adapter planning");
  }

  return [...new Set(skills)];
}

export function composeStudioPlan(input: {
  project: GameProject;
  brief: GameBrief;
  agents: AgentRun[];
  assetPlan: AssetPlan;
  platformPlans: PlatformPlan[];
}): string {
  const { project, brief, agents, assetPlan, platformPlans } = input;
  const targetedPlatforms = platformPlans.filter((plan) => plan.status === "targeted").map((plan) => plan.platform);
  const watchPlatforms = platformPlans.filter((plan) => plan.status === "planned").map((plan) => plan.platform);

  return [
    `# ${project.name} Studio Execution Plan`,
    "",
    "## Director Summary",
    brief.summary,
    "",
    "## First Playable Slice",
    "- Build one compact session that proves the fantasy before expanding content.",
    "- Use placeholder assets until the core loop and camera readability pass.",
    "- Treat Steam as test readiness only; do not add publishing automation in V1.",
    "",
    "## Agent Merge",
    ...agents.map((agent) => `- ${agent.title}: ${agent.status.toUpperCase()} at ${Math.round(agent.confidence * 100)}% confidence.`),
    "",
    "## Asset Direction",
    `Visual style: ${assetPlan.visualStyle}.`,
    ...assetPlan.items.map((item) => `- ${item.name}: ${item.gate}`),
    "",
    "## Platform Direction",
    `Target now: ${targetedPlatforms.join(", ") || "engine-neutral prototype planning"}.`,
    `Prepare next: ${watchPlatforms.join(", ") || "none"}.`,
    "",
    "## Next Actions",
    "- Convert this plan into an engine adapter only after the brief, asset plan, and QA gates are accepted.",
    "- Generate the smallest playable prototype before adding platform-specific release work.",
    "- Record every build, playtest, screenshot, and agent decision as a project artifact."
  ].join("\n");
}

function renderAgentOutput(
  definition: AgentDefinition,
  project: GameProject,
  brief: GameBrief,
  assetPlan?: AssetPlan,
  platformPlans?: PlatformPlan[],
  runNumber = 1,
  feedbackNotes: string[] = []
): string {
  const relevantSkills = deriveStyleSkills(project);
  const platforms = platformPlans?.filter((plan) => plan.status === "targeted").map((plan) => plan.platform) ?? project.targetPlatforms;

  const commonHeader = [
    `# ${definition.title}`,
    "",
    `Run: #${runNumber}`,
    `Mission: ${definition.mission}`,
    `Project: ${project.name}`,
    `Relevant skills: ${[...definition.skills, ...relevantSkills].join(", ")}`,
    feedbackNotes.length ? `Recent creator feedback: ${feedbackNotes.slice(-3).join(" | ")}` : "Recent creator feedback: none",
    ""
  ].join("\n");

  if (definition.role === "studio-director") {
    return `${commonHeader}${[
      "## Verdict",
      `${project.name} should stay engine-neutral until the first playable slice is precisely defined.`,
      "",
      "## Creative Thesis",
      brief.fantasy,
      "",
      "## Scope Lock",
      "- One prototype loop.",
      "- One camera and control scheme.",
      "- One asset language.",
      "- One headed playtest gate before Unity, Godot, or Steam-specific work.",
      "",
      "## Go / No-Go",
      "GO for studio planning. NO-GO for publishing automation."
    ].join("\n")}`;
  }

  if (definition.role === "game-designer") {
    return `${commonHeader}${[
      "## Mechanics",
      ...brief.coreLoop.map((step) => `- ${step}`),
      "",
      "## Player Motivation",
      "- Make the first attempt understandable.",
      "- Make the second attempt feel smarter.",
      "- Make the best attempt worth showing.",
      "",
      "## Prototype Rule",
      "Do not add extra modes until the retry loop proves a measurable skill gain."
    ].join("\n")}`;
  }

  if (definition.role === "gameplay-developer") {
    return `${commonHeader}${[
      "## Implementation Slice Contract",
      "- Implement only the smallest playable loop that proves the approved design.",
      "- Keep runtime state explicit: setup, ready, input, resolve, success/fail, reset.",
      "- Use adapter code as generated implementation, but keep Game OS artifacts as the source of truth.",
      "- Treat controls, collision, reset, save/resume, and watermark as implementation requirements, not polish extras.",
      "",
      "## Code Review Gate",
      "No playable build is accepted unless the implementation can be tested by the QA Director and challenged by the Advanced Player."
    ].join("\n")}`;
  }

  if (definition.role === "technical-architect") {
    return `${commonHeader}${[
      "## Architecture",
      "- Keep the Game OS project model separate from engine adapters.",
      "- Generate engine-specific files only from approved artifacts.",
      "- Store agent outputs, QA evidence, and asset prompts outside engine folders.",
      "",
      "## Data Flow",
      "Prompt -> Brief -> Agent Swarm -> Studio Plan -> Adapter Plan -> Prototype Build -> QA Evidence.",
      "",
      "## Runtime Risks",
      ...brief.risks.map((risk) => `- ${risk}`)
    ].join("\n")}`;
  }

  if (definition.role === "ux-flow-director") {
    return `${commonHeader}${[
      "## Creator Journey Doctrine",
      "- One command should create a project, import assets when provided, build Web, run QA, and print the next best command.",
      "- Status and journey output must name exact blockers instead of asking users to inspect raw files.",
      "- Artifact reads are summarized by default; large outputs require --full.",
      "- Feedback must become durable context for the next agent regeneration.",
      "",
      "## Blocker Rule",
      "If a creator cannot tell what is ready, risky, missing, and next from the CLI, the OS flow is not release-quality."
    ].join("\n")}`;
  }

  if (definition.role === "rules-systems-designer") {
    const isLudo = project.prompt.toLowerCase().includes("ludo");
    return `${commonHeader}${[
      "## Rules Contract",
      isLudo
        ? "Use the same legal-move resolver for human moves, bot moves, QA simulations, save/resume, and replay validation."
        : "Rules must be deterministic before implementation starts.",
      "",
      "## State Priorities",
      "- Turn owner.",
      "- Dice or action result.",
      "- Legal action list.",
      "- Resolution events.",
      "- Persisted post-turn snapshot.",
      "",
      "## Edge Cases",
      ...(isLudo
        ? [
            "- Six from base.",
            "- No legal move after roll.",
            "- Capture versus safe square.",
            "- Exact home entry.",
            "- Extra-turn chain policy.",
            "- Bot turn cannot bypass the resolver."
          ]
        : ["- Invalid input.", "- No legal action.", "- Interrupted/resumed turn.", "- Win condition edge cases."])
    ].join("\n")}`;
  }

  if (definition.role === "art-director") {
    return `${commonHeader}${[
      "## Visual Direction",
      assetPlan?.visualStyle ?? "Readable arcade prototype style.",
      "",
      "## Asset Gates",
      ...(assetPlan?.items.map((item) => `- ${item.name}: ${item.prompt}`) ?? ["- Define player, challenge, environment, and feedback assets."]),
      "",
      "## Promotion Rule",
      "Generated assets are references until they pass gameplay-camera readability and adapter cleanup."
    ].join("\n")}`;
  }

  if (definition.role === "asset-pipeline-director") {
    return `${commonHeader}${[
      "## Asset Intake Doctrine",
      "- Classify uploaded assets by gameplay role before any adapter consumes them.",
      "- Reject UI buttons, icons, hazards, or backgrounds when they are mistakenly selected as hero physics objects.",
      "- Preserve the source archive and write a preview manifest listing selected files and reasons.",
      "",
      "## Promotion Rule",
      "A build can be playable with procedural helpers, but it cannot be called asset-fit approved unless hero object, goal character, and collectible roles are selected intentionally."
    ].join("\n")}`;
  }

  if (definition.role === "visual-quality-director") {
    return `${commonHeader}${[
      "## Visual Quality Doctrine",
      "- Use one focused play surface with a compact HUD; no scattered explanatory text over the playfield.",
      "- Prefer mature procedural composition when imported backgrounds are weak, noisy, or role-incompatible.",
      "- Ensure the uploaded assets appear as intentional gameplay actors, not decorative leftovers.",
      "",
      "## Blocker Rule",
      "Do not promote a Web prototype as worth playing when the screenshot would look confusing, childish by accident, or visually incoherent at first glance."
    ].join("\n")}`;
  }

  if (definition.role === "game-feel-director") {
    return `${commonHeader}${[
      "## Game Feel Doctrine",
      "- The first interaction must feel intentional, responsive, and readable without debug text.",
      "- A failed attempt should teach the player what to try next.",
      "- Reset must be fast enough that retrying feels natural.",
      "- Controls, timing windows, visual feedback, and short-session pacing must be judged together.",
      "",
      "## No-Go Rule",
      "A prototype that only passes scripted completion but feels stiff, confusing, ugly, or unrewarding is not worth-playing."
    ].join("\n")}`;
  }

  if (definition.role === "physics-gameplay-engineer") {
    return `${commonHeader}${[
      "## Physics Slice Doctrine",
      "- Keep the first level deterministic enough for QA while preserving readable swing, gravity, projectile arc, collision, and retry feel.",
      "- Do not use hidden goal attraction, forced win paths, or scripted completion to fake physics.",
      "- Prove a timing window: early and late cuts should miss, while a skilled cut should win.",
      "- For cut/slice games, pointer, mouse, and touch gestures must feel like a smooth blade: forgiving, visible, buffered across recent movement, and tested separately from button fallbacks.",
      "- Include at least one meaningful redirect, bumper, obstacle, or trajectory decision when the game fantasy depends on physics.",
      "- Reset must recreate physics state, clear stale input, and debounce the next pointer/click event.",
      "- Cutting, missing, winning, resetting, and recutting are separate acceptance checks.",
      "",
      "## Blocker Rule",
      "A technically rendered canvas is not playable unless timing changes the outcome and the loop can be cut, reset, and replayed without accidental state carryover."
    ].join("\n")}`;
  }

  if (definition.role === "advanced-player") {
    return `${commonHeader}${[
      "## Stress Test",
      "- Can a skilled player express mastery in under 60 seconds?",
      "- Can a viewer understand why a run failed without reading debug text?",
      "- Is there a meaningful risk-reward choice in every short session?",
      "- Does the game look coherent, use assets correctly, reset reliably, and prove its physics loop?",
      "- Does the primary control feel natural under smooth mouse/touch movement, including a blade-like pass across the rope, not only through a UI button or scripted cut?",
      "- Do early, careless, and late actions fail while a timed action succeeds?",
      "- Would a real player improve on a second or third try, or is the game merely an animation?",
      "",
      "## Retention Bet",
      project.targetAudience.toLowerCase().includes("youtube")
        ? "Creator playtests need a fast reset, a visible fail state, and one highlight moment per session."
        : "Prototype testers need a sharper next goal after every result."
    ].join("\n")}`;
  }

  if (definition.role === "qa-director") {
    return `${commonHeader}${[
      "## QA Gates",
      "- Static artifact completeness check.",
      "- First 60-second headed playtest.",
      "- Retry loop verification.",
      "- Asset readability screenshot review.",
      "- Platform-specific smoke test only after an adapter exists.",
      "",
      "## Evidence",
      "Every gate must produce a report, screenshots where visual feel matters, and a director verdict."
    ].join("\n")}`;
  }

  if (definition.role === "memory-manager") {
    return `${commonHeader}${[
      "## Memory Contract",
      "- Game bible, rules spec, QA gates, storage manifest, and latest agent outputs are durable memory.",
      "- Regenerated agents append new run artifacts instead of overwriting history.",
      "- Engine adapters must load the memory map before generating code.",
      "",
      "## Recall Priority",
      "- Rules decisions.",
      "- Current platform target.",
      "- Open QA watch gates.",
      "- Storage and save/resume constraints."
    ].join("\n")}`;
  }

  if (definition.role === "storage-manager") {
    return `${commonHeader}${[
      "## Storage Contract",
      "- SQLite owns structured records.",
      "- Markdown artifacts own human-readable studio memory.",
      "- Generated local data stays out of git.",
      "- Save/resume requirements must be captured before prototype code generation.",
      "",
      "## Integrity Gate",
      "Every studio room must have canonical artifacts plus one artifact per latest agent run."
    ].join("\n")}`;
  }

  if (definition.role === "security-privacy-reviewer") {
    return `${commonHeader}${[
      "## Security And Privacy Doctrine",
      "- V1 remains local-first: no telemetry, accounts, hidden cloud calls, or automatic publishing.",
      "- Generated projects, caches, uploaded archives, and local data must stay out of the npm package.",
      "- Asset archives must be copied into project storage intentionally and referenced through manifests.",
      "- Destructive, expensive, or heavy engine work must require explicit flags.",
      "- Package publish readiness requires license, security policy, audit, and clean package contents.",
      "",
      "## Blocker Rule",
      "Do not call Game OS production-ready if user data movement, package contents, or dependency risk is unclear."
    ].join("\n")}`;
  }

  if (definition.role === "prototype-producer") {
    return `${commonHeader}${[
      "## Prototype Slice",
      "- Build the smallest playable rules loop before polish.",
      "- Use placeholder visuals until rules and turn feedback are proven.",
      "- Make save/resume and restart testable from the first build.",
      "",
      "## Done When",
      "A headed tester can complete the first representative session and the QA Director can cite evidence."
    ].join("\n")}`;
  }

  if (definition.role === "platform-producer") {
    return `${commonHeader}${[
      "## Platform Map",
      `Target platforms: ${platforms.join(", ") || "engine-neutral planning"}.`,
      "",
      "## V1 Boundary",
      "- Steam is readiness tracking only.",
      "- Unity and Godot are adapter lanes, not assumptions.",
      "- Mobile and console require separate compliance gates.",
      "",
      "## Producer Call",
      "Do not let store work start before the game loop has a headed PASS."
    ].join("\n")}`;
  }

  if (definition.role === "swarm-orchestrator") {
    return `${commonHeader}${[
      "## Swarm Order",
      "- Studio Director locks intent.",
      "- Game Designer, Gameplay Developer, Rules Systems Designer, UX Flow Director, and Game Feel Director define play, implementation shape, user journey, and first-minute feel.",
      "- Technical Architect, Memory Manager, and Storage Manager define implementation boundaries.",
      "- Art Director, Asset Pipeline Director, Visual Quality Director, Physics Gameplay Engineer, QA Director, and Security Privacy Reviewer set acceptance gates.",
      "- Platform Producer, Prototype Producer, Build Sentinel, and Open Source Release Engineer sequence execution and release hygiene.",
      "",
      "## Regeneration Rule",
      "Regenerate the narrowest agent that owns the uncertainty, then re-read memory and QA artifacts before implementation."
    ].join("\n")}`;
  }

  if (definition.role === "build-sentinel") {
    return `${commonHeader}${[
      "## Build Rule",
      "- Only one heavy engine/build lane may run at a time.",
      "- Record process status before and after every heavy command.",
      "- Keep generated project artifacts separate from local caches and build output.",
      "",
      "## Future Commands",
      "Unity, Godot, Xcode, SteamCMD, and headed QA commands must be serialized behind this role."
    ].join("\n")}`;
  }

  if (definition.role === "open-source-release-engineer") {
    return `${commonHeader}${[
      "## Open Source Release Doctrine",
      "- npm package contents must include only dist, docs, agent definitions, README, license, changelog, security policy, and code of conduct.",
      "- Generated projects, .next output, local data, tmp files, and plugin packages stay out of the publish path.",
      "- Release checks must include tests, CLI build, CLI smoke, package dry-run, audit, and install smoke.",
      "- Homebrew readiness must pin npm tarball version and sha256 before public tap submission.",
      "",
      "## Go-Live Rule",
      "A release is not user-ready unless installation, one-command Web generation, QA verdicts, docs, and uninstall/data behavior are documented and tested."
    ].join("\n")}`;
  }

  return `${commonHeader}${[
    "## Build Rule",
    "- Follow the Studio Director's scope lock.",
    "- Write evidence as artifacts.",
    "- Route blockers to the narrowest owning agent.",
    "",
    "## Future Commands",
    "Regenerate this agent after creator feedback or new QA evidence."
  ].join("\n")}`;
}

function inferBlockers(role: string, project: GameProject, platformPlans?: PlatformPlan[]): string[] {
  const blockers: string[] = [];

  if (role === "platform-producer" && platformPlans?.some((plan) => plan.platform === "Console" && plan.status === "blocked")) {
    blockers.push("Console platform access is not available in V1.");
  }

  if (role === "build-sentinel" && !project.enginePreference.toLowerCase().includes("unity") && !project.enginePreference.toLowerCase().includes("godot")) {
    blockers.push("No heavy engine lane is selected yet, so build serialization remains a future gate.");
  }

  return blockers;
}

function confidenceFor(role: string, blockerCount: number): number {
  const base = role === "build-sentinel" ? 0.76 : 0.86;
  return Number(Math.max(0.45, base - blockerCount * 0.1).toFixed(2));
}
