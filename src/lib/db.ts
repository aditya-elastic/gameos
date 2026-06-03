import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { getDataRoot, readArtifactContent } from "./artifacts";
import type {
  AgentRun,
  ArtifactRecord,
  AssetPlan,
  GameBrief,
  GameProject,
  PlatformPlan,
  ProjectWorkspace,
  QAGate
} from "./types";

const databases = new Map<string, DatabaseSync>();
const DEFAULT_BUSY_RETRIES = 6;
const DEFAULT_BUSY_DELAY_MS = 35;

export function getDatabasePath(): string {
  return path.join(getDataRoot(), "game-os.sqlite");
}

export function getDb(): DatabaseSync {
  const dbPath = getDatabasePath();
  const existing = databases.get(dbPath);
  if (existing) return existing;

  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  configureDatabase(db);
  migrate(db);
  databases.set(dbPath, db);
  return db;
}

export function closeDatabasesForTests(): void {
  for (const db of databases.values()) {
    db.close();
  }

  databases.clear();
}

export function saveWorkspace(workspace: ProjectWorkspace): void {
  withDatabaseRetry(() => {
    const db = getDb();
    let transactionStarted = false;

    try {
      db.exec("BEGIN IMMEDIATE");
      transactionStarted = true;
      insertProject(db, workspace.project);
      insertBrief(db, workspace.brief);
      insertAssetPlan(db, workspace.assetPlan);
      replacePlatformPlans(db, workspace.project.id, workspace.platformPlans);
      replaceQAGates(db, workspace.project.id, workspace.qaGates);
      replaceAgentRuns(db, workspace.project.id, workspace.agents);
      insertArtifacts(db, workspace.artifacts);
      db.exec("COMMIT");
    } catch (error) {
      rollbackQuietly(db, transactionStarted);
      throw error;
    }
  });
}

export function listWorkspaces(): ProjectWorkspace[] {
  return withDatabaseRetry(() => {
    const db = getDb();
    const rows = db.prepare("SELECT id FROM projects ORDER BY created_at DESC").all() as unknown as Array<{ id: string }>;
    return rows.map((row) => getWorkspace(row.id)).filter(Boolean) as ProjectWorkspace[];
  });
}

export function getWorkspace(projectId: string): ProjectWorkspace | null {
  return withDatabaseRetry(() => {
    const db = getDb();
    const project = getProject(db, projectId);
    if (!project) return null;

    const brief = getBrief(db, projectId);
    const assetPlan = getAssetPlan(db, projectId);
    const agents = getAgentRuns(db, projectId);
    const platformPlans = getPlatformPlans(db, projectId);
    const qaGates = getQAGates(db, projectId);
    const artifacts = getArtifacts(db, projectId);
    const studioPlanArtifact = artifacts.find((artifact) => artifact.kind === "studio-plan");
    const studioPlan = studioPlanArtifact ? readArtifactContent(studioPlanArtifact.path) : "";

    if (!brief || !assetPlan) return null;

    return {
      project,
      brief,
      agents,
      assetPlan,
      platformPlans,
      qaGates,
      artifacts,
      studioPlan
    };
  });
}

export function getArtifact(projectId: string, artifactId: string): ArtifactRecord | null {
  return withDatabaseRetry(() => {
    const db = getDb();
    const row = db
      .prepare("SELECT * FROM artifacts WHERE project_id = ? AND id = ?")
      .get(projectId, artifactId) as unknown as ArtifactRow | undefined;

    if (!row) return null;

    return {
      id: row.id,
      projectId: row.project_id,
      kind: row.kind as ArtifactRecord["kind"],
      label: row.label,
      path: row.path,
      createdAt: row.created_at
    };
  });
}

export function updateAgentRun(projectId: string, agent: AgentRun, artifact: ArtifactRecord): void {
  withDatabaseRetry(() => {
    const db = getDb();
    let transactionStarted = false;

    try {
      db.exec("BEGIN IMMEDIATE");
      transactionStarted = true;
      const existing = db.prepare("SELECT created_at FROM agent_runs WHERE project_id = ? AND role = ?").get(projectId, agent.role) as unknown as
        | { created_at: string }
        | undefined;
      const createdAt = existing?.created_at ?? agent.createdAt;

      db.prepare(
        `INSERT INTO agent_runs (
          id, project_id, role, title, input, output, status, artifacts_json, confidence, blockers_json, run_number, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(project_id, role) DO UPDATE SET
          id = excluded.id,
          title = excluded.title,
          input = excluded.input,
          output = excluded.output,
          status = excluded.status,
          artifacts_json = excluded.artifacts_json,
          confidence = excluded.confidence,
          blockers_json = excluded.blockers_json,
          run_number = excluded.run_number,
          updated_at = excluded.updated_at`
      ).run(
        agent.id,
        projectId,
        agent.role,
        agent.title,
        agent.input,
        agent.output,
        agent.status,
        JSON.stringify([artifact]),
        agent.confidence,
        JSON.stringify(agent.blockers),
        agent.runNumber,
        createdAt,
        agent.updatedAt
      );

      insertArtifacts(db, [artifact]);
      touchProject(db, projectId);
      db.exec("COMMIT");
    } catch (error) {
      rollbackQuietly(db, transactionStarted);
      throw error;
    }
  });
}

