export const suites = Object.freeze([
  { name: 'architecture', source: 'scripts/architecture-tests.mjs' },
  { name: 'imports', source: 'tests-v2/imports.ts' },
  ...['domain-boundaries', 'domain', 'state', 'application', 'diagnostics', 'adapters', 'native-routing',
    'native-transport', 'orchestration', 'adapter-boundaries', 'measurement-state', 'progressive-playurl',
    'progressive-routing', 'progressive-transport', 'playurl-summary', 'control-center'].map(name => ({ name,
    source: name === 'domain-boundaries' ? `tests-v2/${name}.ts` : `tests-v2/suites/${name}.ts` })),
  { name: 'tooling', source: 'tests-v2/tooling.ts' },
].map(Object.freeze))

export class UsageError extends Error { exitCode = 2 }
export function selection(filter = '') {
  const name = filter.replace(/^suites\//, '')
  const selected = suites.filter(row => !name || row.name === name)
  if (!selected.length) throw new UsageError(`Unknown test suite: ${filter}`)
  return selected
}
export function parseArgs(args) {
  let filter = '', name = '', list = false, hasFilter = false, hasName = false
  for (let i = 0; i < args.length; i++) {
    const value = args[i]
    if (value === '--list' && !list) list = true
    else if (value === '--name' && !hasName && args[i + 1] !== undefined) { name = args[++i]; hasName = true }
    else if (!value.startsWith('-') && !hasFilter) { filter = value; hasFilter = true }
    else throw new UsageError(`Unknown or incomplete argument: ${value}`)
  }
  if (list && (hasFilter || hasName)) throw new UsageError('--list cannot be combined with a suite or --name')
  if (hasName) { try { new RegExp(name) } catch { throw new UsageError(`Invalid case expression: ${name}`) } }
  selection(filter)
  return { filter, name: hasName ? name : undefined, list }
}
