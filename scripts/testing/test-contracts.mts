import { writeFileSync } from 'node:fs'
import { resolve, join, dirname } from 'node:path'
import { withProjectAst, visit, SyntaxKind } from '../lib/typescript-ast.mts'
import {
  isImportDeclaration,
  isStringLiteral,
  isNamedImports,
  isCallExpression,
  isPropertyAccessExpression,
  isIdentifier,
  isObjectLiteralExpression,
  isExportDeclaration,
} from 'typescript/unstable/ast'

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
        if (node.importClause?.name) names.add(node.importClause.name.text)
        const bindings = node.importClause?.namedBindings
        for (const member of bindings && isNamedImports(bindings) ? bindings.elements : []) {
          if (['test', 'it', 'describe'].includes(member.propertyName?.text ?? member.name.text))
            names.add(member.name.text)
        }
      }
      visit(ast, (node) => {
        if (!isCallExpression(node)) return
        const call = node.expression
        const focused =
          isPropertyAccessExpression(call) &&
          call.name.text === 'only' &&
          isIdentifier(call.expression) &&
          names.has(call.expression.text)
        if (focused) throw Error('Focused test registration (only) is forbidden')
        if (!isIdentifier(call) || !names.has(call.text)) return
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
