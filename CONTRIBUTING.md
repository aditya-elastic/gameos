# Contributing

Game OS is a local-first studio operating system for AI-assisted game creation. Contributions should keep the product smooth for creators and safe for local development.

## Local Setup

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Before A PR

```bash
npm run check
```

The check command runs unit/integration tests, a production build, and npm audit at moderate severity.

## Product Rules

- Keep the first screen usable. Do not replace the command center with a marketing page.
- Normal user actions must show inline errors, not raw framework stacks.
- Generated artifacts should be file-backed and readable outside the UI.
- Engine adapters must stay downstream of approved Game OS artifacts.
- Steam remains a test-readiness lane until a future publishing workflow is explicitly designed.

## Agent Changes

Agent definitions live in `studio-agents/agents.json`. Keep each agent role focused, with clear mission and skill boundaries.
