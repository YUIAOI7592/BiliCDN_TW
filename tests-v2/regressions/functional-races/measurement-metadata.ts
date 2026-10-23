import { test, type TestContext } from 'node:test'
import assert from 'node:assert/strict'
import { setImmediate as nextTurn } from 'node:timers/promises'
import {
  MeasurementMetaStore,
  MEASUREMENT_META_KEY,
} from '../../../src-v2/state/measurement-meta-store.ts'
import type { MeasurementMeta } from '../../../src-v2/state/measurement-meta-ports.ts'
import { MeasurementController } from '../../../src-v2/application/measurement-controller.ts'
import type { MeasurementStatus } from '../../../src-v2/application/measurement-model.ts'
import type { StoragePort } from '../../../src-v2/platform/storage-port.ts'
import {
  generationId,
  epochId,
  representationId,
  decisionId,
} from '../../../src-v2/domain/model.ts'
import { TRUSTED_CATALOG } from '../../../src-v2/domain/catalog.ts'
import { FakeStorage } from '../../support/storage.ts'
import { FakeClock } from '../../support/clock.ts'
import { testScope } from '../../support/scope.ts'
import { measurementRoutes } from '../../support/controllers.ts'
import { deferred } from '../../support/deferred.ts'
import type { MeasurementMetadataPort } from '../../../src-v2/application/measurement-ports.ts'
import type { AppliedRouteDecision } from '../../../src-v2/application/route-model.ts'

const at = 2_000_000_000_000
const zero = { catalogCursor: 0, lastChallengeAt: 0 }
function store(raw: unknown, now = at) {
  let value = raw
  const writes: unknown[] = []
  const storage = {
    get: <T>(_key: string, _fallback: T): T => value as T,
    set: <T>(_key: string, next: T) => {
      value = next
      writes.push(next)
    },
    delete: () => {
      value = undefined
    },
    listen: () => {
      throw Error('metadata must not subscribe')
    },
    withLock: async <T>(_name: string, task: () => T | Promise<T>) => await task(),
  } satisfies StoragePort
  return { meta: new MeasurementMetaStore(storage, () => now), writes, value: () => value }
}

for (const [name, raw] of [
  ['missing', null],
  ['array', Object.assign([], { schema: 2, catalogCursor: 4 })],
  ['wrong-schema', { schema: 3, catalogCursor: 4, lastChallengeAt: 10 }],
  ['missing-schema', { catalogCursor: 4, lastChallengeAt: 10 }],
  ['inherited', Object.create({ schema: 2, catalogCursor: 4, lastChallengeAt: 10 })],
] as const) {
  test(`META U schema ${name} defaults without writing`, () => {
    const f = store(raw)
    assert.deepEqual(f.meta.get(), zero)
    assert.equal(f.value(), raw)
    assert.equal(f.writes.length, 0)
  })
}

for (const [name, value] of [
  ['string', '3'],
  ['negative', -1],
  ['fraction', 1.5],
  ['NaN', NaN],
  ['Infinity', Infinity],
  ['unsafe-integer', Number.MAX_SAFE_INTEGER + 1],
  [
    'coercible-object',
    {
      valueOf: () => {
        throw Error('must not coerce')
      },
    },
  ],
] as const) {
  test(`META U invalid cursor ${name} defaults independently`, () => {
    const f = store({ schema: 2, catalogCursor: value, lastChallengeAt: 123 })
    assert.deepEqual(f.meta.get(), { catalogCursor: 0, lastChallengeAt: 123 })
    assert.equal(f.writes.length, 0)
  })
}

for (const [name, value] of [
  ['string', '123'],
  ['negative', -1],
  ['NaN', NaN],
  ['Infinity', Infinity],
  ['future', at + 1],
  ['unsafe', Number.MAX_SAFE_INTEGER + 1],
] as const) {
  test(`META U invalid cooldown ${name} defaults independently`, () => {
    const f = store({ schema: 2, catalogCursor: 7, lastChallengeAt: value })
    assert.deepEqual(f.meta.get(), { catalogCursor: 7, lastChallengeAt: 0 })
  })
}

