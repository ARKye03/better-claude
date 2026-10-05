import { defaultOps, needsSmart, resolveHeuristically, trimConnector } from './heuristics.js'
import { SYSTEM, buildUserMessage, parseReply, parseResponse } from './protocol.js'

/**
 * Builds the model-backed resolver from `complete({ system, prompt })`, any function that
 * resolves to the model's reply text (or null). The mod passes one over `$.model.complete`
 * (the session's own client: no API key, no subprocess); the eval script one over `claude -p`.
 */
export function createModelResolver (complete) {
  return async ({ command, text, items, started = [] }) => {
    const reply = await complete({ system: SYSTEM, prompt: buildUserMessage({ command, text, items, started }) })
    const response = parseReply(reply)
    const ops = parseResponse(response, items)
    return ops ? { ops, note: typeof response.note === 'string' ? response.note.trim() : '' } : null
  }
}

/** Whether resolving this text may need the model (so callers can mark the work as slow). */
export const isSmartCandidate = (text, items, started = []) => needsSmart(text, items, started)

/** The running task and a few recently finished ones, newest first. */
export const startedTasks = (state) => [
  ...(state.running ? [{ ...state.running, status: 'running' }] : []),
  ...state.done.slice(0, 5)
]

const isDefaultAdd = (ops, command, text) =>
  ops.length === 1 && ops[0].type === 'add' && ops[0].text === text.trim() &&
  ops[0].where.kind === (command === 'before' ? 'start' : 'end')

/** Relative adds should not start with the connector that followed the reference. */
const tidy = (ops) => ops.map(op => op.type === 'add' && (op.where.kind === 'after' || op.where.kind === 'before')
  ? { ...op, text: trimConnector(op.text) }
  : op)

/**
 * Turns natural language into queue operations.
 * Plain tasks are added instantly; only text that may refer to queued (or already started)
 * tasks reaches Haiku, and local heuristics take over when Haiku is disabled or fails.
 * Resolves to { ops, via: 'haiku' | 'heuristics' | null, note? }; `via` is null when the
 * result is simply "add the text", so the UI has nothing to explain.
 */
export async function resolveSmart ({ command, text, items, started = [], resolver }) {
  if (!needsSmart(text, items, started)) return { ops: defaultOps(command, text), via: null }
  const local = resolveHeuristically({ command, text, items, started })
  const answer = resolver ? await resolver({ command, text, items, started }).catch(() => null) : null
  if (!answer) return local

  if (isDefaultAdd(answer.ops, command, text)) {
    // Haiku read it as a plain task, but a clear local match says it is about the queue:
    // trust the match ("remove the beta one" must never become a task)
    return local.via ? local : { ops: answer.ops, via: null }
  }
  return { ...answer, ops: tidy(answer.ops), via: 'haiku' }
}
