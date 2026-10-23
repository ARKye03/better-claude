// Regenerates the plugin table in README.md from each plugins/*/.claude-plugin/plugin.json.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('..', import.meta.url).pathname
const readmePath = join(root, 'README.md')
const START = '<!-- plugins:start -->'
const END = '<!-- plugins:end -->'

// Not on the web yet: listed only inside an HTML comment.
const HIDDEN = new Set(['after', 'use-haiku', 'think-hard', 'token-meter'])

const title = (name) => name.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ')

// Plain-text descriptions get inline code for slash commands, [placeholders] and <args>.
const format = (text) =>
  text
    .replace(/\|/g, '\\|')
    .replace(/(^|\s)(\/[a-z][\w-]*(?: <[^>]+>)*|\[[^\]]+\]|<[^>]+>)/g, '$1`$2`')

const plugins = readdirSync(join(root, 'plugins'), { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort()
  .map((name) => {
    const manifest = JSON.parse(readFileSync(join(root, 'plugins', name, '.claude-plugin', 'plugin.json'), 'utf8'))
    return { name, row: `| **${title(name)}** | ${format(manifest.description)} | [\`plugins/${name}/\`](plugins/${name}/README.md) |` }
  })

const visible = plugins.filter((p) => !HIDDEN.has(p.name)).map((p) => p.row)
const hidden = plugins.filter((p) => HIDDEN.has(p.name)).map((p) => p.row)

const table = [
  START,
  '| Plugin | What it does | Folder |',
  '| --- | --- | --- |',
  ...visible,
  ...(hidden.length ? ['', '<!-- Hidden until they are on the web:', ...hidden, '-->'] : []),
  END
].join('\n')

const readme = readFileSync(readmePath, 'utf8')
const start = readme.indexOf(START)
const end = readme.indexOf(END)
if (start === -1 || end === -1) {
  console.error(`README.md needs ${START} and ${END} around the plugin table.`)
  process.exit(1)
}

const next = readme.slice(0, start) + table + readme.slice(end + END.length)
if (next !== readme) writeFileSync(readmePath, next)