for (const cursor of [0, Number.MAX_SAFE_INTEGER]) {
  test(`META U valid cursor ${cursor} and fractional timestamp retain exact values`, () => {
    const f = store({ schema: 2, catalogCursor: cursor, lastChallengeAt: 123.25 })
    assert.deepEqual(f.meta.get(), { catalogCursor: cursor, lastChallengeAt: 123.25 })
  })
}

test('META U read and update never invoke getters or repersist unknown payload', () => {
  let calls = 0
  const raw = { schema: 2, lastChallengeAt: 123, secret: 'synthetic-private' }
  Object.defineProperty(raw, 'catalogCursor', {
    get() {
      calls++
      throw Error('getter')
    },
  })
  Object.defineProperty(raw, 'unknown', {
    enumerable: true,
    get() {
      calls++
      throw Error('unknown')
    },
  })
  const f = store(raw)
  assert.deepEqual(f.meta.get(), { catalogCursor: 0, lastChallengeAt: 123 })
  f.meta.update({ catalogCursor: 3, secret: 'synthetic-patch' } as Partial<MeasurementMeta>)
  assert.deepEqual(f.value(), { schema: 2, catalogCursor: 3, lastChallengeAt: 123, updatedAt: at })
  assert.equal(calls, 0)
  assert.equal(f.writes.length, 1)
})

test('META U invalid partial fields and accessor patch preserve validated current fields', () => {
  const f = store({ schema: 2, catalogCursor: 3, lastChallengeAt: 123 })
  const patch = Object.defineProperty({ catalogCursor: Infinity }, 'lastChallengeAt', {
    enumerable: true,
    get() {
      throw Error('patch getter')
    },
  })
  f.meta.update(patch)
  assert.deepEqual(f.value(), { schema: 2, catalogCursor: 3, lastChallengeAt: 123, updatedAt: at })
  f.meta.update({ catalogCursor: 0, lastChallengeAt: 0 })
  assert.deepEqual(f.meta.get(), zero)
})

test('META U returned values are isolated and reads observe the latest storage', () => {
  const f = store({ schema: 2, catalogCursor: 2, lastChallengeAt: 0 })
  const result = f.meta.get()
  try {
    ;(result as { catalogCursor: number }).catalogCursor = 50
  } catch {}
  assert.equal(f.meta.get().catalogCursor, 2)
  f.meta.update({ catalogCursor: 8 })
  assert.equal(f.meta.get().catalogCursor, 8)
  f.meta.clear()
  assert.deepEqual(f.meta.get(), zero)
})

for (const now of [NaN, Infinity, -1]) {
  test(`META U invalid clock ${now} cannot persist a nonfinite or negative time`, () => {
    const f = store(null, now)
    f.meta.update({ lastChallengeAt: 100 })
    assert.deepEqual(f.value(), { schema: 2, catalogCursor: 0, lastChallengeAt: 0, updatedAt: 0 })
  })
}

for (const failure of ['get', 'set', 'lock'] as const) {
  test(`META U storage ${failure} failure retains its exception and does not fabricate persistence`, async () => {
    const expected = Error('synthetic storage error'),
      values: unknown[] = []
    const storage = {
      get: <T>(_key: string, fallback: T): T => {
        if (failure === 'get') throw expected
        return fallback
      },
      set: <T>(_key: string, value: T) => {
        if (failure === 'set') throw expected
        values.push(value)
      },
      delete: () => undefined,
      listen: () => () => undefined,
      withLock: async <T>(_name: string, task: () => T | Promise<T>) => {
        if (failure === 'lock') throw expected
        return await task()
      },
    } satisfies StoragePort
    const meta = new MeasurementMetaStore(storage, () => at)
    if (failure === 'lock')
      await assert.rejects(
        meta.withLock(() => meta.update({ catalogCursor: 3 })),
        (error) => error === expected,
      )
    else
      assert.throws(
        () => meta.update({ catalogCursor: 3 }),
        (error) => error === expected,
      )
    assert.equal(values.length, 0)
  })
}

