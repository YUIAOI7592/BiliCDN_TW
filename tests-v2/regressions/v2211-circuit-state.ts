import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EvidenceStore, EVIDENCE_KEY } from '../../src-v2/state/evidence-store.ts'
import { createRuntimeIds } from '../../src-v2/platform/runtime-ids.ts'
import { SharedEvidenceStorage } from '../support/shared-evidence-storage.ts'
import { testScope } from '../support/scope.ts'
import type { EvidenceSample } from '../../src-v2/domain/model.ts'
import type { StorageLock, StorageRead } from '../../src-v2/platform/storage-port.ts'
import { deferred } from '../support/deferred.ts'

const host = 'cdn.example',
  at = 2_000_000_000_000
const failure = (id: string): EvidenceSample => ({
  requestId: id,
  at,
  source: 'transport',
  outcome: 'failure',
  throughputMbps: null,
  ttfbMs: null,
  failureKind: 'network',
})
test('V2211 storage: speed history expiry does not erase circuit debt', (t) => {
  const storage = new SharedEvidenceStorage()
  storage.set(EVIDENCE_KEY, {
    schema: 2,
    updatedAt: at,
    records: {
      one: {
        host,
        kind: 'video',
        samples: [],
        circuitLevel: 4,
        circuitUntil: at + 10,
        updatedAt: at,
      },
    },
  })
  const store = testScope(t).own(
    new EvidenceStore(storage, () => at + 86_400_001, createRuntimeIds()),
  )
  assert.equal(store.get(host, 'video')!.circuitLevel, 4)
  assert.equal(store.get(host, 'video')!.circuitUntil, at + 10)
})
test('V2211 storage: one receipt can commit only one failure even concurrently', async (t) => {
  const store = testScope(t).own(
    new EvidenceStore(new SharedEvidenceStorage(), () => at, createRuntimeIds()),
  )
  const receipt = {},
    sample = failure('one')
  await Promise.all([
    store.commit(host, 'video', sample, receipt),
    store.commit(host, 'video', sample, receipt),
  ])
  assert.equal(store.get(host, 'video')!.circuitLevel, 1)
})
test('V2211 storage: two stores cannot lower the same shared version twice', async (t) => {
  const scope = testScope(t),
    storage = new SharedEvidenceStorage()
  let now = at
  const a = scope.own(new EvidenceStore(storage, () => now, createRuntimeIds()))
  const b = scope.own(new EvidenceStore(storage, () => now, createRuntimeIds()))
  await a.record(host, 'video', failure('one'))
  await a.record(host, 'video', failure('two'))
  now += 1_800_001
  const stamp = a.control(host, 'video').stamp!
  const results = await Promise.all([
    a.tryDowngrade(host, 'video', stamp, 'a-proof', () => true),
    b.tryDowngrade(host, 'video', stamp, 'b-proof', () => true),
  ])
  assert.equal(results.filter((r) => r.status === 'committed').length, 1)
  assert.equal(a.control(host, 'video').level, 1)
})
test('V2211 storage: clear tombstone and canonical reread reject stale notifications and proofs', async (t) => {
  const storage = new SharedEvidenceStorage(),
    store = testScope(t).own(new EvidenceStore(storage, () => at, createRuntimeIds()))
  await store.record(host, 'video', failure('one'))
  const old = structuredClone(storage.get(EVIDENCE_KEY, null)),
    stamp = store.control(host, 'video').stamp!
  await store.clear()
  for (const listener of storage.listeners.get(EVIDENCE_KEY) ?? []) listener(old, true)
  assert.equal(store.get(host, 'video'), null)
  assert.equal((await store.tryDowngrade(host, 'video', stamp, 'old', () => true)).status, 'stale')
  assert.ok(storage.get(EVIDENCE_KEY, null))
})

