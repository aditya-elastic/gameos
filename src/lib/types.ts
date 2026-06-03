export type ProjectStatus = "draft" | "swarm-ready" | "prototype-planned" | "blocked";

export type AgentStatus = "queued" | "running" | "complete" | "blocked";

export type PlatformStatus = "targeted" | "planned" | "later" | "blocked";

export type GateResult = "pass" | "watch" | "blocked";

export type TrustVerdictTier = "LOCAL_PROTOTYPE_READY" | "CREATOR_TEST_READY" | "NEEDS_IMPROVEMENT" | "BLOCKED";

export type ArtifactKind =
  | "brief"
  | "agent-output"
  | "asset-plan"
  | "platform-plan"
  | "qa-plan"
  | "studio-plan"
  | "production-roadmap"
  | "risk-register"
  | "playtest-script"
  | "engine-adapter-brief"
  | "rules-spec"
  | "memory-map"
  | "storage-manifest"
  | "test-matrix"
  | "studio-scorecard"
  | "acceptance-profile"
  | "trust-diagnosis"
  | "asset-import-report"
  | "asset-pack-manifest"
  | "asset-preview-manifest"
  | "user-feedback"
  | "godot-adapter"
  | "unity-adapter"
  | "unity-playtest-report"
  | "web-adapter"
  | "web-playtest-report"
  | "web-export"
  | "os-design-review"
  | "capability-map"
  | "architecture-risk-report"
  | "upgrade-doctrine";

export interface CreateProjectInput {
  prompt: string;
  targetPlatforms: string[];
  enginePreference?: string;
  genre?: string;
  targetAudience?: string;
}

export interface GameProject {
  id: string;
  name: string;
  prompt: string;
  genre: string;
  targetAudience: string;
  targetPlatforms: string[];
  enginePreference: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
}

export interface GameBrief {
  projectId: string;
  summary: string;
  fantasy: string;
  pillars: string[];
  coreLoop: string[];
  references: string[];
  risks: string[];
  createdAt: string;
}

export interface AgentDefinition {
  role: string;
  title: string;
  mission: string;
  skills: string[];
}

export interface AgentRun {
  id: string;
  projectId: string;
  role: string;
  title: string;
  input: string;
  output: string;
  status: AgentStatus;
  artifacts: ArtifactRecord[];
  confidence: number;
  blockers: string[];
  runNumber: number;
  createdAt: string;
  updatedAt: string;
}

export interface ArtifactRecord {
  id: string;
  projectId: string;
  kind: ArtifactKind;
  label: string;
  path: string;
  createdAt: string;
}

export interface AssetItem {
  name: string;
  purpose: string;
  prompt: string;
  source: string;
  status: "needed" | "generated" | "approved" | "rejected";
  gate: string;
}

export interface AssetPlan {
  projectId: string;
  visualStyle: string;
  items: AssetItem[];
  createdAt: string;
}

export type ImportedAssetKind = "image" | "audio" | "data" | "other";

export type AssetRelevanceTag =
  | "rope"
  | "hero-object"
  | "character"
  | "collectible"
  | "ui"
  | "background"
  | "hazard"
  | "physics-piece";

export type AssetImportVerdict =
  | "APPROVED_FOR_ASSET_PHYSICS_WEB_BUILD"
  | "PARTIAL_ASSET_MATCH_NEEDS_PLACEHOLDERS"
  | "WRONG_ASSET_PACK_FOR_ASSET_PHYSICS";

export type AssetRole =
  | "background"
  | "hero-object"
  | "goal-character"
  | "rope-connector"
  | "collectible"
  | "hazard"
  | "ui";

export type AssetRoleStatus = "accepted" | "procedural-required" | "missing" | "rejected";

export interface ImportedAssetFile {
  name: string;
  relativePath: string;
  absolutePath: string;
  kind: ImportedAssetKind;
  sizeBytes: number;
  tags: AssetRelevanceTag[];
  score: number;
}

export interface AssetRoleAssignment {
  role: AssetRole;
  status: AssetRoleStatus;
  confidence: number;
  reason: string;
  file?: ImportedAssetFile;
}

export interface AssetImportManifest {
  projectId: string;
  sourceFileName: string;
  storedArchivePath: string;
  extractedRoot: string;
  importedAt: string;
  totalFiles: number;
  files: ImportedAssetFile[];
  imageCount: number;
  audioCount: number;
  dataCount: number;
  otherCount: number;
  relevantTags: AssetRelevanceTag[];
  verdict: AssetImportVerdict;
  confidence: number;
  missingCategories: AssetRelevanceTag[];
  roleAssignments: AssetRoleAssignment[];
  notes: string[];
}

export interface PlatformPlan {
  projectId: string;
  platform: string;
  status: PlatformStatus;
  readinessGates: string[];
  notes: string;
}

export interface QAGate {
  id: string;
  projectId: string;
  name: string;
  automatedChecks: string[];
  headedPlaytestChecks: string[];
  playerFeelChecks: string[];
  result: GateResult;
}

export interface AcceptanceProfile {
  projectId: string;
  verdictPolicy: string;
  selectedCapabilities: string[];
  requiredPlayerActions: string[];
  requiredVisualChecks: string[];
  requiredInputChecks: string[];
  requiredAssetRoleChecks: string[];
  requiredAdvancedPlayerChecks: string[];
  blockedPublishClaims: string[];
  createdAt: string;
}

export interface TrustDiagnosis {
  projectId: string;
  verdict: TrustVerdictTier;
  blocker: string;
  failedCapability: string;
  failedEvidence: string;
  owningAgent: string;
  nextCommand: string;
  evidence: string[];
}

export interface ProjectWorkspace {
  project: GameProject;
  brief: GameBrief;
  agents: AgentRun[];
  assetPlan: AssetPlan;
  platformPlans: PlatformPlan[];
  qaGates: QAGate[];
  artifacts: ArtifactRecord[];
  studioPlan: string;
}

export interface StudioApiError {
  error: string;
  details?: string[];
}
