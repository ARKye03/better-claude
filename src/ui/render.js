// Plain-text rendering of the queue: what /after prints in the transcript, and the lines
// the band and the pane share.
import { plural, shorten } from './format.js'

const RESET = '\x1b[0m'
const STYLES = { bold: '\x1b[1m', dim: '\x1b[2m', cyan: '\x1b[36m', green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m', magenta: '\x1b[35m' }

/** Returns a painter that is a no-op when color is disabled. */
export const painter = (color) => (style, text) => color ? `${STYLES[style]}${text}${RESET}` : text

const MARK_LABEL = { new: '← new', moved: '← moved', edited: '← edited' }
const ICON = { ok: '✓', info: '·', error: '✗' }

export const HINT = '/after <task> · /before <task> · /after rm <n> · /after help'

function header (state, paint) {
  const parts = [paint('bold', 'After')]
  if (state.items.length === 0 && !state.running) parts.push('queue empty')
  else parts.push(state.items.length ? plural(state.items.length, 'task') + ' queued' : 'nothing queued')
  if (state.paused) parts.push(paint('yellow', '⏸ paused'))
  else if (state.running) parts.push(paint('green', '▶ running'))
  return parts.join(' · ')
}

/** The queue as a compact timeline: last finished → running → pending. */
export function renderQueue (state, { marks = {}, color = false, width = 72, showDone = 2, hint = HINT } = {}) {
  const paint = painter(color)
  const text = (value, room) => shorten(value, Math.max(12, room))
  const lines = [`┌ ${header(state, paint)}`]

  for (const item of state.done.slice(0, showDone).reverse()) {
    const icon = item.status === 'stopped' ? '■' : '✓'
    const note = item.status === 'stopped' ? ' (interrupted)' : ''
    lines.push(`│ ${paint('dim', `${icon} ${text(item.text, width - 6 - note.length)}${note}`)}`)
  }
  if (state.running) {
    lines.push(`│ ${paint('green', '▶')} ${text(state.running.text, width - 6)}`)
  }
  const digits = String(state.items.length).length
  state.items.forEach((item, i) => {
    const label = MARK_LABEL[marks[item.id]]
    const number = paint('cyan', String(i + 1).padStart(digits))
    const body = text(item.text, width - 6 - digits - (label ? label.length + 2 : 0))
    lines.push(`│ ${number} ${body}${label ? `  ${paint('yellow', label)}` : ''}`)
  })
  lines.push(`└ ${paint('dim', hint)}`)
  return lines.join('\n')
}

/**
 * @param {{ kind: 'ok' | 'info' | 'error', text: string } | null} message
 * @param {{ via?: string | null, note?: string, color?: boolean }} [options]
 */
export function renderMessage (message, { via = null, note = '', color = false } = {}) {
  if (!message?.text) return ''
  const paint = painter(color)
  const tone = { ok: 'green', info: 'dim', error: 'red' }[message.kind]
  const [first, ...rest] = message.text.split('\n')
  const lines = [`${paint(tone, ICON[message.kind])} ${first}`, ...rest.map(line => `  ${line.trimStart()}`)]
  if (via === 'haiku' && message.kind !== 'info') lines.push(paint('magenta', `  ✦ Haiku${note ? `: ${note}` : ''}`))
  if (via === 'heuristics' && message.kind !== 'info') lines.push(paint('dim', '  ✦ matched locally'))
  return lines.join('\n')
}

export function renderHelp () {
  return `After · queue prompts for Claude Code without steering the current task

  /after <task>            queue a task · it runs when Claude finishes
  /before <task>           queue a task at the front · it runs next
  /after #2 <task>         insert right after #2 (/before #2 <task>: right before)
  /after                   show the queue
  /after rm 2 · rm 2-4     remove tasks (also: rm last, rm all)
  /after edit 2 <text>     rewrite a task
  /after mv 3 1            move #3 to position 1 (also: mv 3 last, top 3)
  /after pause · resume    hold the queue / let it run again
  /after undo · clear      undo the last change / empty the queue
  /after watch             live, editable view in a pane

  Plain language works too (Haiku understands it):
  /after tests, write a README explaining them   → goes right after the tests task
  /before deploy bump the version                → goes right before the deploy task
  /after remove the tests one                    → removes it
  /after -- remove the old API                   → "--" queues the text as-is`
}

/**
 * Everything a /after command prints inside Claude Code. The queue itself is left out when
 * something else shows it live (the band), unless the command only asked to see it.
 */
export function renderResponse (outcome, { idle = false, showQueue = true } = {}) {
  const { state } = outcome
  if (outcome.view === 'help') return showQueue ? `${renderHelp()}\n\n${renderQueue(state)}` : renderHelp()

  const blocks = []
  if (outcome.view === 'watch') blocks.push('Opened the live view · Esc returns to the prompt')
  const message = renderMessage(outcome.message, outcome)
  if (message) blocks.push(message)
  if (idle && outcome.kick && !state.paused && !state.running && state.items.length > 0) {
    blocks.push(`▶ Claude is idle · starting ${shorten(state.items[0].text, 48)} now`)
  }
  if (showQueue || blocks.length === 0) blocks.push(renderQueue(state, { marks: outcome.marks }))
  return blocks.join('\n\n')
}

/** One line on what the queue will do next. */
export function describeStatus (state) {
  if (state.paused) return { tone: 'yellow', text: '⏸ paused · queued tasks wait until you resume' }
  if (state.running) return { tone: 'green', text: '▶ Claude is working on a queued task' }
  if (state.busy) return { tone: 'green', text: '● Claude is working · queued tasks run when it finishes' }
  if (state.items.length === 0) return { tone: 'dim', text: 'Claude is idle · nothing queued' }
  return { tone: 'yellow', text: 'Claude is idle · /after go starts the queue' }
}
