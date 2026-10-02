import { resolve } from 'node:path'
import { filesUnder } from './lib.mjs'
import { withProjectAst } from './typescript-ast.mjs'
import { inspectModule, validateGraph } from './architecture-rules.mjs'

const root = resolve('src-v2')
const files = filesUnder(root).filter(file => file.endsWith('.ts') && !file.endsWith('.d.ts'))
withProjectAst('tsconfig.json', program => {
  const modules = files.map(file => {
    const source = program.getSourceFile(resolve(file))
    if (!source) throw Error(`Missing architecture input: ${file}`)
    return inspectModule(source, root)
  })
  validateGraph(modules)
})
console.log(`Architecture AST boundaries passed for ${files.length} runtime modules; no import cycles.`)