for (const mode of ['before', 'after'] as const) {
  test(`V2211 storage: ${mode}-write exception is reconciled without repeating a receipt`, async (t) => {
    class AmbiguousStorage extends SharedEvidenceStorage {
      fail = false
      override set<T>(key: string, value: T): void {
        if (!this.fail || mode === 'after') super.set(key, value)
        if (this.fail) throw Error('storage unavailable')
      }
    }
    const storage = new AmbiguousStorage(),
      store = testScope(t).own(new EvidenceStore(storage, () => at, createRuntimeIds()))
    storage.fail = true
    const receipt = {}
    const result = await store.commit(host, 'video', failure('one'), receipt)
    assert.equal(result.status, mode === 'after' ? 'committed' : 'unconfirmed')
    assert.equal((await store.commit(host, 'video', failure('one'), receipt)).status, 'duplicate')
    assert.equal(store.get(host, 'video')?.circuitLevel ?? 0, mode === 'after' ? 1 : 0)
  })
}
test('V2211 storage: read failure cannot overwrite persisted records with an empty payload', async (t) => {
  class UnreadableStorage extends SharedEvidenceStorage {
    fail = false
    override readResult<T>(key: string, fallback: T): StorageRead<T> {
      return this.fail ? { ok: false } : super.readResult(key, fallback)
    }
  }
  const storage = new UnreadableStorage(),
    store = testScope(t).own(new EvidenceStore(storage, () => at, createRuntimeIds()))
  await store.record(host, 'video', failure('one'))
  const saved = structuredClone(storage.values.get(EVIDENCE_KEY))
  storage.fail = true
  assert.equal((await store.commit(host, 'video', failure('two'), {})).status, 'unconfirmed')
  assert.deepEqual(storage.values.get(EVIDENCE_KEY), saved)
  assert.equal(store.control(host, 'video').synchronized, false)
})
test('V2211 storage: a fallback lock never authorizes a downgrade', async (t) => {
  class FallbackStorage extends SharedEvidenceStorage {
    override async withLock<T>(_name: string, task: (lock?: StorageLock) => Promise<T> | T) {
      return await task({ exclusive: false })
    }
  }
  let now = at
  const store = testScope(t).own(
    new EvidenceStore(new FallbackStorage(), () => now, createRuntimeIds()),
  )
  await store.record(host, 'video', failure('one'))
  now += 600001
  assert.equal(
    (
      await store.tryDowngrade(
        host,
        'video',
        store.control(host, 'video').stamp!,
        'proof',
        () => true,
      )
    ).status,
    'no-common-lock',
  )
  assert.equal(store.get(host, 'video')!.circuitLevel, 1)
})
test('V2211 storage: a same-millisecond failure defeats an older recovery proof', async (t) => {
  let now = at
  const store = testScope(t).own(
    new EvidenceStore(new SharedEvidenceStorage(), () => now, createRuntimeIds()),
  )
  await store.record(host, 'video', failure('one'))
  now += 600001
  const stamp = store.control(host, 'video').stamp!
  await store.record(host, 'video', { ...failure('two'), at: now })
  assert.equal((await store.tryDowngrade(host, 'video', stamp, 'old', () => true)).status, 'stale')
  assert.equal(store.get(host, 'video')!.circuitLevel, 2)
})
test('V2211 storage: ordinary health writes retain the circuit revision', async (t) => {
  let now = at
  const store = testScope(t).own(
    new EvidenceStore(new SharedEvidenceStorage(), () => now, createRuntimeIds()),
  )
  await store.record(host, 'video', failure('one'))
  const before = store.control(host, 'video').stamp
  now += 600001
  await store.record(host, 'video', {
    ...failure('success'),
    at: now,
    outcome: 'success',
    bytes: 65536,
    elapsedMs: 100,
    ttfbMs: 10,
    throughputMbps: 10,
    failureKind: null,
  })
  assert.deepEqual(store.control(host, 'video').stamp, before)
  assert.equal(store.get(host, 'video')!.circuitLevel, 1)
  assert.equal(store.get(host, 'video')!.circuitUntil, 0)
})

