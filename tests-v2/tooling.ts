import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, rmSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { tmpdir } from 'node:os'
import { parseArgs, selection, UsageError } from '../scripts/test-registry.mts'
import { executeSuites, validateReport, finishOutcome } from '../scripts/test.mts'
import { BrowserScheduler } from '../src-v2/adapters/scheduler.ts'
import { supervise } from '../scripts/test-process.mts'
import { inspectImportPurity } from '../scripts/import-purity.mts'
import { formattedSource } from '../scripts/format.mts'
import { testScope } from './support/scope.ts'
import { FakeClock } from './support/clock.ts'
import { deferred } from './support/deferred.ts'
import './regressions/iab-event-collector.ts'
import './regressions/documentation.ts'
import './regressions/archive.ts'
import './regressions/project-config.ts'
import './regressions/upstream-comparison.ts'
import './regressions/buffer-shadow-evaluation.ts'
import './regressions/buffer-observation-integrity.ts'
import './regressions/buffer-confirmation-v3.ts'
import './regressions/buffer-low-tooling.ts'
import './regressions/buffer-continuity-tooling.ts'
import './regressions/buffer-live-evaluation.ts'
import './regressions/buffer-risk-evaluation.ts'
import './regressions/buffer-adoption-decision.ts'

test('formatting reaches a stable source before the next check', { timeout: 5000 }, async () => {
  const source =
    'const values=Object.freeze(rows.slice(0,3).map(row=>Object.freeze({host:row.host,type:row.type,valid:row.valid,safeMbps:row.safeMbps,status:row.status,reason:row.reason})))'
  const formatted = await formattedSource('fixture.ts', source)
  assert.notEqual(formatted, source)
  assert.equal(await formattedSource('fixture.ts', formatted), formatted)
})

test(
  'format check is read-only and write mode excludes release archive evidence and generated JS',
  { timeout: 5000 },
  async (t) => {
    const scope = testScope(t),
      dir = mkdtempSync(join(tmpdir(), 'bilicdn-format-'))
    const parent = resolve(tmpdir()),
      target = resolve(dir)
    assert.ok(
      target.startsWith(parent + sep) && target.split(sep).at(-1)?.startsWith('bilicdn-format-'),
    )
    scope.defer(() => rmSync(target, { recursive: true }))
    const protectedFiles = [
      'Release/v9/sample.ts',
      'archive/sample.mts',
      'baseline/sample.ts',
      '.work/sample.ts',
      'scripts/generated.mjs',
    ]
    for (const file of [...protectedFiles, 'src-v2/fixture.ts']) {
      const absolute = join(dir, file)
      mkdirSync(resolve(absolute, '..'), { recursive: true })
      writeFileSync(absolute, 'export const amount:number=1\n')
    }
    writeFileSync(join(dir, '.prettierrc.json'), readFileSync('.prettierrc.json', 'utf8'))
    const entry = pathToFileURL(resolve('scripts/format.mts')).href
    const run = (check: boolean) =>
      supervise(
        process.execPath,
        [
          '--input-type=module',
          '-e',
          `import {formatProject} from ${JSON.stringify(entry)};try{await formatProject(${check});}catch(error){console.error(error.message);process.exitCode=1;}`,
        ],
        { cwd: dir },
      )
    const checked = await run(true)
    assert.equal(checked.code, 1)
    assert.match(checked.stderr, /src-v2\/fixture\.ts/)
    assert.equal(
      readFileSync(join(dir, 'src-v2/fixture.ts'), 'utf8'),
      'export const amount:number=1\n',
    )
    assert.equal((await run(false)).code, 0)
    assert.equal(
      readFileSync(join(dir, 'src-v2/fixture.ts'), 'utf8'),
      'export const amount: number = 1\n',
    )
    assert.equal((await run(true)).code, 0)
    for (const file of protectedFiles)
      assert.equal(readFileSync(join(dir, file), 'utf8'), 'export const amount:number=1\n')
  },
)

test(
  'registry aliases, listing and CLI validation do not allocate or execute',
  { timeout: 5000 },
  () => {
    assert.deepEqual(selection('adapters'), selection('suites/adapters'))
    assert.equal(parseArgs(['--list']).list, true)
    assert.equal(selection().length, 19)
    assert.equal(parseArgs(['application', '--name', 'startup']).name, 'startup')
    for (const args of [
      ['missing'],
      ['--unknown'],
      ['--name'],
      ['--name', '['],
      ['adapters', 'state'],
      ['--list', 'adapters'],
      ['--list', '--name', 'x'],
    ])
      assert.throws(() => parseArgs(args), UsageError)
  },
)

