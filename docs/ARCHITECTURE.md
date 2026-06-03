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
3. Game OS creates the game brief, capability map, acceptance profile, OS design review, architecture risk report, upgrade doctrine, and agent swarm outputs.
4. Artifacts are written as local Markdown/JSON files.
5. `gameos make --assets` can import user assets, classify gameplay roles, and write an asset preview manifest before Web generation.
6. `gameos build web` creates the first playable lane.
7. `gameos qa web` records static or browser player-agent evidence.
8. `gameos journey` reports stage-by-stage blockers.
9. `gameos review` creates the studio trust scorecard and promotes the final trust gate only when creator-test evidence passes.
10. `gameos diagnose` names the current verdict, blocker, failed capability, failed evidence, owning agent, and next best command.
11. `gameos feedback` records creator feedback for agent regeneration.
12. Godot and Unity lanes require `--allow-heavy`.

## Agent Roles

- Global OS Designer
- Product Truth Officer
- Acceptance Architect
- Advanced Player Council
- Evidence Auditor
- Universal Capability Steward
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

Asset-led Web prototypes are not promoted by render success alone. `WORTH_PLAYING` requires role-fit assets, visible GameOS watermark, coherent screenshot composition, readable physics without hidden goal attraction, timing skill, player agency, mastery proof, smooth primary gesture input, deliberate pointer/touch input, reset/retry input proof, and Advanced Player approval. Partial asset packs may still produce playable prototypes, but `gameos journey` must explain the blocker.

## Global OS Design Doctrine

The Global OS Designer sits above project-specific agents. This role owns Game OS vision and direction as an ultra-global AI game studio runtime, not just a local demo generator. It evaluates category-defining product strategy, global business expansion, ecosystem positioning, public package language, creator trust, local privacy, release readiness, and architecture scalability before project-specific agents narrow the work.

Every project receives a capability map before adapter generation. Historical showcase games are private regression fixtures only; they are not permanent product lanes or public product language. New game requests must map to reusable systems such as rules, physics, arcade loops, platforming, combat, economy, multiplayer, narrative, creator loops, monetization readiness, accessibility, localization readiness, camera, input, HUD, assets, storage, and QA.

## Trust Review Doctrine

`gameos review` is the final local trust gate for V1. It creates a `studio-scorecard` artifact covering Global OS architecture, agent swarm, design, assets, Web playability, QA evidence, creator UX, game feel, memory/storage, security/privacy, and open-source release readiness. A project may only claim `LOCAL_PROTOTYPE_READY` or `CREATOR_TEST_READY` when the acceptance profile, runnable Web evidence, QA reports, watermark/provenance, and scorecard agree. Otherwise it returns `NEEDS_IMPROVEMENT` or `BLOCKED`.

`gameos diagnose` is the plain-language trust debugger. It reports the exact blocker, failed capability, failed evidence, owning agent, and next best command without dumping large artifacts.

`npm run acceptance:universal-trust` proves the fast doctrine across arcade, deterministic rules, asset-led physics timing, platform movement, and combat/survival prompt families. `npm run acceptance:universal-deep` expands the pre-release proof to arcade, deterministic rules, asset-led physics timing, platform movement, combat/survival, racing, economy, puzzle, narrative choice, and local multiplayer/pass-and-play. `npm run acceptance:web-quality` remains the browser-backed Web quality proof for a role-fit asset-led game.

## V1 Boundary

V1 is a local CLI game studio runtime. Web is the default first playable lane, Godot and Unity are optional local adapter lanes, and Steam remains test readiness only.
