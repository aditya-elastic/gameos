import fs from "node:fs";
import path from "node:path";
import { getProjectArtifactRoot, readArtifactContent } from "./artifacts";
import { loadAgentDefinitions } from "./agent-registry";
import type { ArtifactRecord, ProjectWorkspace } from "./types";

export type StudioScorecardCheck = {
  label: string;
  pass: boolean;
  evidence: string;
  gap: string;
};

export type StudioScorecardCategory = {
  name: string;
  score: number;
  verdict: "PASS" | "WATCH" | "BLOCKED";
  evidence: string[];
  gaps: string[];
};

export type StudioScorecard = {
  projectId: string;
  projectName: string;
  overallScore: number;
  minimumCategoryScore: number;
  verdict: "10_OUT_OF_10_READY_FOR_LOCAL_USERS" | "NEEDS_FINAL_POLISH" | "NEEDS_ARCHITECTURE_UPGRADE";
  agentCount: number;
  categoryCount: number;
  categories: StudioScorecardCategory[];
};

export function generateStudioScorecard(workspace: ProjectWorkspace): StudioScorecard {
  const categories = [
    scoreAgentSwarm(workspace),
    scoreStudioDesign(workspace),
    scoreAssetPipeline(workspace),
    scoreWebPlayability(workspace),
    scoreQaEvidence(workspace),
    scoreUxFlow(workspace),
    scoreGameFeel(workspace),
    scoreMemoryStorage(workspace),
    scoreSecurityPrivacy(workspace),
    scoreOpenSourceRelease(workspace)
  ];
  const overallScore = roundScore(categories.reduce((total, category) => total + category.score, 0) / categories.length);
  const minimumCategoryScore = Math.min(...categories.map((category) => category.score));
  const verdict =
    minimumCategoryScore === 10
      ? "10_OUT_OF_10_READY_FOR_LOCAL_USERS"
      : minimumCategoryScore >= 8 && categories.every((category) => category.verdict !== "BLOCKED")
        ? "NEEDS_FINAL_POLISH"
        : "NEEDS_ARCHITECTURE_UPGRADE";

  return {
    projectId: workspace.project.id,
    projectName: workspace.project.name,
    overallScore,
    minimumCategoryScore,
    verdict,
    agentCount: workspace.agents.length,
    categoryCount: categories.length,
    categories
  };
}

export function renderStudioScorecardMarkdown(scorecard: StudioScorecard): string {
  return [
    `# ${scorecard.projectName} 10/10 Studio Scorecard`,
    "",
    "## Verdict",
    `- Overall score: ${formatScore(scorecard.overallScore)}/10`,
    `- Minimum category score: ${formatScore(scorecard.minimumCategoryScore)}/10`,
    `- Verdict: ${scorecard.verdict}`,
    `- Agents reviewed: ${scorecard.agentCount}`,
    `- Categories reviewed: ${scorecard.categoryCount}`,
    "",
    "## Categories",
    ...scorecard.categories.flatMap((category) => [
      `### ${category.name}`,
      `- Score: ${formatScore(category.score)}/10`,
      `- Verdict: ${category.verdict}`,
      "",
      "Evidence:",
      ...category.evidence.map((item) => `- ${item}`),
      "",
      "Gaps:",
      ...(category.gaps.length ? category.gaps.map((item) => `- ${item}`) : ["- none"]),
      ""
    ]),
    "## Director Rule",
    "Game OS can only claim 10/10 when every category reaches 10/10 with artifact-backed evidence. Any gap routes to the owning agent before release."
  ].join("\n");
}

function scoreAgentSwarm(workspace: ProjectWorkspace): StudioScorecardCategory {
  const requiredRoles = loadAgentDefinitions().map((definition) => definition.role);
  const completedRoles = new Set(workspace.agents.filter((agent) => agent.status === "complete").map((agent) => agent.role));
  const checks = requiredRoles.map((role) => ({
    label: `${role} complete`,
    pass: completedRoles.has(role),
    evidence: `${role} generated a complete agent run.`,
    gap: `${role} is missing or not complete.`
  }));
  checks.push({
    label: "Agent artifacts persisted",
    pass: workspace.agents.every((agent) => agent.artifacts.length > 0 && agent.artifacts.every((artifact) => fs.existsSync(artifact.path))),
    evidence: "Every agent has at least one file-backed output artifact.",
    gap: "One or more agent outputs are not persisted as local artifacts."
  });
  return categoryFromChecks("Agent Swarm And Skills", checks);
}

