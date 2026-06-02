# Release Checklist

## Before Publishing

- Run `npm ci`.
- Run `npm run check`.
- Run `npm pack --dry-run` and confirm the package contains only publish-safe files.
- Run `npm pack`.
- Install the tarball globally:

```bash
npm install -g ./gameos-*.tgz
gameos doctor
```

- Run a clean data-dir smoke:

```bash
GAME_OS_DATA_DIR="$(mktemp -d)" gameos make --prompt "A small Ludo game for creator playtesting with dice, tokens, captures, safe squares, and a fast web prototype." --target web-playable --quality fast --yes
```

## npm Release

- Preferred: publish from GitHub Actions using npm trusted publishing/provenance.
- Manual fallback release command:

```bash
npm publish
```

## Homebrew Release

- Run `npm pack`.
- Compute the tarball SHA:

```bash
shasum -a 256 gameos-*.tgz
```

- Copy `Formula/gameos.rb` into the tap repo at `github.com/aditya-elastic/homebrew-gameos`.
- Update the tap formula with the matching version and SHA from the published npm tarball.
- Test:

```bash
brew tap aditya-elastic/gameos
brew install gameos
brew test gameos
brew audit --strict gameos
```

## Quality Gates

- `gameos doctor` explains local readiness.
- `gameos make` creates a project, Web build, and QA report.
- `gameos status` shows blockers and next command.
- `gameos artifact read` does not dump large artifacts unless `--full` is passed.
- No generated local data is included in the npm package.
- V1 has no telemetry, accounts, cloud calls, or hidden network behavior.
