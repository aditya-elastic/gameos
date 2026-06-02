# 10/10 Goal Audit

`npm run goal:audit` is the repository-level proof that Game OS is aligned with the full studio objective before release claims.

It is local and deterministic. It does not publish to npm, contact stores, or run engine-heavy lanes. It verifies that the open-source system contains the agents, skills, QA gates, docs, release scripts, and game-proof machinery needed to support a 10/10 local game creation claim.

## Command

```bash
npm run goal:audit
```

`npm run check` also runs this audit before release audit, Next build, npm audit, and package dry-run.

## Categories

- Agent Swarm And Skills
- Game Direction Design And Developer
- Creator UX Flow
- Asset Pipeline And Visual Quality
- Web Game Playability
- QA Player Agent Evidence
- Security Privacy And Storage
- Open Source Release Readiness
- Documentation And Contributor Trust
- Goal Completion Discipline

## What It Proves

- The 21-agent swarm is present and each agent has usable skills.
- Studio Director, Game Designer, Gameplay Developer, UX Flow Director, Game Feel Director, Physics Gameplay Engineer, Advanced Player, QA Director, Memory Manager, Storage Manager, Security Privacy Reviewer, Build Sentinel, and Open Source Release Engineer are wired into the system.
- The Cut Rope Web lane includes asset role mapping, no-goal-magnet physics, timing skill, agency, mastery, smooth and slow mouse blade input, reset/recut proof, watermarking, and Advanced Player gates.
- Playable Web HUDs stay player-facing instead of leaking raw machine verdict constants; manifests and QA reports keep the exact machine-readable fields.
- The open-source package includes release, security, privacy, Homebrew, CI, publishing, and contributor trust evidence.
- The acceptance path can prove a fresh asset-led Web game reaches `WORTH_PLAYING_FOR_CUT_ROPE_WEB_PROTOTYPE` and `10_OUT_OF_10_READY_FOR_LOCAL_USERS`.

## What It Does Not Prove

- It does not publish `gameos` to npm.
- It does not update Homebrew to an unpublished npm tarball.
- It does not replace `npm run acceptance:cutrope`; the acceptance test is still the browser-backed end-to-end game proof.
- It does not run Unity or Godot heavy lanes unless those are explicitly invoked with their own commands.

## Release Use

Run this before public release claims:

```bash
npm run goal:audit
npm run check
npm run acceptance:cutrope
```

The npm/Homebrew go-live step still requires npm authentication. If npm returns `EOTP`, complete one-time password or trusted-publishing setup before running:

```bash
npm publish --otp <code>
npm run homebrew:update -- 0.2.0
```
