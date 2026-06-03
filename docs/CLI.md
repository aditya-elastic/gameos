# Game OS CLI

Game OS is a pure local command-line game studio runtime. It does not require a website, plugin, MCP server, account, telemetry, or cloud service.

## 60-Second Quickstart

```bash
npm install -g gameos
gameos
```

In an interactive terminal, `gameos` opens the Game OS Cockpit. The user selects from a short, ranked action list with arrows, Enter, and hotkeys: `n` new game, `p` play, `i` improve, `a` assets, `v` verdict, and `q` quit.

For command mode:

```bash
gameos doctor
gameos make --prompt "A one-button arcade game where players swap lanes, dodge blockers, collect charge shards, build streaks, and chase a high score in quick replayable web sessions." --target web-playable --quality fast --yes
```

The command creates a local project, writes OS design and capability artifacts, generates a Web build, runs fast static QA, and prints the next command.

For an asset-led Web prototype:

```bash
gameos make --prompt "A physics timing puzzle where the player releases a suspended hero object, collects mastery pickups, and guides it into a goal using clean readable motion." --target web-playable --assets ./assets.zip --quality standard --yes
gameos journey <project-id>
```

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
gameos
gameos cockpit
gameos doctor
gameos create --prompt "..." --platform Web
gameos make --prompt "..." --target web-playable --assets ./assets.zip --quality fast|standard|strict
gameos list
gameos status <project-id>
gameos journey <project-id>
gameos review <project-id>
gameos diagnose <project-id>
gameos diagnose <project-id> --strict
gameos feedback <project-id> --note "what got stuck or should improve"
gameos improve <project-id> --note "what should change" --yes
gameos play <project-id>
gameos assets import <project-id> ./assets.zip
gameos build web <project-id>
gameos qa web <project-id>
gameos artifact list <project-id>
gameos artifact read <project-id> game-bible
```

Use `--json` for automation and `--full` when you intentionally want complete artifact content.

## Asset-Led Web QA

When `--assets` is provided, Game OS imports the pack, maps gameplay roles such as hero object, goal character, collectible, background, hazard, and UI, writes an asset preview manifest, builds the Web lane, runs browser QA when available, and records the Advanced Player verdict.

`WORTH_PLAYING` requires:

- visible GameOS watermark
- asset-fit role mapping
- mature visual composition
- readable physics dynamics without hidden goal attraction
- timing skill where early and late actions miss
- player agency where the best timed action wins
- mastery proof such as star collection or bumper/obstacle use
- smooth primary gesture proof for games that depend on timing or pointer motion
- smooth mouse/touch path proof for games that require deliberate motion
- slow human mouse blade proof for deliberate, non-perfect movement
- release/action, reset, no automatic replay, and retry input proof
- Advanced Player approval

## Trust Review

`gameos review <project-id>` writes `studio-scorecard.md` and prints an 11-category score plus an honest readiness tier:

- `LOCAL_PROTOTYPE_READY`
- `CREATOR_TEST_READY`
- `NEEDS_IMPROVEMENT`
- `BLOCKED`

`gameos diagnose <project-id>` explains the current verdict, blocker, failed capability, failed evidence, owning agent, and next best command. Add `--strict` for automation that should exit non-zero on `NEEDS_IMPROVEMENT`.

- Global OS Architecture
- Agent Swarm And Skills
- Game Direction And Design
- Asset Pipeline And Visual Fit
- Playable Web Build
- QA Evidence And Player Agents
- Creator UX Flow
- Game Feel And First Minute
- Memory And Storage
- Security And Privacy
- Open Source Release Readiness

Only `CREATOR_TEST_READY` promotes the final trust gate. `LOCAL_PROTOTYPE_READY` means the Web prototype has useful local evidence but should still be treated as a creator-testing artifact.

For repository trust proof, run:

```bash
npm run goal:audit
npm run acceptance:universal-trust
npm run trust:audit
npm run acceptance:web-quality
```

`acceptance:universal-trust` checks five prompt families and verifies that each project receives a capability map, acceptance profile, Web build, watermark/provenance, QA artifact, and honest diagnosis. `acceptance:web-quality` remains the stronger browser-backed Web quality proof when Chrome is available.

## Engine Requirements

- Web build generation requires Node.js 24+.
- Web browser QA requires Google Chrome or `CHROME_PATH`.
- Godot and Unity are optional heavy lanes and require `--allow-heavy`.

## Privacy

V1 has no telemetry, no accounts, no hidden network calls, and no cloud sync. Generated projects stay on the local machine.