test(
  'registry order and native CLI entry preserve listing and usage exit codes',
  { timeout: 5000 },
  async () => {
    const entry = 'scripts/test.mts'
    const listed = await supervise(process.execPath, [entry, '--list'])
    assert.equal(listed.code, 0)
    assert.equal(
      listed.stdout,
      selection()
        .map((row) => `${row.name}\t${row.source}\n`)
        .join(''),
    )
    assert.equal(listed.stderr, '')
    const invalid = await supervise(process.execPath, [entry, '--name', '['])
    assert.equal(invalid.code, 2)
    assert.match(invalid.stderr, /Invalid case expression/)
    assert.match(invalid.stderr, /Usage: npm test/)
  },
)

test(
  'structured summary validation preserves suite records and empty filtered execution',
  { timeout: 5000 },
  () => {
    const location = { file: 'fixture.ts', line: 1, column: 1, durationMs: 0 }
    const report = {
      version: 1,
      nodeVersion: process.versions.node,
      success: true,
      durationMs: 0,
      counts: {
        tests: 1,
        passed: 0,
        failed: 0,
        cancelled: 0,
        skipped: 1,
        todo: 0,
        suites: 1,
        topLevel: 1,
      },
      cases: [
        { ...location, name: 'group', kind: 'suite', status: 'passed' },
        { ...location, name: 'unmatched', kind: 'test', status: 'skipped' },
      ],
      failures: [],
    }
    assert.equal(validateReport(report, { code: 0 }, { filtered: true, name: 'selected' }), 0)
    assert.throws(() => validateReport(report, { code: 0 }), /incomplete/)
    assert.throws(
      () =>
        validateReport(
          { ...report, failures: [{ ...location, name: 'fake', message: '', stack: '' }] },
          { code: 0 },
        ),
      /disagree/,
    )
  },
)

test(
  'assertion failure retains TS stack; later cases and suites still run',
  { timeout: 5000 },
  async (t) => {
    const scope = testScope(t),
      dir = mkdtempSync(join(tmpdir(), 'bilicdn-tooling-'))
    scope.defer(() => rmSync(dir, { recursive: true }))
    const first = join(dir, 'first.ts'),
      next = join(dir, 'next.ts')
    writeFileSync(
      first,
      `import {test} from 'node:test'; import assert from 'node:assert/strict';
test('broken original case',()=>assert.equal(1,2,'fixture failure'));
test('later case',()=>assert.ok(true));`,
    )
    writeFileSync(next, `import {test} from 'node:test'; test('next suite',()=>{});`)
    const out = await executeSuites(
      [
        { name: 'first', source: first },
        { name: 'next', source: next },
      ],
      { emit: false },
    )
    assert.equal(out.results[0]!.success, false)
    assert.equal(out.results[1]!.success, true)
    const report = out.results[0]!.report!
    assert.equal(report.counts.passed, 1)
    assert.match(report.failures[0]!.name, /broken original case/)
    assert.match(report.failures[0]!.stack, /first\.ts:2:/)
    assert.match(report.failures[0]!.file!, /first\.ts$/)
    assert.equal(report.version, 1)
  },
)

test(
  'case name filtering permits filtered skips and identifies zero execution',
  { timeout: 5000 },
  async (t) => {
    const scope = testScope(t),
      dir = mkdtempSync(join(tmpdir(), 'bilicdn-tooling-'))
    scope.defer(() => rmSync(dir, { recursive: true }))
    const source = join(dir, 'filter.ts')
    writeFileSync(
      source,
      `import {test} from 'node:test'; test('startup first',()=>{}); test('later second',()=>{});`,
    )
    const one = await executeSuites([{ name: 'filter', source }], { name: 'startup', emit: false })
    assert.equal(one.results[0]!.executed, 1)
    const zero = await executeSuites([{ name: 'filter', source }], { name: 'absent', emit: false })
    assert.equal(zero.results[0]!.executed, 0)
    assert.throws(() => finishOutcome(zero), UsageError)
  },
)

test('build failure does not stop a subsequent suite', { timeout: 5000 }, async (t) => {
  const scope = testScope(t),
    dir = mkdtempSync(join(tmpdir(), 'bilicdn-tooling-'))
  scope.defer(() => rmSync(dir, { recursive: true }))
  const source = join(dir, 'valid.ts')
  writeFileSync(source, `import {test} from 'node:test';test('valid',()=>{});`)
  const out = await executeSuites(
    [
      { name: 'missing', source: join(dir, 'missing.ts') },
      { name: 'valid', source },
    ],
    { emit: false },
  )
  assert.equal(out.results[0]!.phase, 'build')
  assert.equal(out.results[0]!.success, false)
  assert.equal(out.results[1]!.success, true)
})

