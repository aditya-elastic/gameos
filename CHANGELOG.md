# Changelog

## 0.2.0

- Adds `gameos make --assets` for the one-command asset-led Web creator journey.
- Adds the Game OS Cockpit TUI through `gameos`/`gameos cockpit`, plus `gameos play` and `gameos improve` for no-command game iteration.
- Adds `gameos journey` and `gameos feedback` for blocker diagnosis and creator feedback routing.
- Adds Asset Pipeline Director, Visual Quality Director, and Physics Gameplay Engineer swarm roles.
- Upgrades Cut Rope style Web generation with role-based asset selection, polished procedural fallback, reset debouncing, canvas/DOM GameOS watermark, and cleaner HUD composition.
- Upgrades Cut Rope style Web physics to use pendulum swing momentum, gravity, bumper collision, hazards, timing arcs, and trajectory prediction without hidden goal attraction.
- Adds smooth mouse/touch swipe slicing with visible trails and rope-intersection detection for Cut Rope style games.
- Adds slow human mouse blade buffering and QA so deliberate, non-perfect rope cuts are tested before promotion.
- Adds a 21-agent swarm with Gameplay Developer, UX Flow Director, Game Feel Director, Security Privacy Reviewer, and Open Source Release Engineer roles.
- Adds `gameos review <project-id>` and `studio-scorecard` artifacts for 10-category 10/10 evidence gates.
- Promotes project QA gates from watch to pass only after the studio scorecard reaches 10/10 across every category.
- Adds `npm run acceptance:cutrope` as a full asset-led Web proof that creates a fresh game, runs browser QA, runs 21-agent review, and fails unless the scorecard is 10/10.
- Adds `npm run goal:audit` as a repository-level 10/10 local-readiness proof across agents, skills, UX, security/privacy, game direction, gameplay development, QA, and open-source release evidence.
- Adds `npm run release:audit` to verify package metadata, CLI binary, agent registry, docs, privacy posture, and npm tarball contents before go-live.
- Adds `npm run homebrew:audit` to verify formula URL/SHA values against published npm tarballs and report pending formula updates.
- Adds `npm run homebrew:update` to update or check `Formula/gameos.rb` from the published npm tarball without manual SHA editing.
- Keeps generated Web game HUD labels player-facing while preserving machine-readable QA verdicts in manifests and smoke/player-agent reports.
- Hardens CI/release workflows with macOS Homebrew audit, duplicate-version publish guard, package smoke, and post-publish Homebrew SHA instructions.
- Upgrades browser QA and Advanced Player reports with visual, physics, timing skill, player agency, mastery, smooth slice gesture, input, asset-fit, reset/recut, and watermark gates.
- Adds asset preview manifests and stricter wrong-role rejection so UI buttons are not approved as hero physics objects.

## 0.1.0

- Initial pure CLI Game OS release candidate.
- Adds `gameos` command for local project creation, Web builds, asset imports, QA, and artifact inspection.
- Stores local data under `~/.gameos` by default.
