# Troubleshooting

## `gameos` is not found

Reinstall the package and confirm npm global binaries are on your shell path:

```bash
npm install -g gameos
npm bin -g
```

## Node version is too old

Game OS requires Node.js 24+ because it uses the local `node:sqlite` runtime.

```bash
node --version
```

## Web QA cannot find Chrome

Use static QA for fast local checks:

```bash
gameos qa web <project-id> --static
```

For browser QA, install Google Chrome or set `CHROME_PATH`.

## Asset-led game is not worth-playing

Run the journey view first:

```bash
gameos journey <project-id>
```

Common blockers:

- wrong assets: the pack lacks role-fit hero object, goal character, or collectible files
- visual gate: the generated screenshot is not coherent enough for creator playtesting
- physics gate: the release/drop/collision loop did not complete reliably or used shallow scripted motion
- timing gate: early and late actions did not fail, or the best timed action did not win
- agency gate: the player cannot improve through timing, trajectory, or obstacle use
- gesture gate: the primary pointer/touch motion is not smooth, slow deliberate movement fails, or only the fallback button works
- input gate: release/action, reset, no automatic replay, and retry were not all proven
- browser QA: only static QA ran, so Game OS cannot approve worth-playing quality

Record feedback before regenerating specialist agents:

```bash
gameos feedback <project-id> --note "reset behavior is weak, background needs polish, and asset roles look wrong"
gameos agents rerun <project-id> visual-quality-director
gameos agents rerun <project-id> physics-gameplay-engineer
```

## Godot or Unity commands do not run

Godot and Unity are heavy optional lanes. Install the engine first, then pass `--allow-heavy`:

```bash
gameos build godot <project-id> --allow-heavy
gameos build unity <project-id> --allow-heavy
gameos qa godot <project-id> --allow-heavy
gameos qa unity <project-id> --allow-heavy
```

If QA fails, read the generated `engine-qa-report` artifact. It records the command, stdout/stderr, Game OS provenance, required watermark policy, and whether the lane is blocked by a missing engine, a smoke-test failure, or adapter setup.

## Too much output

Artifact reads are summary-first. Use `--full` only when you intentionally want the complete artifact:

```bash
gameos artifact read <project-id> game-bible --full
```

## Reset local Game OS data

Game OS stores local data under `~/.gameos`. To test cleanly without deleting existing work:

```bash
GAME_OS_DATA_DIR="$(mktemp -d)" gameos make --prompt "A tiny arcade game" --target web-playable --quality fast --yes
```