function scoreStudioDesign(workspace: ProjectWorkspace): StudioScorecardCategory {
  return categoryFromChecks("Game Direction And Design", [
    artifactCheck(workspace, "brief", "Game bible exists."),
    artifactCheck(workspace, "studio-plan", "Studio execution plan exists."),
    artifactCheck(workspace, "rules-spec", "Rules/state spec exists."),
    agentCheck(workspace, "studio-director", "Studio Director owns go/no-go."),
    agentCheck(workspace, "game-designer", "Game Designer owns mechanics and motivation."),
    agentCheck(workspace, "gameplay-developer", "Gameplay Developer owns implementation-slice contract.")
  ]);
}

function scoreAssetPipeline(workspace: ProjectWorkspace): StudioScorecardCategory {
  const wantsAssets = /cut.*rope|rope.*cut|physics puzzle/i.test(workspace.project.prompt);
  const assetManifest = readLatestJsonArtifact<Record<string, unknown>>(workspace, "asset-pack-manifest");
  const preview = readLatestJsonArtifact<{ roleAssignments?: Array<Record<string, unknown>> }>(workspace, "asset-preview-manifest");
  const roles = preview?.roleAssignments ?? [];
  const roleAccepted = (role: string) => roles.some((assignment) => assignment.role === role && assignment.status === "accepted");

  return categoryFromChecks("Asset Pipeline And Visual Fit", [
    agentCheck(workspace, "asset-pipeline-director", "Asset Pipeline Director owns role mapping."),
    agentCheck(workspace, "art-director", "Art Director owns visual language."),
    agentCheck(workspace, "visual-quality-director", "Visual Quality Director owns screenshot maturity."),
    {
      label: "Asset manifest present",
      pass: !wantsAssets || Boolean(assetManifest),
      evidence: "Asset import manifest exists for the asset-led game.",
      gap: "Asset-led game has no imported asset manifest."
    },
    {
      label: "Asset verdict approved",
      pass: !wantsAssets || assetManifest?.verdict === "APPROVED_FOR_CUT_ROPE_WEB_PROTOTYPE",
      evidence: `Asset verdict is ${String(assetManifest?.verdict)}.`,
      gap: "Asset verdict is not approved for the rope physics prototype."
    },
    {
      label: "Critical asset roles accepted",
      pass: !wantsAssets || ["hero-object", "goal-character", "collectible"].every(roleAccepted),
      evidence: "Hero object, goal character, and collectible roles are accepted.",
      gap: "One or more critical gameplay asset roles are missing or not accepted."
    }
  ]);
}

function scoreWebPlayability(workspace: ProjectWorkspace): StudioScorecardCategory {
  const webTargeted = workspace.platformPlans.some((plan) => plan.platform === "Web" && plan.status === "targeted");
  const needsPhysicsPlayability = /cut.*rope|rope.*cut|physics puzzle/i.test(workspace.project.prompt);
  const webReport = readLatestMarkdownArtifact(workspace, "web-playtest-report");
  const manifest = readWebAdapterManifest(workspace);
  const verdict = readMarkdownValue(webReport, "Verdict") ?? "";

  return categoryFromChecks("Playable Web Build", [
    {
      label: "Web target selected",
      pass: webTargeted,
      evidence: "Web is a targeted platform for fast local proof.",
      gap: "Web is not selected, so this review cannot prove the default playable lane."
    },
    artifactCheck(workspace, "web-adapter", "Web adapter artifact exists."),
    {
      label: "Worth-playing verdict",
      pass: verdict.startsWith("WORTH_PLAYING"),
      evidence: `Advanced Player verdict is ${verdict || "missing"}.`,
      gap: "Advanced Player has not approved the Web build."
    },
    needsPhysicsPlayability ? markdownValueCheck(webReport, "Visual verdict", "VISUAL_GATE_PASS", "Visual gate passed.") : numericMarkdownCheck(webReport, "Branching decisions", 1, "Rules playability produced branching decisions."),
    needsPhysicsPlayability ? markdownValueCheck(webReport, "Physics verdict", "PHYSICS_GATE_PASS", "Physics gate passed.") : numericMarkdownCheck(webReport, "Captures", 1, "Rules playability produced captures."),
    needsPhysicsPlayability ? markdownValueCheck(webReport, "Timing skill verdict", "TIMING_SKILL_PASS", "Timing skill gate passed.") : numericMarkdownCheck(webReport, "Releases", 1, "Rules playability released tokens/pieces."),
    needsPhysicsPlayability ? markdownValueCheck(webReport, "Agency verdict", "AGENCY_GATE_PASS", "Player agency gate passed.") : numericMarkdownCheck(webReport, "Finish choices", 1, "Rules playability produced finish choices."),
    needsPhysicsPlayability ? markdownValueCheck(webReport, "Mastery verdict", "MASTERY_GATE_PASS", "Mastery gate passed.") : numericMarkdownCheck(webReport, "Safe-square choices", 1, "Rules playability produced safe choices."),
    needsPhysicsPlayability ? markdownValueCheck(webReport, "Smooth mouse verdict", "SMOOTH_MOUSE_BLADE_PASS", "Smooth mouse blade gate passed.") : passingCheck("Smooth mouse blade is not required for this non-physics target."),
    needsPhysicsPlayability ? markdownValueCheck(webReport, "Slow mouse verdict", "SLOW_MOUSE_BLADE_PASS", "Slow human mouse blade gate passed.") : passingCheck("Slow mouse blade is not required for this non-physics target."),
    {
      label: "Manifest provenance and watermark",
      pass: manifest?.generatedBy === "Game OS" && Boolean(manifest?.watermark?.required),
      evidence: "Web manifest records generatedBy Game OS and required watermark.",
      gap: "Web manifest is missing Game OS provenance or watermark policy."
    }
  ]);
}