test(
  'name filtering cannot hide an explicitly skipped selected case',
  { timeout: 5000 },
  async (t) => {
    const scope = testScope(t),
      dir = mkdtempSync(join(tmpdir(), 'bilicdn-tooling-'))
    scope.defer(() => rmSync(dir, { recursive: true }))
    const source = join(dir, 'selected-skip.ts')
    writeFileSync(
      source,
      `import {test} from 'node:test';test('startup skipped',{skip:true},()=>{});test('startup runnable',()=>{});`,
    )
    const out = await executeSuites([{ name: 'skip', source }], { name: 'startup', emit: false })
    assert.equal(out.results[0]!.success, false)
    assert.match(out.results[0]!.error!, /explicitly skipped/)
  },
)

test('empty or focused suites cannot pass the complete-run gate', { timeout: 5000 }, async (t) => {
  const scope = testScope(t),
    dir = mkdtempSync(join(tmpdir(), 'bilicdn-tooling-'))
  scope.defer(() => rmSync(dir, { recursive: true }))
  for (const [name, contents] of [
    ['empty', 'export const value=1'],
    ['only', `import {test} from 'node:test';test.only('focused',()=>{});`],
    ['option', `import {test as check} from 'node:test';check('focused',{only:true},()=>{});`],
  ]) {
    const source = join(dir, name + '.ts')
    writeFileSync(source, contents!)
    const out = await executeSuites([{ name: name!, source }], { emit: false })
    assert.equal(out.results[0]!.success, false)
  }
})

test(
  'missing and corrupted JSON files are actual report-phase failures',
  { timeout: 5000 },
  async (t) => {
    const scope = testScope(t),
      dir = mkdtempSync(join(tmpdir(), 'bilicdn-tooling-'))
    scope.defer(() => rmSync(dir, { recursive: true }))
    for (const [name, write] of [
      ['missing', ''],
      [
        'corrupt',
        `writeFileSync(process.execArgv.find(a=>a.startsWith('--test-reporter-destination=')&&!a.endsWith('=stdout')).split('=').slice(1).join('='),'broken');`,
      ],
    ]) {
      const source = join(dir, name + '.ts')
      writeFileSync(
        source,
        `import {test} from 'node:test';import {writeFileSync} from 'node:fs';test('exit before final summary',()=>{${write}process.exit(0)});`,
      )
      const out = await executeSuites([{ name: name!, source }], { emit: false })
      assert.equal(out.results[0]!.success, false)
      assert.equal(out.results[0]!.phase, 'report')
    }
  },
)

test(
  'cleanup failure and hook timeout fail the suite while later cases run',
  { timeout: 5000 },
  async (t) => {
    const scope = testScope(t),
      dir = mkdtempSync(join(tmpdir(), 'bilicdn-tooling-'))
    scope.defer(() => rmSync(dir, { recursive: true }))
    const source = join(dir, 'cleanup.ts')
    writeFileSync(
      source,
      `import {test} from 'node:test';
test('cleanup throws',t=>{t.after(()=>{throw Error('cleanup failure')},{timeout:50})});
test('cleanup hangs',t=>{t.after(()=>new Promise(()=>{}),{timeout:50})});
test('later clean case',()=>{});`,
    )
    const out = await executeSuites([{ name: 'cleanup', source }], { emit: false })
    assert.equal(out.results[0]!.success, false)
    assert.equal(out.results[0]!.report!.counts.passed, 1)
    assert.match(
      out.results[0]!.report!.failures.map((row) => row.message).join('\n'),
      /cleanup failure|timed out/,
    )
  },
)

test('suite startup failure is an execute-phase failure', { timeout: 5000 }, async (t) => {
  const scope = testScope(t),
    dir = mkdtempSync(join(tmpdir(), 'bilicdn-tooling-'))
  scope.defer(() => rmSync(dir, { recursive: true }))
  const source = join(dir, 'startup.ts')
  writeFileSync(source, `import {test} from 'node:test';test('valid',()=>{});`)
  const out = await executeSuites([{ name: 'startup', source }], {
    executable: 'bilicdn-test-command-does-not-exist',
    emit: false,
  })
  assert.equal(out.results[0]!.success, false)
  assert.equal(out.results[0]!.phase, 'execute')
})

