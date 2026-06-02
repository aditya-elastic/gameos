# Security And Privacy

Game OS V1 is a local-first CLI runtime.

- No telemetry is collected.
- No account is required.
- No hidden network calls are made by Game OS commands.
- Generated projects and artifacts stay under `~/.gameos` by default.
- `GAME_OS_DATA_DIR` or `--data-dir` can redirect all local project data.
- Optional browser, Godot, and Unity checks run only when the user invokes them.

Report security issues privately to the maintainer before public disclosure. Do not include secrets, private assets, or unpublished game data in issue reports.
