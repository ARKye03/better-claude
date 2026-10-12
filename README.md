# better-claude

Plugins and mods for Claude Code by midudev, one per folder:

| Plugin | What it does | Folder |
| --- | --- | --- |
| **After** | A prompt queue: `/after <task>` runs it when Claude finishes, without steering it. | [`after/`](after/README.md) |
| **Use Haiku** | Start a prompt with `_` and that turn runs on Haiku. | [`use-haiku/`](use-haiku/README.md) |
| **Think Hard** | Start a prompt with `+` and that turn thinks at max effort. | [`think-hard/`](think-hard/README.md) |
| **Token Meter** | Each turn's tokens in the status line, with the session total. | [`token-meter/`](token-meter/README.md) |

## Install

```text
/plugin marketplace add midudev/better-claude
/plugin install after@better-claude
/plugin install use-haiku@better-claude
/plugin install think-hard@better-claude
/plugin install token-meter@better-claude
```

This repository is the marketplace: [`.claude-plugin/marketplace.json`](.claude-plugin/marketplace.json) lists each plugin folder as a source.

## Development

Each plugin is its own folder with its own `package.json` or manifest. Run the After commands from `after/`, and validate or test any plugin with `claude plugin validate ./<folder>` and `claude plugin test ./<folder>` from here.

MIT © Miguel Ángel Durán (midudev)
