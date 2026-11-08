import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  MeasurementMetaStore,
  MEASUREMENT_META_KEY,
} from '../../src-v2/state/measurement-meta-store.ts'
import { createRuntimeIds } from '../../src-v2/platform/runtime-ids.ts'
import { SharedEvidenceStorage } from '../support/shared-evidence-storage.ts'
import { FakeStorage } from '../support/storage.ts'

const now = 2_000_000_000_000
const claim = (revision = 1) => ({
  host: 'cdn.example',
  kind: 'video' as const,
  stamp: { generation: 'evidence-generation', recordId: 'host-record', revision },
  claimId: `claim-${revision}`,
  roundId: 'round-one',
})

class FaultMetadataStorage extends SharedEvidenceStorage {
  writeMode: 'normal' | 'before-save' | 'after-save' = 'normal'
  readFailed = false
  readCalls = 0
  failReadAt = -1
  failReadAfterSave = false
  writes = 0

  override readResult<T>(key: string, fallback: T): { ok: true; value: T } | { ok: false } {
    this.readCalls++
    if (this.readFailed || this.readCalls === this.failReadAt) return { ok: false }
    return super.readResult(key, fallback)
  }
  override set<T>(key: string, value: T): void {
    this.writes++
    if (this.writeMode === 'before-save') throw Error('metadata was not saved')
    super.set(key, value)
    if (this.failReadAfterSave) this.readFailed = true
    if (this.writeMode === 'after-save') throw Error('metadata saved but reply unknown')
  }
}

test('V2213 meta: shared priority claim survives reload and cannot be reclaimed', async () => {
  const storage = new SharedEvidenceStorage()
  const a = new MeasurementMetaStore(storage, () => now, createRuntimeIds())
  const b = new MeasurementMetaStore(storage, () => now, createRuntimeIds())
  await a.withLock((lock) => {
    const lease = a.coordination(lock)!
    assert.ok(lease)
    assert.equal(a.claimRevalidation(lease.generation, claim()), true)
  })
  await b.withLock((lock) => {
    const lease = b.coordination(lock)!
    assert.equal(lease.claims.length, 1)
    assert.equal(b.claimRevalidation(lease.generation, { ...claim(), claimId: 'another' }), false)
    assert.equal(b.claimRevalidation(lease.generation, claim(2)), true)
  })
})

test('V2213 meta: ordinary updates preserve claims and clear invalidates the old generation', async () => {
  const storage = new SharedEvidenceStorage()
  const meta = new MeasurementMetaStore(storage, () => now, createRuntimeIds())
  let generation = ''
  await meta.withLock((lock) => {
    const lease = meta.coordination(lock)!
    generation = lease.generation
    assert.equal(meta.claimRevalidation(generation, claim()), true)
    meta.update({ lastChallengeAt: now, catalogCursor: 4 })
    assert.equal(meta.coordination(lock)!.claims.length, 1)
  })
  await meta.clear()
  await meta.withLock((lock) => {
    const lease = meta.coordination(lock)!
    assert.notEqual(lease.generation, generation)
    assert.equal(lease.claims.length, 0)
    assert.equal(meta.claimRevalidation(generation, claim()), false)
    assert.deepEqual(meta.get(), { lastChallengeAt: 0, catalogCursor: 0 })
  })
})

test('V2213 meta: missing common lock cannot grant priority and protocol rollback cannot reset claims', async () => {
  const fallback = new MeasurementMetaStore(new FakeStorage(), () => now, createRuntimeIds())
  await fallback.withLock((lock) => assert.equal(fallback.coordination(lock), null))
  const storage = new SharedEvidenceStorage()
  const meta = new MeasurementMetaStore(storage, () => now, createRuntimeIds())
  await meta.withLock((lock) => assert.ok(meta.coordination(lock)))
  storage.set(MEASUREMENT_META_KEY, { schema: 2, catalogCursor: 0, lastChallengeAt: now })
  await meta.withLock((lock) => assert.equal(meta.coordination(lock), null))
})

test('V2213 meta: full claim capacity cannot evict an existing live control stamp', async () => {
  const meta = new MeasurementMetaStore(new SharedEvidenceStorage(), () => now, createRuntimeIds())
  await meta.withLock((lock) => {
    const lease = meta.coordination(lock)!
    for (let i = 0; i < 96; i++)
      assert.equal(
        meta.claimRevalidation(lease.generation, { ...claim(), host: `cdn-${i}.example` }),
        true,
      )
    assert.equal(meta.claimRevalidation(lease.generation, claim()), false)
    assert.equal(meta.coordination(lock)!.claims.length, 96)
    assert.equal(
      meta.claimRevalidation(lease.generation, { ...claim(2), host: 'cdn-0.example' }),
      true,
    )
  })
})

test('V2213 meta: concurrent stores reserve one priority claim for the same control stamp', async () => {
  const storage = new SharedEvidenceStorage(),
    a = new MeasurementMetaStore(storage, () => now, createRuntimeIds()),
    b = new MeasurementMetaStore(storage, () => now, createRuntimeIds())
  const reserve = (meta: MeasurementMetaStore, claimId: string) =>
    meta.withLock((lock) => {
      const lease = meta.coordination(lock)!
      return meta.claimRevalidation(lease.generation, { ...claim(), claimId })
    })
  assert.deepEqual(await Promise.all([reserve(a, 'claim-a'), reserve(b, 'claim-b')]), [true, false])
  await b.withLock((lock) => assert.equal(b.coordination(lock)!.claims.length, 1))
})

