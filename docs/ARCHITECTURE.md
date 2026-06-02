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
5. `gameos make --assets` can import user assets, classify gameplay roles, and write an asset preview manifest before Web generation.
6. `gameos build web` creates the first playable lane.
7. `gameos qa web` records static or browser player-agent evidence.
8. `gameos journey` reports stage-by-stage blockers.
9. `gameos review` creates the 10/10 studio scorecard and promotes QA gates only when all categories pass.
10. `gameos feedback` records creator feedback for agent regeneration.
11. Godot and Unity lanes require `--allow-heavy`.

## Agent Roles

- Studio Director
- Game Designer
- Gameplay Developer
- Technical Architect
- UX Flow Director
- Rules Systems Designer
- Art Director
- Asset Pipeline Director
- Visual Quality Director
- Game Feel Director
- Physics Gameplay Engineer
- Advanced Player
- QA Director
- Memory Manager
- Storage Manager
- Security Privacy Reviewer
- Prototype Producer
- Platform Producer
- Swarm Orchestrator
- Build Sentinel
- Open Source Release Engineer

## CLI UX Doctrine

- Human-readable output by default.
- `--json` for automation.
- Artifact reads are summary-first.
- `--full` is required for large artifact dumps.
- `--allow-heavy` is required for Godot/Unity long-running checks.
- V1 does not automate store publishing.

## Web Worth-Playing Doctrine

Asset-led Web prototypes are not promoted by render success alone. `WORTH_PLAYING` requires role-fit assets, visible GameOS watermark, coherent screenshot composition, readable physics without hidden goal attraction, timing skill, player agency, mastery proof, smooth primary gesture input, smooth mouse/touch blade input, reset/cut/recut input proof, and Advanced Player approval. Partial asset packs may still produce playable prototypes, but `gameos journey` must explain the blocker.

## 10/10 Review Doctrine

`gameos review` is the final local studio gate. It creates a `studio-scorecard` artifact covering agent swarm, design, assets, Web playability, QA evidence, creator UX, game feel, memory/storage, security/privacy, and open-source release readiness. A project may only claim 10/10 when every category scores 10/10 with artifact evidence; otherwise the scorecard names the owning gap.

`npm run acceptance:cutrope` is the repo-level proof that this doctrine works end to end for an asset-led Web game. It creates a fresh rope physics project, imports a generated role-fit asset zip, runs browser QA, runs the 21-agent studio review, verifies all QA gates are promoted, and reruns Web smoke/player checks.

## V1 Boundary

V1 is a local CLI game studio runtime. Web is the default first playable lane, Godot and Unity are optional local adapter lanes, and Steam remains test readiness only.
