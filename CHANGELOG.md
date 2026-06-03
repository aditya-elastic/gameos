# Changelog

## 0.5.0

- Adds the Game Quality Engine release target for stronger Web creator-test output.
- Captures browser visual QA screenshots for every generated Web build, not only asset-led physics games.
- Adds browser visual QA checks for canvas readability, overflow, watermark visibility, watermark padding, visible controls, and hidden raw machine verdicts.
- Upgrades Advanced Player evidence with first-10-seconds, replay, control-feel, clarity, difficulty-curve, visual-maturity, and Advanced Player Council verdicts.
- Tightens studio review so Web builds need visual browser QA evidence and Advanced Player Council proof before creator-test promotion.
- Adds `gameos export web <project-id>` to create a dependency-free ZIP with the playable Web build, Game OS artifacts, provenance manifest, and required watermark metadata.

## 0.4.1

- Improves `gameos doctor` with active binary path, PATH shadowing detection, data directory, Chrome/Godot/Unity readiness, and clearer npm/Homebrew install guidance.
- Prioritizes browser QA in `gameos next`, `gameos status`, `gameos journey`, and the cockpit after static Web QA passes.
- Adds SQLite busy timeout, WAL mode, and retry handling so rapid local commands are less likely to fail with `database is locked`.
- Adds friendlier Chrome guidance when browser QA cannot run.
- Pads visible GameOS watermarks in generated Web builds so provenance stays visible without hugging the edge.
- Updates quickstart docs around the full first-user loop: examples, make, next, browser QA, review, and play.

## 0.4.0

- Adds first-run polish with `gameos init`, `gameos examples`, starter idea presets, and a friendlier cockpit action set.
- Adds `gameos next <project-id>` so users and AI coding tools can ask for one concise next action, confidence reason, blocker, and exact command.
- Adds `gameos assets preview <project-id>` for friendly asset-role and asset-fit diagnosis.
- Lets `gameos improve <project-id> --yes` prompt for natural feedback when `--note` is omitted in an interactive terminal.
- Expands universal acceptance with `npm run acceptance:universal-deep`, covering ten capability families across arcade, deterministic rules, asset-led physics timing, platform movement, combat/survival, racing, economy, puzzle, narrative choice, and local multiplayer/pass-and-play.
- Updates the capability Web builder and player-agent report to record capability-specific evidence instead of relying on named example lanes.
- Tightens release, goal, and trust audits around first-run UX, friendly blocker labels, starter prompts, asset preview, and deep universal proof.

## 0.3.0

- Replaces public readiness theater with honest trust tiers: `LOCAL_PROTOTYPE_READY`, `CREATOR_TEST_READY`, `NEEDS_IMPROVEMENT`, and `BLOCKED`.
- Adds `acceptance-profile` artifacts so every game is judged against project-specific capabilities, player actions, visual checks, input/reset checks, asset-role checks, and Advanced Player evidence.
- Adds `gameos diagnose <project-id>` for blocker-first diagnosis with failed capability, failed evidence, owning agent, and next best command.
- Adds Product Truth Officer, Acceptance Architect, Advanced Player Council, Evidence Auditor, and Universal Capability Steward roles to strengthen release wording, proof design, player judgment, evidence checks, and reusable capability discipline.
- Adds `npm run acceptance:universal-trust` to test arcade, rules, physics timing, platform movement, and combat/survival prompt families for capability maps, acceptance profiles, Web builds, watermark/provenance, QA artifacts, and honest verdicts.
- Adds `npm run trust:audit` to block exaggerated public language and verify diagnosis output before release.
- Tightens `gameos review` so only `CREATOR_TEST_READY` promotes the final trust quality gate.
- Updates docs toward local prototype and creator-test readiness. Commercial launch readiness remains out of scope until engine export, platform compliance, packaging, and human review exist.

## 0.2.0

- Adds `gameos make --assets` for the one-command asset-led Web creator journey.
- Adds the Game OS Cockpit TUI through `gameos`/`gameos cockpit`, plus `gameos play` and `gameos improve` for no-command game iteration.
- Adds `gameos journey` and `gameos feedback` for blocker diagnosis and creator feedback routing.
- Adds Asset Pipeline Director, Visual Quality Director, and Physics Gameplay Engineer swarm roles.
- Upgrades asset-led physics timing Web generation with role-based asset selection, polished procedural fallback, reset debouncing, canvas/DOM GameOS watermark, and cleaner HUD composition.
- Upgrades asset-led physics timing Web physics to use pendulum swing momentum, gravity, bumper collision, hazards, timing arcs, and trajectory prediction without hidden goal attraction.
- Adds smooth mouse/touch swipe slicing with visible trails and connector-intersection detection for asset-led physics timing games.
- Adds slow human mouse blade buffering and QA so deliberate, non-perfect connector releases are tested before promotion.
- Adds a larger specialist swarm with Gameplay Developer, UX Flow Director, Game Feel Director, Security Privacy Reviewer, and Open Source Release Engineer roles.
- Adds `gameos review <project-id>` and `studio-scorecard` artifacts for evidence-backed local review gates.
- Promotes project QA gates from watch to pass only after every scorecard category is backed by evidence.
- Adds `npm run acceptance:web-quality` as a full asset-led Web proof that creates a fresh game, runs browser QA, runs agent review, and fails unless the trust scorecard passes.
- Adds `npm run goal:audit` as a repository-level local-readiness proof across agents, skills, UX, security/privacy, game direction, gameplay development, QA, and open-source release evidence.
- Adds `npm run release:audit` to verify package metadata, CLI binary, agent registry, docs, privacy posture, and npm tarball contents before go-live.
- Adds `npm run homebrew:audit` to verify formula URL/SHA values against published npm tarballs and report pending formula updates.
- Adds `npm run homebrew:update` to update or check `Formula/gameos.rb` from the published npm tarball without manual SHA editing.
- Keeps generated Web game HUD labels player-facing while preserving machine-readable QA verdicts in manifests and smoke/player-agent reports.
- Hardens CI/release workflows with macOS Homebrew audit, duplicate-version publish guard, package smoke, and post-publish Homebrew SHA instructions.
- Upgrades browser QA and Advanced Player reports with visual, physics, timing skill, player agency, mastery, smooth gesture input, asset-fit, reset/retry, and watermark gates.
- Adds asset preview manifests and stricter wrong-role rejection so UI buttons are not approved as hero physics objects.

## 0.1.0

- Initial pure CLI Game OS release candidate.
- Adds `gameos` command for local project creation, Web builds, asset imports, QA, and artifact inspection.
- Stores local data under `~/.gameos` by default.
