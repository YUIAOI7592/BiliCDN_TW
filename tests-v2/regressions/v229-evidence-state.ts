import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EvidenceStore, EVIDENCE_KEY } from '../../src-v2/state/evidence-store.ts'
import { FakeStorage } from '../support/storage.ts'
import { testScope } from '../support/scope.ts'

for (const basis of [
  'fetch-consumer',
  'xhr-terminal',
  'probe-reader',
  'invalid',
  undefined,
] as const)
  test(`V229 evidence timing basis round trip: ${basis ?? 'legacy'}`, async (t) => {
    const scope = testScope(t),
      storage = new FakeStorage(),
      now = 2000000000000
    const sample = {
      requestId: 'sample',
      at: now,
      source: 'transport',
      outcome: 'success',
      throughputMbps: 8,
      ttfbMs: 20,
      failureKind: null,
      bytes: 100000,
      elapsedMs: 100,
      ...(basis ? { timingBasis: basis } : {}),
    }
    storage.values.set(EVIDENCE_KEY, {
      schema: 2,
      updatedAt: now,
      records: {
        entry: {
          host: 'cdn.example',
          kind: 'video',
          samples: [sample],
          circuitLevel: 0,
          circuitUntil: 0,
          updatedAt: now,
        },
      },
    })
    const before = structuredClone(storage.values.get(EVIDENCE_KEY)),
      store = scope.own(new EvidenceStore(storage, () => now))
    const read = store.get('cdn.example', 'video')!.samples[0]!
    assert.equal(read.timingBasis, basis === 'invalid' ? undefined : basis)
    assert.equal(read.throughputMbps, 8)
    assert.equal(read.bytes, 100000)
    assert.deepEqual(
      storage.values.get(EVIDENCE_KEY),
      before,
      'reading never upgrades stored payload',
    )
  })
