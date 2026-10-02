import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'
import { tmpdir } from 'node:os'
import { withProjectAst } from './typescript-ast.mjs'
import { inspectModule, validateGraph } from './architecture-rules.mjs'

export function testArchitectureRules() {
  const scratch = mkdtempSync(join(tmpdir(), 'bilicdn-architecture-'))
  let assertions = 0
  try {
    const fixtures = {
      'domain/pure.ts': 'export const same = (value: number) => value * 2',
      'state/store.ts': 'export interface Store {}',
      'domain/type-import.ts': "import type { Store } from '../state/store.ts'",
      'domain/re-export.ts': "export type { Store } from '../state/store.ts'",
      'domain/import-type.ts': "type X = import('../state/store.ts').Store",
      'domain/dynamic.ts': "export const load = () => import('../state/store.ts')",
      'domain/variable-import.ts': 'export const load = (name: string) => import(name)',
      'domain/location.ts': 'export const current = () => location.href',
      'domain/qualified.ts': 'export const current = () => globalThis.location.href',
      'domain/clock.ts': 'export const current = () => Date.now()',
      'domain/date.ts': 'export const current = () => new Date()',
      'domain/gm.ts': 'export const current = () => GM_getValue("key")',
      'application/location.ts': 'export const key = () => location.pathname',
      'application/timer.ts': 'export const run = () => setTimeout(() => {}, 10)',
      'application/reload.ts': 'export const run = (player: any) => player.reload()',
      'adapters/affinity.ts': 'export const run = (session: any) => session.setAffinity(null)',
      'ui/storage.ts': 'export const run = () => GM_setValue("bilicdn.v2.meta", {})',
      'ui/reset.ts': 'export const run = (measurement: any) => measurement.reset()',
      'domain/cycle-a.ts': "export { b } from './cycle-b.ts'; export const a = 1",
      'domain/cycle-b.ts': "export { a } from './cycle-a.ts'; export const b = 2",
    }
    for (const [name, source] of Object.entries(fixtures)) {
      const path = join(scratch, name); mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, source)
    }
    const config = join(scratch, 'tsconfig.json')
    writeFileSync(config, JSON.stringify({ compilerOptions: { noLib: true, noEmit: true, allowImportingTsExtensions: true }, include: ['**/*.ts'] }))
    withProjectAst(config, program => {
      const modules = new Map(Object.keys(fixtures).map(name => [name, inspectModule(program.getSourceFile(join(scratch, name)), scratch)]))
      validateGraph([modules.get('domain/pure.ts')]); assertions++
      for (const name of Object.keys(fixtures).filter(name => !['domain/pure.ts', 'state/store.ts'].includes(name) && !name.includes('cycle-'))) {
        let rejected = false
        try { validateGraph([modules.get(name)]) } catch { rejected = true }
        if (!rejected) throw Error(`Architecture rule failed to reject ${name}`)
        assertions++
      }
      let rejected = false
      try { validateGraph([modules.get('domain/cycle-a.ts'), modules.get('domain/cycle-b.ts')]) } catch { rejected = true }
      if (!rejected) throw Error('Architecture rule failed to reject re-export cycle')
      assertions++
    })
    console.log(`Architecture rule contracts: ${assertions} assertions`)
  } finally {
    const target = resolve(scratch), parent = resolve(tmpdir())
    if (!target.startsWith(`${parent}${sep}`) || !target.split(sep).at(-1)?.startsWith('bilicdn-architecture-')) throw Error('Unsafe scratch cleanup')
    rmSync(target, { recursive: true })
  }
}
