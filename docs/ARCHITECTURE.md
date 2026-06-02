# Game OS Architecture

## Product Shape

Game OS is a pure local CLI runtime for AI-assisted game creation. A creator or coding agent runs `gameos` commands, and the runtime creates project memory, artifacts, playable adapter scaffolds, and QA reports on the local machine.

There is no required website, plugin, MCP server, account, telemetry, or cloud service in V1.

## Runtime

- `dist/cli.js` is the published `gameos` binary.
- `src/cli/*` owns command parsing, terminal output, JSON output, quality routing, and CLI QA.
- `src/lib/studio.ts` remains the source-of-truth studio service layer.
- SQLite and project artifacts live under `GAME_OS_DATA_DIR` or `~/.gameos`.
- Agent definitions are loaded from `studio-agents/agents.json`.
- Web, Godot, and Unity adapter scaffolds are generated under `~/.gameos/projects/<project-id>/`.
- Browser and engine checks are explicit commands, never hidden background work.

## Data Flow

1. User runs `gameos create` or `gameos make`.
2. Intake normalizes genre, audience, title, platforms, and engine preference.
3. Game OS creates the game brief and agent swarm outputs.
4. Artifacts are written as local Markdown/JSON files.
5. `gameos build web` creates the first playable lane.
6. `gameos qa web` records static or browser player-agent evidence.
7. Godot and Unity lanes require `--allow-heavy`.
8. `gameos status` reports verdicts, blockers, artifacts, and next command.

## Agent Roles

- Studio Director
- Game Designer
- Technical Architect
- Rules Systems Designer
- Art Director
- Advanced Player
- QA Director
- Memory Manager
- Storage Manager
- Prototype Producer
- Platform Producer
- Swarm Orchestrator
- Build Sentinel

## CLI UX Doctrine

- Human-readable output by default.
- `--json` for automation.
- Artifact reads are summary-first.
- `--full` is required for large artifact dumps.
- `--allow-heavy` is required for Godot/Unity long-running checks.
- V1 does not automate store publishing.

## V1 Boundary

V1 is a local CLI game studio runtime. Web is the default first playable lane, Godot and Unity are optional local adapter lanes, and Steam remains test readiness only.
