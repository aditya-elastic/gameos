# Release Checklist

## Before Publishing

- Run `npm ci`.
- Run `npm run check`.
- Run `npm run goal:audit` when debugging the trust architecture gate directly.
- Run `npm run acceptance:universal-trust` to verify honest diagnosis across multiple prompt families.
- Run `npm run acceptance:universal-deep` before a version bump to verify ten capability families and next-step diagnosis.
- Run `npm run trust:audit` to block exaggerated public verdict language.
- Run `npm run acceptance:web-quality` on a machine with Chrome for the full asset-led Web quality proof.
- Run `npm run release:audit` when debugging publish-boundary failures directly.
- Run `npm run homebrew:audit` to verify published formulae and detect pending formula updates.
- Run `npm run homebrew:update -- 0.6.0 --check` after npm publication to verify the updater against the currently published stable formula.
- Run `npm pack --dry-run` and confirm the package contains only publish-safe files.
- Run `npm pack`.
- Install the tarball globally:

```bash
npm install -g ./gameos-*.tgz
gameos doctor
```

- Run a clean data-dir smoke:

```bash
GAME_OS_DATA_DIR="$(mktemp -d)" gameos make --prompt "A one-button arcade game where players swap lanes, dodge blockers, collect charge shards, build streaks, and chase a high score in quick replayable web sessions." --target web-playable --quality fast --yes
```

- Run an asset-led Web smoke with a role-fit asset zip:

```bash
GAME_OS_DATA_DIR="$(mktemp -d)" gameos make --prompt "An asset-led physics puzzle where the player releases a swinging object, collects stars, and reaches a goal." --target web-playable --assets ./fixtures/web-quality-assets.zip --quality standard --yes
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
brew test gameos
brew audit --strict gameos
```

## Quality Gates

- `gameos doctor` explains local readiness.
- `gameos make` creates a project, Web build, and QA report.
- `gameos make --assets` imports assets, writes a role preview manifest, and runs worth-playing Web gates.
- `gameos build godot|unity --allow-heavy` consumes capability-map and acceptance-profile evidence when generating optional engine lanes.
- `gameos qa godot|unity --allow-heavy` writes `engine-qa-report` artifacts with command output, provenance, watermark policy, and local-only boundaries.
- `gameos examples`, `gameos next`, `gameos assets preview`, and `gameos export web` make the user journey friendly without requiring command memorization.
- `gameos review <project-id>` writes `studio-scorecard.md` and reaches an evidence-backed trust tier.
- `gameos diagnose <project-id>` explains blocker, failed capability, failed evidence, owning agent, and next command.
- `gameos status` and `gameos journey` show blockers and next command.
- `gameos feedback` stores creator feedback for agent regeneration.
- `gameos artifact read` does not dump large artifacts unless `--full` is passed.
- `npm run goal:audit` verifies the full trust objective across agents, skills, UX, security/privacy, game direction, gameplay development, QA, and open-source release evidence.
- `npm run acceptance:universal-trust` verifies capability maps, acceptance profiles, Web builds, watermark/provenance, QA artifacts, and honest verdicts across five prompt families.
- `npm run acceptance:universal-deep` verifies capability maps, acceptance profiles, Web builds, watermark/provenance, QA artifacts, and honest diagnosis across ten capability families.
- `npm run trust:audit` blocks overclaiming and verifies diagnosis output.
- `npm run release:audit` verifies package metadata, CLI binary, agent registry, required docs, trust language, and npm tarball contents.
- `npm run homebrew:audit` verifies formula URL/SHA values against published npm tarballs.
- `npm run homebrew:update` updates `Formula/gameos.rb` from the published npm tarball and computed SHA256.
- No generated local data is included in the npm package.
- V1 has no telemetry, accounts, cloud calls, or hidden network behavior.