test('META U healthy round advances each candidate cursor safely through rollover', async (t) => {
  const scope = testScope(t),
    clock = scope.own(new FakeClock())
  let current = Number.MAX_SAFE_INTEGER
  const cursors: number[] = [],
    writes: number[] = []
  const meta = {
    get: () => ({ catalogCursor: current, lastChallengeAt: 0 }),
    update: (change) => {
      current = change.catalogCursor!
      writes.push(current)
    },
    withLock: async (task) => await task(),
  } satisfies MeasurementMetadataPort
  const applied = {
    url: 'https://synthetic.example/media',
    context: null,
    streamKey: null,
    sourceHost: null,
    decision: {
      action: 'rewrite',
      id: decisionId('metadata-test'),
      host: 'synthetic.example',
      routeType: 'catalog-generated',
      reason: 'synthetic',
      ranking: [],
      candidate: {
        type: 'catalog-generated',
        host: 'synthetic.example',
        kind: 'video',
        catalogIndex: 0,
      },
    },
  } satisfies AppliedRouteDecision
  const controller = scope.own(
    new MeasurementController(
      measurementRoutes({
        challenge: (_representation, _demand, _prefer, _excluded, cursor) => {
          cursors.push(cursor!)
          return applied
        },
      }),
      meta,
      {
        read: async () => ({
          bytes: 65536,
          elapsedMs: 100,
          ttfbMs: 10,
          status: 206,
          directRange: true,
          reason: 'measured',
        }),
      },
      clock.now,
      clock,
    ),
  )
  controller.tick({
    generationActive: true,
    representation: representationId('rollover'),
    demand: { kind: 'video', requiredMbps: 2, highDemand: false },
    stableProgressSec: 25,
    playableBufferSec: 40,
    visible: true,
    seeking: false,
    recovering: false,
    disabled: false,
  })
  await nextTurn()
  assert.deepEqual(cursors, [Number.MAX_SAFE_INTEGER, 0, 1])
  assert.deepEqual(writes, [0])
  controller.dispose()
  assert.equal(clock.pendingCount, 0)
})

function scenario(t: TestContext, initialCursor = 4) {
  const scope = testScope(t),
    clock = scope.own(new FakeClock())
  const waiters: (() => Promise<void>)[] = []
  class Storage extends FakeStorage {
    held = true
    reads = 0
    onRead: (() => void) | null = null
    override get<T>(key: string, fallback: T): T {
      if (key === MEASUREMENT_META_KEY) {
        this.reads++
        this.onRead?.()
      }
      return super.get(key, fallback)
    }
    override async withLock<T>(name: string, task: () => T | Promise<T>): Promise<T> {
      assert.equal(name, 'measurement')
      if (!this.held) return await task()
      const done = deferred<T>()
      waiters.push(async () => {
        try {
          done.resolve(await task())
        } catch (error) {
          done.reject(error)
        }
      })
      return await done.promise
    }
  }
  const storage = new Storage(),
    meta = new MeasurementMetaStore(storage, clock.now)
  meta.update({ catalogCursor: initialCursor, lastChallengeAt: 123 })
  const host = TRUSTED_CATALOG[0]!,
    url = `https://${host}/metadata.m4s`
  const context = {
    generation: generationId(1),
    epoch: epochId(1),
    representation: representationId('meta'),
    kind: 'video' as const,
    authorityRevision: 1,
  }
  let probes = 0,
    commits = 0
  const cursors: number[] = []
  const make = () =>
    scope.own(
      new MeasurementController(
        measurementRoutes({
          startupOptions: (_url, cursor = 0) => {
            cursors.push(cursor)
            return {
              candidates: [
                {
                  host,
                  url,
                  type: 'catalog-generated',
                  original: false,
                  cachedSafeMbps: null,
                  context,
                },
              ],
              demand: { kind: 'video', requiredMbps: 2, highDemand: false },
              originalHost: host,
            }
          },
          commitStartupChoice: () => {
            commits++
            return { host }
          },
        }),
        meta,
        {
          read: async () => {
            probes++
            return {
              bytes: 65536,
              elapsedMs: 100,
              ttfbMs: 10,
              status: 206,
              directRange: true,
              reason: 'measured',
            }
          },
        },
        clock.now,
        clock,
      ),
    )
  scope.defer(async () => {
    storage.onRead = null
    for (const run of waiters.splice(0)) await run()
  })
  async function release() {
    for (const run of waiters.splice(0)) await run()
    await nextTurn()
  }
  async function cleanup(...controllers: MeasurementController[]) {
    for (const controller of controllers) controller.dispose()
    await release()
    assert.equal(clock.pendingCount, 0)
    assert.equal(waiters.length, 0)
    assert.equal(storage.listeners.size, 0)
  }
  return {
    scope,
    storage,
    clock,
    meta,
    make,
    url,
    release,
    cleanup,
    cursors,
    probes: () => probes,
    commits: () => commits,
    context,
  }
}

