// After as a Claude Code mod: one hooks module, no subprocesses.
//
// - /after and /before are slash commands of the mod. They run at once, even mid-turn, print
//   a line the model never reads, and their record is scrubbed so queued tasks never reach
//   Claude before their turn (no steering).
// - When a turn ends, the next task is handed to Claude with $.prompt.submit.
// - The queue lives in $.state (the band and the pane redraw from it) and in $.store (so a
//   resumed session finds it).
import { atom, read, update } from 'claude-code'
import type { EngineInterface, EventOf, Register, RenderElement } from 'claude-code'

import { applyIntent, applyOps } from '../src/commands/apply.js'
import { executeCommand } from '../src/commands/execute.js'
import { parsePrompt } from '../src/commands/parse.js'
import { canStart, createState, giveBack, markIdle, normalizeState, takeNext } from '../src/core/queue.js'
import { createModelResolver } from '../src/smart/resolve.js'
import { plural, shorten } from '../src/ui/format.js'
import { describeStatus, renderMessage, renderResponse } from '../src/ui/render.js'
import type { AfterDraft, AfterNote, AfterQueue, AfterTask } from '../types'

type Engine = EngineInterface
type Command = 'after' | 'before'
type RenderOf<C extends string> = Extract<EventOf['ui.render'], { component: C }>
type Next<C extends string> = (e: RenderOf<C>) => Promise<RenderElement>
type Outcome = Omit<ReturnType<typeof applyOps>, 'state'> & { state: AfterQueue }
type Op =
  | { type: 'add'; text: string; where: object }
  | { type: 'remove'; ids: number[] }
  | { type: 'move'; id: number; where: object }
  | { type: 'edit'; id: number; text: string }
  | { type: 'clear' }

const PANE = 'after'
const STORE_PREFIX = 'queue:'
const STORE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000
const MODEL_TIMEOUT_MS = 25_000

const QUEUE_REF = { plugin: 'after', key: 'queue' } as const
const NOTE_REF = { plugin: 'after', key: 'note' } as const
const DRAFT_REF = { plugin: 'after', key: 'draft' } as const
const PANE_OPEN_REF = { plugin: 'after', key: 'paneOpen' } as const
const QUEUE = atom(QUEUE_REF, null)
const NOTE = atom(NOTE_REF, null)
const DRAFT = atom(DRAFT_REF, { text: '', editId: null })
const PANE_OPEN = atom(PANE_OPEN_REF, false)

const EMPTY_DRAFT: AfterDraft = { text: '', editId: null }
const COLOR: Record<string, string | undefined> = { green: 'green', yellow: 'yellow', red: 'red', cyan: 'cyan', dim: undefined }
const TONE: Record<AfterNote['kind'], string | undefined> = { ok: 'green', info: undefined, error: 'red' }
const MARK_LABEL: Record<string, string> = { new: '← new', moved: '← moved', edited: '← edited' }
// The row a slash command leaves in the transcript, which the model reads on its next request
const COMMAND_RECORD = /<command-name>\/(?:after:)?(?:after|before)<\/command-name>/
const COMMAND_ARGS = /<command-args>[\s\S]*?<\/command-args>/

// The queue as this module last wrote it. $.state publishes it to the drawings and survives a
// hot reload; $.store keeps it across restarts. Every write goes through `exclusive`.
let current: AfterQueue | null = null
let chain: Promise<unknown> = Promise.resolve()
// A /clear starts a new conversation (and session id) in the same process: the queue stays
let carryOver = false
// Plain-language commands waiting for the model. A turn that ends meanwhile waits for them,
// so "/after remove the readme one" typed mid-turn lands before the queue moves on.
let resolving = 0
let kickPending = false
let settings = { smart: true, model: 'haiku', display: 'band' }

