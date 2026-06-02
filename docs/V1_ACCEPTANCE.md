# V1 Acceptance Checklist

Game OS V1 is shippable when the pure CLI path is reliable.

## Local CLI Experience

- `npm install -g gameos` installs a `gameos` binary.
- `gameos doctor` reports Node, data root, optional engines, privacy posture, and readiness.
- `gameos make --target web-playable --quality fast` creates a local project from one prompt.
- `gameos status <project-id>` shows verdicts, blockers, artifact count, and next command.
- `gameos artifact read` is summary-first and requires `--full` for full output.
- `--json` works for core commands.

## Studio Flow

- Game OS generates game bible, agent outputs, asset plan, platform plan, QA gates, roadmap, risk register, playtest script, engine adapter brief, rules spec, memory map, storage manifest, and test matrix.
- Users can import an asset pack from the CLI.
- Web adapter generation works without a website.
- Web static QA records a `web-playtest-report`.
- Browser Web QA can run when Chrome is available.
- Godot and Unity adapter commands are explicit heavy lanes.

## Open Source Readiness

- README explains install, quickstart, commands, data, privacy, and requirements.
- License, changelog, security, conduct, and publishing docs exist.
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
