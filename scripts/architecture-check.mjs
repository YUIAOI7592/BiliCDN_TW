import { readFileSync } from 'node:fs'
import { dirname, normalize, relative, resolve } from 'node:path'
import { filesUnder } from './lib.mjs'

const root = resolve('src-v2')
const files = filesUnder('src-v2').filter(file => file.endsWith('.ts'))
const layer = file => relative(root, resolve(file)).split(/[\\/]/)[0]
const allowed = {
  domain: new Set(['domain']),
  platform: new Set(['platform']),
  state: new Set(['state', 'domain', 'platform']),
  application: new Set(['application', 'state', 'domain', 'platform']),
  adapters: new Set(['adapters', 'application', 'state', 'domain', 'platform']),
  diagnostics: new Set(['diagnostics', 'domain']),
  ui: new Set(['ui', 'diagnostics', 'application', 'state', 'domain', 'platform']),
}
const graph = new Map(files.map(file => [normalize(file), []]))
for (const file of files) {
  if (file.endsWith('entry.ts') || file.endsWith('globals.d.ts')) continue
  const source = readFileSync(file, 'utf8')
  for (const match of source.matchAll(/(?:import|export)\s+(?:type\s+)?(?:[^'";]+?\s+from\s+)?['"]([^'"]+)['"]/g)) {
    const specifier = match[1]
    if (!specifier?.startsWith('.')) continue
    const target = normalize(resolve(dirname(file), specifier))
    const targetRelative = normalize(relative(process.cwd(), target))
    const fromLayer = layer(file), toLayer = layer(targetRelative)
    if (!allowed[fromLayer]?.has(toLayer)) throw Error(`Architecture violation: ${file} (${fromLayer}) -> ${targetRelative} (${toLayer})`)
    graph.get(normalize(file))?.push(targetRelative)
  }
}
const visiting = new Set(), visited = new Set()
const walk = (file, stack = []) => {
  if (visiting.has(file)) throw Error(`Import cycle: ${[...stack, file].join(' -> ')}`)
  if (visited.has(file)) return
  visiting.add(file)
  for (const target of graph.get(file) ?? []) if (graph.has(target)) walk(target, [...stack, file])
  visiting.delete(file); visited.add(file)
}
for (const file of graph.keys()) walk(file)
console.log(`Architecture boundaries passed for ${files.length} TypeScript modules; no import cycles.`)
