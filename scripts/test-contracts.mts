import { writeFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { withProjectAst, visit } from './typescript-ast.mts'
import {
  isImportDeclaration,
  isStringLiteral,
  isNamedImports,
  isCallExpression,
  isPropertyAccessExpression,
  isIdentifier,
  isObjectLiteralExpression,
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
    const ast = program.getSourceFile(file)
    if (!ast) throw Error(`Cannot read test source: ${source}`)
    const names = new Set<string>()
    for (const node of ast.statements) {
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
    let registered = 0
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
    if (!registered) throw Error('Suite registered no named cases')
  })
}
