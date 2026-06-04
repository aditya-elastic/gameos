import fs from "node:fs";
import path from "node:path";
import { getProjectArtifactRoot, readArtifactContent } from "./artifacts";
import type { AcceptanceProfile, ArtifactRecord, ProjectWorkspace, TrustDiagnosis, TrustVerdictTier } from "./types";

export function createAcceptanceProfile(workspace: Omit<ProjectWorkspace, "artifacts">, capabilityIds: string[], now = new Date().toISOString()): AcceptanceProfile {
  const hasPhysics = capabilityIds.includes("physics");
  const hasRules = capabilityIds.includes("rules");
  const hasCombat = capabilityIds.includes("combat");
  const hasPlatforming = capabilityIds.includes("platforming");
  const hasArcade = capabilityIds.includes("arcade-loop");
  return {
    projectId: workspace.project.id,
    verdictPolicy: "Local Web proof may reach LOCAL_PROTOTYPE_READY or CREATOR_TEST_READY only. Publish-candidate claims are blocked until engine export, platform compliance, packaging, and human review exist.",
    selectedCapabilities: capabilityIds,
    requiredPlayerActions: [
      hasPhysics ? "Timing-based release/action changes the result." : "Primary action changes game state.",
      hasRules ? "Legal and invalid actions are distinguishable." : "Retry loop is available.",
      hasCombat ? "Threat, hit/miss, and fail state are readable." : "Failure state is readable.",
      hasPlatforming ? "Move, collide, fail, and retry are proven." : "Goal state is readable.",
      hasArcade ? "Score/retry loop is visible." : "Player can understand the first objective."
    ],
    requiredVisualChecks: ["GameOS watermark is visible.", "Play surface is focused.", "HUD is compact and player-facing.", "No raw machine verdict leaks into the HUD."],
    requiredInputChecks: ["Primary input works.", "Reset/retry works.", "Repeated input does not corrupt state.", "Keyboard or pointer fallback is available where relevant."],
    requiredAssetRoleChecks: hasPhysics ? ["hero-object", "goal-character", "collectible"] : ["primary actor or board element", "background or play surface", "UI feedback"],
    requiredAdvancedPlayerChecks: ["Advanced Player verdict is recorded.", "Simulation evidence exists.", "Result is not based on render success alone.", "Blockers are routed to a named owner."],
    blockedPublishClaims: ["commercial launch claim", "platform store claim", "public release claim", "numeric perfection claim"],
    createdAt: now
  };
}

export function renderAcceptanceProfileMarkdown(profile: AcceptanceProfile): string {
  return [
    "# Acceptance Profile",
    "",
    `Verdict policy: ${profile.verdictPolicy}`,
    "",
    "## Selected Capabilities",
    ...profile.selectedCapabilities.map((item) => `- ${item}`),
    "",
    "## Required Player Actions",
    ...profile.requiredPlayerActions.map((item) => `- ${item}`),
    "",
    "## Required Visual Checks",
    ...profile.requiredVisualChecks.map((item) => `- ${item}`),
    "",
    "## Required Input Checks",
    ...profile.requiredInputChecks.map((item) => `- ${item}`),
    "",
    "## Required Asset Role Checks",
    ...profile.requiredAssetRoleChecks.map((item) => `- ${item}`),
    "",
    "## Required Advanced Player Checks",
    ...profile.requiredAdvancedPlayerChecks.map((item) => `- ${item}`),
    "",
    "## Blocked Publish Claims",
    ...profile.blockedPublishClaims.map((item) => `- ${item}`)
  ].join("\n");
}

