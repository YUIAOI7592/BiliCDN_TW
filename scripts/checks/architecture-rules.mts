import { dirname, resolve, relative } from 'node:path'
import { SyntaxKind as K, visit } from '../lib/typescript-ast.mts'
import {
  isCallExpression,
  isExportDeclaration,
  isExternalModuleReference,
  isIdentifier,
  isImportDeclaration,
  isImportEqualsDeclaration,
  isImportTypeNode,
  isLiteralTypeNode,
  isMethodSignatureDeclaration,
  isNewExpression,
  isNoSubstitutionTemplateLiteral,
  isPropertyAccessExpression,
  isPropertyAssignment,
  isPropertySignatureDeclaration,
  isStringLiteral,
} from 'typescript/unstable/ast'
import type { Node, SourceFile } from 'typescript/unstable/ast'
export interface ModuleInspection {
  file: string
  dependencies: string[]
  violations: string[]
}
const layers: Record<string, readonly string[]> = {
  domain: ['domain'],
  platform: ['platform'],
  state: ['state', 'domain', 'platform'],
  application: ['application', 'state', 'domain', 'platform'],
  adapters: ['adapters', 'application', 'state', 'domain', 'platform'],
  ui: ['ui', 'application', 'state', 'domain', 'platform'],
}
// Feature groups expose owners and shared contracts, never private implementation helpers.
const featureBoundaries = [
  {
    prefix: 'application/routing/',
    publicFiles: [
      'route-coordinator.ts',
      'route-contracts.ts',
      'early-retry-controller.ts',
      'early-retry-contracts.ts',
    ],
  },
  { prefix: 'adapters/player/', publicFiles: ['player.ts'] },
  {
    prefix: 'application/measurement/',
    publicFiles: ['measurement-controller.ts', 'measurement-contracts.ts'],
  },
  { prefix: 'adapters/transport/', publicFiles: ['transport.ts', 'range-probe.ts'] },
] as const
const browserGlobals = new Set([
  'globalThis',
  'self',
  'window',
  'document',
  'location',
  'history',
  'navigator',
  'unsafeWindow',
  'console',
  'process',
  'fetch',
  'XMLHttpRequest',
  'WebSocket',
  'Worker',
  'setTimeout',
  'setInterval',
  'clearTimeout',
  'clearInterval',
  'queueMicrotask',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'performance',
])
const bookkeeping = new Set([
  'application/routing/request-ownership.ts',
  'application/routing/retry-permit-state.ts',
])
const nameOf = (node: Node | undefined): string =>
  node && 'text' in node && typeof node.text === 'string'
    ? node.text
    : node && 'escapedText' in node && typeof node.escapedText === 'string'
      ? node.escapedText
      : ''
const modulePath = (root: string, file: string): string =>
  relative(root, file).replaceAll('\\', '/')
const isContractModule = (path: string): boolean =>
  /(?:^|\/)[^/]+-(?:ports|model|contracts)\.ts$/.test(path) ||
  [
    'domain/model.ts',
    'application/ports.ts',
    'platform/storage-port.ts',
    'platform/runtime-id-port.ts',
  ].includes(path)
