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
brew install aditya-elastic/gameos/gameos@0.4.1
```

## 60-Second Quickstart

```bash
gameos
```

In an interactive terminal, `gameos` opens the Game OS Cockpit: a keyboard-first studio flow with at most five actions on screen. Use arrows, Enter, and hotkeys like `n` for new game, `p` to play, `i` to improve, `a` to add assets, `v` for verdict, and `q` to quit.

Command mode is still available for AI coding agents, scripts, and advanced users:

```bash
gameos doctor
gameos examples
gameos make --prompt "A one-button arcade game where players swap lanes, dodge blockers, collect charge shards, build streaks, and chase a high score in quick replayable web sessions." --target web-playable --quality fast --yes
```

After `make`, let Game OS tell you the smallest next step:

```bash
gameos next <project-id>
gameos qa web <project-id>
gameos review <project-id>
gameos play <project-id>
gameos export web <project-id>
```

If browser QA cannot run, install Google Chrome or set `CHROME_PATH`. `gameos doctor` shows the active binary, data directory, Chrome readiness, and whether npm/Homebrew installs may be shadowing each other on PATH.

Asset-led Web prototype:

```bash
gameos make --prompt "A physics timing puzzle where the player releases a suspended hero object, collects mastery pickups, and guides it into a goal using clean readable motion." --target web-playable --assets ./assets.zip --quality standard --yes
```

Then play, improve, or inspect:

```bash
gameos play <project-id>
gameos export web <project-id>
gameos next <project-id>
gameos improve <project-id> --yes
gameos list
gameos status <project-id>
gameos journey <project-id>
gameos review <project-id>
gameos diagnose <project-id>
gameos diagnose <project-id> --strict
gameos feedback <project-id> --note "reset behavior is weak, background needs polish, asset roles look wrong"
gameos assets preview <project-id>
gameos artifact list <project-id>
gameos artifact read <project-id> game-bible
```

## Commands

```bash
gameos
gameos init
gameos cockpit
gameos examples
gameos doctor
gameos create --prompt "..." --platform Web
gameos make --prompt "..." --target web-playable --assets ./assets.zip --quality fast|standard|strict
gameos list
gameos status <project-id>
gameos journey <project-id>
gameos next <project-id>
gameos review <project-id>
gameos diagnose <project-id>
gameos feedback <project-id> --note "what got stuck or should improve"
gameos improve <project-id> [--note "what should change"] --yes
gameos play <project-id>
gameos agents run <project-id>
gameos agents rerun <project-id> <role>
gameos assets import <project-id> ./assets.zip
gameos assets preview <project-id>
gameos build web <project-id>
gameos build godot <project-id> --allow-heavy
gameos build unity <project-id> --allow-heavy
gameos qa web <project-id>
gameos qa web <project-id> --static
gameos export web <project-id>
gameos export web <project-id> --output ./my-game.zip
gameos artifact list <project-id>
gameos artifact read <project-id> <artifact-name>
gameos artifact read <project-id> <artifact-name> --full
```

Use `--json` for automation and AI coding agents. Artifact reads are summary-first unless `--full` is passed.

## Universal Coverage Proof

Game OS is designed around reusable capabilities, not a handful of named demo games. The release gates prove that prompts are mapped into systems such as arcade loops, deterministic rules, physics timing, platform movement, combat/survival, racing, economy management, puzzle logic, narrative choice, local multiplayer/pass-and-play, input, HUD, camera, assets, storage, and QA.

`npm run acceptance:universal-trust` is the fast CI proof across five prompt families. `npm run acceptance:universal-deep` is the pre-publish breadth proof across ten prompt families. Each generated project must produce a capability map, acceptance profile, Web build, GameOS watermark/provenance, QA artifact, and capability-specific diagnosis. Passing these gates means Game OS can build and honestly judge many kinds of local Web prototypes; it does not claim every first attempt is commercially finished.

## Web Worth-Playing Gates

Every project starts with a Global OS Designer review and a capability map. This designer owns ultra-global business expansion, category-defining product vision, ecosystem strategy, public package direction, universal product language, and release-blocking architecture governance before specialist agents narrow the work. Historical showcase games remain private regression fixtures; the public CLI should generate unfamiliar game ideas from reusable systems such as rules, physics, arcade loops, platforming, combat, economy, multiplayer, narrative, accessibility, localization readiness, camera, input, HUD, assets, storage, and QA.

For Web games, Game OS blocks promotion unless the generated prototype passes browser visual QA, visible GameOS watermark, readable play surface, no horizontal overflow, compact player-facing controls, and Advanced Player Council evidence for first-10-seconds, replay, control feel, clarity, difficulty curve, and visual maturity. Asset-led Web games also require role-fit assets, real physics dynamics, timing skill, player agency, mastery, smooth primary gesture input, deliberate pointer/touch input, and reset/retry input. `gameos journey <project-id>` explains the exact blocker when a project is not ready.

## Trust Review

Run `gameos review <project-id>` after build and QA. It writes a `studio-scorecard` artifact and assigns an honest readiness tier:

- `LOCAL_PROTOTYPE_READY`
- `CREATOR_TEST_READY`
- `NEEDS_IMPROVEMENT`
- `BLOCKED`

Game OS only claims local prototype or creator-test readiness in V1. `CREATOR_TEST_READY` means a local Web build has enough evidence for creator playtesting; it is not a commercial, store, or platform publish claim. Commercial launch claims require later engine export, platform compliance, packaging, and human review.

The scorecard covers:

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

Run `gameos diagnose <project-id>` for the exact blocker, failed capability, failed evidence, owning agent, and next best command. Use `--strict` in automation when `NEEDS_IMPROVEMENT` should fail the command.

Use `gameos export web <project-id>` after browser QA/review to create a zipped local Web build with Game OS provenance, artifacts, QA evidence, and the required visible watermark.

Run `npm run goal:audit`, `npm run acceptance:universal-trust`, `npm run acceptance:universal-deep`, and `npm run trust:audit` for the repository-level trust gates across agents, skills, UX flow, security/privacy, game direction, gameplay development, QA, universal prompt families, and open-source release evidence.

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
npm run acceptance:universal-trust
npm run acceptance:universal-deep
npm run trust:audit
npm run acceptance:web-quality
npm run release:audit
npm run homebrew:audit
npm run homebrew:update -- 0.4.1 --check
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
