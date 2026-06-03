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
gameos make --prompt "A small Ludo game for creator playtesting with dice, tokens, captures, and a fast web prototype." --target web-playable --quality fast --yes
```

The command creates a local project, writes Game OS artifacts, generates a Web build, runs fast static QA, and prints the next command.

For an asset-led Web prototype:

```bash
gameos make --prompt "A rope-cut physics puzzle where the player drops candy into a hungry character and collects stars." --target web-playable --assets ./assets.zip --quality standard --yes
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
- smooth swipe/touch slicing proof for cut-style games
- smooth mouse/touch blade proof for moving naturally through the rope
- slow human mouse blade proof for deliberate, non-perfect movement
- cut, reset, no auto-cut, and recut input proof
- Advanced Player approval

## Studio Review

`gameos review <project-id>` writes `studio-scorecard.md` and prints a 10-category score. It only exits successfully when every category is 10/10:

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

When review passes, Game OS promotes the project QA gates to pass. When review fails, rerun the owning agent named by the scorecard gap.

For the full asset-led proof on a local machine with Chrome, run:

```bash
npm run goal:audit
npm run acceptance:cutrope
```

`goal:audit` verifies the repository-level 10/10 local-readiness evidence across agents, skills, UX flow, security/privacy, game direction, gameplay development, QA, and open-source release gates.

That command creates a fresh rope physics project from a prompt and asset zip, runs browser QA, runs `gameos review`, and fails unless the scorecard reaches `10_OUT_OF_10_READY_FOR_LOCAL_USERS`.

## Engine Requirements

- Web build generation requires Node.js 24+.
- Web browser QA requires Google Chrome or `CHROME_PATH`.
- Godot and Unity are optional heavy lanes and require `--allow-heavy`.

## Privacy

V1 has no telemetry, no accounts, no hidden network calls, and no cloud sync. Generated projects stay on the local machine.
