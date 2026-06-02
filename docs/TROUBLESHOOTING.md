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

## Godot or Unity commands do not run

Godot and Unity are heavy optional lanes. Install the engine first, then pass `--allow-heavy`:

```bash
gameos build godot <project-id> --allow-heavy
gameos build unity <project-id> --allow-heavy
```

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