export function addArtifact(artifact: ArtifactRecord): void {
  withDatabaseRetry(() => {
    const db = getDb();
    let transactionStarted = false;

    try {
      db.exec("BEGIN IMMEDIATE");
      transactionStarted = true;
      insertArtifacts(db, [artifact]);
      touchProject(db, artifact.projectId);
      db.exec("COMMIT");
    } catch (error) {
      rollbackQuietly(db, transactionStarted);
      throw error;
    }
  });
}

export function withDatabaseRetry<T>(
  operation: () => T,
  options: { retries?: number; baseDelayMs?: number } = {}
): T {
  const retries = options.retries ?? DEFAULT_BUSY_RETRIES;
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_BUSY_DELAY_MS;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return operation();
    } catch (error) {
      lastError = error;
      if (!isSqliteBusyError(error) || attempt === retries) throw error;
      sleepSync(baseDelayMs * (attempt + 1));
    }
  }

  throw lastError;
}

export function isSqliteBusyError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /database is locked|database is busy|SQLITE_BUSY|SQLITE_LOCKED/i.test(message);
}

function configureDatabase(db: DatabaseSync): void {
  db.exec(`
    PRAGMA busy_timeout = 5000;
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA foreign_keys = ON;
  `);
}

function rollbackQuietly(db: DatabaseSync, transactionStarted: boolean): void {
  if (!transactionStarted) return;
  try {
    db.exec("ROLLBACK");
  } catch {
    // The original database error is more useful than a failed cleanup.
  }
}