export const register: Register = (on, options) => {
  settings = {
    smart: options.smart !== false,
    model: String(options.model || 'haiku'),
    display: String(options.display || 'band')
  }

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'after',
      description: 'Queue a task to run after the current one, without steering it',
      argumentHint: '[task] | rm <n> | mv <n> <m> | edit <n> <text> | pause | resume | undo | clear | watch | help',
      immediate: true
    })
    await $.command.register({
      name: 'before',
      description: 'Queue a task at the front so it runs next',
      argumentHint: '[task] | #<n> <task> to insert before #n',
      immediate: true
    })
    await exclusive(() => load($))
    await prune($)
    await warnAboutShims($)
    return next(e)
  })

  on('session.end', async ($, e, next) => {
    if (e.reason === 'clear') carryOver = true
    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    await commit($, state => ({ state: state.busy ? state : { ...state, busy: true } }))
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId === undefined) await finishTurn($, e.reason === 'answer')
    return result
  })

  on('command.run', { command: 'after' }, ($, e) => slashCommand($, 'after', e.args))
  on('command.run', { command: 'before' }, ($, e) => slashCommand($, 'before', e.args))

  // The command's record would show Claude what was queued before its turn: keep the
  // command, drop its arguments
  on('session.append', { door: 'command' }, ($, e, next) => {
    const isAfter = e.message.content.some(block => typeof block.text === 'string' && COMMAND_RECORD.test(block.text))
    if (!isAfter) return next(e)
    const content = e.message.content.map(block => typeof block.text === 'string'
      ? { ...block, text: block.text.replace(COMMAND_ARGS, '<command-args></command-args>') }
      : block)
    return next({ ...e, message: { ...e.message, content } })
  })

  on('ui.render', { component: 'AbovePrompt' }, ($, e, next) => drawBand($, e, next))
  on('ui.render', { component: 'Pane', requestId: PANE }, ($, e) => drawPane($, e))
  on('ui.close', { id: PANE }, async ($, e, next) => {
    await $.state.set(PANE_OPEN_REF, false)
    return next(e)
  })
}

// ── The queue ──────────────────────────────────────────────────────────────────

function exclusive<T> (work: () => Promise<T>): Promise<T> {
  const run = chain.then(work, work)
  chain = run.catch(() => {})
  return run
}

const storeKey = (sessionId: string | null) => `${STORE_PREFIX}${sessionId}`

/** The queue of the session running now. Call inside `exclusive`. */
async function load ($: Engine): Promise<AfterQueue> {
  const sessionId = await $.session.id()
  if (current?.sessionId === sessionId) return current
  if (current && carryOver) {
    carryOver = false
    await $.store.delete(storeKey(current.sessionId))
    return publish($, { ...current, sessionId })
  }
  const held = await read($, QUEUE)
  if (held?.sessionId === sessionId) return (current = held)

  const now = await $.clock.now()
  const stored = await $.store.get(storeKey(sessionId))
  // A queue from a previous run of this session: Claude is not working on anything now
  const state = stored
    ? markIdle(normalizeState(stored, { sessionId }), { now, status: 'stopped' })
    : createState({ sessionId, cwd: await $.session.cwd(), now })
  return publish($, state as AfterQueue)
}

async function publish ($: Engine, state: AfterQueue): Promise<AfterQueue> {
  current = state
  await $.state.set(QUEUE_REF, state)
  await $.store.set(storeKey(state.sessionId), state)
  if (settings.display === 'status') $.ui.status(statusLine(state))
  return state
}

/** Applies `apply(state, now)` and saves the state it returns. */
function commit<T extends { state: AfterQueue }> ($: Engine, apply: (state: AfterQueue, now: number) => T): Promise<T> {
  return exclusive(async () => {
    const state = await load($)
    const now = await $.clock.now()
    const outcome = apply(state, now)
    if (outcome.state === state) return outcome
    return { ...outcome, state: await publish($, { ...outcome.state, updatedAt: now }) }
  })
}

