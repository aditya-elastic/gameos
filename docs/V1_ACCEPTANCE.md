# V1 Acceptance Checklist

Game OS V1 is shippable when the pure CLI path is reliable.

## Local CLI Experience

- `npm install -g gameos` installs a `gameos` binary.
- `gameos` opens the keyboard-first Cockpit in an interactive terminal and prints help in non-interactive shells.
- `gameos init` opens the create flow for users who expect CLI tools to start with init.
- `gameos cockpit` opens the same guided flow explicitly.
- `gameos examples` prints universal starter prompts for quick copy-paste creation.
- `gameos doctor` reports Node, data root, optional engines, privacy posture, and readiness.
- `gameos make --target web-playable --quality fast` creates a local project from one prompt.
- `gameos make --target web-playable --assets ./assets.zip --quality standard` imports assets, maps gameplay roles, builds Web, runs QA, and prints a verdict.
- `gameos build godot <project-id> --allow-heavy` and `gameos build unity <project-id> --allow-heavy` generate optional local engine lanes only after those platforms are selected.
- `gameos qa godot <project-id> --allow-heavy` and `gameos qa unity <project-id> --allow-heavy` write `engine-qa-report` artifacts with command output, Game OS provenance, and the local-only engine boundary.
- `gameos status <project-id>` shows verdicts, blockers, artifact count, and next command.
- `gameos journey <project-id>` explains the current stage and exact blocker.
- `gameos next <project-id>` prints the next best action, confidence reason, and exact command.
- `gameos export web <project-id>` writes a zipped local Web build with Game OS provenance, QA artifacts, and required watermark metadata.
- `gameos review <project-id>` creates an 11-category `studio-scorecard` with an honest trust tier.
- `gameos diagnose <project-id>` reports verdict, blocker, failed capability, failed evidence, owning agent, and next command; `--strict` fails automation on `NEEDS_IMPROVEMENT`.
- `npm run goal:audit` verifies the repository-level trust proof across agents, skills, UX, security, game direction, gameplay development, QA, and open-source release evidence.
- `gameos feedback <project-id> --note "..."` records creator feedback for regeneration.
- `gameos improve <project-id> --note "..." --yes` records feedback, reruns routed agents, rebuilds Web, reruns QA, and writes a studio review.
- `gameos play <project-id>` starts a local Web play server and prints the playable URL.
- `gameos artifact read` is summary-first and requires `--full` for full output.
- `--json` works for core commands.

## Studio Flow

- Game OS generates OS design review, capability map, acceptance profile, architecture risk report, upgrade doctrine, game bible, agent outputs, asset plan, platform plan, QA gates, roadmap, risk register, playtest script, engine adapter brief, rules spec, memory map, storage manifest, and test matrix.
- The Global OS Designer approves capability-driven direction before adapters turn the project into a playable build.
- Historical showcase games are private regression fixtures; unknown game prompts must map to reusable capabilities instead of falling into an example lane.
- Users can import an asset pack from the CLI or pass `--assets` directly to `gameos make`.
- `gameos assets preview <project-id>` shows selected asset roles, missing roles, and asset-fit diagnosis in friendly language.
- Asset packs produce role assignments and an asset preview manifest; wrong-role assets block promotion.
- Web adapter generation works without a website.
- Web static QA records a `web-playtest-report`.
- Browser Web QA can run when Chrome is available.
- Web games require browser visual QA screenshots, readable play surface, no horizontal overflow, watermark, controls, first-10-seconds, replay, control feel, clarity, difficulty curve, visual maturity, and Advanced Player Council gates for `WORTH_PLAYING`. Asset-led Web games also require no-goal-magnet physics, timing skill, player agency, mastery, smooth primary gesture input, smooth mouse/touch blade input, slow human mouse blade input, input/reset, and asset-fit gates.
- Playable Web HUDs use player-facing labels; raw machine verdict constants stay in manifests, smoke output, and player-agent reports.
- The full agent swarm includes Global OS Designer, Product Truth Officer, Acceptance Architect, Evidence Auditor, Universal Capability Steward, game direction, design, gameplay development, UX flow, visual quality, game feel, physics, Advanced Player Council, QA, memory, storage, security/privacy, release engineering, orchestration, and build-sentinel roles.
- `gameos review` promotes the final trust gate only after the scorecard reaches `CREATOR_TEST_READY`.
- `npm run acceptance:universal-trust` creates five prompt-family fixtures and verifies capability maps, acceptance profiles, Web builds, watermark/provenance, QA artifacts, and honest diagnosis.
- `npm run acceptance:universal-deep` creates ten prompt-family fixtures and verifies capability-specific diagnosis across arcade, rules, physics timing, platform movement, combat/survival, racing, economy, puzzle, narrative, and local multiplayer/pass-and-play.
- `npm run acceptance:web-quality` creates a fresh asset-led Web quality fixture, runs browser QA, runs trust review, and reruns Web smoke/player checks.
- Godot and Unity adapter commands are explicit heavy lanes.
- Godot and Unity adapter manifests include `generatedBy: "Game OS"`, selected capability ids, acceptance-profile requirements, required `Made with GameOS` watermark policy, and no store or platform publishing automation claim.
- Godot and Unity runtime scaffolds include the visible `Made with GameOS` watermark and smoke checks that prove the watermark/provenance policy exists.
- Godot and Unity QA produces local evidence artifacts. These lanes prove adapter and smoke-test readiness only; commercial launch readiness remains outside V1.

## Open Source Readiness

- README explains install, quickstart, commands, data, privacy, and requirements.
- License, changelog, security, conduct, and publishing docs exist.
- `npm run release:audit` verifies package metadata, CLI binary, agent registry, docs, privacy posture, trust language, and tarball contents.
- `npm run goal:audit` verifies the trust architecture and fails if any objective category lacks evidence.
- `npm run trust:audit` blocks exaggerated verdict language and proves diagnosis output.
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