function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function migrate(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      prompt TEXT NOT NULL,
      genre TEXT NOT NULL,
      target_audience TEXT NOT NULL,
      target_platforms_json TEXT NOT NULL,
      engine_preference TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS briefs (
      project_id TEXT PRIMARY KEY,
      summary TEXT NOT NULL,
      fantasy TEXT NOT NULL,
      pillars_json TEXT NOT NULL,
      core_loop_json TEXT NOT NULL,
      references_json TEXT NOT NULL,
      risks_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(project_id) REFERENCES projects(id)
    );

    CREATE TABLE IF NOT EXISTS agent_runs (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      role TEXT NOT NULL,
      title TEXT NOT NULL,
      input TEXT NOT NULL,
      output TEXT NOT NULL,
      status TEXT NOT NULL,
      artifacts_json TEXT NOT NULL,
      confidence REAL NOT NULL,
      blockers_json TEXT NOT NULL,
      run_number INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(project_id, role),
      FOREIGN KEY(project_id) REFERENCES projects(id)
    );

    CREATE TABLE IF NOT EXISTS asset_plans (
      project_id TEXT PRIMARY KEY,
      visual_style TEXT NOT NULL,
      items_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(project_id) REFERENCES projects(id)
    );

    CREATE TABLE IF NOT EXISTS platform_plans (
      project_id TEXT NOT NULL,
      platform TEXT NOT NULL,
      status TEXT NOT NULL,
      readiness_gates_json TEXT NOT NULL,
      notes TEXT NOT NULL,
      PRIMARY KEY(project_id, platform),
      FOREIGN KEY(project_id) REFERENCES projects(id)
    );

    CREATE TABLE IF NOT EXISTS qa_gates (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      automated_checks_json TEXT NOT NULL,
      headed_playtest_checks_json TEXT NOT NULL,
      player_feel_checks_json TEXT NOT NULL,
      result TEXT NOT NULL,
      FOREIGN KEY(project_id) REFERENCES projects(id)
    );

    CREATE TABLE IF NOT EXISTS artifacts (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      label TEXT NOT NULL,
      path TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(project_id, path),
      FOREIGN KEY(project_id) REFERENCES projects(id)
    );
  `);
}

function insertProject(db: DatabaseSync, project: GameProject): void {
  db.prepare(
    `INSERT INTO projects (
      id, name, prompt, genre, target_audience, target_platforms_json, engine_preference, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      prompt = excluded.prompt,
      genre = excluded.genre,
      target_audience = excluded.target_audience,
      target_platforms_json = excluded.target_platforms_json,
      engine_preference = excluded.engine_preference,
      status = excluded.status,
      updated_at = excluded.updated_at`
  ).run(
    project.id,
    project.name,
    project.prompt,
    project.genre,
    project.targetAudience,
    JSON.stringify(project.targetPlatforms),
    project.enginePreference,
    project.status,
    project.createdAt,
    project.updatedAt
  );
}

function insertBrief(db: DatabaseSync, brief: GameBrief): void {
  db.prepare(
    `INSERT INTO briefs (
      project_id, summary, fantasy, pillars_json, core_loop_json, references_json, risks_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(project_id) DO UPDATE SET
      summary = excluded.summary,
      fantasy = excluded.fantasy,
      pillars_json = excluded.pillars_json,
      core_loop_json = excluded.core_loop_json,
      references_json = excluded.references_json,
      risks_json = excluded.risks_json`
  ).run(
    brief.projectId,
    brief.summary,
    brief.fantasy,
    JSON.stringify(brief.pillars),
    JSON.stringify(brief.coreLoop),
    JSON.stringify(brief.references),
    JSON.stringify(brief.risks),
    brief.createdAt
  );
}

function insertAssetPlan(db: DatabaseSync, assetPlan: AssetPlan): void {
  db.prepare(
    `INSERT INTO asset_plans (project_id, visual_style, items_json, created_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(project_id) DO UPDATE SET
      visual_style = excluded.visual_style,
      items_json = excluded.items_json`
  ).run(assetPlan.projectId, assetPlan.visualStyle, JSON.stringify(assetPlan.items), assetPlan.createdAt);
}

function replacePlatformPlans(db: DatabaseSync, projectId: string, plans: PlatformPlan[]): void {
  db.prepare("DELETE FROM platform_plans WHERE project_id = ?").run(projectId);

  const statement = db.prepare(
    `INSERT INTO platform_plans (project_id, platform, status, readiness_gates_json, notes)
    VALUES (?, ?, ?, ?, ?)`
  );

  for (const plan of plans) {
    statement.run(projectId, plan.platform, plan.status, JSON.stringify(plan.readinessGates), plan.notes);
  }
}

function replaceQAGates(db: DatabaseSync, projectId: string, gates: QAGate[]): void {
  db.prepare("DELETE FROM qa_gates WHERE project_id = ?").run(projectId);

  const statement = db.prepare(
    `INSERT INTO qa_gates (
      id, project_id, name, automated_checks_json, headed_playtest_checks_json, player_feel_checks_json, result
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`
  );

  for (const gate of gates) {
    statement.run(
      gate.id,
      projectId,
      gate.name,
      JSON.stringify(gate.automatedChecks),
      JSON.stringify(gate.headedPlaytestChecks),
      JSON.stringify(gate.playerFeelChecks),
      gate.result
    );
  }
}

function replaceAgentRuns(db: DatabaseSync, projectId: string, agents: AgentRun[]): void {
  db.prepare("DELETE FROM agent_runs WHERE project_id = ?").run(projectId);

  const statement = db.prepare(
    `INSERT INTO agent_runs (
      id, project_id, role, title, input, output, status, artifacts_json, confidence, blockers_json, run_number, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  for (const agent of agents) {
    statement.run(
      agent.id,
      projectId,
      agent.role,
      agent.title,
      agent.input,
      agent.output,
      agent.status,
      JSON.stringify(agent.artifacts),
      agent.confidence,
      JSON.stringify(agent.blockers),
      agent.runNumber,
      agent.createdAt,
      agent.updatedAt
    );
  }
}

function insertArtifacts(db: DatabaseSync, artifacts: ArtifactRecord[]): void {
  const statement = db.prepare(
    `INSERT INTO artifacts (id, project_id, kind, label, path, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(project_id, path) DO UPDATE SET
      label = excluded.label,
      kind = excluded.kind,
      created_at = excluded.created_at`
  );

  for (const artifact of artifacts) {
    statement.run(artifact.id, artifact.projectId, artifact.kind, artifact.label, artifact.path, artifact.createdAt);
  }
}

function touchProject(db: DatabaseSync, projectId: string): void {
  db.prepare("UPDATE projects SET updated_at = ? WHERE id = ?").run(new Date().toISOString(), projectId);
}

function getProject(db: DatabaseSync, projectId: string): GameProject | null {
  const row = db.prepare("SELECT * FROM projects WHERE id = ?").get(projectId) as unknown as ProjectRow | undefined;
  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    prompt: row.prompt,
    genre: row.genre,
    targetAudience: row.target_audience,
    targetPlatforms: JSON.parse(row.target_platforms_json) as string[],
    enginePreference: row.engine_preference,
    status: row.status as GameProject["status"],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function getBrief(db: DatabaseSync, projectId: string): GameBrief | null {
  const row = db.prepare("SELECT * FROM briefs WHERE project_id = ?").get(projectId) as unknown as BriefRow | undefined;
  if (!row) return null;

  return {
    projectId: row.project_id,
    summary: row.summary,
    fantasy: row.fantasy,
    pillars: JSON.parse(row.pillars_json) as string[],
    coreLoop: JSON.parse(row.core_loop_json) as string[],
    references: JSON.parse(row.references_json) as string[],
    risks: JSON.parse(row.risks_json) as string[],
    createdAt: row.created_at
  };
}

function getAssetPlan(db: DatabaseSync, projectId: string): AssetPlan | null {
  const row = db.prepare("SELECT * FROM asset_plans WHERE project_id = ?").get(projectId) as unknown as AssetPlanRow | undefined;
  if (!row) return null;

  return {
    projectId: row.project_id,
    visualStyle: row.visual_style,
    items: JSON.parse(row.items_json) as AssetPlan["items"],
    createdAt: row.created_at
  };
}

function getAgentRuns(db: DatabaseSync, projectId: string): AgentRun[] {
  const rows = db.prepare("SELECT * FROM agent_runs WHERE project_id = ? ORDER BY rowid ASC").all(projectId) as unknown as AgentRunRow[];

  return rows.map((row) => ({
    id: row.id,
    projectId: row.project_id,
    role: row.role,
    title: row.title,
    input: row.input,
    output: row.output,
    status: row.status as AgentRun["status"],
    artifacts: JSON.parse(row.artifacts_json) as ArtifactRecord[],
    confidence: row.confidence,
    blockers: JSON.parse(row.blockers_json) as string[],
    runNumber: row.run_number,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));
}

function getPlatformPlans(db: DatabaseSync, projectId: string): PlatformPlan[] {
  const rows = db.prepare("SELECT * FROM platform_plans WHERE project_id = ? ORDER BY rowid ASC").all(projectId) as unknown as PlatformPlanRow[];

  return rows.map((row) => ({
    projectId: row.project_id,
    platform: row.platform,
    status: row.status as PlatformPlan["status"],
    readinessGates: JSON.parse(row.readiness_gates_json) as string[],
    notes: row.notes
  }));
}

function getQAGates(db: DatabaseSync, projectId: string): QAGate[] {
  const rows = db.prepare("SELECT * FROM qa_gates WHERE project_id = ? ORDER BY rowid ASC").all(projectId) as unknown as QAGateRow[];

  return rows.map((row) => ({
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    automatedChecks: JSON.parse(row.automated_checks_json) as string[],
    headedPlaytestChecks: JSON.parse(row.headed_playtest_checks_json) as string[],
    playerFeelChecks: JSON.parse(row.player_feel_checks_json) as string[],
    result: row.result as QAGate["result"]
  }));
}

function getArtifacts(db: DatabaseSync, projectId: string): ArtifactRecord[] {
  const rows = db.prepare("SELECT * FROM artifacts WHERE project_id = ? ORDER BY rowid ASC").all(projectId) as unknown as ArtifactRow[];

  return rows.map((row) => ({
    id: row.id,
    projectId: row.project_id,
    kind: row.kind as ArtifactRecord["kind"],
    label: row.label,
    path: row.path,
    createdAt: row.created_at
  }));
}

interface ProjectRow {
  id: string;
  name: string;
  prompt: string;
  genre: string;
  target_audience: string;
  target_platforms_json: string;
  engine_preference: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface BriefRow {
  project_id: string;
  summary: string;
  fantasy: string;
  pillars_json: string;
  core_loop_json: string;
  references_json: string;
  risks_json: string;
  created_at: string;
}

interface AgentRunRow {
  id: string;
  project_id: string;
  role: string;
  title: string;
  input: string;
  output: string;
  status: string;
  artifacts_json: string;
  confidence: number;
  blockers_json: string;
  run_number: number;
  created_at: string;
  updated_at: string;
}

interface AssetPlanRow {
  project_id: string;
  visual_style: string;
  items_json: string;
  created_at: string;
}

interface PlatformPlanRow {
  project_id: string;
  platform: string;
  status: string;
  readiness_gates_json: string;
  notes: string;
}

interface QAGateRow {
  id: string;
  project_id: string;
  name: string;
  automated_checks_json: string;
  headed_playtest_checks_json: string;
  player_feel_checks_json: string;
  result: string;
}

interface ArtifactRow {
  id: string;
  project_id: string;
  kind: string;
  label: string;
  path: string;
  created_at: string;
}
