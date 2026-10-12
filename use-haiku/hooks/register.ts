import type { Register } from 'claude-code'

const MARK = '_'
const HAIKU = 'claude-haiku-5-5'

// Set by the prompt that starts the turn, cleared when the turn ends.
let haikuTurn = false

export const register: Register = on => {
  on('prompt.submit', ($, e, next) => {
    haikuTurn = e.text.startsWith(MARK)
    return next(haikuTurn ? { ...e, text: e.text.slice(MARK.length).trimStart() } : e)
  })

  on('turn.complete', ($, e, next) => {
    haikuTurn = false
    return next(e)
  })

  // Every model request of a marked turn, the main loop's and its subagents', goes to Haiku.
  on('turn.step', async function* ($, e, next) {
    return yield* next(haikuTurn ? { ...e, model: HAIKU } : e)
  })
}
