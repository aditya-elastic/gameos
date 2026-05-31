# Security Policy

## Supported Version

Game OS V1 is local-first and currently supports the `main` branch.

## Reporting Issues

For now, open a private maintainer report or GitHub issue with:

- A short description of the risk.
- Steps to reproduce.
- Whether the issue exposes local files, generated artifacts, API routes, or project data.

## Local Data Model

Game OS stores local project data under `GAME_OS_DATA_DIR` or `./data` by default. Do not commit generated `data/` output.

## Current Boundaries

- No store publishing automation in V1.
- No external AI provider is called by default.
- No secrets are required for the local prototype workflow.