for (const [name, code] of [
  [
    'unresolved promise',
    `import {test} from 'node:test';test('hang',{timeout:40},()=>new Promise(()=>{}));`,
  ],
  ['blocked event loop', `import {test} from 'node:test';test('blocked',()=>{while(true){}});`],
  [
    'leaked interval',
    `import {test} from 'node:test';test('leak',()=>{setInterval(()=>{},1000)});`,
  ],
] as const)
  test(`hard deadline observes process exit: ${name}`, { timeout: 5000 }, async (t) => {
    const scope = testScope(t),
      dir = mkdtempSync(join(tmpdir(), 'bilicdn-tooling-'))
    scope.defer(() => rmSync(dir, { recursive: true }))
    const source = join(dir, 'hang.ts')
    writeFileSync(source, code)
    const out = await executeSuites([{ name: 'hang', source }], { timeoutMs: 250, emit: false })
    assert.equal(out.results[0]!.success, false)
    if (name !== 'unresolved promise') assert.equal(out.results[0]!.process!.reason, 'timeout')
  })

test(
  'spawn errors, nonzero status and both output streams are preserved',
  { timeout: 5000 },
  async () => {
    const invalid = await supervise('bilicdn-test-command-does-not-exist', [], { timeoutMs: 250 })
    assert.ok(invalid.error)
    const result = await supervise(process.execPath, [
      '-e',
      `process.stdout.write('out');process.stderr.write('err');process.exitCode=7`,
    ])
    assert.equal(result.code, 7)
    assert.equal(result.stdout, 'out')
    assert.equal(result.stderr, 'err')
  },
)

test(
  'combined output limit stops an owned child and retains bounded output',
  { timeout: 5000 },
  async () => {
    const result = await supervise(
      process.execPath,
      [
        '-e',
        `process.stdout.write('a'.repeat(9000));process.stderr.write('b'.repeat(9000));setInterval(()=>{},1000)`,
      ],
      { maxBytes: 1024 },
    )
    assert.equal(result.reason, 'output-limit')
    assert.equal(Buffer.byteLength(result.stdout) + Buffer.byteLength(result.stderr), 1024)
  },
)

test('missing, malformed or contradictory structured summaries fail', { timeout: 5000 }, () => {
  for (const report of [null, {}, { version: 1 }])
    assert.throws(() => validateReport(report, { code: 0 }))
  const report = {
    version: 1,
    nodeVersion: process.versions.node,
    counts: {
      tests: 1,
      passed: 1,
      failed: 0,
      cancelled: 0,
      skipped: 0,
      todo: 0,
      suites: 0,
      topLevel: 1,
    },
    durationMs: 1,
    success: true,
    cases: [
      {
        name: 'one',
        status: 'passed',
        kind: 'test',
        file: 'source.ts',
        line: 1,
        column: 1,
        durationMs: 1,
      },
    ],
    failures: [],
  }
  assert.equal(validateReport(report, { code: 0 }), 1)
  assert.throws(() => validateReport(report, { code: 1 }), /disagree/)
  assert.throws(
    () => validateReport({ ...report, counts: { ...report.counts, passed: 2 } }, { code: 0 }),
    /counts/,
  )
})

test(
  'scope unwinds asynchronously in reverse order and disposal is idempotent',
  { timeout: 5000 },
  async () => {
    const hooks: (() => void | Promise<void>)[] = [],
      scope = testScope({
        after(fn) {
          hooks.push(fn)
        },
      }),
      order: string[] = []
    scope.defer(() => {
      order.push('first')
    })
    scope.own({
      async dispose() {
        await Promise.resolve()
        order.push('second')
      },
    })
    const first = scope.dispose()
    assert.equal(scope.dispose(), first)
    await first
    assert.deepEqual(order, ['second', 'first'])
    await hooks[0]!()
    assert.throws(() => scope.defer(() => {}), /disposed/)
  },
)

test(
  'scope aggregates cleanup errors and restores first global descriptor',
  { timeout: 5000 },
  async () => {
    const key = '__bilicdn_tooling_scope__',
      before = Object.getOwnPropertyDescriptor(globalThis, key)
    const scope = testScope({ after() {} }),
      order: string[] = []
    scope.defineGlobal(key, { value: 1, configurable: true, enumerable: false, writable: true })
    scope.defineGlobal(key, { get: () => 2, configurable: true })
    scope.defer(() => {
      order.push('one')
      throw Error('one')
    })
    scope.defer(async () => {
      order.push('two')
      throw Error('two')
    })
    await assert.rejects(scope.dispose(), (error: AggregateError) => error.errors.length === 2)
    assert.deepEqual(order, ['two', 'one'])
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, key), before)
    await assert.rejects(scope.dispose(), AggregateError)
  },
)