async function prune ($: Engine) {
  const now = await $.clock.now()
  const keys = (await $.store.keys()).filter(key => key.startsWith(STORE_PREFIX))
  for (const key of keys) {
    const state = (await $.store.get(key)) as Partial<AfterQueue> | undefined
    const isEmpty = !state?.items?.length && !state?.running
    if (isEmpty && now - (state?.updatedAt ?? 0) > STORE_MAX_AGE_MS) await $.store.delete(key)
  }
}

/** After 0.1 put /after and /before in ~/.claude/commands; a file there would shadow the mod. */
async function warnAboutShims ($: Engine) {
  const shadowing = (await $.command.list())
    .filter(command => command.source === 'user' && (command.name === 'after' || command.name === 'before'))
  if (shadowing.length === 0) return
  const files = shadowing.map(command => `${command.name}.md`).join(' and ')
  $.ui.log(`After: delete ${files} from ~/.claude/commands (left by After 0.1) so /after reaches the mod`)
}

// ── Running tasks ──────────────────────────────────────────────────────────────

async function finishTurn ($: Engine, isAnswered: boolean) {
  // Esc, a refusal or an API error stop the queue until the next turn ends normally
  const { state, finished } = await commit($, (state, now) => ({
    state: markIdle(state, { now, status: isAnswered ? 'done' : 'stopped' }) as AfterQueue,
    finished: state.running
  }))
  if (!isAnswered) return
  if (finished && state.items.length === 0 && settings.display !== 'none') $.ui.toast('After · all queued tasks done')
  startNext($)
}

/** Hands the next task to Claude if it is idle and the queue may run. */
function startNext ($: Engine) {
  if (resolving > 0) {
    kickPending = true
    return
  }
  kickPending = false
  void commit($, (state, now) => canStart(state) ? takeNext(state, now) : { state, item: null })
    .then(({ item }: { item: AfterTask | null }) => item && submit($, item))
    .catch(error => debug($, error))
}

/** Work nobody awaits reports its failures to the debug log (claude --debug). */
function debug ($: Engine, error: unknown) {
  try {
    $.ui.log(`After: ${error instanceof Error ? error.message : String(error)}`, { to: 'debug' })
  } catch {}
}

async function submit ($: Engine, item: AfterTask) {
  // The user typed it with /after, so Claude reads it as their message, bare
  let reason: string | undefined
  try {
    reason = (await $.prompt.submit({ text: item.text, asUser: true })).drop
  } catch (error) {
    reason = error instanceof Error ? error.message : String(error)
  }
  if (reason === undefined) return
  await commit($, state => ({ state: giveBack(state, item.id) as AfterQueue }))
  $.ui.log(`✗ After could not start “${shorten(item.text, 48)}”: ${reason}\n  The queue is paused · /after resume to try again`)
}

// ── Commands ───────────────────────────────────────────────────────────────────

async function track<T> (work: () => Promise<T>): Promise<T> {
  resolving++
  try {
    return await work()
  } finally {
    resolving--
  }
}

function resolverFor ($: Engine) {
  if (!settings.smart) return null
  return createModelResolver(async ({ system, prompt }: { system: string; prompt: string }) => {
    const reply = await $.model.complete({ model: settings.model, system, prompt, maxTokens: 1024, effort: 'low', timeoutMs: MODEL_TIMEOUT_MS })
    return reply.isAnswered ? reply.text : null
  })
}

async function slashCommand ($: Engine, command: Command, args: string) {
  try {
    const outcome = await runCommand($, command, args)
    // One transcript line per line of output: a line the model never reads
    const output = renderResponse(outcome, { idle: !outcome.state.busy, showQueue: settings.display !== 'band' })
    for (const line of output.split('\n')) if (line.trim()) $.ui.log(line)
    if (outcome.kick || kickPending) startNext($)
  } catch (error) {
    $.ui.log(`✗ After could not handle that: ${error instanceof Error ? error.message : String(error)}`)
  }
  // No text: a command's output is a row the model reads on its next request
  return {}
}

