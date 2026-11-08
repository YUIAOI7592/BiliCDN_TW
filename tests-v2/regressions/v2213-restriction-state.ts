import { test } from 'node:test'
import type { TestContext } from 'node:test'
import assert from 'node:assert/strict'
import { RestrictionStore, RESTRICTIONS_KEY } from '../../src-v2/state/restriction-store.ts'
import { type StorageRead } from '../../src-v2/platform/storage-port.ts'
import { type RestrictionRecord } from '../../src-v2/state/restriction-contracts.ts'
import { FakeStorage } from '../support/storage.ts'
import { SharedEvidenceStorage } from '../support/shared-evidence-storage.ts'
import { testScope } from '../support/scope.ts'

const at = 2_000_000_000_000,
  host = 'cdn.example',
  otherHost = 'other.example'
const record = (name = host): RestrictionRecord => ({
  host: name,
  type: 'black',
  kind: 'all',
  reason: 'contract',
  createdAt: at,
  updatedAt: at,
  expireAt: at + 60_000,
})
const payload = (records: readonly RestrictionRecord[] = [record()], updatedAt = at) => ({
  schema: 2,
  records,
  updatedAt,
})

class ControlledStorage extends FakeStorage {
  failRead = false
  writes = 0
  deletes = 0
  mode: 'normal' | 'before' | 'after' | 'unreadable' | 'after-unreadable' | 'malformed' = 'normal'
  onRead: (() => void) | null = null
  onSet: (() => void) | null = null

  override readResult<T>(key: string, fallback: T): StorageRead<T> {
    if (this.failRead) return { ok: false }
    const value = this.get(key, fallback)
    const callback = this.onRead
    this.onRead = null
    callback?.()
    return { ok: true, value }
  }
  override set<T>(key: string, value: T): void {
    this.writes++
    if (this.mode === 'before') throw Error('controlled pre-write failure')
    if (this.mode === 'malformed')
      super.set(key, { schema: 2, records: [{ host: 'invalid' }], updatedAt: at })
    else super.set(key, value)
    const callback = this.onSet
    this.onSet = null
    callback?.()
    if (this.mode === 'unreadable' || this.mode === 'after-unreadable') this.failRead = true
    if (this.mode === 'after' || this.mode === 'after-unreadable')
      throw Error('controlled post-write failure')
  }
  override delete(key: string): void {
    this.deletes++
    super.delete(key)
  }
  notify(value: unknown): void {
    for (const listener of this.listeners.get(RESTRICTIONS_KEY) ?? []) listener(value, true)
  }
}

function createRestrictions(t: TestContext, initial = payload()) {
  const storage = new ControlledStorage()
  storage.values.set(RESTRICTIONS_KEY, structuredClone(initial))
  let now = at
  const store = testScope(t).own(new RestrictionStore(storage, () => now))
  return { store, storage, setNow: (value: number) => (now = value) }
}

test('V2213 restrictions: clear confirms a saved empty payload without deleting the key', async (t) => {
  const { store, storage } = createRestrictions(t)
  await store.clear()
  assert.deepEqual(storage.values.get(RESTRICTIONS_KEY), payload([]))
  assert.equal(storage.writes, 1)
  assert.equal(storage.deletes, 0)
  assert.equal(store.has(host, 'video'), false)
})

for (const mode of ['before', 'after', 'unreadable', 'after-unreadable'] as const) {
  test(`V2213 restrictions: ${mode} write outcome is reconciled without retry`, async (t) => {
    const { store, storage } = createRestrictions(t)
    storage.mode = mode
    if (mode === 'after') await store.clear()
    else await assert.rejects(store.clear())
    assert.equal(storage.writes, 1)
    assert.equal(storage.deletes, 0)
    assert.equal(store.has(host, 'video'), mode !== 'after')
    assert.deepEqual(
      storage.values.get(RESTRICTIONS_KEY),
      mode === 'before' ? payload() : payload([]),
    )
  })
}

test('V2213 restrictions: failed authoritative reads never become an empty write', async (t) => {
  const { store, storage } = createRestrictions(t)
  storage.failRead = true
  await assert.rejects(store.clear())
  assert.equal(storage.writes, 0)
  assert.deepEqual(storage.values.get(RESTRICTIONS_KEY), payload())
  assert.equal(store.has(host, 'audio'), true)
})

