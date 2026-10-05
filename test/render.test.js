import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { applyIntent } from '../src/commands/apply.js'
import { markIdle, takeNext } from '../src/core/queue.js'
import { describeStatus, renderHelp, renderMessage, renderQueue, renderResponse } from '../src/ui/render.js'
import { seed } from './helpers.js'

describe('renderQueue', () => {
  test('shows an empty queue', () => {
    assert.match(renderQueue(seed([])), /^┌ After · queue empty\n└ /)
  })

  test('shows finished, running and pending tasks in order', () => {
    let state = seed(['done task', 'running task', 'next task', 'later task'])
    state = markIdle(takeNext(state).state)
    state = takeNext(state).state
    const lines = renderQueue(state, { marks: { 3: 'new' } }).split('\n')
    assert.equal(lines[0], '┌ After · 2 tasks queued · ▶ running')
    assert.equal(lines[1], '│ ✓ done task')
    assert.equal(lines[2], '│ ▶ running task')
    assert.equal(lines[3], '│ 1 next task  ← new')
    assert.equal(lines[4], '│ 2 later task')
  })

  test('flags a paused queue and truncates long tasks', () => {
    const state = { ...seed(['x'.repeat(200)]), paused: true }
    const output = renderQueue(state, { width: 40 })
    assert.match(output, /⏸ paused/)
    assert.ok(output.split('\n')[1].length <= 40)
    assert.match(output, /…/)
  })

  test('only uses ANSI colors when asked', () => {
    assert.doesNotMatch(renderQueue(seed(['a'])), /\x1b\[/)
    assert.match(renderQueue(seed(['a']), { color: true }), /\x1b\[/)
  })
})

describe('renderResponse', () => {
  test('confirms, announces an idle start and shows the queue', () => {
    const outcome = applyIntent(seed([]), { type: 'add', text: 'add tests', where: { kind: 'end' } })
    const output = renderResponse(outcome, { idle: true })
    assert.match(output, /^✓ Queued #1 · add tests/)
    assert.match(output, /▶ Claude is idle · starting add tests now/)
    assert.match(output, /│ 1 add tests {2}← new/)
  })

  test('does not announce a start when paused', () => {
    const paused = { ...seed([]), paused: true }
    const outcome = applyIntent(paused, { type: 'add', text: 'x', where: { kind: 'end' } })
    assert.doesNotMatch(renderResponse(outcome, { idle: true }), /starting/)
  })

  test('shows help and confirms the live view', () => {
    assert.match(renderResponse(applyIntent(seed([]), { type: 'help' })), /\/before <task>/)
    assert.match(renderResponse(applyIntent(seed([]), { type: 'watch' })), /^Opened the live view/)
  })

  test('credits Haiku with its note', () => {
    assert.equal(renderMessage({ kind: 'ok', text: 'Removed “a”' }, { via: 'haiku', note: 'it was the tests task' }),
      '✓ Removed “a”\n  ✦ Haiku: it was the tests task')
    assert.equal(renderMessage(null), '')
  })

  test('help documents every command', () => {
    for (const word of ['rm', 'edit', 'mv', 'pause', 'resume', 'undo', 'clear', 'watch', '--']) {
      assert.ok(renderHelp().includes(word), word)
    }
  })
})

describe('describeStatus', () => {
  test('says what the queue will do next', () => {
    assert.match(describeStatus({ ...seed(['a']), paused: true }).text, /paused/)
    assert.match(describeStatus(takeNext(seed(['a'])).state).text, /working on a queued task/)
    assert.match(describeStatus({ ...seed(['a']), busy: true }).text, /run when it finishes/)
    assert.match(describeStatus(seed([])).text, /nothing queued/)
    assert.match(describeStatus(seed(['a'])).text, /\/after go/)
  })
})

describe('renderResponse with a live band', () => {
  test('leaves the queue out unless the command only asked to see it', () => {
    const added = applyIntent(seed([]), { type: 'add', text: 'add tests', where: { kind: 'end' } })
    assert.doesNotMatch(renderResponse(added, { showQueue: false }), /┌ After/)
    assert.match(renderResponse(applyIntent(seed(['a']), { type: 'show' }), { showQueue: false }), /┌ After · 1 task queued/)
    assert.doesNotMatch(renderResponse(applyIntent(seed(['a']), { type: 'help' }), { showQueue: false }), /┌ After/)
  })
})
