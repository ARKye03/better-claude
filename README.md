# better-claude

<img width="1590" height="576" alt="CleanShot 2026-10-15 at 14 38 45@2x" src="https://github.com/user-attachments/assets/67b271e6-254e-4429-9273-9571fe98f79b" />

Plugins and mods for Claude Code by midudev, one per folder in [`plugins/`](plugins):

<!-- plugins:start -->
| Plugin | What it does | Folder |
| --- | --- | --- |
| **Commit** | `/commit` asks whether to commit and push, only commit, or commit on a new branch, then splits your changes into Conventional Commits, one per logical group, on the branch you are on. Runs on Haiku 5.5. | [`plugins/commit/`](plugins/commit/README.md) |
| **Context Meter** | The session's context window fill, right above the prompt: gray while there is room, yellow when it is time to `/compact`, red when a new session is better. | [`plugins/context-meter/`](plugins/context-meter/README.md) |
| **Image Preview** | Hover a pasted `[Image #N]` to see the picture: above the prompt while you write, and on the prompts you sent. | [`plugins/image-preview/`](plugins/image-preview/README.md) |
| **Narrator** | Click ⏸︎ narrator off in the footer, or `/narrator`, and after each turn Claude tells you out loud what it did, in your language, with the best free voice your system has: Siri's on macOS, Narrator's on Windows, speech-dispatcher's on Linux. | [`plugins/narrator/`](plugins/narrator/README.md) |
| **Sub Meter** | Your subscription usage at the bottom right of Claude Code: the 5-hour and weekly windows, taking turns, side by side or fixed on one of them. | [`plugins/sub-meter/`](plugins/sub-meter/README.md) |
| **Time Machine** | Every turn that changes files is a git snapshot off your history: `/timeline` shows them and puts the working tree back as it was before any turn, Bash changes included. Undoable. | [`plugins/time-machine/`](plugins/time-machine/README.md) |

<!-- Hidden until they are on the web:
| **After** | A real prompt queue for Claude Code: `/after <task>` runs it after the current task, without steering. See, reorder and remove queued tasks from a band and a live pane, in plain language. | [`plugins/after/`](plugins/after/README.md) |
| **Think Hard** | Start a prompt with `+` and that turn thinks at max effort. Other prompts keep the session's effort. | [`plugins/think-hard/`](plugins/think-hard/README.md) |
| **Token Meter** | Each turn's tokens and the session's running total, in color at the end of the hint line under the prompt. | [`plugins/token-meter/`](plugins/token-meter/README.md) |
| **Use Haiku** | Start a prompt with `_` and that turn runs on Haiku, shown as you type, while it runs and under the answer. | [`plugins/use-haiku/`](plugins/use-haiku/README.md) |
-->
<!-- plugins:end -->

## Install

```text
/plugin marketplace add midudev/better-claude
/plugin install image-preview@better-claude
/plugin install sub-meter@better-claude
/plugin install context-meter@better-claude
/plugin install commit@better-claude
/plugin install narrator@better-claude
/plugin install time-machine@better-claude
```

<!-- Hidden until they are on the web:
/plugin install after@better-claude
/plugin install use-haiku@better-claude
/plugin install think-hard@better-claude
/plugin install token-meter@better-claude
-->

To get new versions on their own, turn on auto-update: `/plugin` → **Marketplaces** → **better-claude** → **Enable auto-update**. Claude Code leaves it off for marketplaces outside Anthropic's.

This repository is the marketplace: [`.claude-plugin/marketplace.json`](.claude-plugin/marketplace.json) lists each plugin folder as a source.

## Development

Each plugin is its own folder with its own manifest. One `package.json` at the root runs everything: `npm test`, `npm run validate`, `npm run test:node` (After's and Time Machine's unit tests) and `npm run test:mod` (every plugin's tests against the engine).

MIT © Miguel Ángel Durán (midudev)
