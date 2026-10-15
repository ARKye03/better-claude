---
description: Semantic commits of current changes, then push to the current branch
model: claude-haiku-5-5
allowed-tools: Bash(git *)
---

Current state:
- Status: !`git status --short`
- Diff: !`git diff HEAD`

Split the changes into logical groups, one commit per group. For each group:
1. `git add` only its files (never stage `.env*` or secrets).
2. Commit with a Conventional Commits message in English: `type(scope): summary` (types: feat, fix, refactor, style, docs, test, chore, build). Imperative, under 72 chars. Add a body only if the why isn't obvious.
3. Never add `Co-Authored-By`, "Generated with Claude", or any Claude/Anthropic attribution.

Then run `git push -u origin HEAD` to push the current branch. If there is no remote, or the push fails, report the error and stop.

Finish with a short list of the commits created and the push result.
