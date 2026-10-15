# better-claude

Plugins and mods for Claude Code by midudev, one per folder in [`plugins/`](plugins):

| Plugin | What it does | Folder |
| --- | --- | --- |
| **After** | A prompt queue: `/after <task>` runs it when Claude finishes, without steering it. | [`plugins/after/`](plugins/after/README.md) |
| **Use Haiku** | Start a prompt with `_` and that turn runs on Haiku. | [`plugins/use-haiku/`](plugins/use-haiku/README.md) |
| **Think Hard** | Start a prompt with `+` and that turn thinks at max effort. | [`plugins/think-hard/`](plugins/think-hard/README.md) |
| **Token Meter** | Each turn's tokens and the session total, in color under the prompt. | [`plugins/token-meter/`](plugins/token-meter/README.md) |
| **Sub Meter** | Subscription usage at the bottom right: the 5-hour and weekly windows, as a bar. | [`plugins/sub-meter/`](plugins/sub-meter/README.md) |
| **Image Preview** | Hover a pasted `[Image #N]` to see the picture, while you write and on the prompts you sent. | [`plugins/image-preview/`](plugins/image-preview/README.md) |

## Install

```text
/plugin marketplace add midudev/better-claude
/plugin install after@better-claude
/plugin install use-haiku@better-claude
/plugin install think-hard@better-claude
/plugin install token-meter@better-claude
/plugin install sub-meter@better-claude
/plugin install image-preview@better-claude
```

This repository is the marketplace: [`.claude-plugin/marketplace.json`](.claude-plugin/marketplace.json) lists each plugin folder as a source.

## Development

Each plugin is its own folder with its own manifest. One `package.json` at the root runs everything: `npm test`, `npm run validate`, `npm run test:node` (After's unit tests) and `npm run test:mod` (every plugin's tests against the engine).

MIT © Miguel Ángel Durán (midudev)
