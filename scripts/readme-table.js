// Regenerates the plugin table in README.md from each plugins/*/.claude-plugin/plugin.json.
// --check: exit 1 when the table was out of date (it is still rewritten).
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const readmePath = join(root, 'README.md')
const START = '<!-- plugins:start -->'
const END = '<!-- plugins:end -->'

const fail = (message) => {
  console.error(message)
  process.exit(1)
}

// A plugin is on the web when web/index.html has a picker button for it that is not hidden.
const onWeb = new Set(
  [...readFileSync(join(root, 'web', 'index.html'), 'utf8').matchAll(/<li>\s*<button[^>]*\bdata-plugin="([^"]+)"/g)].map((m) => m[1])
)

const title = (name) => name.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ')

// Plain-text descriptions get inline code for slash commands, [placeholders], <args> and lone +/_ prefixes.
const format = (text) =>
  text
    .replace(/\|/g, '\\|')
    .replace(/(^|\s)(\/[a-z][\w-]*(?: <[^>]+>)*|\[[^\]]+\](?!\()|<[^>]+>|[+_](?=\s))/g, '$1`$2`')

const plugins = readdirSync(join(root, 'plugins'), { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(join(root, 'plugins', d.name, '.claude-plugin', 'plugin.json')))
  .map((d) => d.name)
  .sort()
  .map((name) => {
    const { description } = JSON.parse(readFileSync(join(root, 'plugins', name, '.claude-plugin', 'plugin.json'), 'utf8'))
    if (typeof description !== 'string' || !description) fail(`plugins/${name}/.claude-plugin/plugin.json has no description.`)
    return { name, row: `| **${title(name)}** | ${format(description)} | [\`plugins/${name}/\`](plugins/${name}/README.md) |` }
  })

const visible = plugins.filter((p) => onWeb.has(p.name)).map((p) => p.row)
const hidden = plugins.filter((p) => !onWeb.has(p.name)).map((p) => p.row)

const readme = readFileSync(readmePath, 'utf8')
const eol = readme.includes('\r\n') ? '\r\n' : '\n'
const table = [
  START,
  '| Plugin | What it does | Folder |',
  '| --- | --- | --- |',
  ...visible,
  ...(hidden.length ? ['', '<!-- Hidden until they are on the web:', ...hidden, '-->'] : []),
  END
].join(eol)

const start = readme.indexOf(START)
const end = readme.indexOf(END, start)
if (start === -1 || end === -1) fail(`README.md needs ${START} and ${END}, in that order, around the plugin table.`)

const next = readme.slice(0, start) + table + readme.slice(end + END.length)
if (next !== readme) {
  writeFileSync(readmePath, next)
  if (process.argv.includes('--check')) fail('README.md plugin table was out of date and has been regenerated. Commit it, then push again.')
}