/** One /after or /before command, from the prompt or from the pane's input. */
async function runCommand ($: Engine, command: Command, args: string): Promise<Outcome> {
  const queue = {
    read: () => exclusive(() => load($)),
    commit: (apply: (state: AfterQueue, now: number) => Outcome) => commit($, apply)
  }
  const outcome: Outcome = await executeCommand({ queue, command, args, resolver: resolverFor($), track })
  await remember($, outcome)
  if (outcome.view === 'watch') await openPane($)
  return outcome
}

/** Concrete, id-based operations from the pane's buttons. */
async function runOps ($: Engine, ops: Op[]) {
  const outcome: Outcome = await commit($, (state, now) => applyOps(state, ops, { now }))
  await remember($, outcome)
  if (outcome.kick) startNext($)
}

async function runIntent ($: Engine, type: 'pause' | 'resume' | 'undo') {
  const outcome: Outcome = await commit($, (state, now) => applyIntent(state, { type }, { now }))
  await remember($, outcome)
  if (outcome.kick) startNext($)
}

async function remember ($: Engine, outcome: Outcome) {
  const note: AfterNote | null = outcome.message
    ? { ...outcome.message, via: outcome.via, note: outcome.note, marks: outcome.marks }
    : null
  await $.state.set(NOTE_REF, note)
}

// ── Drawing ────────────────────────────────────────────────────────────────────

async function openPane ($: Engine) {
  await $.state.set(PANE_OPEN_REF, true)
  await $.ui.open({ id: PANE, title: 'After', focus: true })
}

function statusLine (state: AfterQueue): string | undefined {
  if (state.items.length === 0 && !state.running) return undefined
  const count = state.items.length ? `${plural(state.items.length, 'task')} queued` : 'last queued task running'
  return `After · ${count}${state.paused ? ' · paused' : ''}`
}

/** The band above the prompt: what runs now and what comes next. */
async function drawBand ($: Engine, e: RenderOf<'AbovePrompt'>, next: Next<'AbovePrompt'>) {
  if (settings.display !== 'band' || e.props.hasSurvey) return next(e)
  const state = await read($, QUEUE)
  if (!state || (state.items.length === 0 && !state.running) || (await read($, PANE_OPEN))) return next(e)

  const { Box, Button, Text } = $.ui.resolve(e)
  const width = Math.max(20, e.props.bodyColumns)
  const head = state.paused
    ? { color: 'yellow', text: '⏸ paused' }
    : state.running
      ? { color: 'green', text: `▶ ${shorten(state.running.text, Math.max(12, width - 40))}` }
      : { color: undefined, text: state.busy ? '● waiting for Claude' : 'idle' }
  const upcoming = state.items.slice(0, 3).map((item, i) => `${i + 1} ${shorten(item.text, 40)}`)
  const more = state.items.length - upcoming.length

  return (
    <Box flexDirection="column">
      <Box flexDirection="row" gap={1}>
        <Text bold>After</Text>
        <Text dimColor>{state.items.length ? `${plural(state.items.length, 'task')} queued` : 'nothing else queued'}</Text>
        <Text color={head.color} dimColor={head.color === undefined} wrap="truncate-end">{head.text}</Text>
        <Button key="view" label="view" plain dimColor onPress={() => openPane($)} />
      </Box>
      {upcoming.length > 0 && (
        <Text dimColor wrap="truncate-end">
          {`next ${upcoming.join(' · ')}${more > 0 ? ` · +${more} more` : ''}`}
        </Text>
      )}
    </Box>
  )
}

