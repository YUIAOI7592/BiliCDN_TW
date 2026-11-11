import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  MeasurementMetaStore,
  MEASUREMENT_META_KEY,
} from '../../../src-v2/state/measurement-meta-store.ts'
import { createRuntimeIds } from '../../../src-v2/platform/runtime-ids.ts'
import { SharedEvidenceStorage } from '../../support/shared-evidence-storage.ts'
import { FakeStorage } from '../../support/storage.ts'
import { EvidenceStore, EVIDENCE_KEY } from '../../../src-v2/state/evidence-store.ts'
import { testScope } from '../../support/scope.ts'
import { type StoragePort } from '../../../src-v2/platform/storage-port.ts'

const now = 2_000_000_000_000
const claim = (revision = 1) => ({
  host: 'cdn.example',
  kind: 'video' as const,
  stamp: { generation: 'evidence-generation', recordId: 'host-record', revision },
  claimId: `claim-${revision}`,
  roundId: 'round-one',
})
const currentControl = (revision = 1) => ({
  stamp: claim(revision).stamp,
  level: 1,
  until: now - 1,
  synchronized: true,
})
const metadata = (storage: StoragePort, authority = { revision: 1 }) =>
  new MeasurementMetaStore(
    storage,
    () => now,
    createRuntimeIds(),
    () => currentControl(authority.revision),
  )

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
  const storage = new SharedEvidenceStorage(),
    authority = { revision: 1 }
  const a = metadata(storage, authority)
  const b = metadata(storage, authority)
  await a.withLock((lock) => {
    const lease = a.coordination(lock)!
    assert.ok(lease)
    assert.equal(a.claimRevalidation(lease.generation, claim()), true)
  })
  await b.withLock((lock) => {
    const lease = b.coordination(lock)!
    assert.equal(lease.claims.length, 1)
    assert.equal(b.claimRevalidation(lease.generation, { ...claim(), claimId: 'another' }), false)
    authority.revision = 2
    assert.equal(b.claimRevalidation(lease.generation, claim(2)), true)
  })
})

test('V2213 meta: ordinary updates preserve claims and clear invalidates the old generation', async () => {
  const storage = new SharedEvidenceStorage()
  const meta = metadata(storage)
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
  const fallback = metadata(new FakeStorage())
  await fallback.withLock((lock) => assert.equal(fallback.coordination(lock), null))
  const storage = new SharedEvidenceStorage()
  const meta = metadata(storage)
  await meta.withLock((lock) => assert.ok(meta.coordination(lock)))
  storage.set(MEASUREMENT_META_KEY, { schema: 2, catalogCursor: 0, lastChallengeAt: now })
  await meta.withLock((lock) => assert.equal(meta.coordination(lock), null))
})

test('V2213 meta: full claim capacity cannot evict an existing live control stamp', async () => {
  const authority = { revision: 1 },
    meta = metadata(new SharedEvidenceStorage(), authority)
  await meta.withLock((lock) => {
    const lease = meta.coordination(lock)!
    for (let i = 0; i < 96; i++)
      assert.equal(
        meta.claimRevalidation(lease.generation, { ...claim(), host: `cdn-${i}.example` }),
        true,
      )
    assert.equal(meta.claimRevalidation(lease.generation, claim()), false)
    assert.equal(meta.coordination(lock)!.claims.length, 96)
    authority.revision = 2
    assert.equal(
      meta.claimRevalidation(lease.generation, { ...claim(2), host: 'cdn-0.example' }),
      true,
    )
  })
})

test('V2213 meta: concurrent stores reserve one priority claim for the same control stamp', async () => {
  const storage = new SharedEvidenceStorage(),
    a = metadata(storage),
    b = metadata(storage)
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
    meta = metadata(storage)
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
    a = metadata(storage),
    b = metadata(storage)
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
    meta = metadata(storage)
  storage.readFailed = true
  await meta.withLock((lock) => assert.equal(meta.coordination(lock), null))
  assert.equal(storage.writes, 0)
})

test('V2213 meta: read failure between stamp checks rejects a claim without throwing or writing', async () => {
  const storage = new FaultMetadataStorage(),
    meta = metadata(storage)
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
    a = metadata(storage),
    b = metadata(storage)
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
    meta = metadata(storage)
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
    authority = { revision: 1 },
    a = metadata(storage, authority),
    b = metadata(storage, authority)
  let generation = ''
  await a.withLock((lock) => {
    const lease = a.coordination(lock)!
    generation = lease.generation
    assert.equal(a.claimRevalidation(generation, claim()), true)
  })
  authority.revision = 2
  const clear = b.clear()
  const staleRound = a.withLock(() => a.claimRevalidation(generation, claim(2)))
  await clear
  assert.equal(await staleRound, false)
  await a.withLock((lock) => {
    const lease = a.coordination(lock)!
    assert.notEqual(lease.generation, generation)
    assert.deepEqual(lease.claims, [])
    assert.equal(
      a.claimRevalidation(lease.generation, claim(2)),
      true,
      'the same current evidence is eligible when owned by the new round',
    )
  })
})

test('V2213 meta: failed authoritative clear reads cannot overwrite current coordination', async () => {
  const storage = new FaultMetadataStorage(),
    meta = metadata(storage)
  await meta.withLock((lock) => assert.ok(meta.coordination(lock)))
  const before = structuredClone(storage.get(MEASUREMENT_META_KEY, null)),
    writes = storage.writes
  storage.readFailed = true
  await assert.rejects(meta.clear(), /read unconfirmed/)
  assert.equal(storage.writes, writes)
  assert.deepEqual(storage.get(MEASUREMENT_META_KEY, null), before)
})

