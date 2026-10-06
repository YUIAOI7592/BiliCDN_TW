import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'
import { tmpdir } from 'node:os'
import { withProjectAst } from './typescript-ast.mjs'
import { inspectModule, validateGraph } from './architecture-rules.mjs'

function architectureFixture() {
  const scratch = mkdtempSync(join(tmpdir(), 'bilicdn-architecture-'))
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
    return withProjectAst(config, program => new Map(Object.keys(fixtures).map(name =>
      [name, inspectModule(program.getSourceFile(join(scratch, name)), scratch)])))
  } finally {
    const target = resolve(scratch), parent = resolve(tmpdir())
    if (!target.startsWith(`${parent}${sep}`) || !target.split(sep).at(-1)?.startsWith('bilicdn-architecture-')) throw Error('Unsafe scratch cleanup')
    rmSync(target, { recursive: true })
  }
}
const rejected = ['domain/type-import.ts','domain/re-export.ts','domain/import-type.ts','domain/dynamic.ts',
  'domain/variable-import.ts','domain/location.ts','domain/qualified.ts','domain/clock.ts','domain/date.ts','domain/gm.ts',
  'application/location.ts','application/timer.ts','application/reload.ts','adapters/affinity.ts','ui/storage.ts','ui/reset.ts']
test('pure domain module is allowed', { timeout: 5000 }, () => {
  const modules = architectureFixture()
  assert.doesNotThrow(() => validateGraph([modules.get('domain/pure.ts')]))
})
for (const name of rejected) test(`reject forbidden architecture: ${name}`, { timeout: 5000 }, () => {
  const modules = architectureFixture()
  assert.throws(() => validateGraph([modules.get(name)]), undefined, `Architecture rule failed to reject ${name}`)
})
test('reject re-export cycle', { timeout: 5000 }, () => {
  const modules = architectureFixture()
  assert.throws(() => validateGraph([modules.get('domain/cycle-a.ts'), modules.get('domain/cycle-b.ts')]), /Import cycle/)
})
