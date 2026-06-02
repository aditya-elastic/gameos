# V1 Acceptance Checklist

Game OS V1 is shippable when the pure CLI path is reliable.

## Local CLI Experience

- `npm install -g gameos` installs a `gameos` binary.
- `gameos doctor` reports Node, data root, optional engines, privacy posture, and readiness.
- `gameos make --target web-playable --quality fast` creates a local project from one prompt.
- `gameos make --target web-playable --assets ./assets.zip --quality standard` imports assets, maps gameplay roles, builds Web, runs QA, and prints a verdict.
- `gameos status <project-id>` shows verdicts, blockers, artifact count, and next command.
- `gameos journey <project-id>` explains the current stage and exact blocker.
- `gameos review <project-id>` creates a 10-category `studio-scorecard` and fails unless every category is 10/10.
- `npm run goal:audit` verifies the repository-level 10/10 local-readiness proof across agents, skills, UX, security, game direction, gameplay development, QA, and open-source release evidence.
- `gameos feedback <project-id> --note "..."` records creator feedback for regeneration.
- `gameos artifact read` is summary-first and requires `--full` for full output.
- `--json` works for core commands.

## Studio Flow

- Game OS generates game bible, agent outputs, asset plan, platform plan, QA gates, roadmap, risk register, playtest script, engine adapter brief, rules spec, memory map, storage manifest, and test matrix.
- Users can import an asset pack from the CLI or pass `--assets` directly to `gameos make`.
- Asset packs produce role assignments and an asset preview manifest; wrong-role assets block promotion.
- Web adapter generation works without a website.
- Web static QA records a `web-playtest-report`.
- Browser Web QA can run when Chrome is available.
- Asset-led Web games require visual, no-goal-magnet physics, timing skill, player agency, mastery, smooth primary gesture input, smooth mouse/touch blade input, slow human mouse blade input, input/reset, asset-fit, watermark, and Advanced Player gates for `WORTH_PLAYING`.
- The 21-agent swarm includes game direction, design, gameplay development, UX flow, visual quality, game feel, physics, advanced player, QA, memory, storage, security/privacy, release engineering, orchestration, and build-sentinel roles.
- `gameos review` promotes QA gates to pass only after all 10 studio scorecard categories are 10/10.
- `npm run acceptance:cutrope` creates a fresh asset-led rope physics game, runs browser QA, runs 21-agent review, verifies `10_OUT_OF_10_READY_FOR_LOCAL_USERS`, and reruns Web smoke/player checks.
- Godot and Unity adapter commands are explicit heavy lanes.

## Open Source Readiness

- README explains install, quickstart, commands, data, privacy, and requirements.
- License, changelog, security, conduct, and publishing docs exist.
- `npm run release:audit` verifies package metadata, CLI binary, 21-agent registry, docs, privacy posture, and tarball contents.
- `npm run goal:audit` verifies the 10/10 local-readiness proof and fails if any objective category lacks evidence.
- `npm run homebrew:audit` verifies formula URL/SHA values against published npm tarballs and reports pending formula updates.
- `npm run homebrew:update` updates or checks `Formula/gameos.rb` against the published npm tarball without manual SHA editing.
- CI runs tests, CLI build, CLI smoke, package dry-run, and audit.
- Generated local data is ignored by git and excluded from npm.

## Verification

```bash
npm run check
npm pack --dry-run
npm pack
npm install -g ./gameos-*.tgz
gameos doctor
```