test('scope restores an existing accessor descriptor exactly', { timeout: 5000 }, async (t) => {
  const outer = testScope(t),
    key = '__bilicdn_tooling_descriptor__',
    get = () => 42
  outer.defineGlobal(key, { get, configurable: true, enumerable: true })
  const before = Object.getOwnPropertyDescriptor(globalThis, key),
    inner = testScope({ after() {} })
  inner.defineGlobal(key, { value: 7, writable: true, configurable: true, enumerable: false })
  inner.defineGlobal(key, { value: 9, configurable: true })
  await inner.dispose()
  assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, key), before)
})

test(
  'FakeClock timer FIFO, independent microtasks, cancellation and deadline boundary',
  { timeout: 5000 },
  (t) => {
    const clock = testScope(t).own(new FakeClock()),
      order: string[] = []
    const cancel = clock.timeout(() => order.push('cancelled'), 1)
    cancel()
    clock.timeout(() => {
      order.push('first')
      clock.microtask(() => order.push('nested microtask'))
    }, 3000)
    clock.timeout(() => order.push('second'), 3000)
    clock.microtask(() => order.push('microtask'))
    assert.equal(clock.pendingCount, 3)
    clock.advance(2999)
    assert.deepEqual(order, ['microtask'])
    clock.advance(1)
    assert.deepEqual(order, ['microtask', 'first', 'nested microtask', 'second'])
    assert.equal(clock.pendingCount, 0)
    clock.interval(() => order.push('interval'), 1)
    clock.dispose()
    assert.equal(clock.pendingCount, 0)
    assert.throws(() => clock.advance(1), /disposed/)
  },
)

test(
  'FakeClock rejects invalid input and bounds timer and microtask loops',
  { timeout: 5000 },
  (t) => {
    const scope = testScope(t),
      clock = scope.own(new FakeClock())
    for (const delay of [-1, NaN, Infinity])
      assert.throws(() => clock.timeout(() => {}, delay), RangeError)
    assert.throws(() => clock.interval(() => {}, 0), RangeError)
    assert.throws(() => clock.advance(-1), RangeError)
    let callbacks = 0
    const loop = () =>
      clock.timeout(() => {
        callbacks++
        loop()
      }, 0)
    loop()
    assert.throws(() => clock.advance(0), /10000/)
    assert.equal(callbacks, 10000)
    const micro = scope.own(new FakeClock()),
      repeat = () => micro.microtask(repeat)
    repeat()
    assert.throws(() => micro.advance(0), /10000/)
  },
)

test('deferred completion and rejection are explicit signals', { timeout: 5000 }, async () => {
  const done = deferred<number>()
  done.resolve(4)
  assert.equal(await done.promise, 4)
  const rejected = deferred<void>()
  rejected.reject(Error('cancelled'))
  await assert.rejects(rejected.promise, /cancelled/)
})

test(
  'BrowserScheduler owns real event-loop timers and completion signals',
  { timeout: 5000 },
  async (t) => {
    const scope = testScope(t),
      scheduler = new BrowserScheduler(),
      micro = deferred<void>(),
      timer = deferred<void>(),
      interval = deferred<void>()
    scheduler.microtask(() => micro.resolve())
    scope.defer(scheduler.timeout(() => timer.resolve(), 0))
    let ticks = 0
    const stop = scheduler.interval(() => {
      if (++ticks === 2) {
        stop()
        interval.resolve()
      }
    }, 1)
    scope.defer(stop)
    await Promise.all([micro.promise, timer.promise, interval.promise])
    assert.equal(ticks, 2)
  },
)

test(
  'raw import probe detects effects without loading the test framework',
  { timeout: 5000 },
  async (t) => {
    const scope = testScope(t),
      dir = mkdtempSync(join(tmpdir(), 'bilicdn-tooling-'))
    scope.defer(() => rmSync(dir, { recursive: true }))
    const pure = join(dir, 'pure.ts'),
      effect = join(dir, 'effect.ts')
    writeFileSync(pure, 'export const value=42')
    writeFileSync(effect, 'export const value=Date.now()')
    assert.equal((await inspectImportPurity([pure])).modules, 1)
    await assert.rejects(inspectImportPurity([effect]), /Import side effect: Date.now/)
  },
)
import './regressions/diagnostics-cost.ts'
