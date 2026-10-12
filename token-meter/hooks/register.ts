import type { Register } from 'claude-code'

// Running totals for the session, kept by the module (a reload starts them over).
let session = { input: 0, output: 0, cached: 0 }

const short = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`)

export const register: Register = on => {
  on('session.start', ($, e, next) => {
    session = { input: 0, output: 0, cached: 0 }
    return next(e)
  })

  on('turn.complete', ($, e, next) => {
    const usage = e.usage
    if (usage) {
      const cached = usage.cache_read_input_tokens + usage.cache_creation_input_tokens
      session = {
        input: session.input + usage.input_tokens,
        output: session.output + usage.output_tokens,
        cached: session.cached + cached
      }
      $.ui.status(
        `↑ ${short(usage.input_tokens)}  ↓ ${short(usage.output_tokens)}  cache ${short(cached)}` +
          `  ·  session ↑ ${short(session.input)}  ↓ ${short(session.output)}`
      )
    }
    return next(e)
  })
}
