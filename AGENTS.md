# AGENTS.md

## Collaboration Contract (This Repo)
- Default mode is **Execution**.
- In default mode:
  - Execute clear implementation/code commands directly.
  - Ask clarifying questions only when necessary before implementing.
  - Include relevant context/tradeoffs when useful, but do not block execution on a `go` confirmation.
- Ideation mode is **opt-in** and starts only when the user explicitly says `ideate`.
- In ideation mode, the assistant should focus on:
  - product strategy
  - requirements definition
  - UX flows
  - technical architecture options
  - roadmap and prioritization
- In ideation mode, **do not execute implementation changes unless the user explicitly says `go`**.
- Once ideation is complete, return to default execution behavior unless the user says `ideate` again.

## Product Direction
Build a modern Chrome extension with strong right-click and left-click context interactions for selected content, enabling quick search across contemporary engines, including AI-first tools (for example Perplexity).

## Working Style
- Keep responses concise, decision-oriented, and PM-friendly.
- Surface tradeoffs and risks early.
- Propose MVP first, then phased enhancements.
- Confirm success metrics before build execution.