export function inspectModule(source: SourceFile, root: string): ModuleInspection {
  const file = resolve(source.fileName),
    path = modulePath(root, file),
    layer = path.split('/')[0]!
  const dependencies: string[] = [],
    violations: string[] = [],
    entry = file === resolve(root, 'entry.ts')
  const addImport = (node: Node | undefined, dynamic = false) => {
    if (!node || !(isStringLiteral(node) || isNoSubstitutionTemplateLiteral(node))) {
      violations.push(`${file}: non-literal dynamic import`)
      return
    }
    const specifier = node.text
    if (!specifier.startsWith('.')) {
      violations.push(`${file}: runtime dependency ${specifier}`)
      return
    }
    const target = resolve(dirname(file), specifier),
      targetPath = modulePath(root, target),
      toLayer = targetPath.split('/')[0]
    dependencies.push(target)
    if (bookkeeping.has(targetPath) && path !== 'application/routing/route-coordinator.ts')
      violations.push(`${file}: private bookkeeping belongs to RouteCoordinator`)
    if (
      bookkeeping.has(path) &&
      toLayer !== 'domain' &&
      ![
        'application/routing/route-contracts.ts',
        'application/routing/early-retry-contracts.ts',
      ].includes(targetPath)
    )
      violations.push(`${file}: private bookkeeping cannot import capabilities ${targetPath}`)
    for (const feature of featureBoundaries)
      if (
        targetPath.startsWith(feature.prefix) &&
        !path.startsWith(feature.prefix) &&
        !(feature.publicFiles as readonly string[]).includes(
          targetPath.slice(feature.prefix.length),
        )
      )
        violations.push(`${file}: feature-private implementation ${targetPath}`)
    if (!entry && !layers[layer]?.includes(toLayer!))
      violations.push(`${file}: ${layer} -> ${toLayer}`)
    if (isContractModule(path) && toLayer !== 'domain' && !isContractModule(targetPath))
      violations.push(`${file}: contract modules must not import implementation ${targetPath}`)
    if (dynamic) violations.push(`${file}: dynamic runtime loading is not supported`)
  }
  visit(source, (node) => {
    if ((isImportDeclaration(node) || isExportDeclaration(node)) && node.moduleSpecifier)
      addImport(node.moduleSpecifier)
    if (isImportTypeNode(node) && isLiteralTypeNode(node.argument)) addImport(node.argument.literal)
    if (isImportEqualsDeclaration(node))
      addImport(
        isExternalModuleReference(node.moduleReference)
          ? node.moduleReference.expression
          : undefined,
      )
    if (isCallExpression(node) && node.expression.kind === K.ImportKeyword)
      addImport(node.arguments[0], true)
    if (isCallExpression(node) && isPropertyAccessExpression(node.expression)) {
      const method = nameOf(node.expression.name)
      if (method === 'setAffinity' && path !== 'application/routing/route-coordinator.ts')
        violations.push(`${file}: only RouteCoordinator may change affinity`)
      if (
        layer === 'application' &&
        method === 'reload' &&
        path !== 'application/playback/recovery-controller.ts'
      )
        violations.push(`${file}: only RecoveryController may reload the player`)
      const receiver = node.expression.expression
      const receiverName = isPropertyAccessExpression(receiver)
        ? nameOf(receiver.name)
        : nameOf(receiver)
      if (
        bookkeeping.has(path) &&
        [
          'session',
          'vault',
          'storage',
          'evidence',
          'settings',
          'clock',
          'probe',
          'player',
        ].includes(receiverName)
      )
        violations.push(`${file}: private bookkeeping cannot access ${receiverName}`)
      if (
        method === 'read' &&
        receiverName === 'probe' &&
        path !== 'application/measurement/measurement-controller.ts'
      )
        violations.push(`${file}: only MeasurementController may start active probes`)
      if (
        layer === 'ui' &&
        [
          'set',
          'delete',
          'reset',
          'invalidateForUserSetting',
          'blacklist',
          'requestManual',
        ].includes(method) &&
        node.expression.expression.kind !== K.SuperKeyword &&
        nameOf(
          isPropertyAccessExpression(node.expression.expression)
            ? node.expression.expression.name
            : undefined,
        ) !== 'commands'
      ) {
        violations.push(`${file}: UI mutations must use the command port (${method})`)
      }
    }
    if (['domain', 'application', 'ui'].includes(layer) && isIdentifier(node)) {
      const name = nameOf(node),
        parent = node.parent
      const property = parent && isPropertyAccessExpression(parent) && parent.name === node
      const member =
        parent &&
        (isPropertySignatureDeclaration(parent) ||
          isMethodSignatureDeclaration(parent) ||
          isPropertyAssignment(parent)) &&
        parent.name === node
      const forbidden =
        layer === 'ui'
          ? ['GM_getValue', 'GM_setValue', 'GM_deleteValue'].includes(name)
          : browserGlobals.has(name) || name.startsWith('GM_')
      if (!property && !member && forbidden)
        violations.push(`${file}: ${layer} reads forbidden global ${name}`)
      if (layer !== 'ui') {
        if (
          name === 'Date' &&
          parent &&
          isPropertyAccessExpression(parent) &&
          nameOf(parent.name) === 'now'
        )
          violations.push(`${file}: ${layer} reads Date.now`)
        if (name === 'Date' && parent && isNewExpression(parent) && !parent.arguments?.length)
          violations.push(`${file}: ${layer} reads current Date`)
        if (
          name === 'Math' &&
          parent &&
          isPropertyAccessExpression(parent) &&
          nameOf(parent.name) === 'random'
        )
          violations.push(`${file}: ${layer} reads Math.random`)
      }
    }
  })
  return { file, dependencies, violations }
}
export function validateGraph(modules: readonly ModuleInspection[]): void {
  const graph = new Map(modules.map((row) => [row.file, row.dependencies]))
  const violations = modules.flatMap((row) => row.violations),
    visiting = new Set<string>(),
    visited = new Set<string>()
  const walk = (file: string, stack: readonly string[] = []): void => {
    if (visiting.has(file)) throw Error(`Import cycle: ${[...stack, file].join(' -> ')}`)
    if (visited.has(file)) return
    visiting.add(file)
    for (const target of graph.get(file) ?? [])
      if (graph.has(target)) walk(target, [...stack, file])
    visiting.delete(file)
    visited.add(file)
  }
  if (violations.length) throw Error(violations.join('\n'))
  for (const file of graph.keys()) walk(file)
}
