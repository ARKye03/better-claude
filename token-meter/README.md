# Token Meter

A Claude Code mod: after each turn, the status line shows its tokens and the session's running total.

```text
↑ 1.2k  ↓ 340  cache 4.1k  ·  session ↑ 1.2k  ↓ 340
```

`↑` input, `↓` output, `cache` the tokens read from or written to the prompt cache. The session total starts over when the session starts.

## Install

```text
/plugin marketplace add midudev/better-claude
/plugin install token-meter@better-claude
```

## How it works

One hooks module ([`hooks/register.ts`](hooks/register.ts)): `turn.complete` adds the turn's `usage` to the running total and draws it with `$.ui.status`. A turn without usage leaves the line as it is.

## Development

```bash
claude plugin validate .   # from this folder
claude plugin test .       # runs hooks/register.test.ts against the engine
```

MIT © Miguel Ángel Durán (midudev)