test('V2213 restrictions: filtered malformed rows cannot confirm an empty clear', async (t) => {
  const { store, storage } = createRestrictions(t)
  storage.mode = 'malformed'
  await assert.rejects(store.clear())
  assert.equal(storage.writes, 1)
  assert.equal(store.list().length, 0, 'cache follows actual effective data, not the proposal')
  assert.equal((storage.values.get(RESTRICTIONS_KEY) as { records: unknown[] }).records.length, 1)
})

test('V2213 restrictions: an already satisfied clear is idempotently confirmed after an exception', async (t) => {
  const { store, storage } = createRestrictions(t, payload([]))
  storage.mode = 'before'
  await store.clear()
  assert.equal(storage.writes, 1)
  assert.deepEqual(storage.values.get(RESTRICTIONS_KEY), payload([]))
})

test('V2213 restrictions: old same-millisecond notifications cannot revive a confirmed clear', async (t) => {
  const { store, storage } = createRestrictions(t)
  const old = structuredClone(storage.values.get(RESTRICTIONS_KEY))
  await store.clear()
  storage.notify(old)
  assert.equal(store.has(host, 'video'), false)
  assert.deepEqual(storage.values.get(RESTRICTIONS_KEY), payload([]))
})

test('V2213 restrictions: late deletion notifications cannot hide a newer persisted restriction', (t) => {
  const { store, storage, setNow } = createRestrictions(t, payload([]))
  const latest = payload([record()], at + 1)
  storage.values.set(RESTRICTIONS_KEY, latest)
  setNow(at + 2)
  storage.notify(undefined)
  assert.equal(store.has(host, 'audio'), true)
  assert.deepEqual(storage.values.get(RESTRICTIONS_KEY), latest)
})

test('V2213 restrictions: authoritative changes apply after wall-clock rollback', (t) => {
  const { store, storage, setNow } = createRestrictions(t)
  const latest = payload([], at - 1000)
  storage.values.set(RESTRICTIONS_KEY, latest)
  setNow(at - 1000)
  storage.notify(latest)
  assert.equal(store.has(host, 'video'), false)
})

test('V2213 restrictions: failed notification reads retain the last confirmed cache until recovery', (t) => {
  const { store, storage } = createRestrictions(t)
  storage.values.set(RESTRICTIONS_KEY, payload([]))
  storage.failRead = true
  storage.notify(undefined)
  assert.equal(store.has(host, 'video'), true)
  storage.failRead = false
  storage.notify(payload())
  assert.equal(store.has(host, 'video'), false)
})

test('V2213 restrictions: a reentrant newer read cannot be overwritten by an older read result', (t) => {
  const { store, storage } = createRestrictions(t)
  storage.onRead = () => {
    storage.values.set(RESTRICTIONS_KEY, payload([record(otherHost)]))
    storage.notify(null)
  }
  storage.notify(null)
  assert.equal(store.has(host, 'video'), false)
  assert.equal(store.has(otherHost, 'video'), true)
})

test('V2213 restrictions: reentrant authority changes invalidate a pending write proposal', async (t) => {
  const { store, storage } = createRestrictions(t)
  storage.onRead = () => {
    storage.values.set(RESTRICTIONS_KEY, payload([record(otherHost)]))
    storage.notify(null)
  }
  await assert.rejects(store.clear())
  assert.equal(storage.writes, 0)
  assert.equal(store.has(otherHost, 'video'), true)
})

test('V2213 restrictions: a synchronous newer write is adopted instead of overwritten after set', async (t) => {
  const { store, storage } = createRestrictions(t)
  storage.onSet = () => {
    storage.values.set(RESTRICTIONS_KEY, payload([record(otherHost)]))
    storage.notify(null)
  }
  await assert.rejects(store.clear())
  assert.equal(storage.writes, 1)
  assert.equal(store.has(otherHost, 'video'), true)
})

test('V2213 restrictions: input conversion reentrancy cannot submit an outdated add proposal', async (t) => {
  const { store, storage } = createRestrictions(t)
  const incoming = {
    ...record(otherHost),
    get host() {
      storage.values.set(RESTRICTIONS_KEY, payload([record('newer.example')]))
      storage.notify(null)
      return otherHost
    },
  }
  await assert.rejects(store.add(incoming))
  assert.equal(storage.writes, 0)
  assert.equal(store.has('newer.example', 'audio'), true)
  assert.equal(store.has(otherHost, 'video'), false)
})

