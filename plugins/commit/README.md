# Commit

A Claude Code command: `/commit` splits your changes into Conventional Commits, one per logical group, and pushes the current branch. It runs on Haiku 5.5 (`claude-haiku-5-5`), whatever model the session uses.

```text
❯ /commit
```

- Reads `git status` and `git diff HEAD` before Claude starts.
- Stages only each group's files, never `.env*` or secrets, and commits as `type(scope): summary`: English, imperative, under 72 characters, with a body only when the why is not obvious.
- Never adds `Co-Authored-By` or any Claude or Anthropic attribution.
- Pushes with `git push -u origin HEAD`. With no remote, or a failed push, it reports the error and stops.
- Runs `git` and nothing else (`allowed-tools: Bash(git *)`).

## Install

```text
/plugin marketplace add midudev/better-claude
/plugin install commit@better-claude
```

## How it works

One command file ([`commands/commit.md`](commands/commit.md)): its frontmatter picks the model and the allowed tools, and its `` !`git …` `` lines put the status and the diff in the prompt.

## Development

```bash
claude plugin validate .   # from this folder
claude --plugin-dir .      # try it from source
```

MIT © Miguel Ángel Durán (midudev)
