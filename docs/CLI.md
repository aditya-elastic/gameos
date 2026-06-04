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
gameos examples
gameos make --prompt "A one-button arcade game where players swap lanes, dodge blockers, collect charge shards, build streaks, and chase a high score in quick replayable web sessions." --target web-playable --quality fast --yes
```

The command creates a local project, writes OS design and capability artifacts, generates a Web build, runs fast static QA, and prints the next command. The normal first-user loop is:

```bash
gameos examples
gameos make --prompt "..." --target web-playable --quality fast --yes
gameos next <project-id>
gameos qa web <project-id>
gameos review <project-id>
gameos play <project-id>
gameos export web <project-id>
```

If browser QA cannot run, install Google Chrome or set `CHROME_PATH`. `gameos doctor` shows the active binary, data directory, Chrome readiness, and whether npm/Homebrew installs may be shadowing each other on PATH.

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
gameos diagnose <project-id> --strict
gameos feedback <project-id> --note "what got stuck or should improve"
gameos improve <project-id> [--note "what should change"] --yes
gameos play <project-id>
gameos assets import <project-id> ./assets.zip
gameos assets preview <project-id>
gameos build web <project-id>
gameos build godot <project-id> --allow-heavy
gameos build unity <project-id> --allow-heavy
gameos qa web <project-id>
gameos qa godot <project-id> --allow-heavy
gameos qa unity <project-id> --allow-heavy
gameos export web <project-id>
gameos artifact list <project-id>
gameos artifact read <project-id> game-bible
```

Use `--json` for automation and `--full` when you intentionally want complete artifact content.

## Universal Coverage Proof

Game OS uses a capability graph instead of named game lanes. The Web builder and QA reports should explain the selected systems for each prompt: arcade, deterministic rules, asset-led physics timing, platform movement, combat/survival, racing, economy, puzzle, narrative choice, local multiplayer/pass-and-play, plus supporting input, HUD, camera, assets, storage, and QA.

`npm run acceptance:universal-trust` is the fast proof. `npm run acceptance:universal-deep` is the pre-publish breadth proof across ten families. The acceptance target is honest generation and diagnosis: capability map, acceptance profile, Web build, watermark/provenance, QA artifact, and next action. It is not a claim that every first local Web build is commercially finished.

## Asset-Led Web QA

When `--assets` is provided, Game OS imports the pack, maps gameplay roles such as hero object, goal character, collectible, background, hazard, and UI, writes an asset preview manifest, builds the Web lane, runs browser QA when available, and records the Advanced Player verdict.

`WORTH_PLAYING` requires:

- visible GameOS watermark
- browser visual QA screenshot
- readable play surface
- no horizontal overflow
- visible player-facing controls
- first-10-seconds approval
- replay-loop approval
- control-feel approval
- clarity approval
- difficulty-curve approval
- visual-maturity approval
- Advanced Player Council approval
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

`gameos next <project-id>` prints only the next best action, why it matters, and the exact command. It is the smallest output for Cursor, Codex CLI, Claude CLI, shell scripts, or a creator who just wants to know what to do next.

`gameos export web <project-id>` writes a dependency-free ZIP containing the playable Web build, Game OS artifacts, provenance manifest, QA report, and required watermark metadata. Use `--output ./name.zip` to choose the file path.

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

Only `CREATOR_TEST_READY` promotes the final trust gate. It means the local Web prototype has enough evidence for creator playtesting, not commercial or platform publishing. `LOCAL_PROTOTYPE_READY` means the Web prototype has useful local evidence but should still be treated as a creator-testing artifact.

For repository trust proof, run:

```bash
npm run goal:audit
npm run acceptance:universal-trust
npm run acceptance:universal-deep
npm run trust:audit
npm run acceptance:web-quality
```

`acceptance:universal-trust` checks five prompt families and verifies that each project receives a capability map, acceptance profile, Web build, watermark/provenance, QA artifact, and honest diagnosis. `acceptance:universal-deep` expands that proof to ten capability families: arcade, deterministic rules, asset-led physics timing, platform movement, combat/survival, racing, economy, puzzle, narrative choice, and local multiplayer/pass-and-play. `acceptance:web-quality` remains the stronger browser-backed Web quality proof when Chrome is available.

## Engine Requirements

- Web build generation requires Node.js 24+.
- Web browser QA requires Google Chrome or `CHROME_PATH`.
- Godot and Unity are optional heavy lanes and require `--allow-heavy`.
- Godot and Unity generated adapters consume the project capability map and acceptance profile, include `Made with GameOS` runtime watermark/provenance, and write `engine-qa-report` artifacts when their QA commands run.
- Engine lane QA proves local scaffolding and smoke-test readiness only. It does not claim commercial launch readiness, platform compliance, store submission, packaging completeness, or direct publishing automation.

## Privacy

V1 has no telemetry, no accounts, no hidden network calls, and no cloud sync. Generated projects stay on the local machine.