function scoreQaEvidence(workspace: ProjectWorkspace): StudioScorecardCategory {
  const projectRoot = getProjectArtifactRoot(workspace.project.id);
  const needsPhysicsScreenshots = /cut.*rope|rope.*cut|physics puzzle/i.test(workspace.project.prompt);
  return categoryFromChecks("QA Evidence And Player Agents", [
    artifactCheck(workspace, "qa-plan", "QA gates artifact exists."),
    artifactCheck(workspace, "test-matrix", "Test matrix exists."),
    artifactCheck(workspace, "web-playtest-report", "Web player-agent report exists."),
    agentCheck(workspace, "qa-director", "QA Director owns acceptance evidence."),
    agentCheck(workspace, "advanced-player", "Advanced Player owns worth-playing verdict."),
    {
      label: "Visual QA screenshot captured",
      pass: !needsPhysicsScreenshots || fs.existsSync(path.join(projectRoot, "web", "qa", "cut-rope-visual-qa.png")),
      evidence: needsPhysicsScreenshots ? "Visual QA screenshot exists under the generated Web build." : "Visual QA screenshot is not mandatory for this non-physics proof target.",
      gap: "Visual QA screenshot is missing."
    },
    {
      label: "Interaction QA screenshot captured",
      pass: !needsPhysicsScreenshots || fs.existsSync(path.join(projectRoot, "web", "qa", "cut-rope-interaction-qa.png")),
      evidence: needsPhysicsScreenshots ? "Interaction QA screenshot exists under the generated Web build." : "Interaction QA screenshot is not mandatory for this non-physics proof target.",
      gap: "Interaction QA screenshot is missing."
    }
  ]);
}

function scoreUxFlow(workspace: ProjectWorkspace): StudioScorecardCategory {
  const webReport = readLatestMarkdownArtifact(workspace, "web-playtest-report");
  return categoryFromChecks("Creator UX Flow", [
    agentCheck(workspace, "ux-flow-director", "UX Flow Director owns the CLI journey."),
    artifactCheck(workspace, "playtest-script", "First playtest script exists."),
    artifactCheck(workspace, "production-roadmap", "Production roadmap exists."),
    {
      label: "Status can point to latest evidence",
      pass: workspace.artifacts.some((artifact) => artifact.kind === "web-playtest-report" || artifact.kind === "web-adapter"),
      evidence: "Project has generated build/playtest artifacts for status and journey output.",
      gap: "No build/playtest artifacts exist for status and journey output."
    },
    {
      label: "Large artifacts stay inspectable",
      pass: workspace.artifacts.every((artifact) => fs.existsSync(artifact.path)),
      evidence: "Artifacts are file-backed and can be summarized or read with --full.",
      gap: "One or more artifacts are missing from disk."
    },
    {
      label: "Player verdict visible",
      pass: Boolean(readMarkdownValue(webReport, "Verdict")),
      evidence: "Latest Web player-agent verdict is recorded in an artifact.",
      gap: "No readable player-agent verdict is recorded."
    }
  ]);
}