export function diagnoseTrust(workspace: ProjectWorkspace): TrustDiagnosis {
  const webReport = readLatestMarkdownArtifact(workspace, "web-playtest-report");
  const scorecard = readLatestMarkdownArtifact(workspace, "studio-scorecard");
  const profile = readLatestMarkdownArtifact(workspace, "acceptance-profile");
  const webManifest = readWebManifest(workspace);
  const webVerdict = readMarkdownValue(webReport, "Verdict") ?? "not run";
  const scorecardVerdict = readMarkdownValue(scorecard, "Verdict") ?? "not run";
  const profileChecks = profile ? evaluateAcceptanceProfile(profile, webReport, webManifest) : [];
  const failedProfileCheck = profileChecks.find((check) => !check.pass);
  const webBuilt = workspace.artifacts.some((artifact) => artifact.kind === "web-adapter");
  const profileExists = Boolean(profile);
  const watermarkOk = webManifest?.generatedBy === "Game OS" && Boolean(webManifest?.watermark?.required);
  const browserQaRequired = webVerdict === "STATIC_WEB_QA_PASS_BROWSER_REQUIRED_FOR_WORTH_PLAYING";

  const evidence = [
    `Acceptance profile: ${profileExists ? "present" : "missing"}`,
    `Web build: ${webBuilt ? "present" : "missing"}`,
    `Web verdict: ${webVerdict}`,
    `Studio review: ${scorecardVerdict}`,
    `Watermark manifest: ${watermarkOk ? "present" : "missing"}`,
    ...profileChecks.map((check) => `${check.label}: ${check.pass ? "pass" : "missing"}`)
  ];

  if (!profileExists) return diagnosis(workspace, "BLOCKED", "Acceptance profile is missing.", "qa", "No acceptance-profile artifact exists.", "acceptance-architect", "gameos agents run " + workspace.project.id, evidence);
  if (!webBuilt) return diagnosis(workspace, "BLOCKED", "Web build has not been generated.", "runtime", "No web-adapter artifact exists.", "prototype-producer", "gameos build web " + workspace.project.id, evidence);
  if (!watermarkOk) return diagnosis(workspace, "BLOCKED", "GameOS provenance or watermark is missing.", "hud", "Web manifest lacks generatedBy or required watermark.", "evidence-auditor", "gameos build web " + workspace.project.id, evidence);
  if (!webReport) return diagnosis(workspace, "BLOCKED", "Web QA has not run.", "qa", "No web-playtest-report artifact exists.", "qa-director", "gameos qa web " + workspace.project.id, evidence);
  if (browserQaRequired) return diagnosis(workspace, "NEEDS_IMPROVEMENT", "Browser QA is required for a stronger verdict.", "qa", webVerdict, "qa-director", "gameos qa web " + workspace.project.id, evidence);
  if (webVerdict === "NEEDS_BROWSER_INTERACTION_PROOF") {
    return diagnosis(workspace, "NEEDS_IMPROVEMENT", "Browser interaction proof is incomplete.", "input", webVerdict, "qa-director", "gameos improve " + workspace.project.id + " --note \"fix browser interaction, reset, and retry proof\" --yes", evidence);
  }
  if (failedProfileCheck) {
    return diagnosis(
      workspace,
      "NEEDS_IMPROVEMENT",
      `Acceptance profile proof is incomplete: ${failedProfileCheck.label}.`,
      failedProfileCheck.capability,
      failedProfileCheck.evidence,
      failedProfileCheck.owner,
      failedProfileCheck.nextCommand.replace("<project-id>", workspace.project.id),
      evidence
    );
  }
  if (!webVerdict.startsWith("WORTH_PLAYING")) return diagnosis(workspace, "NEEDS_IMPROVEMENT", "Advanced Player did not approve the local prototype.", "game-feel", webVerdict, "advanced-player-council", "gameos improve " + workspace.project.id + " --note \"address the failed player-agent verdict\" --yes", evidence);
  if (!scorecard) return diagnosis(workspace, "LOCAL_PROTOTYPE_READY", "Local Web prototype passed QA; studio review has not run.", "review", "No studio-scorecard artifact exists.", "studio-director", "gameos review " + workspace.project.id, evidence);
  if (scorecardVerdict === "CREATOR_TEST_READY" || scorecardVerdict === "LOCAL_PROTOTYPE_READY") return diagnosis(workspace, scorecardVerdict, "none", "none", "Evidence-backed local readiness verdict.", "product-truth-officer", "gameos play " + workspace.project.id, evidence);
  return diagnosis(workspace, "LOCAL_PROTOTYPE_READY", "Local Web prototype passed, but review is not creator-test-ready.", "review", scorecardVerdict, "studio-director", "gameos journey " + workspace.project.id, evidence);
}

