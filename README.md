# Game OS

Game OS is a local web operating system for AI-assisted game creation. It turns one strong game idea into a studio room with a design bible, agent swarm outputs, asset pipeline, platform readiness map, QA gates, production roadmap, risk register, playtest script, engine adapter brief, and file-backed artifacts.

V1 is engine-neutral: Unity and Godot are future adapter lanes, and Steam is treated as test readiness only.

## Requirements

- Node.js 24+
- npm 11+

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Use **Run Demo Flow** to generate the built-in creator-challenge test project.

After changing framework config or dependencies during development, use:

```bash
npm run dev:fresh
```

## Verify

```bash
npm run check
```

This runs tests, a production build, and npm audit.

## Local Data

Game OS stores SQLite data and generated artifacts under `data/` by default:

- `data/game-os.sqlite`
- `data/projects/<project-id>/`

For tests or alternate local instances, set `GAME_OS_DATA_DIR`.

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## V1 Acceptance

See [docs/V1_ACCEPTANCE.md](docs/V1_ACCEPTANCE.md).
