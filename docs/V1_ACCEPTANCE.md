# V1 Acceptance Checklist

Game OS V1 is shippable when the following are true.

## Local Experience

- `npm install` succeeds on Node 24+.
- `npm run dev` starts the app at `http://localhost:3000`.
- Normal creator mistakes show inline UI errors or JSON API errors.
- The home page does not expose raw framework errors during standard flows.

## Studio Flow

- A creator can create a studio room from one prompt.
- Game OS generates the game bible, agent outputs, asset plan, platform plan, QA gates, roadmap, risk register, playtest script, and engine adapter brief.
- A creator can regenerate one agent without losing the rest of the project.
- A creator can preview generated artifacts in the UI.
- The demo flow creates a small creator-challenge game and leaves file-backed artifacts.

## Open Source Readiness

- README explains setup, tests, data, and V1 scope.
- License, contributing, security, and conduct docs exist.
- CI runs install, tests, build, and audit.
- Generated local data is ignored by git.

## Verification

Run:

```bash
npm run check
```

Then run the demo flow from the UI or post the demo payload to `/api/projects`.

With the dev server running, use:

```bash
npm run smoke
```

On macOS with Google Chrome installed, also use:

```bash
npm run visual:smoke
```
