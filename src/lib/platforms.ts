import type { GameProject, PlatformPlan, PlatformStatus } from "./types";

const knownPlatforms = ["PC Test", "Steam Test", "Unity", "Godot", "iOS", "Android", "Web", "Console"];

export function normalizePlatformName(platform: string): string {
  const normalized = platform.trim().toLowerCase();

  if (normalized.includes("steam")) return "Steam Test";
  if (normalized.includes("unity")) return "Unity";
  if (normalized.includes("godot") || normalized.includes("gowda")) return "Godot";
  if (normalized.includes("ios") || normalized.includes("iphone") || normalized.includes("ipad")) return "iOS";
  if (normalized.includes("android")) return "Android";
  if (normalized.includes("web") || normalized.includes("browser")) return "Web";
  if (normalized.includes("console") || normalized.includes("playstation") || normalized.includes("xbox")) return "Console";
  if (normalized.includes("pc") || normalized.includes("windows") || normalized.includes("mac")) return "PC Test";

  return platform.trim();
}

export function createPlatformPlans(project: GameProject): PlatformPlan[] {
  const targets = new Set(project.targetPlatforms.map(normalizePlatformName));
  const platformSet = new Set([...knownPlatforms, ...targets]);

  return [...platformSet].map((platform) => {
    const status = resolvePlatformStatus(platform, targets);
    return {
      projectId: project.id,
      platform,
      status,
      readinessGates: readinessGatesFor(platform, status),
      notes: platformNotes(platform, status, project.enginePreference)
    };
  });
}

export function platformReadinessScore(plans: PlatformPlan[]): number {
  if (plans.length === 0) return 0;

  const total = plans.reduce((score, plan) => {
    if (plan.status === "targeted") return score + 1;
    if (plan.status === "planned") return score + 0.6;
    if (plan.status === "later") return score + 0.25;
    return score;
  }, 0);

  return Number((total / plans.length).toFixed(2));
}

function resolvePlatformStatus(platform: string, targets: Set<string>): PlatformStatus {
  if (targets.has(platform)) return "targeted";
  if (platform === "PC Test" || platform === "Steam Test" || platform === "Unity" || platform === "Godot") return "planned";
  if (platform === "Console") return "blocked";
  return "later";
}

function readinessGatesFor(platform: string, status: PlatformStatus): string[] {
  const shared = [
    "Playable slice exists before publish-like work.",
    "Controls, camera, UI, and retry loop pass a headed playtest.",
    "Performance budget is measured on the target lane."
  ];

  if (platform === "Steam Test") {
    return [
      "Local PC build artifact is produced.",
      "Steam is treated as test readiness only; no direct publishing automation in V1.",
      "Store capsule/media requirements are tracked but not uploaded.",
      ...shared
    ];
  }

  if (platform === "Unity") {
    return [
      "Unity adapter is selected only after the engine-neutral plan is approved.",
      "Project settings, packages, and platform build scripts are generated behind a build sentinel.",
      ...shared
    ];
  }

  if (platform === "Godot") {
    return [
      "Godot adapter maps scenes, scripts, assets, and export presets from the Game OS plan.",
      "Prototype can run without store credentials.",
      ...shared
    ];
  }

  if (status === "blocked") {
    return [
      "Console lane requires platform-holder access, dev hardware, and separate compliance planning.",
      "Keep this lane out of V1 execution."
    ];
  }

  return shared;
}

function platformNotes(platform: string, status: PlatformStatus, enginePreference: string): string {
  if (status === "targeted") {
    return `${platform} is part of the first planning target with ${enginePreference}.`;
  }

  if (platform === "Steam Test") {
    return "Steam remains a readiness target in V1, not a publishing integration.";
  }

  if (platform === "Console") {
    return "Console remains blocked until official SDK and compliance access exist.";
  }

  return `${platform} is mapped for future adapter work.`;
}