function scoreGameFeel(workspace: ProjectWorkspace): StudioScorecardCategory {
  const webReport = readLatestMarkdownArtifact(workspace, "web-playtest-report");
  const needsPhysicsFeel = /cut.*rope|rope.*cut|physics puzzle/i.test(workspace.project.prompt);
  return categoryFromChecks("Game Feel And First Minute", [
    agentCheck(workspace, "game-feel-director", "Game Feel Director owns first-minute quality."),
    agentCheck(workspace, "physics-gameplay-engineer", "Physics Gameplay Engineer owns dynamics and controls."),
    needsPhysicsFeel
      ? markdownValueCheck(webReport, "Input verdict", "INPUT_GATE_PASS", "Input/reset gate passed.")
      : passingCheck("Input feel is covered by the non-physics Advanced Player report."),
    needsPhysicsFeel
      ? markdownValueCheck(webReport, "Slice gesture verdict", "SLICE_GESTURE_PASS", "Slice gesture gate passed.")
      : passingCheck("Slice gesture is not required for this non-physics target."),
    needsPhysicsFeel
      ? markdownValueCheck(webReport, "Smooth mouse verdict", "SMOOTH_MOUSE_BLADE_PASS", "Smooth mouse blade gate passed.")
      : passingCheck("Smooth mouse blade is not required for this non-physics target."),
    needsPhysicsFeel
      ? markdownValueCheck(webReport, "Slow mouse verdict", "SLOW_MOUSE_BLADE_PASS", "Slow human mouse blade gate passed.")
      : passingCheck("Slow mouse blade is not required for this non-physics target."),
    needsPhysicsFeel
      ? markdownValueCheck(webReport, "Reset/recut pass", "true", "Reset/recut proof passed.")
      : passingCheck("Reset/recut physics proof is not required for this non-physics target."),
    needsPhysicsFeel ? markdownValueCheck(webReport, "Early miss verified", "true", "Early miss is verified.") : passingCheck("Early miss proof is not required for this target."),
    needsPhysicsFeel ? markdownValueCheck(webReport, "Late miss verified", "true", "Late miss is verified.") : passingCheck("Late miss proof is not required for this target.")
  ]);
}

function scoreMemoryStorage(workspace: ProjectWorkspace): StudioScorecardCategory {
  const projectRoot = getProjectArtifactRoot(workspace.project.id);
  return categoryFromChecks("Memory And Storage", [
    agentCheck(workspace, "memory-manager", "Memory Manager owns durable context."),
    agentCheck(workspace, "storage-manager", "Storage Manager owns local data hygiene."),
    artifactCheck(workspace, "memory-map", "Memory map exists."),
    artifactCheck(workspace, "storage-manifest", "Storage manifest exists."),
    {
      label: "Artifacts live under project root",
      pass: workspace.artifacts.every((artifact) => artifact.path.startsWith(projectRoot)),
      evidence: "All project artifacts are stored under the local Game OS project root.",
      gap: "One or more artifacts are outside the project data root."
    },
    {
      label: "Artifacts exist on disk",
      pass: workspace.artifacts.every((artifact) => fs.existsSync(artifact.path)),
      evidence: "All recorded artifact paths exist.",
      gap: "One or more recorded artifact paths are missing."
    }
  ]);
}

function scoreSecurityPrivacy(workspace: ProjectWorkspace): StudioScorecardCategory {
  const storageManifest = readLatestMarkdownArtifact(workspace, "storage-manifest");
  const engineBrief = readLatestMarkdownArtifact(workspace, "engine-adapter-brief");
  return categoryFromChecks("Security And Privacy", [
    agentCheck(workspace, "security-privacy-reviewer", "Security Privacy Reviewer owns privacy and package boundaries."),
    agentCheck(workspace, "build-sentinel", "Build Sentinel owns expensive/heavy process safety."),
    artifactCheck(workspace, "storage-manifest", "Storage manifest exists."),
    {
      label: "Local-first storage documented",
      pass: /local|SQLite|artifact/i.test(storageManifest),
      evidence: "Storage manifest documents local data and artifact storage.",
      gap: "Storage manifest does not document local storage clearly."
    },
    {
      label: "No store publishing automation",
      pass: /Do not automate store submission|publishing targets|test-readiness/i.test(engineBrief),
      evidence: "Engine adapter brief keeps store publishing out of V1.",
      gap: "Engine adapter brief does not clearly block premature publishing automation."
    },
    {
      label: "Heavy work explicitly gated",
      pass: workspace.agents.some((agent) => agent.role === "build-sentinel" && /heavy engine|build lane|serialized/i.test(agent.output)),
      evidence: "Build Sentinel output documents serialized heavy build lanes.",
      gap: "Build Sentinel output does not document heavy-work safety."
    }
  ]);
}