test('V2211 storage: legacy reads do not migrate or write, and protocol loss revokes the stamp', async (t) => {
  const storage = new SharedEvidenceStorage()
  const legacy = {
    schema: 2,
    updatedAt: at,
    records: {
      one: {
        host,
        kind: 'video',
        samples: [],
        circuitLevel: 3,
        circuitUntil: 0,
        updatedAt: at,
      },
    },
  }
  storage.set(EVIDENCE_KEY, legacy)
  const store = testScope(t).own(new EvidenceStore(storage, () => at, createRuntimeIds()))
  assert.deepEqual(storage.values.get(EVIDENCE_KEY), legacy)
  assert.equal(store.control(host, 'video').stamp, null)
  await store.record(host, 'video', {
    ...failure('success'),
    outcome: 'success',
    failureKind: null,
  })
  assert.ok(store.control(host, 'video').stamp)
  storage.remote(EVIDENCE_KEY, legacy)
  assert.equal(store.control(host, 'video').stamp, null)
  assert.equal(store.get(host, 'video')!.circuitLevel, 3)
})
test('V2211 storage: an evicted and recreated record cannot accept its earlier proof', async (t) => {
  let now = at
  const store = testScope(t).own(
    new EvidenceStore(new SharedEvidenceStorage(), () => now, createRuntimeIds()),
  )
  await store.record(host, 'video', failure('one'))
  const stamp = store.control(host, 'video').stamp!
  for (let i = 0; i < 64; i++) {
    now++
    await store.record(`h${i}.example`, 'video', { ...failure(`other-${i}`), at: now })
  }
  assert.equal(store.get(host, 'video'), null)
  now++
  await store.record(host, 'video', { ...failure('new-one'), at: now })
  assert.notEqual(store.control(host, 'video').stamp!.recordId, stamp.recordId)
  now += 600001
  assert.equal((await store.tryDowngrade(host, 'video', stamp, 'old', () => true)).status, 'stale')
  assert.equal(store.list('video').length, 64)
})
test('V2211 storage: validity is rechecked after a real shared-lock wait', async (t) => {
  let now = at,
    valid = true
  const storage = new SharedEvidenceStorage(),
    store = testScope(t).own(new EvidenceStore(storage, () => now, createRuntimeIds()))
  await store.record(host, 'video', failure('one'))
  now += 600001
  const stamp = store.control(host, 'video').stamp!,
    hold = deferred<void>(),
    entered = deferred<void>()
  const blocker = storage.withLock('routeEvidence', async () => {
    entered.resolve()
    await hold.promise
  })
  await entered.promise
  const pending = store.tryDowngrade(host, 'video', stamp, 'waiting', () => valid)
  valid = false
  hold.resolve()
  await blocker
  assert.equal((await pending).status, 'invalid')
  assert.equal(store.get(host, 'video')!.circuitLevel, 1)
})
test('V2211 storage: revision exhaustion rotates identities instead of reusing an old version', async (t) => {
  const storage = new SharedEvidenceStorage(),
    scope = testScope(t)
  const seed = scope.own(new EvidenceStore(storage, () => at, createRuntimeIds()))
  await seed.record(host, 'video', failure('one'))
  const stamp = seed.control(host, 'video').stamp!
  const payload = structuredClone(storage.get<Record<string, unknown>>(EVIDENCE_KEY, {}))
  payload.dataRevision = Number.MAX_SAFE_INTEGER
  const records = payload.records as Record<string, { circuitControl: { revision: number } }>
  records[`video:${host}`]!.circuitControl.revision = Number.MAX_SAFE_INTEGER
  storage.remote(EVIDENCE_KEY, payload)
  await seed.record(host, 'video', failure('two'))
  const next = seed.control(host, 'video').stamp!
  assert.notEqual(next.generation, stamp.generation)
  assert.notEqual(next.recordId, stamp.recordId)
  assert.equal(Number.isSafeInteger(next.revision), true)
})
