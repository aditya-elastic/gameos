"use client";

import { useMemo, useState, useTransition } from "react";
import type { FormEvent, ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  Blocks,
  Bot,
  Boxes,
  ClipboardCheck,
  Cpu,
  Eye,
  FileText,
  FolderKanban,
  Gamepad2,
  Gauge,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  Rocket,
  ShieldCheck,
  Sparkles,
  Target,
  Upload,
  WandSparkles
} from "lucide-react";
import type { AgentRun, ArtifactRecord, PlatformPlan, ProjectWorkspace, QAGate, StudioApiError } from "@/lib/types";

const platformOptions = ["PC Test", "Steam Test", "Unity", "Godot", "iOS", "Android", "Web"];

const demoGame = {
  prompt:
    "ClipForge Gauntlet is a small creator challenge game for YouTube players. Creators sprint through shifting mini arenas, dodge reaction traps, grab risky highlight tokens, and bank a final clip score for Steam test readiness without store publishing.",
  targetPlatforms: ["PC Test", "Steam Test", "Web"],
  enginePreference: "Engine-neutral first",
  genre: "Creator Challenge",
  targetAudience: "creator and YouTube playtest audience"
};

const turnRulesGame = {
  prompt:
    "Board Race Table is a polished turn-based board strategy game for creator playtesting. Two to four players roll dice, release tokens on special rolls, capture rivals, use safe squares, race tokens home, and support local pass-and-play plus simple bot turns for PC and Steam test readiness before Unity and Godot adapters.",
  targetPlatforms: ["PC Test", "Steam Test", "Web", "Unity", "Godot"],
  enginePreference: "Engine-neutral first",
  genre: "Board Game Strategy",
  targetAudience: "creator and YouTube playtest audience"
};

const assetPhysicsGame = {
  prompt:
    "A physics timing puzzle where a creator uploads an asset pack, releases a rope to drop a hero object into a goal, collects mastery pickups, and proves the asset pipeline through fast web playtesting.",
  targetPlatforms: ["PC Test", "Web"],
  enginePreference: "Web first",
  genre: "Physics Puzzle",
  targetAudience: "creator and YouTube playtest audience"
};

type StudioSeed = typeof demoGame;

type ArtifactPreview = {
  artifact: ArtifactRecord & {
    relativePath: string;
    content: string;
  };
};