test('META I concurrent startup lock waiters preserve both increments and latest cooldown', async (t) => {
  const f = scenario(t),
    a = f.make(),
    b = f.make()
  await Promise.all([a.prepareStartup(f.url), b.prepareStartup(f.url)])
  assert.deepEqual(
    f.cursors,
    [4, 4],
    'candidate selection and startup must not wait for metadata lock',
  )
  assert.equal(f.probes(), 2)
  f.meta.update({ catalogCursor: 9, lastChallengeAt: f.clock.now() })
  await f.release()
  assert.deepEqual(f.meta.get(), { catalogCursor: 11, lastChallengeAt: f.clock.now() })
  assert.equal(f.commits(), 2)
  await Promise.all([a.prepareStartup(f.url), b.prepareStartup(f.url)])
  assert.equal(f.probes(), 2, 'metadata change must not reopen startup budgets')
  await f.cleanup(a, b)
})

for (const timing of ['while-waiting', 'during-fresh-read'] as const) {
  test(`META I startup reset ${timing} prevents stale metadata commit`, async (t) => {
    const f = scenario(t),
      a = f.make()
    await a.prepareStartup(f.url)
    if (timing === 'while-waiting') a.reset()
    else
      f.storage.onRead = () => {
        f.storage.onRead = null
        a.reset()
      }
    await f.release()
    assert.equal(f.meta.get().catalogCursor, 4)
    await f.cleanup(a)
  })
}

test('META I startup cursor wraps safely at MAX_SAFE_INTEGER', async (t) => {
  const f = scenario(t, Number.MAX_SAFE_INTEGER),
    a = f.make()
  await a.prepareStartup(f.url)
  await f.release()
  assert.equal(f.meta.get().catalogCursor, 0)
  await f.cleanup(a)
})

test('META I healthy planning retains exact ten-minute cooldown after startup cursor update', async (t) => {
  const f = scenario(t),
    a = f.make()
  f.meta.update({ lastChallengeAt: f.clock.now() })
  await a.prepareStartup(f.url)
  await f.release()
  f.storage.held = false
  let challenges = 0
  const b = f.scope.own(
    new MeasurementController(
      measurementRoutes({
        challenge: () => {
          challenges++
          return null
        },
      }),
      f.meta,
      {
        read: async () => {
          throw Error('no legal candidate')
        },
      },
      f.clock.now,
      f.clock,
    ),
  )
  const status: MeasurementStatus = {
    generationActive: true,
    representation: f.context.representation,
    demand: { kind: 'video', requiredMbps: 2, highDemand: false },
    stableProgressSec: 25,
    playableBufferSec: 40,
    visible: true,
    seeking: false,
    recovering: false,
    disabled: false,
  }
  f.clock.advance(599999)
  b.tick(status)
  await nextTurn()
  assert.equal(challenges, 0)
  f.clock.advance(1)
  b.tick(status)
  await nextTurn()
  assert.equal(challenges, 1)
  assert.equal(f.probes(), 1)
  await f.cleanup(a, b)
})
