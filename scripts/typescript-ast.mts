// Isolate the locked TypeScript 7 API surface used by local architecture checks.
import { API } from 'typescript/unstable/sync'
import { resolve } from 'node:path'
import type { Program, Snapshot } from 'typescript/unstable/sync'
import type { Node } from 'typescript/unstable/ast'
export { SyntaxKind } from 'typescript/unstable/ast'
export function withProjectAst<T>(config: string, task: (program: Program) => T): T {
  const api = new API({ cwd: process.cwd() })
  let snapshot: Snapshot | undefined
  try {
    snapshot = api.updateSnapshot({ openProjects: [resolve(config)] })
    const project = snapshot.getProject(resolve(config))
    if (!project) throw Error(`Cannot load TypeScript project: ${config}`)
    return task(project.program)
  } finally {
    snapshot?.dispose()
    api.close()
  }
}
export function visit(node: Node, fn: (node: Node) => void): void {
  fn(node)
  node.forEachChild((child) => {
    visit(child, fn)
  })
}