export function GameOsApp({
  initialWorkspaces,
  initialSelectedId
}: {
  initialWorkspaces: ProjectWorkspace[];
  initialSelectedId?: string;
}) {
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState(initialWorkspaces);
  const [selectedId, setSelectedId] = useState(initialSelectedId ?? initialWorkspaces[0]?.project.id ?? "");
  const [prompt, setPrompt] = useState("");
  const [genre, setGenre] = useState("");
  const [audience, setAudience] = useState("");
  const [enginePreference, setEnginePreference] = useState("Engine-neutral first");
  const [targetPlatforms, setTargetPlatforms] = useState(["PC Test", "Steam Test"]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const [artifactPreview, setArtifactPreview] = useState<ArtifactPreview | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.project.id === selectedId) ?? workspaces[0] ?? null,
    [selectedId, workspaces]
  );

  async function createProject(payload?: StudioSeed, action = "create") {
    const requestBody = payload ?? {
      prompt,
      targetPlatforms,
      enginePreference,
      genre,
      targetAudience: audience
    };

    setError("");
    setMessage("");

    if (!requestBody.prompt || requestBody.prompt.trim().length < 20) {
      setError("Give Game OS at least one strong sentence so the swarm has real material.");
      return;
    }

    if (requestBody.targetPlatforms.length === 0) {
      setError("Choose at least one platform lane.");
      return;
    }

    setBusyAction(payload ? action : "create");

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(requestBody)
      });
      const data = (await response.json()) as { project?: ProjectWorkspace } & StudioApiError;

      if (!response.ok || !data.project) {
        throw new Error([data.error, ...(data.details ?? [])].filter(Boolean).join(" "));
      }

      setWorkspaces((current) => [data.project as ProjectWorkspace, ...current.filter((item) => item.project.id !== data.project?.project.id)]);
      setSelectedId(data.project.project.id);
      setPrompt("");
      setGenre("");
      setAudience("");
      setArtifactPreview(null);
      setMessage(`${data.project.project.name} studio room is ready.`);
      startTransition(() => router.push(`/?project=${data.project?.project.id}`));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Game OS could not create the project.");
    } finally {
      setBusyAction("");
    }
  }

  async function regenerateAgent(projectId: string, role: string) {
    setError("");
    setMessage("");
    setBusyAction(`agent:${role}`);

    try {
      const response = await fetch(`/api/projects/${projectId}/agents/${role}`, {
        method: "POST"
      });
      const data = (await response.json()) as { project?: ProjectWorkspace } & StudioApiError;

      if (!response.ok || !data.project) {
        throw new Error([data.error, ...(data.details ?? [])].filter(Boolean).join(" "));
      }

      setWorkspaces((current) => current.map((workspace) => (workspace.project.id === projectId ? (data.project as ProjectWorkspace) : workspace)));
      setMessage(`${data.project.project.name}: ${role.replaceAll("-", " ")} regenerated.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Game OS could not regenerate this agent.");
    } finally {
      setBusyAction("");
    }
  }

  async function generateGodotAdapter(projectId: string) {
    setError("");
    setMessage("");
    setBusyAction("godot-adapter");

    try {
      const response = await fetch(`/api/projects/${projectId}/adapters/godot`, {
        method: "POST"
      });
      const data = (await response.json()) as { project?: ProjectWorkspace } & StudioApiError;

      if (!response.ok || !data.project) {
        throw new Error([data.error, ...(data.details ?? [])].filter(Boolean).join(" "));
      }

      setWorkspaces((current) => current.map((workspace) => (workspace.project.id === projectId ? (data.project as ProjectWorkspace) : workspace)));
      setArtifactPreview(null);
      setMessage(`${data.project.project.name}: Godot adapter generated.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Game OS could not generate the Godot adapter.");
    } finally {
      setBusyAction("");
    }
  }

  async function generateUnityAdapter(projectId: string) {
    setError("");
    setMessage("");
    setBusyAction("unity-adapter");

    try {
      const response = await fetch(`/api/projects/${projectId}/adapters/unity`, {
        method: "POST"
      });
      const data = (await response.json()) as { project?: ProjectWorkspace } & StudioApiError;

      if (!response.ok || !data.project) {
        throw new Error([data.error, ...(data.details ?? [])].filter(Boolean).join(" "));
      }

      setWorkspaces((current) => current.map((workspace) => (workspace.project.id === projectId ? (data.project as ProjectWorkspace) : workspace)));
      setArtifactPreview(null);
      setMessage(`${data.project.project.name}: Unity adapter generated.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Game OS could not generate the Unity adapter.");
    } finally {
      setBusyAction("");
    }
  }

  async function generateWebAdapter(projectId: string) {
    setError("");
    setMessage("");
    setBusyAction("web-adapter");

    try {
      const response = await fetch(`/api/projects/${projectId}/adapters/web`, {
        method: "POST"
      });
      const data = (await response.json()) as { project?: ProjectWorkspace } & StudioApiError;

      if (!response.ok || !data.project) {
        throw new Error([data.error, ...(data.details ?? [])].filter(Boolean).join(" "));
      }

      setWorkspaces((current) => current.map((workspace) => (workspace.project.id === projectId ? (data.project as ProjectWorkspace) : workspace)));
      setArtifactPreview(null);
      setMessage(`${data.project.project.name}: Web adapter generated.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Game OS could not generate the Web adapter.");
    } finally {
      setBusyAction("");
    }
  }

  async function uploadAssets(projectId: string, file: File) {
    setError("");
    setMessage("");
    setBusyAction("asset-upload");

    try {
      const data = file.size > 48 * 1024 * 1024 ? await uploadAssetInChunks(projectId, file) : await uploadAssetAsSingleRequest(projectId, file);

      if (!data.project) {
        throw new Error([data.error, ...(data.details ?? [])].filter(Boolean).join(" "));
      }

      setWorkspaces((current) => current.map((workspace) => (workspace.project.id === projectId ? (data.project as ProjectWorkspace) : workspace)));
      setArtifactPreview(null);
      setMessage(`${data.project.project.name}: asset pack imported and judged.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Game OS could not import this asset pack.");
    } finally {
      setBusyAction("");
    }
  }

  async function uploadAssetAsSingleRequest(projectId: string, file: File): Promise<{ project?: ProjectWorkspace } & StudioApiError> {
    const formData = new FormData();
    formData.append("assetArchive", file);

    const response = await fetch(`/api/projects/${projectId}/assets`, {
      method: "POST",
      body: formData
    });
    const data = (await response.json()) as { project?: ProjectWorkspace } & StudioApiError;

    if (!response.ok) {
      throw new Error([data.error, ...(data.details ?? [])].filter(Boolean).join(" "));
    }

    return data;
  }

  async function uploadAssetInChunks(projectId: string, file: File): Promise<{ project?: ProjectWorkspace } & StudioApiError> {
    const chunkSize = 8 * 1024 * 1024;
    const totalChunks = Math.ceil(file.size / chunkSize);
    const uploadId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    let latestData: ({ project?: ProjectWorkspace } & StudioApiError) | null = null;

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
      const formData = new FormData();
      const start = chunkIndex * chunkSize;
      const end = Math.min(file.size, start + chunkSize);
      formData.append("uploadId", uploadId);
      formData.append("fileName", file.name);
      formData.append("chunkIndex", String(chunkIndex));
      formData.append("totalChunks", String(totalChunks));
      formData.append("chunk", file.slice(start, end), file.name);

      const response = await fetch(`/api/projects/${projectId}/assets/chunk`, {
        method: "POST",
        body: formData
      });
      const data = (await response.json()) as { project?: ProjectWorkspace } & StudioApiError;

      if (!response.ok) {
        throw new Error([data.error, ...(data.details ?? [])].filter(Boolean).join(" "));
      }

      latestData = data;
    }

    return latestData ?? { error: "Chunk upload did not complete." };
  }

  async function openArtifact(projectId: string, artifact: ArtifactRecord) {
    setError("");
    setBusyAction(`artifact:${artifact.id}`);

    try {
      const response = await fetch(`/api/projects/${projectId}/artifacts/${artifact.id}`);
      const data = (await response.json()) as ArtifactPreview & StudioApiError;

      if (!response.ok || !data.artifact) {
        throw new Error([data.error, ...(data.details ?? [])].filter(Boolean).join(" "));
      }

      setArtifactPreview(data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Game OS could not open this artifact.");
    } finally {
      setBusyAction("");
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void createProject();
  }

  function togglePlatform(platform: string) {
    setTargetPlatforms((current) => (current.includes(platform) ? current.filter((item) => item !== platform) : [...current, platform]));
  }

  return (
    <main className="app-shell">
      <section className="topbar" aria-label="Game OS command bar">
        <div className="brand-block">
          <div className="brand-mark">
            <Gamepad2 size={24} aria-hidden />
          </div>
          <div>
            <p className="eyebrow">Local Studio OS</p>
            <h1>Game OS</h1>
          </div>
        </div>
        <div className="topbar-actions">
          <button className="secondary-button dark" type="button" onClick={() => void createProject(turnRulesGame, "turn-rules")} disabled={busyAction === "turn-rules"}>
            {busyAction === "turn-rules" ? <Loader2 className="spin" size={18} aria-hidden /> : <Sparkles size={18} aria-hidden />}
            Run Turn Rules Flow
          </button>
          <button className="secondary-button dark" type="button" onClick={() => void createProject(assetPhysicsGame, "asset-physics")} disabled={busyAction === "asset-physics"}>
            {busyAction === "asset-physics" ? <Loader2 className="spin" size={18} aria-hidden /> : <Sparkles size={18} aria-hidden />}
            Run Asset-Led Physics Flow
          </button>
          <button className="secondary-button dark" type="button" onClick={() => void createProject(demoGame, "demo")} disabled={busyAction === "demo"}>
            {busyAction === "demo" ? <Loader2 className="spin" size={18} aria-hidden /> : <WandSparkles size={18} aria-hidden />}
            Run Demo Flow
          </button>
        </div>
        <div className="topbar-stats" aria-label="Workspace stats">
          <Metric icon={<FolderKanban size={18} />} label="Projects" value={String(workspaces.length)} />
          <Metric icon={<Bot size={18} />} label="Agents" value={selectedWorkspace ? String(selectedWorkspace.agents.length) : "0"} />
          <Metric icon={<ClipboardCheck size={18} />} label="QA Gates" value={selectedWorkspace ? String(selectedWorkspace.qaGates.length) : "0"} />
        </div>
      </section>

      {(error || message || isPending) && (
        <section className={error ? "notice error" : "notice"} role={error ? "alert" : "status"}>
          {error || (isPending ? "Opening the studio room..." : message)}
        </section>
      )}

      <section className="workspace-grid">
        <aside className="left-rail" aria-label="Project creation and project list">
          <NewProjectForm
            prompt={prompt}
            genre={genre}
            audience={audience}
            enginePreference={enginePreference}
            targetPlatforms={targetPlatforms}
            busy={busyAction === "create"}
            onPrompt={setPrompt}
            onGenre={setGenre}
            onAudience={setAudience}
            onEnginePreference={setEnginePreference}
            onTogglePlatform={togglePlatform}
            onSubmit={handleSubmit}
          />
          <ProjectList
            workspaces={workspaces}
            selectedId={selectedWorkspace?.project.id}
            onSelect={(projectId) => {
              setSelectedId(projectId);
              setArtifactPreview(null);
              startTransition(() => router.push(`/?project=${projectId}`));
            }}
          />
        </aside>

        {selectedWorkspace ? (
          <StudioRoom
            workspace={selectedWorkspace}
            artifactPreview={artifactPreview}
            busyAction={busyAction}
            onRegenerate={regenerateAgent}
            onGenerateGodot={generateGodotAdapter}
            onGenerateUnity={generateUnityAdapter}
            onGenerateWeb={generateWebAdapter}
            onUploadAssets={uploadAssets}
            onOpenArtifact={openArtifact}
          />
        ) : (
          <EmptyStudio onDemo={() => void createProject(demoGame)} busy={busyAction === "demo"} />
        )}
      </section>
    </main>
  );
}

function NewProjectForm(props: {
  prompt: string;
  genre: string;
  audience: string;
  enginePreference: string;
  targetPlatforms: string[];
  busy: boolean;
  onPrompt: (value: string) => void;
  onGenre: (value: string) => void;
  onAudience: (value: string) => void;
  onEnginePreference: (value: string) => void;
  onTogglePlatform: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <section className="panel intake-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">New Project</p>
          <h2>Open Studio Room</h2>
        </div>
        <Plus size={20} aria-hidden />
      </div>

      <form className="stacked-form" onSubmit={props.onSubmit}>
        <label>
          <span>Game Prompt</span>
          <textarea
            name="prompt"
            required
            minLength={20}
            rows={7}
            value={props.prompt}
            onChange={(event) => props.onPrompt(event.target.value)}
            placeholder="A small game for YouTube creators where players survive fast challenge rooms, chase highlight moments, and test Steam readiness later."
          />
        </label>

        <div className="two-field-grid">
          <label>
            <span>Genre</span>
            <input name="genre" placeholder="Auto-detect" value={props.genre} onChange={(event) => props.onGenre(event.target.value)} />
          </label>
          <label>
            <span>Audience</span>
            <input
              name="targetAudience"
              placeholder="Auto-detect"
              value={props.audience}
              onChange={(event) => props.onAudience(event.target.value)}
            />
          </label>
        </div>

        <label>
          <span>Engine Preference</span>
          <select name="enginePreference" value={props.enginePreference} onChange={(event) => props.onEnginePreference(event.target.value)}>
            <option>Engine-neutral first</option>
            <option>Unity later</option>
            <option>Godot later</option>
          </select>
        </label>

        <fieldset>
          <legend>Target Platforms</legend>
          <div className="platform-picker">
            {platformOptions.map((platform) => (
              <label key={platform} className="check-pill">
                <input
                  name="targetPlatforms"
                  type="checkbox"
                  value={platform}
                  checked={props.targetPlatforms.includes(platform)}
                  onChange={() => props.onTogglePlatform(platform)}
                />
                <span>{platform}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <button className="primary-button" type="submit" disabled={props.busy}>
          {props.busy ? <Loader2 className="spin" size={18} aria-hidden /> : <Sparkles size={18} aria-hidden />}
          Create Studio
        </button>
      </form>
    </section>
  );
}

function ProjectList({
  workspaces,
  selectedId,
  onSelect
}: {
  workspaces: ProjectWorkspace[];
  selectedId?: string;
  onSelect: (projectId: string) => void;
}) {
  return (
    <section className="panel project-list-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Rooms</p>
          <h2>Project Dashboard</h2>
        </div>
        <Blocks size={20} aria-hidden />
      </div>
      <div className="project-list">
        {workspaces.length === 0 ? (
          <p className="muted">No studio rooms yet.</p>
        ) : (
          workspaces.map((workspace) => (
            <button
              key={workspace.project.id}
              className={workspace.project.id === selectedId ? "project-link selected" : "project-link"}
              type="button"
              onClick={() => onSelect(workspace.project.id)}
            >
              <span>{workspace.project.name}</span>
              <small>{workspace.project.genre}</small>
            </button>
          ))
        )}
      </div>
    </section>
  );
}

function StudioRoom({
  workspace,
  artifactPreview,
  busyAction,
  onRegenerate,
  onGenerateGodot,
  onGenerateUnity,
  onGenerateWeb,
  onUploadAssets,
  onOpenArtifact
}: {
  workspace: ProjectWorkspace;
  artifactPreview: ArtifactPreview | null;
  busyAction: string;
  onRegenerate: (projectId: string, role: string) => Promise<void>;
  onGenerateGodot: (projectId: string) => Promise<void>;
  onGenerateUnity: (projectId: string) => Promise<void>;
  onGenerateWeb: (projectId: string) => Promise<void>;
  onUploadAssets: (projectId: string, file: File) => Promise<void>;
  onOpenArtifact: (projectId: string, artifact: ArtifactRecord) => Promise<void>;
}) {
  const snapshot = createAcceptanceSnapshot(workspace);
  const hasUnityLane = workspace.platformPlans.some((plan) => plan.platform === "Unity" && plan.status === "targeted");
  const hasUnityAdapter = workspace.artifacts.some((artifact) => artifact.kind === "unity-adapter");
  const hasGodotLane = workspace.platformPlans.some((plan) => plan.platform === "Godot" && plan.status === "targeted");
  const hasGodotAdapter = workspace.artifacts.some((artifact) => artifact.kind === "godot-adapter");
  const hasWebLane = workspace.platformPlans.some((plan) => plan.platform === "Web" && plan.status === "targeted");
  const hasWebAdapter = workspace.artifacts.some((artifact) => artifact.kind === "web-adapter");
  const unityBusy = busyAction === "unity-adapter";
  const godotBusy = busyAction === "godot-adapter";
  const webBusy = busyAction === "web-adapter";

  return (
    <section className="studio-room">
      <section className="panel command-panel">
        <div className="project-title-row">
          <div>
            <p className="eyebrow">Active Studio</p>
            <h2>{workspace.project.name}</h2>
          </div>
          <span className={`status-badge ${snapshot.result}`}>{snapshot.result.replaceAll("-", " ")}</span>
        </div>

        <p className="brief-summary">{workspace.brief.summary}</p>

        <div className="metric-grid">
          <Metric icon={<Target size={18} />} label="Genre" value={workspace.project.genre} />
          <Metric icon={<Rocket size={18} />} label="Targets" value={workspace.project.targetPlatforms.join(", ")} />
          <Metric icon={<Gauge size={18} />} label="QA Watch" value={String(snapshot.watchCount)} />
          <Metric icon={<FileText size={18} />} label="Artifacts" value={String(workspace.artifacts.length)} />
        </div>

        <AssetImportPanel workspace={workspace} busy={busyAction === "asset-upload"} onUpload={onUploadAssets} />

        {hasUnityLane && (
          <div className="adapter-actions">
            <button className="secondary-button" type="button" onClick={() => void onGenerateUnity(workspace.project.id)} disabled={unityBusy}>
              {unityBusy ? <Loader2 className="spin" size={18} aria-hidden /> : <Cpu size={18} aria-hidden />}
              {hasUnityAdapter ? "Regenerate Unity Adapter" : "Generate Unity Adapter"}
            </button>
            <small>Creates a Unity project from rules, memory, QA, and asset artifacts.</small>
          </div>
        )}

        {hasGodotLane && (
          <div className="adapter-actions">
            <button className="secondary-button" type="button" onClick={() => void onGenerateGodot(workspace.project.id)} disabled={godotBusy}>
              {godotBusy ? <Loader2 className="spin" size={18} aria-hidden /> : <Cpu size={18} aria-hidden />}
              {hasGodotAdapter ? "Regenerate Godot Adapter" : "Generate Godot Adapter"}
            </button>
            <small>Creates a Godot 4 project from rules, memory, QA, and asset artifacts.</small>
          </div>
        )}

        {hasWebLane && (
          <div className="adapter-actions">
            <button className="secondary-button" type="button" onClick={() => void onGenerateWeb(workspace.project.id)} disabled={webBusy}>
              {webBusy ? <Loader2 className="spin" size={18} aria-hidden /> : <Cpu size={18} aria-hidden />}
              {hasWebAdapter ? "Regenerate Web Adapter" : "Generate Web Adapter"}
            </button>
            <small>Creates a standalone browser prototype for fast local playtesting.</small>
          </div>
        )}
      </section>

      <section className="content-grid">
        <section className="panel bible-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Generated Game Bible</p>
              <h3>Fantasy & Loop</h3>
            </div>
            <BadgeCheck size={20} aria-hidden />
          </div>
          <p>{workspace.brief.fantasy}</p>
          <div className="pillars">
            {workspace.brief.pillars.map((pillar) => (
              <span key={pillar}>{pillar}</span>
            ))}
          </div>
          <ol className="loop-list">
            {workspace.brief.coreLoop.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>

        <AgentSwarm agents={workspace.agents} projectId={workspace.project.id} busyAction={busyAction} onRegenerate={onRegenerate} />
        <RoadmapPanel workspace={workspace} />
        <AssetPipeline workspace={workspace} />
        <PlatformBoard plans={workspace.platformPlans} />
        <QABoard gates={workspace.qaGates} />
        <ArtifactBoard workspace={workspace} preview={artifactPreview} busyAction={busyAction} onOpenArtifact={onOpenArtifact} />
      </section>
    </section>
  );
}

function AssetImportPanel({
  workspace,
  busy,
  onUpload
}: {
  workspace: ProjectWorkspace;
  busy: boolean;
  onUpload: (projectId: string, file: File) => Promise<void>;
}) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const latestImport = [...workspace.artifacts].reverse().find((artifact) => artifact.kind === "asset-import-report");

  return (
    <div className="asset-import-box">
      <div>
        <p className="eyebrow">Creator Asset Upload</p>
        <strong>{latestImport ? "Asset pack judged" : "Import an asset pack"}</strong>
        <small>{latestImport ? "Latest report is available in artifacts." : "Upload a .zip or image pack before generating asset-driven builds."}</small>
      </div>
      <form
        className="asset-import-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (selectedFile) void onUpload(workspace.project.id, selectedFile);
        }}
      >
        <label className="file-import-label">
          <span>Asset Pack</span>
          <input
            data-testid="asset-upload-input"
            name="assetArchive"
            type="file"
            accept=".zip,.png,.jpg,.jpeg,.webp,.svg"
            onChange={(event) => setSelectedFile(event.currentTarget.files?.[0] ?? null)}
          />
        </label>
        <button className="secondary-button" type="submit" disabled={busy || !selectedFile}>
          {busy ? <Loader2 className="spin" size={18} aria-hidden /> : <Upload size={18} aria-hidden />}
          Import Assets
        </button>
      </form>
    </div>
  );
}

function AgentSwarm({
  agents,
  projectId,
  busyAction,
  onRegenerate
}: {
  agents: AgentRun[];
  projectId: string;
  busyAction: string;
  onRegenerate: (projectId: string, role: string) => Promise<void>;
}) {
  return (
    <section className="panel wide-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Agent Swarm</p>
          <h3>Studio Specialists</h3>
        </div>
        <Bot size={20} aria-hidden />
      </div>
      <div className="agent-list">
        {agents.map((agent) => {
          const isBusy = busyAction === `agent:${agent.role}`;

          return (
            <article className="agent-row" key={agent.role}>
              <div>
                <div className="row-title">
                  <strong>{agent.title}</strong>
                  <span className={agent.status}>{agent.status}</span>
                </div>
                <p>{summarizeAgentOutput(agent.output)}</p>
                <small>
                  Run #{agent.runNumber} · {Math.round(agent.confidence * 100)}% confidence
                </small>
              </div>
              <button
                className="icon-button"
                type="button"
                aria-label={`Regenerate ${agent.title}`}
                onClick={() => void onRegenerate(projectId, agent.role)}
                disabled={isBusy}
              >
                {isBusy ? <Loader2 className="spin" size={17} aria-hidden /> : <RefreshCw size={17} aria-hidden />}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function RoadmapPanel({ workspace }: { workspace: ProjectWorkspace }) {
  const nextGates = workspace.qaGates.filter((gate) => gate.result !== "pass");

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Studio Roadmap</p>
          <h3>Next Best Work</h3>
        </div>
        <Play size={20} aria-hidden />
      </div>
      <div className="roadmap-steps">
        <div>
          <strong>1. Lock the playable slice</strong>
          <span>One compact session, one control scheme, one retry loop.</span>
        </div>
        <div>
          <strong>2. Promote only useful assets</strong>
          <span>Generated art stays reference-only until readability passes.</span>
        </div>
        <div>
          <strong>3. Prepare adapter after gates</strong>
          <span>Web, Unity, and Godot lanes wait for accepted artifacts.</span>
        </div>
      </div>
      <div className="gate-strip">
        {nextGates.map((gate) => (
          <span key={gate.id}>{gate.name}</span>
        ))}
      </div>
    </section>
  );
}

function AssetPipeline({ workspace }: { workspace: ProjectWorkspace }) {
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Asset Pipeline</p>
          <h3>Style & Promotion</h3>
        </div>
        <Boxes size={20} aria-hidden />
      </div>
      <p>{workspace.assetPlan.visualStyle}</p>
      <div className="asset-list">
        {workspace.assetPlan.items.map((item) => (
          <div className="asset-row" key={item.name}>
            <strong>{item.name}</strong>
            <span className={item.status}>{item.status}</span>
            <small>{item.gate}</small>
          </div>
        ))}
      </div>
    </section>
  );
}

function PlatformBoard({ plans }: { plans: PlatformPlan[] }) {
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Platform Readiness</p>
          <h3>Engine-Neutral Lanes</h3>
        </div>
        <Cpu size={20} aria-hidden />
      </div>
      <div className="platform-list">
        {plans.map((plan) => (
          <div className={`platform-row ${plan.status}`} key={plan.platform}>
            <strong>{plan.platform}</strong>
            <span className={plan.status}>{plan.status}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function QABoard({ gates }: { gates: QAGate[] }) {
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">QA Gates</p>
          <h3>Playtest Proof</h3>
        </div>
        <ShieldCheck size={20} aria-hidden />
      </div>
      <div className="qa-list">
        {gates.map((gate) => (
          <div className={`qa-row ${gate.result}`} key={gate.id}>
            <strong>{gate.name}</strong>
            <span className={gate.result}>{gate.result}</span>
            <small>{gate.playerFeelChecks[0]}</small>
          </div>
        ))}
      </div>
    </section>
  );
}

function ArtifactBoard({
  workspace,
  preview,
  busyAction,
  onOpenArtifact
}: {
  workspace: ProjectWorkspace;
  preview: ArtifactPreview | null;
  busyAction: string;
  onOpenArtifact: (projectId: string, artifact: ArtifactRecord) => Promise<void>;
}) {
  return (
    <section className="panel wide-panel artifact-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Artifacts</p>
          <h3>File-Backed Memory</h3>
        </div>
        <FileText size={20} aria-hidden />
      </div>
      <div className="artifact-layout">
        <div className="artifact-list">
          {workspace.artifacts.map((artifact) => {
            const isBusy = busyAction === `artifact:${artifact.id}`;

            return (
              <button
                className={preview?.artifact.id === artifact.id ? "artifact-row selected" : "artifact-row"}
                key={artifact.id}
                type="button"
                onClick={() => void onOpenArtifact(workspace.project.id, artifact)}
              >
                <strong>{artifact.label}</strong>
                <span>{artifact.kind}</span>
                <small>{artifact.path.split(`/projects/${workspace.project.id}/`)[1] ?? artifact.path}</small>
                {isBusy && <Loader2 className="spin row-loader" size={15} aria-hidden />}
              </button>
            );
          })}
        </div>
        <div className="artifact-preview">
          {preview ? (
            <>
              <div className="section-heading">
                <div>
                  <p className="eyebrow">{preview.artifact.kind}</p>
                  <h3>{preview.artifact.label}</h3>
                </div>
                <Eye size={20} aria-hidden />
              </div>
              <code>{preview.artifact.relativePath}</code>
              <pre>{preview.artifact.content}</pre>
            </>
          ) : (
            <div className="empty-preview">
              <Eye size={24} aria-hidden />
              <p>Select an artifact to preview the generated studio memory.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function EmptyStudio({ onDemo, busy }: { onDemo: () => void; busy: boolean }) {
  return (
    <section className="panel empty-panel">
      <Sparkles size={34} aria-hidden />
      <h2>Game OS is ready.</h2>
      <p>Open the first studio room, or run the built-in demo flow to watch the full OS pipeline create a project.</p>
      <button className="primary-button" type="button" onClick={onDemo} disabled={busy}>
        {busy ? <Loader2 className="spin" size={18} aria-hidden /> : <WandSparkles size={18} aria-hidden />}
        Run Demo Flow
      </button>
    </section>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="metric">
      <span className="metric-icon">{icon}</span>
      <span className="metric-label">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function createAcceptanceSnapshot(workspace: ProjectWorkspace) {
  const blockedCount = workspace.qaGates.filter((gate) => gate.result === "blocked").length;
  const watchCount = workspace.qaGates.filter((gate) => gate.result === "watch").length;
  const passCount = workspace.qaGates.filter((gate) => gate.result === "pass").length;
  const allAgentsComplete = workspace.agents.every((agent) => agent.status === "complete");
  const result = blockedCount > 0 ? "blocked" : watchCount <= 2 && allAgentsComplete ? "ready-for-engine-adapter" : "needs-studio-review";

  return {
    result,
    passCount,
    watchCount,
    blockedCount
  };
}

function summarizeAgentOutput(output: string): string {
  const lines = output
    .split("\n")
    .map((line) => line.trim())
    .filter(
      (line) =>
        line &&
        !line.startsWith("#") &&
        !line.startsWith("Run:") &&
        !line.startsWith("Mission:") &&
        !line.startsWith("Project:") &&
        !line.startsWith("Relevant skills:")
    );

  return lines[0]?.replace(/^[-*]\s*/, "") ?? "Agent output is ready.";
}
