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
brew install aditya-elastic/gameos/gameos@0.2.0
```

## 60-Second Quickstart

```bash
gameos doctor
gameos make --prompt "A small Ludo game for creator playtesting with dice, tokens, captures, safe squares, and a fast web prototype." --target web-playable --quality fast --yes
```

Asset-led Web prototype:

```bash
gameos make --prompt "A rope-cut physics puzzle where the player drops candy into a hungry character and collects stars." --target web-playable --assets ./assets.zip --quality standard --yes
```

Then inspect:

```bash
gameos list
gameos status <project-id>
gameos journey <project-id>
gameos review <project-id>
gameos feedback <project-id> --note "reset auto-cuts, background is weak, asset roles look wrong"
gameos artifact list <project-id>
gameos artifact read <project-id> game-bible
```

## Commands

```bash
gameos doctor
gameos create --prompt "..." --platform Web
gameos make --prompt "..." --target web-playable --assets ./assets.zip --quality fast|standard|strict
gameos list
gameos status <project-id>
gameos journey <project-id>
gameos review <project-id>
gameos feedback <project-id> --note "what got stuck or should improve"
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

## Web Worth-Playing Gates

For asset-led Web games, Game OS blocks promotion unless the generated prototype passes role-fit assets, visible GameOS watermark, visual composition, real physics dynamics, timing skill, player agency, mastery, smooth primary gesture input, smooth mouse/touch blade input, slow human mouse blade input, cut/reset/recut input, and Advanced Player QA. `gameos journey <project-id>` explains the exact blocker when a project is not ready.

## 10/10 Studio Review

Run `gameos review <project-id>` after build and QA. It writes a `studio-scorecard` artifact and exits non-zero unless every category reaches 10/10 with evidence:

- agent swarm and skills
- game direction and design
- asset pipeline and visual fit
- playable Web build
- QA evidence and player agents
- creator UX flow
- game feel and first minute
- memory and storage
- security and privacy
- open-source release readiness

Run `npm run goal:audit` for the repository-level 10/10 local-readiness gate across agents, skills, UX flow, security/privacy, game direction, gameplay development, QA, and open-source release evidence.

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
npm run goal:audit
npm run acceptance:cutrope
npm run release:audit
npm run homebrew:audit
npm run homebrew:update -- 0.1.0 --check
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
