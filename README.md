# Game OS CLI

Game OS is a pure local command-line AI game studio runtime. It turns one strong game idea into a project with a game bible, agent swarm outputs, asset pipeline, platform plan, QA gates, playable Web/Godot/Unity scaffolds, local artifacts, and playtest reports.

V1 is CLI-first. It does not require a website, plugin, MCP server, account, telemetry, or cloud service.

## Install

```bash
npm install -g gameos
```

Homebrew release target:

```bash
brew tap aditya-elastic/gameos
brew install gameos
```

## 60-Second Quickstart

```bash
gameos doctor
gameos make --prompt "A small Ludo game for creator playtesting with dice, tokens, captures, safe squares, and a fast web prototype." --target web-playable --quality fast --yes
```

Then inspect:

```bash
gameos list
gameos status <project-id>
gameos artifact list <project-id>
gameos artifact read <project-id> game-bible
```

## Commands

```bash
gameos doctor
gameos create --prompt "..." --platform Web
gameos make --prompt "..." --target web-playable --quality fast|standard|strict
gameos list
gameos status <project-id>
gameos agents run <project-id>
gameos agents rerun <project-id> <role>
gameos assets import <project-id> ./assets.zip
gameos build web <project-id>
gameos build godot <project-id> --allow-heavy
gameos build unity <project-id> --allow-heavy
gameos qa web <project-id>
gameos qa web <project-id> --static
gameos artifact list <project-id>
gameos artifact read <project-id> <artifact-name>
gameos artifact read <project-id> <artifact-name> --full
```

Use `--json` for automation and AI coding agents. Artifact reads are summary-first unless `--full` is passed.

## Data And Privacy

Game OS stores local data under:

```text
~/.gameos
```

Override it with:

```bash
GAME_OS_DATA_DIR=./gameos-data gameos list
gameos list --data-dir ./gameos-data
```

V1 has no telemetry, no accounts, no hidden network calls, and no cloud sync.

## Requirements

- Node.js 24+
- npm 11+
- Google Chrome for browser Web QA, or use `gameos qa web --static`
- Godot 4.6+ for optional Godot heavy lane checks
- Unity 6000.4+ for optional Unity heavy lane checks

## Development

```bash
npm install
npm test
npm run build:cli
npm run test:cli
```

Publish checks:

```bash
npm run check
npm pack --dry-run
```

## Docs

- [CLI guide](docs/CLI.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [Publishing guide](docs/PUBLISHING.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Release checklist](docs/RELEASE_CHECKLIST.md)
- [Security](SECURITY.md)
