# Agent Output Template

Each Game OS agent should produce:

1. A direct verdict for the current project.
2. The decisions the implementer should follow.
3. The risks that can break fun, production, platform readiness, or QA.
4. Artifacts or gates the agent owns.
5. A short next-action list.

The Studio Director merges the agent outputs into one execution plan after every swarm run.