test('V2213 meta: a confirmed failed write cannot grant priority or erase the current claim set', async () => {
  const storage = new FaultMetadataStorage(),
    meta = new MeasurementMetaStore(storage, () => now, createRuntimeIds())
  await meta.withLock((lock) => {
    const lease = meta.coordination(lock)!
    storage.writeMode = 'before-save'
    assert.equal(meta.claimRevalidation(lease.generation, claim()), false)
    storage.writeMode = 'normal'
    assert.equal(meta.coordination(lock)!.claims.length, 0)
    assert.equal(meta.claimRevalidation(lease.generation, claim()), true)
  })
})

test('V2213 meta: saved writes with thrown replies are confirmed and cannot be reserved twice', async () => {
  const storage = new FaultMetadataStorage(),
    a = new MeasurementMetaStore(storage, () => now, createRuntimeIds()),
    b = new MeasurementMetaStore(storage, () => now, createRuntimeIds())
  await a.withLock((lock) => {
    const lease = a.coordination(lock)!
    storage.writeMode = 'after-save'
    assert.equal(a.claimRevalidation(lease.generation, claim()), true)
  })
  storage.writeMode = 'normal'
  await b.withLock((lock) => {
    const lease = b.coordination(lock)!
    assert.equal(lease.claims.length, 1)
    assert.equal(
      b.claimRevalidation(lease.generation, { ...claim(), claimId: 'late-claim' }),
      false,
    )
  })
})

test('V2213 meta: unavailable authoritative reads cannot initialize priority coordination', async () => {
  const storage = new FaultMetadataStorage(),
    meta = new MeasurementMetaStore(storage, () => now, createRuntimeIds())
  storage.readFailed = true
  await meta.withLock((lock) => assert.equal(meta.coordination(lock), null))
  assert.equal(storage.writes, 0)
})

test('V2213 meta: read failure between stamp checks rejects a claim without throwing or writing', async () => {
  const storage = new FaultMetadataStorage(),
    meta = new MeasurementMetaStore(storage, () => now, createRuntimeIds())
  await meta.withLock((lock) => {
    const lease = meta.coordination(lock)!,
      writes = storage.writes
    storage.failReadAt = storage.readCalls + 2
    let accepted = true
    assert.doesNotThrow(() => {
      accepted = meta.claimRevalidation(lease.generation, claim())
    })
    assert.equal(accepted, false)
    assert.equal(storage.writes, writes)
  })
})

test('V2213 meta: an unconfirmed saved claim stays consumed after authoritative reads recover', async () => {
  const storage = new FaultMetadataStorage(),
    a = new MeasurementMetaStore(storage, () => now, createRuntimeIds()),
    b = new MeasurementMetaStore(storage, () => now, createRuntimeIds())
  await a.withLock((lock) => {
    const lease = a.coordination(lock)!
    storage.failReadAfterSave = true
    assert.equal(a.claimRevalidation(lease.generation, claim()), false)
  })
  storage.failReadAfterSave = false
  storage.readFailed = false
  await b.withLock((lock) => {
    const lease = b.coordination(lock)!
    assert.equal(lease.claims.length, 1)
    assert.equal(
      b.claimRevalidation(lease.generation, { ...claim(), claimId: 'retry-claim' }),
      false,
    )
  })
})

test('V2213 meta: clear failure preserves claims and does not announce a new generation', async () => {
  const storage = new FaultMetadataStorage(),
    meta = new MeasurementMetaStore(storage, () => now, createRuntimeIds())
  let generation = ''
  await meta.withLock((lock) => {
    const lease = meta.coordination(lock)!
    generation = lease.generation
    assert.equal(meta.claimRevalidation(generation, claim()), true)
  })
  storage.writeMode = 'before-save'
  await assert.rejects(meta.clear(), /write unconfirmed/)
  storage.writeMode = 'normal'
  await meta.withLock((lock) => {
    const lease = meta.coordination(lock)!
    assert.equal(lease.generation, generation)
    assert.equal(lease.claims.length, 1)
    assert.equal(meta.claimRevalidation(generation, claim()), false)
  })
})

test('V2213 meta: a queued clear prevents a stale round from resurrecting its old claim', async () => {
  const storage = new SharedEvidenceStorage(),
    a = new MeasurementMetaStore(storage, () => now, createRuntimeIds()),
    b = new MeasurementMetaStore(storage, () => now, createRuntimeIds())
  let generation = ''
  await a.withLock((lock) => {
    const lease = a.coordination(lock)!
    generation = lease.generation
    assert.equal(a.claimRevalidation(generation, claim()), true)
  })
  const clear = b.clear()
  const staleRound = a.withLock(() => a.claimRevalidation(generation, claim(2)))
  await clear
  assert.equal(await staleRound, false)
  await a.withLock((lock) => {
    const lease = a.coordination(lock)!
    assert.notEqual(lease.generation, generation)
    assert.deepEqual(lease.claims, [])
  })
})

test('V2213 meta: failed authoritative clear reads cannot overwrite current coordination', async () => {
  const storage = new FaultMetadataStorage(),
    meta = new MeasurementMetaStore(storage, () => now, createRuntimeIds())
  await meta.withLock((lock) => assert.ok(meta.coordination(lock)))
  const before = structuredClone(storage.get(MEASUREMENT_META_KEY, null)),
    writes = storage.writes
  storage.readFailed = true
  await assert.rejects(meta.clear(), /read unconfirmed/)
  assert.equal(storage.writes, writes)
  assert.deepEqual(storage.get(MEASUREMENT_META_KEY, null), before)
})
