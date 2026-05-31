# Release Checklist

## Before Tagging V1

- Run `npm run check`.
- Start `npm run dev` and verify `http://localhost:3000`.
- If the dev server was already running through dependency or config edits, restart with `npm run dev:fresh`.
- Dev and build outputs are separated; `npm run check` can run while the local dev server is up.
- Run `npm run smoke` while the dev server is running.
- Run `npm run visual:smoke` on macOS with Chrome installed.
- Create a demo project from the UI.
- Open at least one artifact preview.
- Regenerate one agent and confirm the run number increments.
- Confirm generated files exist in `data/projects/<project-id>/`.
- Confirm invalid API payloads return JSON errors instead of stack traces.

## Manual UX Sweep

- Desktop viewport: dashboard, intake, room, artifacts, and preview are readable.
- Mobile viewport: controls stack without overlap.
- Buttons have loading states.
- Error and success messages are visible.
- No publishing automation is presented as available.
