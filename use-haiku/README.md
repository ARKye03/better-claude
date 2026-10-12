# Use Haiku

A Claude Code mod: start a prompt with `_` and that turn runs on Haiku. Other prompts keep the session's model.

```text
❯ _summarize the last commit
```

Claude gets `summarize the last commit`, without the `_`, and every model request of that turn goes to `claude-haiku-5-5`. The next prompt goes back to the session's model.

## Install

```text
/plugin marketplace add midudev/after-for-claude-code
/plugin install use-haiku@after-for-claude-code
```

Requires a Claude Code version with mods (2.1.289 or newer).

## How it works

One hooks module ([`hooks/register.ts`](hooks/register.ts)):

- `prompt.submit`: a prompt starting with `_` marks its turn and loses the mark.
- `turn.step`: while a turn is marked, each request names Haiku (`next({ ...e, model })`).
- `turn.complete`: clears the mark.

## Development

```bash
claude plugin validate .   # from the repository root, or ./use-haiku
claude plugin test .       # runs hooks/register.test.ts against the engine
```

MIT © Miguel Ángel Durán (midudev)
