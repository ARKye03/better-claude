// Mod tests, run against the engine itself: `claude plugin test .`
import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

const HAIKU = 'claude-haiku-5-5'

/** What sits beneath the mod: the prompts that reach Claude and the model each request names. */
function world (on: On) {
  const prompts: string[] = []
  const models: string[] = []
  on('prompt.submit', ($, e) => {
    prompts.push(e.text)
    return { text: e.text }
  })
  on('turn.complete', ($, e) => ({ text: e.answer }))
  on('turn.step', async function* ($, e) {
    models.push(e.model)
    return { turnId: e.turnId, index: e.index, answer: 'ok', toolUses: [] } as never
  })
  return { prompts, models }
}

const step = async ($: Engine, index: number) => {
  for await (const _ of $.turn.step({ turnId: 't1', index, model: 'claude-sonnet-5-5', messageCount: 1 })) void _
}

test('a prompt that starts with _ is sent without the mark and runs on Haiku', async ($, on) => {
  const w = world(on)
  await $.prompt.submit({ text: '_summarize the diff' })
  await step($, 0)
  expect(w.prompts).toEqual(['summarize the diff'])
  expect(w.models).toEqual([HAIKU])
})

test('a prompt without the mark keeps the session model', async ($, on) => {
  const w = world(on)
  await $.prompt.submit({ text: 'summarize the diff' })
  await step($, 0)
  expect(w.prompts).toEqual(['summarize the diff'])
  expect(w.models).toEqual(['claude-sonnet-5-5'])
})

test('the next turn goes back to the session model once a marked turn ends', async ($, on) => {
  const w = world(on)
  await $.prompt.submit({ text: '_quick question' })
  await $.turn.complete({ answer: '', durationMs: 1, isAborted: false, turnId: 't1', reason: 'answer' })
  await $.prompt.submit({ text: 'longer question' })
  await step($, 0)
  expect(w.models).toEqual(['claude-sonnet-5-5'])
})