/** The live view: every task, with buttons to reorder, edit and remove, and an input. */
async function drawPane ($: Engine, e: RenderOf<'Pane'>) {
  const elements = $.ui.resolve(e)
  const { Box, Button, Text } = elements
  const Input = 'Input' in elements ? elements.Input : undefined
  const state = (await read($, QUEUE)) ?? (createState({}) as AfterQueue)
  const note = await read($, NOTE)
  const draft = await read($, DRAFT)
  const status = describeStatus(state)
  const editing = draft.editId === null ? -1 : state.items.findIndex(item => item.id === draft.editId)
  const room = Math.max(20, e.props.bodyColumns - 14)
  const digits = String(state.items.length).length

  const move = (id: number, index: number) => runOps($, [{ type: 'move', id, where: { kind: 'index', index } }])

  return (
    <Box flexDirection="column">
      <Text color={COLOR[status.tone]} dimColor={status.tone === 'dim'}>{status.text}</Text>
      {state.done.slice(0, 3).reverse().map(task => (
        <Text key={`done-${task.id}`} dimColor wrap="truncate-end">
          {`  ${task.status === 'stopped' ? '■' : '✓'} ${shorten(task.text, room)}`}
        </Text>
      ))}
      {state.running && <Text color="green" wrap="truncate-end">{`  ▶ ${shorten(state.running.text, room)}`}</Text>}
      {state.items.length === 0 && <Text dimColor>  Nothing queued. Type a task below, or /after in the prompt.</Text>}
      {state.items.map((item, i) => {
        const mark = MARK_LABEL[note?.marks[String(item.id)] ?? '']
        return (
          <Box key={`row-${item.id}`} flexDirection="row" gap={1}>
            <Text color="cyan">{String(i + 1).padStart(digits + 1)}</Text>
            <Box flexGrow={1}>
              <Text wrap="truncate-end" bold={i === editing}>
                {`${shorten(item.text, room)}${mark ? `  ${mark}` : ''}`}
              </Text>
            </Box>
            <Button key={`up-${item.id}`} label="↑" plain dimColor onPress={() => i > 0 && move(item.id, i - 1)} />
            <Button key={`down-${item.id}`} label="↓" plain dimColor
              onPress={() => i < state.items.length - 1 && move(item.id, i + 1)} />
            {Input && (
              <Button key={`edit-${item.id}`} label="✎" plain dimColor
                onPress={() => update($, DRAFT, () => ({ text: item.text, editId: item.id }))} />
            )}
            <Button key={`rm-${item.id}`} label="✕" plain dimColor onPress={() => runOps($, [{ type: 'remove', ids: [item.id] }])} />
          </Box>
        )
      })}
      {Input && (
        <Input
          key="task"
          label={editing >= 0 ? `edit #${editing + 1}` : 'add'}
          placeholder="a task, or rm 2 · mv 3 1 · remove the tests one"
          value={draft.text}
          submitLabel={editing >= 0 ? 'save' : 'queue'}
          onSubmit={(value: string) => void submitDraft($, value, draft.editId).catch(error => debug($, error))}
        />
      )}
      <Box flexDirection="row" gap={1}>
        <Button key="pause" label={state.paused ? 'resume' : 'pause'} hotkey="p"
          onPress={() => runIntent($, state.paused ? 'resume' : 'pause')} />
        <Button key="undo" label="undo" hotkey="u" onPress={() => runIntent($, 'undo')} />
        {state.items.length > 0 && <Button key="clear" label="clear" onPress={() => runOps($, [{ type: 'clear' }])} />}
        {editing >= 0 && <Button key="cancel" label="cancel edit" onPress={() => update($, DRAFT, () => EMPTY_DRAFT)} />}
      </Box>
      {note && (
        <Text color={TONE[note.kind]} dimColor={note.kind === 'info'} wrap="truncate-end">
          {renderMessage(note, { via: note.via, note: note.note }).split('\n').slice(0, 2).join(' ')}
        </Text>
      )}
    </Box>
  )
}

/** Enter in the pane's input: save an edit, or run the text as an /after command. */
async function submitDraft ($: Engine, value: string, editId: number | null) {
  const text = value.trim()
  await update($, DRAFT, () => EMPTY_DRAFT)
  if (!text) return
  if (editId !== null) return runOps($, [{ type: 'edit', id: editId, text }])
  const typed = parsePrompt(text)
  const outcome = await runCommand($, (typed?.command ?? 'after') as Command, typed ? typed.args : text)
  if (outcome.kick || kickPending) startNext($)
}