function scoreOpenSourceRelease(workspace: ProjectWorkspace): StudioScorecardCategory {
  return categoryFromChecks("Open Source Release Readiness", [
    agentCheck(workspace, "open-source-release-engineer", "Open Source Release Engineer owns package readiness."),
    artifactCheck(workspace, "platform-plan", "Platform plan exists."),
    artifactCheck(workspace, "engine-adapter-brief", "Engine adapter brief exists."),
    {
      label: "Release doctrine generated",
      pass: workspace.agents.some((agent) => agent.role === "open-source-release-engineer" && /npm package contents|Homebrew readiness|Release checks/i.test(agent.output)),
      evidence: "Open Source Release Engineer output names npm, Homebrew, docs, audit, and package contents.",
      gap: "Open Source Release Engineer output does not cover npm/Homebrew release hygiene."
    },
    {
      label: "Platform boundaries documented",
      pass: /Steam|Unity|Godot|Web|publishing/i.test(readLatestMarkdownArtifact(workspace, "platform-plan")),
      evidence: "Platform readiness artifact documents platform boundaries.",
      gap: "Platform readiness artifact is missing platform boundaries."
    }
  ]);
}

function categoryFromChecks(name: string, checks: StudioScorecardCheck[]): StudioScorecardCategory {
  const passed = checks.filter((check) => check.pass);
  const score = checks.length === 0 ? 0 : roundScore((passed.length / checks.length) * 10);
  const verdict = score === 10 ? "PASS" : score >= 7 ? "WATCH" : "BLOCKED";
  return {
    name,
    score,
    verdict,
    evidence: passed.map((check) => check.evidence),
    gaps: checks.filter((check) => !check.pass).map((check) => check.gap)
  };
}

function artifactCheck(workspace: ProjectWorkspace, kind: ArtifactRecord["kind"], evidence: string): StudioScorecardCheck {
  return {
    label: `${kind} artifact exists`,
    pass: workspace.artifacts.some((artifact) => artifact.kind === kind && fs.existsSync(artifact.path)),
    evidence,
    gap: `${kind} artifact is missing.`
  };
}

function agentCheck(workspace: ProjectWorkspace, role: string, evidence: string): StudioScorecardCheck {
  return {
    label: `${role} complete`,
    pass: workspace.agents.some((agent) => agent.role === role && agent.status === "complete"),
    evidence,
    gap: `${role} is missing or incomplete.`
  };
}

function markdownValueCheck(content: string, label: string, expected: string, evidence: string): StudioScorecardCheck {
  const actual = readMarkdownValue(content, label);
  return {
    label,
    pass: actual === expected,
    evidence,
    gap: `${label} is ${actual || "missing"}; expected ${expected}.`
  };
}

function numericMarkdownCheck(content: string, label: string, minimum: number, evidence: string): StudioScorecardCheck {
  const actual = Number(readMarkdownValue(content, label) ?? "NaN");
  return {
    label,
    pass: Number.isFinite(actual) && actual >= minimum,
    evidence,
    gap: `${label} is ${Number.isFinite(actual) ? actual : "missing"}; expected at least ${minimum}.`
  };
}

function passingCheck(evidence: string): StudioScorecardCheck {
  return {
    label: evidence,
    pass: true,
    evidence,
    gap: "Unexpected target-aware scorecard gap."
  };
}

function latestArtifact(workspace: ProjectWorkspace, kind: ArtifactRecord["kind"]): ArtifactRecord | undefined {
  return [...workspace.artifacts].reverse().find((artifact) => artifact.kind === kind);
}

function readLatestMarkdownArtifact(workspace: ProjectWorkspace, kind: ArtifactRecord["kind"]): string {
  const artifact = latestArtifact(workspace, kind);
  if (!artifact) return "";
  return readArtifactContent(artifact.path);
}

function readLatestJsonArtifact<T>(workspace: ProjectWorkspace, kind: ArtifactRecord["kind"]): T | null {
  const artifact = latestArtifact(workspace, kind);
  if (!artifact) return null;
  try {
    return JSON.parse(readArtifactContent(artifact.path)) as T;
  } catch {
    return null;
  }
}

function readWebAdapterManifest(workspace: ProjectWorkspace): { generatedBy?: string; watermark?: { required?: boolean; label?: string } } | null {
  const manifestPath = path.join(getProjectArtifactRoot(workspace.project.id), "web", "web-adapter-manifest.json");
  if (!fs.existsSync(manifestPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(manifestPath, "utf8")) as { generatedBy?: string; watermark?: { required?: boolean; label?: string } };
  } catch {
    return null;
  }
}

function readMarkdownValue(content: string, label: string): string | null {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = content.match(new RegExp(`- ${escaped}:\\s*(.+)`));
  return match?.[1]?.trim() ?? null;
}

function roundScore(value: number): number {
  return Math.round(value * 10) / 10;
}

function formatScore(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
