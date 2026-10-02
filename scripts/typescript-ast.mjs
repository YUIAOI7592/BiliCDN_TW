// Isolate the locked TypeScript 7 API surface used by local architecture checks.
import { API } from 'typescript/unstable/sync'
import { resolve } from 'node:path'
export { SyntaxKind } from 'typescript/unstable/ast'
export function withProjectAst(config, task) {
  const api = new API({ cwd: process.cwd() })
  let snapshot
  try {
    snapshot = api.updateSnapshot({ openProjects: [resolve(config)] })
    const project = snapshot.getProject(resolve(config))
    if (!project) throw Error(`Cannot load TypeScript project: ${config}`)
    return task(project.program)
  } finally { snapshot?.dispose(); api.close() }
}
export function visit(node, fn) { fn(node); node.forEachChild(child => { visit(child, fn) }) }
