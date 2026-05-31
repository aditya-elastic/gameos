# Game OS Architecture

## Product Shape

Game OS is a local web operating system for game creation. The creator enters a game idea, chooses platform lanes, and receives a complete studio room with agents, artifacts, QA gates, and platform readiness.

## Runtime

- Next.js app router powers the local web UI.
- Server routes own persistence and generation.
- The client command center owns smooth form state, loading states, inline errors, artifact preview, and demo flow.
- Development uses `.next-dev` while production builds use `.next`, so release checks do not corrupt a running local dev server.
- SQLite stores project records under `GAME_OS_DATA_DIR` or `./data`.
- Markdown artifacts are written under `data/projects/<project-id>/`.

## Data Flow

1. Creator submits a prompt and platform lanes.
2. Intake normalizes genre, audience, title, and engine preference.
3. Game OS creates the game brief.
4. The agent registry spawns eight studio specialists.
5. Asset, platform, QA, roadmap, risk, playtest, and adapter artifacts are generated.
6. The studio room displays the current state and can regenerate individual agents.

## Agent Roles

- Studio Director
- Game Designer
- Technical Architect
- Art Director
- Advanced Player
- QA Director
- Platform Producer
- Build Sentinel

Agent definitions are editable in `studio-agents/agents.json`.

## V1 Boundary

V1 is engine-neutral. Unity and Godot are adapter lanes, not assumptions. Steam is a test-readiness target, not publishing automation.
