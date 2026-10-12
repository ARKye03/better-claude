// Mod tests, run against the engine itself: `claude plugin test .`
import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

const USAGE = { input_tokens: 1200, output_tokens: 340, cache_read_input_tokens: 4100, cache_creation_input_tokens: 0, model: 'claude-sonnet-5-5' }

/** What sits beneath the mod: the status lines it draws. */
function world (on: On) {
  const status: string[] = []
  on('turn.complete', ($, e) => ({ text: e.answer }))
  on('ui.status', ($, e) => {
    if (e.text !== undefined) status.push(e.text)
    return { value: undefined }
  })
  return { status }
}

const turnEnd = ($: Engine, usage?: typeof USAGE) =>
  $.turn.complete({ answer: '', durationMs: 1, isAborted: false, turnId: 't1', reason: 'answer', usage })

test('a finished turn shows its tokens in the status line', async ($, on) => {
  const w = world(on)
  await turnEnd($, USAGE)
  expect(w.status).toEqual(['↑ 1.2k  ↓ 340  cache 4.1k  ·  session ↑ 1.2k  ↓ 340'])
})

test('the session total adds up across turns', async ($, on) => {
  const w = world(on)
  await turnEnd($, USAGE)
  await turnEnd($, { ...USAGE, input_tokens: 800, output_tokens: 60, cache_read_input_tokens: 0 })
  expect(w.status.at(-1)).toBe('↑ 800  ↓ 60  cache 0  ·  session ↑ 2.0k  ↓ 400')
})

test('a turn without usage leaves the status line alone', async ($, on) => {
  const w = world(on)
  await turnEnd($)
  expect(w.status).toEqual([])
})
