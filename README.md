# After

**A prompt queue for Claude Code, built as a [Claude Code mod](https://claude.com/blog/claude-code-mods).** Keep typing while Claude works: `/after <task>` runs it when the current task is done, without steering it.

```text
> /after add tests for the parser
> /after update the README
> /before fix the lint errors first

⏺ after: ✓ Queued #1 · fix the lint errors first (next up)

After 3 tasks queued ▶ refactor the parser                                    view
next 1 fix the lint errors first · 2 add tests for the parser · 3 update the README
❯ _
```

- **No steering.** Queued tasks never reach Claude until it finishes what it is doing.
- **You see the queue.** A band above the prompt shows what runs now and what comes next; `/after watch` opens a live, editable pane.
- **Plain language.** `/after tests, write a README explaining them` goes right after the tests task; `/after remove the tests one` removes it. Haiku figures it out.
- **Nothing to install around it.** No Node.js, no API key, no background processes: the mod runs inside Claude Code.

## Why

Anything you type while Claude is working gets injected into the current turn (steering). That is great for *"use Vitest, not Jest"*, and bad for *"when you're done, update the README"*: Claude changes plans mid-task, mixes priorities and fills its context with work it should not do yet.

Rule of thumb:

- **Steering** (just type) changes what Claude is doing **now**.
- **After** (`/after …`) is work for **later**.

## Install

```text
/plugin marketplace add midudev/after-for-claude-code
/plugin install after@after-for-claude-code
```

Mods ship inside plugins, so that is all. Requires a Claude Code version with mods (2.1.289 or newer).

> **Upgrading from 0.1?** After 0.1 put `after.md` and `before.md` in `~/.claude/commands`. Delete them: the mod registers `/after` and `/before` itself, and After tells you at startup if those files are still there. The `after` CLI for a second terminal is gone too; the pane replaces it.

## Usage

| Command | What it does |
| --- | --- |
| `/after <task>` | Queue a task. It runs when Claude finishes (right away if Claude is idle). |
| `/before <task>` | Queue a task at the front, so it runs next. |
| `/after #2 <task>` · `/before #2 <task>` | Insert right after / before task #2. |
| `/after` | Show the queue. |
| `/after watch` | Open the live, editable pane. |
| `/after rm 2` · `rm 2-4` · `rm last` · `rm all` | Remove tasks. |
| `/after edit 2 <text>` | Rewrite a task. |
| `/after mv 3 1` · `mv 3 last` · `top 3` | Reorder. |
| `/after pause` · `/after resume` | Hold the queue / let it run again. |
| `/after undo` | Undo the last change. |
| `/after clear` | Empty the queue. |
| `/after help` | All of the above. |

`/after` and `/before` run the moment you press Enter, even while Claude is working: the confirmation shows up at once, and the task waits for its turn.

### Plain language

When what you type could refer to something already queued, After asks Claude Haiku (through Claude Code's own model client, so there is no API key to set up) and falls back to local matching if Haiku does not answer:

```text
/after tests, write a README explaining them    → inserted right after the tests task
/before deploy bump the version                 → inserted right before the deploy task
/after remove adding tests                      → removes the tests task
/after quita lo del readme                      → Spanish works too
/after move the readme to the top               → reorders
/after -- remove the old API                    → "--" queues the text as-is, no interpretation
```

Removing a task that already started is refused instead of being queued as a new task, so *"remove the tests"* can never turn into *"delete the test files"*.

### The band and the pane

While something is queued, a band above the prompt shows the running task and the next ones. **view** (or `/after watch`) opens the pane: docked beside the transcript in fullscreen, above the prompt otherwise.

```text
⏸ paused · queued tasks wait until you resume
  ✓ refactor the parser
 1 add tests for the parser                   ↑ ↓ ✎ ✕
 2 bump the version                           ↑ ↓ ✎ ✕
 3 deploy to staging                          ↑ ↓ ✎ ✕
add: a task, or rm 2 · mv 3 1 · remove the tests one
[ resume ] [ undo ] [ clear ]
```

- `↑` `↓` reorder, `✎` loads the task into the input to rewrite it, `✕` removes it.
- The input takes a new task or anything `/after` understands, plain language included.
- `p` pauses or resumes, `u` undoes, while the pane has the keys (`ctrl+x tab`, or a click). `Esc` returns to the prompt; `ctrl+x x` closes it.

Everything applies at once, even while Claude is working. If Claude is idle, a task you add starts on its own.

## How it works

After is one hooks module ([`hooks/register.tsx`](hooks/register.tsx)) running inside Claude Code. Nothing patches Claude Code and nothing runs outside it.

1. **`/after` never reaches the model.** The mod registers `/after` and `/before` as slash commands that run immediately, even mid-turn. Their output is a transcript line the model never reads, and a `session.append` hook strips the command's arguments from the record the model would see, so queued tasks stay out of Claude's context until their turn.
2. **The queue moves when a turn ends.** On `turn.complete` (an answered turn, not Esc or an error) the mod pops the next task and submits it with `$.prompt.submit` as your own message. A plain-language command still being resolved when the turn ends is waited for, so a `/after remove …` typed mid-turn lands first.
3. **Haiku through `$.model.complete`.** The session's own client, no subprocess and no API key. Plain tasks never ask the model; only text that may refer to the queue does.
4. **One queue per session**, held in `$.state` (the band and the pane redraw from it, and it survives a hot reload) and saved in `$.store`, so a resumed session finds its queue. `/clear` keeps the queue.

```
hooks/      register.tsx (the mod) · register.test.tsx (claude plugin test)
types/      index.d.ts (the $.state contract)
src/
├── core/       queue.js (pure operations)
├── commands/   parse.js (/after grammar) · apply.js (intents → state) · execute.js
├── smart/      text.js (fuzzy matching) · heuristics.js · protocol.js (Haiku contract) · resolve.js
└── ui/         render.js · format.js
```

Everything under `src/` is plain, dependency-free JavaScript with no Node APIs, shared by the mod and the unit tests.

## Configuration

`/config` lists After's options (or set them under `pluginConfigs.after.options` in `settings.json`):

| Option | Default | |
| --- | --- | --- |
| Plain-language commands (`smart`) | on | Off uses local matching only, never the model. |
| Model (`model`) | `haiku` | Model for plain-language commands. |
| Where the queue shows (`display`) | `band` | `band` above the prompt, `status` as one line under it, or `none`. |

## Good to know

- **Esc** interrupts the running task as usual; the queue waits until the next turn ends normally. Use `/after pause` to hold it.
- If Claude is idle, `/after <task>` starts the task right away. To build a queue first, `/after pause`, add your tasks, then `/after resume`.
- Queued tasks arrive as your own message, marked in the transcript as coming from the After plugin.

## Development

```bash
npm run test:node                # unit tests for src/ (node --test, no dependencies)
npm run test:mod                 # the mod against the engine: claude plugin test .
npm run validate                 # claude plugin validate .
npm run typecheck                # tsc against the types Claude Code lays in .claude-plugin/types
claude --plugin-dir .            # try it from source; edits hot-reload
npm run eval                     # the real model against the plain-language cases (costs a few cents)
```

`.claude-plugin/types/` is written by Claude Code the first time it loads the mod from this folder (`claude --plugin-dir .`), which `npm run typecheck` needs.

## License

MIT © Miguel Ángel Durán (midudev)
