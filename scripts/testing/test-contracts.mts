import { writeFileSync } from 'node:fs'
import { resolve, join, dirname } from 'node:path'
import { withProjectAst, visit, SyntaxKind } from '../lib/typescript-ast.mts'
import {
  type Node,
  isImportDeclaration,
  isStringLiteral,
  isNamedImports,
  isNamespaceImport,
  isCallExpression,
  isElementAccessExpression,
  isPropertyAccessExpression,
  isIdentifier,
  isObjectLiteralExpression,
  isExportDeclaration,
} from 'typescript/unstable/ast'

const testExports = new Set(['test', 'it', 'describe', 'suite'])

function staticMember(node: Node) {
  if (isPropertyAccessExpression(node)) return { base: node.expression, name: node.name.text }
  if (isElementAccessExpression(node) && isStringLiteral(node.argumentExpression))
    return { base: node.expression, name: node.argumentExpression.text }
  return null
}

// Catch accidental focused runs and Node's synthetic "empty file passed" result.
// Inspect syntax; strings/comments containing sample tests are not registrations.
export function validateTestDefinitions(source: string, scratch: string): void {
  const file = resolve(source),
    config = join(scratch, 'definitions.json')
  writeFileSync(
    config,
    JSON.stringify({
      compilerOptions: { noLib: true, noEmit: true, allowJs: true },
      files: [file],
    }),
  )
  withProjectAst(config, (program) => {
    const pending = [file],
      seen = new Set<string>()
    let registered = 0
    while (pending.length) {
      const current = pending.shift()!
      if (seen.has(current)) continue
      seen.add(current)
      const ast = program.getSourceFile(current)
      if (!ast) throw Error(`Cannot read test source: ${current}`)
      const names = new Set<string>()
      const namespaces = new Set<string>()
      for (const node of ast.statements) {
        if (
          isImportDeclaration(node) &&
          isStringLiteral(node.moduleSpecifier) &&
          node.moduleSpecifier.text.startsWith('.')
        ) {
          const clause = node.importClause,
            bindings = clause?.namedBindings
          const runtime =
            !clause ||
            (clause.phaseModifier !== SyntaxKind.TypeKeyword &&
              (!!clause.name ||
                !bindings ||
                !isNamedImports(bindings) ||
                !bindings.elements.length ||
                bindings.elements.some((member) => !member.isTypeOnly)))
          if (runtime) pending.push(resolve(dirname(current), node.moduleSpecifier.text))
        }
        if (
          isExportDeclaration(node) &&
          node.moduleSpecifier &&
          isStringLiteral(node.moduleSpecifier) &&
          node.moduleSpecifier.text.startsWith('.') &&
          !node.isTypeOnly &&
          (!node.exportClause ||
            !('elements' in node.exportClause) ||
            !node.exportClause.elements.length ||
            node.exportClause.elements.some((member) => !member.isTypeOnly))
        )
          pending.push(resolve(dirname(current), node.moduleSpecifier.text))
        if (
          !isImportDeclaration(node) ||
          !isStringLiteral(node.moduleSpecifier) ||
          node.moduleSpecifier.text !== 'node:test'
        )
          continue
        const clause = node.importClause
        if (clause?.phaseModifier === SyntaxKind.TypeKeyword) continue
        if (clause?.name) names.add(clause.name.text)
        const bindings = clause?.namedBindings
        if (bindings && isNamespaceImport(bindings)) namespaces.add(bindings.name.text)
        for (const member of bindings && isNamedImports(bindings) ? bindings.elements : []) {
          if (!member.isTypeOnly && testExports.has(member.propertyName?.text ?? member.name.text))
            names.add(member.name.text)
        }
      }
      function isRegistration(target: Node): boolean {
        if (isIdentifier(target)) return names.has(target.text)
        const member = staticMember(target)
        return (
          member !== null &&
          isIdentifier(member.base) &&
          ((namespaces.has(member.base.text) &&
            (testExports.has(member.name) || member.name === 'default')) ||
            (names.has(member.base.text) && testExports.has(member.name)))
        )
      }
      visit(ast, (node) => {
        if (!isCallExpression(node)) return
        const call = node.expression
        const member = staticMember(call)
        if (member?.name === 'only' && isRegistration(member.base))
          throw Error('Focused test registration (only) is forbidden')
        if (!isRegistration(call)) return
        registered++
        const options = node.arguments[1]
        if (
          options &&
          isObjectLiteralExpression(options) &&
          options.properties.some(
            (property) =>
              'name' in property &&
              property.name &&
              (isIdentifier(property.name) || isStringLiteral(property.name)) &&
              property.name.text === 'only',
          )
        )
          throw Error('Focused test option (only) is forbidden')
      })
    }
    if (!registered) throw Error('Suite registered no named cases')
  })
}
