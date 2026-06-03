# Goal Trust Audit

`npm run goal:audit` is the repository-level proof that Game OS is aligned with the full studio objective before release claims.

It is local and deterministic. It does not publish to npm, contact stores, or run engine-heavy lanes. It verifies that the open-source system contains the agents, skills, QA gates, docs, release scripts, and game-proof machinery needed to support honest local prototype and creator-test readiness claims.

## Command

```bash
npm run goal:audit
```

`npm run check` also runs this audit before release audit, Next build, npm audit, and package dry-run.

## Categories

- Agent Swarm And Skills
- Global OS Architecture
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

- The full agent swarm is present and each agent has usable skills.
- Global OS Designer, Product Truth Officer, Acceptance Architect, Evidence Auditor, Universal Capability Steward, Studio Director, Game Designer, Gameplay Developer, UX Flow Director, Game Feel Director, Physics Gameplay Engineer, Advanced Player Council, QA Director, Memory Manager, Storage Manager, Security Privacy Reviewer, Build Sentinel, and Open Source Release Engineer are wired into the system.
- Game OS generates OS design review, capability map, acceptance profile, architecture risk report, and upgrade doctrine artifacts so examples cannot become accidental product architecture.
- The ultra-friendly creator path is present through `gameos`/`gameos init`/`gameos cockpit`, starter ideas, max-five action ranking, `gameos next`, `gameos play`, `gameos assets preview`, and `gameos improve`.
- The Web quality proof includes asset role mapping, no-goal-magnet physics, timing skill, agency, mastery, smooth and slow pointer input, reset/retry proof, watermarking, and Advanced Player gates.
- Playable Web HUDs stay player-facing instead of leaking raw machine verdict constants; manifests and QA reports keep the exact machine-readable fields.
- The open-source package includes release, security, privacy, Homebrew, CI, publishing, and contributor trust evidence.
- The acceptance paths can prove capability maps, acceptance profiles, Web builds, watermark/provenance, QA reports, and honest trust diagnosis across multiple prompt families.

## What It Does Not Prove

- It does not publish `gameos` to npm.
- It does not update Homebrew to an unpublished npm tarball.
- It does not replace `npm run acceptance:web-quality`; the acceptance test is still the browser-backed end-to-end game proof.
- It does not claim commercial launch readiness from local Web proof.
- It does not run Unity or Godot heavy lanes unless those are explicitly invoked with their own commands.

## Release Use

Run this before public release claims:

```bash
npm run goal:audit
npm run acceptance:universal-trust
npm run acceptance:universal-deep
npm run trust:audit
npm run check
npm run acceptance:web-quality
```

The npm/Homebrew go-live step still requires npm authentication. If npm returns `EOTP`, complete one-time password or trusted-publishing setup before running:

```bash
npm publish --otp <code>
npm run homebrew:update -- 0.4.0
```
