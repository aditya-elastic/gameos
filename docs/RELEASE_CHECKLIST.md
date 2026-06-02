# Release Checklist

## Before Publishing

- Run `npm ci`.
- Run `npm run check`.
- Run `npm run acceptance:cutrope` on a machine with Chrome for the full asset-led 10/10 game proof.
- Run `npm run release:audit` when debugging publish-boundary failures directly.
- Run `npm run homebrew:audit` to verify published formulae and detect pending formula updates.
- Run `npm run homebrew:update -- 0.1.0 --check` to verify the updater against the currently published stable formula.
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

- Run an asset-led Web smoke with a role-fit asset zip:

```bash
GAME_OS_DATA_DIR="$(mktemp -d)" gameos make --prompt "A rope-cut physics puzzle where the player drops candy into a hungry character and collects stars." --target web-playable --assets ./fixtures/cutrope-assets.zip --quality standard --yes
```

## npm Release

- Preferred: publish from GitHub Actions using npm trusted publishing/provenance.
- The release workflow blocks duplicate versions and proves the packed tarball installs before `npm publish`.
- Manual fallback release command:

```bash
npm publish
```

## Homebrew Release

- Run `npm pack`.
- After npm publish, update and verify the formula from the published npm tarball:

```bash
VERSION="$(node -p "require('./package.json').version")"
npm run homebrew:update -- "$VERSION"
npm run homebrew:update -- "$VERSION" --check
npm run homebrew:audit
```

- Copy `Formula/gameos.rb` into the tap repo at `github.com/aditya-elastic/homebrew-gameos`.
- Test:

```bash
brew tap aditya-elastic/gameos
brew install gameos
brew install aditya-elastic/gameos/gameos@0.2.0
brew test gameos
brew audit --strict gameos
```

## Quality Gates

- `gameos doctor` explains local readiness.
- `gameos make` creates a project, Web build, and QA report.
- `gameos make --assets` imports assets, writes a role preview manifest, and runs worth-playing Web gates.
- `gameos review <project-id>` writes `studio-scorecard.md` and reaches 10/10 before any go-live claim.
- `gameos status` and `gameos journey` show blockers and next command.
- `gameos feedback` stores creator feedback for agent regeneration.
- `gameos artifact read` does not dump large artifacts unless `--full` is passed.
- `npm run release:audit` verifies package metadata, CLI binary, 21-agent registry, required docs, and npm tarball contents.
- `npm run homebrew:audit` verifies formula URL/SHA values against published npm tarballs.
- `npm run homebrew:update` updates `Formula/gameos.rb` from the published npm tarball and computed SHA256.
- No generated local data is included in the npm package.
- V1 has no telemetry, accounts, cloud calls, or hidden network behavior.
