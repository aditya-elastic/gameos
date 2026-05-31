export type ProjectStatus = "draft" | "swarm-ready" | "prototype-planned" | "blocked";

export type AgentStatus = "queued" | "running" | "complete" | "blocked";

export type PlatformStatus = "targeted" | "planned" | "later" | "blocked";

export type GateResult = "pass" | "watch" | "blocked";

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
  | "engine-adapter-brief";

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