type AcceptanceProfileCheck = {
  label: string;
  pass: boolean;
  capability: string;
  evidence: string;
  owner: string;
  nextCommand: string;
};

function evaluateAcceptanceProfile(profile: string, webReport: string, manifest: { generatedBy?: string; watermark?: { required?: boolean } } | null): AcceptanceProfileCheck[] {
  const selectedCapabilities = sectionItems(profile, "Selected Capabilities");
  const requiredInputs = sectionItems(profile, "Required Input Checks");
  const requiredVisuals = sectionItems(profile, "Required Visual Checks");
  const requiredPlayerActions = sectionItems(profile, "Required Player Actions");
  const requiresPhysics = selectedCapabilities.includes("physics");
  const requiresCombat = selectedCapabilities.includes("combat");
  const requiresPlatforming = selectedCapabilities.includes("platforming");
  const requiresArcade = selectedCapabilities.includes("arcade-loop");
  const requiresRules = selectedCapabilities.includes("rules");

  return [
    {
      label: "Profile selected capabilities have QA evidence",
      pass: selectedCapabilities.length > 0 && (/Capability verdict:\s*(CAPABILITY_GATE_PASS|not reported)/i.test(webReport) || /Verdict:\s*WORTH_PLAYING/i.test(webReport)),
      capability: "qa",
      evidence: "Capability evidence is missing from the Web QA report.",
      owner: "acceptance-architect",
      nextCommand: "gameos qa web <project-id>"
    },
    {
      label: "Required visual checks are backed by watermark and visual report",
      pass: requiredVisuals.length > 0 && Boolean(manifest?.watermark?.required) && (/Visual verdict:\s*(VISUAL_GATE_PASS|not reported)/i.test(webReport) || /Verdict:\s*WORTH_PLAYING/i.test(webReport)),
      capability: "visual",
      evidence: "Visual acceptance checks are not backed by watermark/provenance and QA report evidence.",
      owner: "visual-quality-director",
      nextCommand: "gameos qa web <project-id>"
    },
    {
      label: "Required input checks are backed by input/reset evidence",
      pass: requiredInputs.length > 0 && (/Input verdict:\s*(INPUT_GATE_PASS|not reported)/i.test(webReport) || /reset.*(true|pass)|Reset\/recut pass:\s*true/i.test(webReport) || /Verdict:\s*WORTH_PLAYING/i.test(webReport)),
      capability: "input",
      evidence: "Input/reset/retry proof is missing from Web QA.",
      owner: "qa-director",
      nextCommand: "gameos qa web <project-id>"
    },
    {
      label: "Required player actions are backed by simulation evidence",
      pass: requiredPlayerActions.length > 0 && (/Matches:\s*[1-9]/i.test(webReport) || /Trials:\s*[1-9]/i.test(webReport) || /Completions:\s*[1-9]/i.test(webReport)),
      capability: "player-actions",
      evidence: "Player action simulation evidence is missing.",
      owner: "advanced-player-council",
      nextCommand: "gameos qa web <project-id>"
    },
    {
      label: "Physics capability has timing and dynamics proof",
      pass: !requiresPhysics || /Physics verdict:\s*PHYSICS_GATE_PASS/i.test(webReport),
      capability: "physics",
      evidence: "Physics capability was selected but physics proof is missing.",
      owner: "physics-gameplay-engineer",
      nextCommand: "gameos qa web <project-id>"
    },
    {
      label: "Combat capability has threat/fail/action proof",
      pass: !requiresCombat || /Capability verdict:\s*CAPABILITY_GATE_PASS|Branching decisions:\s*[1-9]|Average score:\s*[1-9]/i.test(webReport),
      capability: "combat",
      evidence: "Combat/survival capability was selected but threat/action evidence is missing.",
      owner: "advanced-player-council",
      nextCommand: "gameos improve <project-id> --note \"add threat, hit/miss, fail, and retry evidence\" --yes"
    },
    {
      label: "Platforming capability has movement/fail/retry proof",
      pass: !requiresPlatforming || /Capability verdict:\s*CAPABILITY_GATE_PASS|Branching decisions:\s*[1-9]|Average score:\s*[1-9]/i.test(webReport),
      capability: "platforming",
      evidence: "Platform movement capability was selected but movement/fail/retry evidence is missing.",
      owner: "advanced-player-council",
      nextCommand: "gameos improve <project-id> --note \"add movement, collision, fail, and retry evidence\" --yes"
    },
    {
      label: "Arcade capability has score/retry proof",
      pass: !requiresArcade || /Average score:\s*[1-9]|Capability verdict:\s*CAPABILITY_GATE_PASS|Matches:\s*[1-9]/i.test(webReport),
      capability: "arcade-loop",
      evidence: "Arcade loop was selected but score/retry evidence is missing.",
      owner: "advanced-player-council",
      nextCommand: "gameos qa web <project-id>"
    },
    {
      label: "Rules capability has legal-choice proof",
      pass: !requiresRules || /Branching decisions:\s*[1-9]|Capability verdict:\s*CAPABILITY_GATE_PASS|Matches:\s*[1-9]/i.test(webReport),
      capability: "rules",
      evidence: "Rules capability was selected but legal-choice evidence is missing.",
      owner: "rules-systems-designer",
      nextCommand: "gameos qa web <project-id>"
    }
  ];
}