for (const change of ['revision', 'generation'] as const) {
  test(`V2213 meta: delayed evidence notifications cannot replace a newer ${change} claim with an old stamp`, async (t) => {
    const scope = testScope(t),
      storage = new SharedEvidenceStorage()
    let at = now
    const b = scope.own(new EvidenceStore(storage, () => at, createRuntimeIds()))
    const fail = (requestId: string) =>
      b.record('cdn.example', 'video', {
        requestId,
        at,
        source: 'transport',
        outcome: 'failure',
        throughputMbps: null,
        ttfbMs: null,
        failureKind: 'network',
      })
    await fail('first-failure')
    at = b.control('cdn.example', 'video').until + 1
    const a = scope.own(new EvidenceStore(storage, () => at, createRuntimeIds())),
      oldStamp = a.control('cdn.example', 'video').stamp!,
      metaA = new MeasurementMetaStore(
        storage,
        () => at,
        createRuntimeIds(),
        (host, kind) => a.readCurrentControl(host, kind),
      ),
      metaB = new MeasurementMetaStore(
        storage,
        () => at,
        createRuntimeIds(),
        (host, kind) => b.readCurrentControl(host, kind),
      )
    await metaA.withLock((lock) => {
      const lease = metaA.coordination(lock)!
      assert.equal(metaA.claimRevalidation(lease.generation, { ...claim(), stamp: oldStamp }), true)
    })
    // SharedEvidenceStorage deliberately retains each store's cache until remote notification.
    if (change === 'generation') await b.clear()
    await fail('newer-failure')
    const current = b.control('cdn.example', 'video')
    at = current.until + 1
    assert.deepEqual(a.control('cdn.example', 'video').stamp, oldStamp)
    assert.notDeepEqual(current.stamp, oldStamp)
    await metaB.withLock((lock) => {
      const lease = metaB.coordination(lock)!
      assert.equal(
        metaB.claimRevalidation(lease.generation, { ...claim(2), stamp: current.stamp! }),
        true,
      )
    })
    await metaA.withLock((lock) => {
      const lease = metaA.coordination(lock)!
      assert.equal(
        metaA.claimRevalidation(lease.generation, { ...claim(), stamp: oldStamp }),
        false,
        'an old cached control cannot replace the current claim',
      )
      assert.deepEqual(metaA.coordination(lock)!.claims[0]!.stamp, current.stamp)
    })
    await metaB.withLock((lock) => {
      const lease = metaB.coordination(lock)!
      assert.equal(
        metaB.claimRevalidation(lease.generation, { ...claim(2), stamp: current.stamp! }),
        false,
        'the newer control remains consumed',
      )
    })
  })
}

test('V2213 meta: unavailable evidence authority cannot replace or consume a shared claim', async (t) => {
  class Storage extends SharedEvidenceStorage {
    failEvidenceRead = false
    override readResult<T>(key: string, fallback: T) {
      return key === EVIDENCE_KEY && this.failEvidenceRead
        ? { ok: false as const }
        : super.readResult(key, fallback)
    }
  }
  const storage = new Storage(),
    scope = testScope(t)
  let at = now
  const evidence = scope.own(new EvidenceStore(storage, () => at, createRuntimeIds())),
    meta = new MeasurementMetaStore(
      storage,
      () => at,
      createRuntimeIds(),
      (host, kind) => evidence.readCurrentControl(host, kind),
    )
  const fail = (requestId: string) =>
    evidence.record('cdn.example', 'video', {
      requestId,
      at,
      source: 'transport',
      outcome: 'failure',
      throughputMbps: null,
      ttfbMs: null,
      failureKind: 'network',
    })
  await fail('first-authority')
  at = evidence.control('cdn.example', 'video').until + 1
  await meta.withLock((lock) => {
    const lease = meta.coordination(lock)!
    assert.equal(
      meta.claimRevalidation(lease.generation, {
        ...claim(),
        stamp: evidence.control('cdn.example', 'video').stamp!,
      }),
      true,
    )
  })
  await fail('new-authority')
  const current = evidence.control('cdn.example', 'video')
  at = current.until + 1
  const before = structuredClone(storage.get(MEASUREMENT_META_KEY, null))
  storage.failEvidenceRead = true
  await meta.withLock((lock) => {
    const lease = meta.coordination(lock)!
    assert.equal(
      meta.claimRevalidation(lease.generation, { ...claim(2), stamp: current.stamp! }),
      false,
    )
  })
  assert.deepEqual(storage.get(MEASUREMENT_META_KEY, null), before)
  storage.failEvidenceRead = false
  await meta.withLock((lock) => {
    const lease = meta.coordination(lock)!
    assert.equal(
      meta.claimRevalidation(lease.generation, { ...claim(2), stamp: current.stamp! }),
      true,
    )
  })
})

test('V2213 meta: absent or unexpired evidence authority cannot grant priority', async () => {
  const storage = new SharedEvidenceStorage(),
    absent = new MeasurementMetaStore(storage, () => now, createRuntimeIds()),
    unexpired = new MeasurementMetaStore(
      storage,
      () => now,
      createRuntimeIds(),
      () => ({
        ...currentControl(),
        until: now + 1,
      }),
    )
  for (const meta of [absent, unexpired])
    await meta.withLock((lock) => {
      const lease = meta.coordination(lock)!
      assert.equal(meta.claimRevalidation(lease.generation, claim()), false)
      assert.deepEqual(meta.coordination(lock)!.claims, [])
    })
})
