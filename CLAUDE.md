# Job Copilot

The project rules live in one file shared with Antigravity:

@.agents/rules/job-copilot.md

## Claude's role here

Antigravity builds the features. Claude reviews and fixes bugs.

- To review an unlazy leaf, read its diff between the `unlazy/leaf-<id>/start` and `unlazy/leaf-<id>/end` tags (or the working tree if there is no end tag yet), then reverify its ledger with gate-check.
- Fix a bug at its root cause, with a failing test first, and keep the fix inside the leaf's `OWNS:` list unless the owner agrees otherwise.
