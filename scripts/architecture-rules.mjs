import { basename, dirname, resolve, relative } from 'node:path'
import { SyntaxKind as K, visit } from './typescript-ast.mjs'
const layers = {
  domain: ['domain'], platform: ['platform'], state: ['state', 'domain', 'platform'],
  application: ['application', 'state', 'domain', 'platform'],
  adapters: ['adapters', 'application', 'state', 'domain', 'platform'],
  diagnostics: ['diagnostics', 'domain'], ui: ['ui', 'diagnostics', 'application', 'state', 'domain', 'platform'],
}
const browserGlobals = new Set(['globalThis', 'self', 'window', 'document', 'location', 'history', 'navigator', 'unsafeWindow', 'console', 'process',
  'fetch', 'XMLHttpRequest', 'WebSocket', 'Worker', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval',
  'queueMicrotask', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance'])
const nameOf = node => node?.text ?? node?.escapedText ?? ''
export function inspectModule(source, root) {
  const file = resolve(source.fileName), layer = relative(root, file).split(/[\\/]/)[0]
  const dependencies = [], violations = [], entry = file === resolve(root, 'entry.ts')
  const addImport = (node, dynamic = false) => {
    if (!node || ![K.StringLiteral, K.NoSubstitutionTemplateLiteral].includes(node.kind)) {
      violations.push(`${file}: non-literal dynamic import`); return
    }
    const specifier = node.text
    if (!specifier.startsWith('.')) { violations.push(`${file}: runtime dependency ${specifier}`); return }
    const target = resolve(dirname(file), specifier), toLayer = relative(root, target).split(/[\\/]/)[0]
    dependencies.push(target)
    if (!entry && !layers[layer]?.includes(toLayer)) violations.push(`${file}: ${layer} -> ${toLayer}`)
    if (dynamic) violations.push(`${file}: dynamic runtime loading is not supported`)
  }
  visit(source, node => {
    if ((node.kind === K.ImportDeclaration || node.kind === K.ExportDeclaration) && node.moduleSpecifier) addImport(node.moduleSpecifier)
    if (node.kind === K.ImportType && node.argument?.literal) addImport(node.argument.literal)
    if (node.kind === K.ImportEqualsDeclaration) addImport(node.moduleReference?.expression)
    if (node.kind === K.CallExpression && node.expression.kind === K.ImportKeyword) addImport(node.arguments[0], true)
    if (node.kind === K.CallExpression && node.expression.kind === K.PropertyAccessExpression) {
      const method = nameOf(node.expression.name)
      if (method === 'setAffinity' && basename(file) !== 'route-coordinator.ts') violations.push(`${file}: only RouteCoordinator may change affinity`)
      if (layer === 'application' && method === 'reload' && basename(file) !== 'recovery-controller.ts') violations.push(`${file}: only RecoveryController may reload the player`)
      if (layer === 'ui' && ['set', 'delete', 'reset', 'invalidateForUserSetting', 'setOriginalComparison', 'blacklist', 'requestManual'].includes(method)
        && node.expression.expression.kind !== K.SuperKeyword && nameOf(node.expression.expression.name) !== 'commands') {
        violations.push(`${file}: UI mutations must use the command port (${method})`)
      }
    }
    if (['domain', 'application', 'ui'].includes(layer) && node.kind === K.Identifier) {
      const name = nameOf(node), parent = node.parent
      const property = parent?.kind === K.PropertyAccessExpression && parent.name === node
      const member = [K.PropertySignature, K.MethodSignature, K.PropertyAssignment].includes(parent?.kind) && parent.name === node
      const forbidden = layer === 'ui' ? ['GM_getValue', 'GM_setValue', 'GM_deleteValue'].includes(name) : browserGlobals.has(name) || name.startsWith('GM_')
      if (!property && !member && forbidden) violations.push(`${file}: ${layer} reads forbidden global ${name}`)
      if (layer !== 'ui') {
        if (name === 'Date' && parent?.kind === K.PropertyAccessExpression && nameOf(parent.name) === 'now') violations.push(`${file}: ${layer} reads Date.now`)
        if (name === 'Date' && parent?.kind === K.NewExpression && !parent.arguments?.length) violations.push(`${file}: ${layer} reads current Date`)
        if (name === 'Math' && parent?.kind === K.PropertyAccessExpression && nameOf(parent.name) === 'random') violations.push(`${file}: ${layer} reads Math.random`)
      }
    }
  })
  return { file, dependencies, violations }
}
export function validateGraph(modules) {
  const graph = new Map(modules.map(row => [row.file, row.dependencies]))
  const violations = modules.flatMap(row => row.violations), visiting = new Set(), visited = new Set()
  const walk = (file, stack = []) => {
    if (visiting.has(file)) throw Error(`Import cycle: ${[...stack, file].join(' -> ')}`)
    if (visited.has(file)) return
    visiting.add(file)
    for (const target of graph.get(file) ?? []) if (graph.has(target)) walk(target, [...stack, file])
    visiting.delete(file); visited.add(file)
  }
  if (violations.length) throw Error(violations.join('\n'))
  for (const file of graph.keys()) walk(file)
}
