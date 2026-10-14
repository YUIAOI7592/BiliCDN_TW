import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'
import { tmpdir } from 'node:os'
import { withProjectAst } from './typescript-ast.mts'
import { inspectModule, validateGraph } from './architecture-rules.mts'

function architectureFixture(additional: Readonly<Record<string, string>> = {}) {
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
      ...additional,
    }
    for (const [name, source] of Object.entries(fixtures)) {
      const path = join(scratch, name)
      mkdirSync(dirname(path), { recursive: true })
      writeFileSync(path, source)
    }
    const config = join(scratch, 'tsconfig.json')
    writeFileSync(
      config,
      JSON.stringify({
        compilerOptions: { noLib: true, noEmit: true, allowImportingTsExtensions: true },
        include: ['**/*.ts'],
      }),
    )
    return withProjectAst(
      config,
      (program) =>
        new Map(
          Object.keys(fixtures).map((name) => {
            const source = program.getSourceFile(join(scratch, name))
            if (!source) throw Error(`Missing fixture: ${name}`)
            return [name, inspectModule(source, scratch)]
          }),
        ),
    )
  } finally {
    const target = resolve(scratch),
      parent = resolve(tmpdir())
    if (
      !target.startsWith(`${parent}${sep}`) ||
      !target.split(sep).at(-1)?.startsWith('bilicdn-architecture-')
    )
      throw Error('Unsafe scratch cleanup')
    rmSync(target, { recursive: true })
  }
}
const rejected = [
  'domain/type-import.ts',
  'domain/re-export.ts',
  'domain/import-type.ts',
  'domain/dynamic.ts',
  'domain/variable-import.ts',
  'domain/location.ts',
  'domain/qualified.ts',
  'domain/clock.ts',
  'domain/date.ts',
  'domain/gm.ts',
  'application/location.ts',
  'application/timer.ts',
  'application/reload.ts',
  'adapters/affinity.ts',
  'ui/storage.ts',
  'ui/reset.ts',
]
test('pure domain module is allowed', { timeout: 5000 }, () => {
  const modules = architectureFixture()
  assert.doesNotThrow(() => validateGraph([modules.get('domain/pure.ts')!]))
})
for (const name of rejected)
  test(`reject forbidden architecture: ${name}`, { timeout: 5000 }, () => {
    const modules = architectureFixture()
    assert.throws(
      () => validateGraph([modules.get(name)!]),
      `Architecture rule failed to reject ${name}`,
    )
  })
test('reject re-export cycle', { timeout: 5000 }, () => {
  const modules = architectureFixture()
  assert.throws(
    () => validateGraph([modules.get('domain/cycle-a.ts')!, modules.get('domain/cycle-b.ts')!]),
    /Import cycle/,
  )
})

for (const [file, source] of [
  [
    'application/routing/route-coordinator.ts',
    'export const run = (session: {setAffinity(value: null): void}) => session.setAffinity(null)',
  ],
  [
    'adapters/route-coordinator.ts',
    'export const run = (session: {setAffinity(value: null): void}) => session.setAffinity(null)',
  ],
  [
    'application/recovery/recovery-controller.ts',
    'export const run = (player: {reload(): void}) => player.reload()',
  ],
  [
    'application/measurement/measurement-controller.ts',
    'export const run = (probe: {read(): void}) => probe.read()',
  ],
  [
    'application/other-probe.ts',
    'export class Reader { constructor(private probe: {read(): void}) {} run() { return this.probe.read() } }',
  ],
] as const)
  test(`sole effect owner rejects a spoofed module path: ${file}`, { timeout: 5000 }, () => {
    const modules = architectureFixture({ [file]: source })
    assert.throws(
      () => validateGraph([modules.get(file)!]),
      /only (RouteCoordinator|RecoveryController|MeasurementController)/,
    )
  })

for (const [file, source] of [
  [
    'application/route-coordinator.ts',
    'export const run = (session: {setAffinity(value: null): void}) => session.setAffinity(null)',
  ],
  [
    'application/recovery-controller.ts',
    'export const run = (player: {reload(): void}) => player.reload()',
  ],
  [
    'application/measurement-controller.ts',
    'export const run = (probe: {read(): void}) => probe.read()',
  ],
  ['application/body-reader.ts', 'export const run = (reader: {read(): void}) => reader.read()'],
] as const)
  test(
    `sole effect owner permits the exact path or ordinary reader: ${file}`,
    { timeout: 5000 },
    () => {
      const modules = architectureFixture({ [file]: source })
      assert.doesNotThrow(() => validateGraph([modules.get(file)!]))
    },
  )

for (const [file, source] of [
  ['state/settings-ports.ts', "import type { Store } from './store.ts'"],
  ['state/settings-model.ts', "export type { Store } from './store.ts'"],
  [
    'application/route-model.ts',
    "type Controller = import('./route-coordinator.ts').RouteCoordinator",
  ],
  ['application/ports.ts', "import type { Controller } from './runtime-controller.ts'"],
  ['diagnostics/model.ts', "import type { Observer } from './observer.ts'"],
  ['diagnostics/ports.ts', "export type { Observer } from './observer.ts'"],
  ['platform/storage-port.ts', "import type { TampermonkeyStorage } from './storage.ts'"],
  ['platform/runtime-id-port.ts', "import type { createRuntimeIds } from './runtime-ids.ts'"],
  [
    'ui/control-center-ports.ts',
    "import { ControlCommands } from '../application/control-commands.ts'",
  ],
] as const)
  test(
    `contract module rejects implementation dependency including types: ${file}`,
    { timeout: 5000 },
    () => {
      const modules = architectureFixture({ [file]: source })
      assert.throws(
        () => validateGraph([modules.get(file)!]),
        /contract modules must not import implementation/,
      )
    },
  )

test(
  'contract modules can compose model, capability and pure domain types',
  { timeout: 5000 },
  () => {
    const modules = architectureFixture({
      'domain/model.ts': 'export interface Value { readonly count: number }',
      'state/record-model.ts':
        "import type { Value } from '../domain/model.ts'; export interface Record { readonly value: Value }",
      'state/record-ports.ts':
        "import type { Record } from './record-model.ts'; export interface Reader { get(): Record }",
      'application/reader-ports.ts':
        "import type { Reader } from '../state/record-ports.ts'; export interface Consumer { reader: Reader }",
    })
    assert.doesNotThrow(() =>
      validateGraph(
        [
          'domain/model.ts',
          'state/record-model.ts',
          'state/record-ports.ts',
          'application/reader-ports.ts',
        ].map((file) => modules.get(file)!),
      ),
    )
  },
)