function sectionItems(content: string, title: string): string[] {
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = content.match(new RegExp(`## ${escaped}\\n([\\s\\S]*?)(?:\\n## |$)`));
  if (!match) return [];
  return match[1]
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim());
}

export function trustVerdictFromScore(minimumCategoryScore: number, webVerdict: string, hasProfile: boolean, hasRunnableEvidence: boolean): TrustVerdictTier {
  if (!hasProfile || !hasRunnableEvidence) return "BLOCKED";
  if (!webVerdict.startsWith("WORTH_PLAYING")) return "NEEDS_IMPROVEMENT";
  if (minimumCategoryScore >= 10) return "CREATOR_TEST_READY";
  if (minimumCategoryScore >= 7) return "LOCAL_PROTOTYPE_READY";
  return "NEEDS_IMPROVEMENT";
}

export function renderTrustDiagnosisMarkdown(diagnosisValue: TrustDiagnosis): string {
  return [
    "# Trust Diagnosis",
    "",
    `- Verdict: ${diagnosisValue.verdict}`,
    `- Blocker: ${diagnosisValue.blocker}`,
    `- Failed capability: ${diagnosisValue.failedCapability}`,
    `- Failed evidence: ${diagnosisValue.failedEvidence}`,
    `- Owning agent: ${diagnosisValue.owningAgent}`,
    `- Next command: ${diagnosisValue.nextCommand}`,
    "",
    "## Evidence",
    ...diagnosisValue.evidence.map((item) => `- ${item}`)
  ].join("\n");
}

function diagnosis(workspace: ProjectWorkspace, verdict: TrustVerdictTier, blocker: string, failedCapability: string, failedEvidence: string, owningAgent: string, nextCommand: string, evidence: string[]): TrustDiagnosis {
  return { projectId: workspace.project.id, verdict, blocker, failedCapability, failedEvidence, owningAgent, nextCommand, evidence };
}

function latestArtifact(workspace: ProjectWorkspace, kind: ArtifactRecord["kind"]): ArtifactRecord | undefined {
  return [...workspace.artifacts].reverse().find((artifact) => artifact.kind === kind);
}

function readLatestMarkdownArtifact(workspace: ProjectWorkspace, kind: ArtifactRecord["kind"]): string {
  const artifact = latestArtifact(workspace, kind);
  return artifact ? readArtifactContent(artifact.path) : "";
}

function readWebManifest(workspace: ProjectWorkspace): { generatedBy?: string; watermark?: { required?: boolean } } | null {
  const manifestPath = path.join(getProjectArtifactRoot(workspace.project.id), "web", "web-adapter-manifest.json");
  if (!fs.existsSync(manifestPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(manifestPath, "utf8")) as { generatedBy?: string; watermark?: { required?: boolean } };
  } catch {
    return null;
  }
}

function readMarkdownValue(content: string, label: string): string | null {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = content.match(new RegExp(`- ${escaped}:\\s*(.+)`));
  return match?.[1]?.trim() ?? null;
}
