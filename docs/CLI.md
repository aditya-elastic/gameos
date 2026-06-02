# Game OS CLI

Game OS is a pure local command-line game studio runtime. It does not require a website, plugin, MCP server, account, telemetry, or cloud service.

## 60-Second Quickstart

```bash
npm install -g gameos
gameos doctor
gameos make --prompt "A small Ludo game for creator playtesting with dice, tokens, captures, and a fast web prototype." --target web-playable --quality fast --yes
```

The command creates a local project, writes Game OS artifacts, generates a Web build, runs fast static QA, and prints the next command.

## Storage

Game OS stores local data at:

```text
~/.gameos
```

Override it with:

```bash
gameos list --data-dir ./my-gameos-data
GAME_OS_DATA_DIR=./my-gameos-data gameos list
```

## Core Commands

```bash
gameos doctor
gameos create --prompt "..." --platform Web
gameos make --prompt "..." --target web-playable --quality fast
gameos list
gameos status <project-id>
gameos assets import <project-id> ./assets.zip
gameos build web <project-id>
gameos qa web <project-id>
gameos artifact list <project-id>
gameos artifact read <project-id> game-bible
```

Use `--json` for automation and `--full` when you intentionally want complete artifact content.

## Engine Requirements

- Web build generation requires Node.js 24+.
- Web browser QA requires Google Chrome or `CHROME_PATH`.
- Godot and Unity are optional heavy lanes and require `--allow-heavy`.

## Privacy

V1 has no telemetry, no accounts, no hidden network calls, and no cloud sync. Generated projects stay on the local machine.
