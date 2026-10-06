import { writeFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { withProjectAst, SyntaxKind as K, visit } from './typescript-ast.mjs'

// Catch accidental focused runs and Node's synthetic "empty file passed" result.
// Inspect syntax; strings/comments containing sample tests are not registrations.
export function validateTestDefinitions(source, scratch) {
  const file = resolve(source), config = join(scratch, 'definitions.json')
  writeFileSync(config, JSON.stringify({ compilerOptions: { noLib: true, noEmit: true, allowJs: true }, files: [file] }))
  withProjectAst(config, program => {
    const ast = program.getSourceFile(file)
    if (!ast) throw Error(`Cannot read test source: ${source}`)
    const names = new Set()
    for (const node of ast.statements) {
      if (node.kind !== K.ImportDeclaration || node.moduleSpecifier.text !== 'node:test') continue
      if (node.importClause?.name) names.add(node.importClause.name.text)
      for (const member of node.importClause?.namedBindings?.elements ?? []) {
        if (['test','it','describe'].includes(member.propertyName?.text ?? member.name.text)) names.add(member.name.text)
      }
    }
    let registered = 0
    visit(ast, node => {
      if (node.kind !== K.CallExpression) return
      const call = node.expression
      const focused = call.kind === K.PropertyAccessExpression && call.name.text === 'only' && names.has(call.expression.text)
      if (focused) throw Error('Focused test registration (only) is forbidden')
      if (!names.has(call.text)) return
      registered++
      const options = node.arguments[1]
      if (options?.kind === K.ObjectLiteralExpression && options.properties.some(property => property.name?.text === 'only'))
        throw Error('Focused test option (only) is forbidden')
    })
    if (!registered) throw Error('Suite registered no named cases')
  })
}