test('V2213 restrictions: confirmation reentrancy cannot replace the newer authoritative cache', async (t) => {
  const { store, storage } = createRestrictions(t)
  storage.onSet = () => {
    const saved = storage.values.get(RESTRICTIONS_KEY) as object
    let reads = 0
    Object.defineProperty(saved, 'updatedAt', {
      get: () => {
        if (++reads === 2) {
          storage.values.set(RESTRICTIONS_KEY, payload([record(otherHost)]))
          storage.notify(null)
        }
        return at
      },
    })
  }
  await assert.rejects(store.clear())
  assert.equal(storage.writes, 1)
  assert.equal(store.has(otherHost, 'video'), true)
})

test('V2213 restrictions: synchronous notification of the accepted write still confirms once', async (t) => {
  const { store, storage } = createRestrictions(t)
  storage.onSet = () => storage.notify(payload())
  await store.clear()
  assert.equal(storage.writes, 1)
  assert.equal(store.has(host, 'video'), false)
})

for (const command of ['add', 'remove'] as const) {
  test(`V2213 restrictions: ${command} write failure leaves authority and cache aligned`, async (t) => {
    const { store, storage } = createRestrictions(t)
    storage.mode = 'before'
    await assert.rejects(command === 'remove' ? store.remove(host) : store.add(record(otherHost)))
    assert.equal(storage.writes, 1)
    assert.equal(store.has(host, 'video'), true)
    assert.equal(store.has(otherHost, 'video'), false)
    assert.deepEqual(storage.values.get(RESTRICTIONS_KEY), payload())
  })
}

test('V2213 restrictions: raw scalar field mismatches cannot confirm a write', async (t) => {
  const { store, storage } = createRestrictions(t)
  storage.onSet = () => {
    storage.values.set(RESTRICTIONS_KEY, { ...payload([]), updatedAt: String(at) })
  }
  await assert.rejects(store.clear())
  assert.equal(storage.writes, 1)
  assert.equal(store.list().length, 0)
})

test('V2213 restrictions: two stores serialize merges through the existing shared lock', async (t) => {
  const scope = testScope(t),
    storage = new SharedEvidenceStorage(),
    a = scope.own(new RestrictionStore(storage, () => at)),
    b = scope.own(new RestrictionStore(storage, () => at))
  await Promise.all([a.add(record()), b.add(record(otherHost))])
  const saved = storage.get<{ records: RestrictionRecord[] }>(RESTRICTIONS_KEY, { records: [] })
  assert.equal(saved.records.length, 2)
  for (const listener of storage.listeners.get(RESTRICTIONS_KEY) ?? []) listener(null, true)
  assert.equal(a.list().length, 2)
  assert.equal(b.list().length, 2)
})

test('V2213 restrictions: fallback locks retain confirmed local operation without atomicity claims', async (t) => {
  const { store, storage } = createRestrictions(t)
  await store.add(record(otherHost))
  assert.equal(store.list().length, 2)
  await store.remove(host)
  assert.equal(store.has(otherHost, 'audio'), true)
  await store.clear()
  assert.deepEqual(storage.values.get(RESTRICTIONS_KEY), payload([]))
})

test('V2213 restrictions: unreadable initialization recovers on a later authoritative notification', (t) => {
  const storage = new ControlledStorage()
  storage.values.set(RESTRICTIONS_KEY, payload())
  storage.failRead = true
  const store = testScope(t).own(new RestrictionStore(storage, () => at))
  assert.equal(storage.writes, 0)
  storage.failRead = false
  storage.notify(null)
  assert.equal(store.has(host, 'video'), true)
})

test('V2213 restrictions: disposed stores no longer accept notifications', async (t) => {
  const { store, storage } = createRestrictions(t)
  store.dispose()
  storage.values.set(RESTRICTIONS_KEY, payload([]))
  storage.notify(null)
  assert.equal(store.has(host, 'video'), true)
  assert.equal(storage.listeners.get(RESTRICTIONS_KEY)?.size, 0)
})
