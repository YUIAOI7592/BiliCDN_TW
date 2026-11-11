import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EvidenceStore, EVIDENCE_KEY } from '../../../src-v2/state/evidence-store.ts'
import { FakeStorage } from '../../support/storage.ts'
import { testScope } from '../../support/scope.ts'

test('V227 evidence storage: optional timing round trips without upgrading old samples or adding a key', async (t) => {
  const scope = testScope(t),
    storage = new FakeStorage(),
    now = 2_000_000_000_000
  const store = scope.own(new EvidenceStore(storage, () => now))
  await store.record('cdn.example', 'video', {
    requestId: 'full',
    at: now,
    source: 'transport',
    outcome: 'success',
    throughputMbps: 8,
    ttfbMs: 500,
    failureKind: null,
    ...{ bytes: 1_000_000, elapsedMs: 1000 },
  })
  const restored = scope.own(new EvidenceStore(storage, () => now))
  assert.equal(Reflect.get(restored.get('cdn.example', 'video')!.samples[0]!, 'bytes'), 1_000_000)
  assert.equal(Reflect.get(restored.get('cdn.example', 'video')!.samples[0]!, 'elapsedMs'), 1000)
  assert.equal(storage.get<{ schema: number } | null>(EVIDENCE_KEY, null)?.schema, 2)
  await store.record('cdn.example', 'audio', {
    requestId: 'old',
    at: now,
    source: 'transport',
    outcome: 'success',
    throughputMbps: 8,
    ttfbMs: null,
    failureKind: null,
  })
  const legacy = scope.own(new EvidenceStore(storage, () => now)).get('cdn.example', 'audio')!
    .samples[0]!
  assert.equal(Object.hasOwn(legacy, 'bytes'), false)
  assert.equal(Object.hasOwn(legacy, 'elapsedMs'), false)
  assert.deepEqual([...storage.values.keys()], [EVIDENCE_KEY])
})
test('V227 evidence storage: malformed optional timing is discarded without deleting valid legacy throughput', async (t) => {
  const scope = testScope(t),
    storage = new FakeStorage(),
    now = 2_000_000_000_000
  storage.set(EVIDENCE_KEY, {
    schema: 2,
    updatedAt: now,
    records: {
      video: {
        host: 'cdn.example',
        kind: 'video',
        updatedAt: now,
        circuitLevel: 0,
        circuitUntil: 0,
        samples: [
          {
            requestId: 'bad',
            at: now,
            source: 'transport',
            outcome: 'success',
            throughputMbps: 8,
            ttfbMs: 200,
            bytes: 65536,
            elapsedMs: 100,
          },
        ],
      },
    },
  })
  const store = scope.own(new EvidenceStore(storage, () => now)),
    s = store.get('cdn.example', 'video')!.samples[0]!
  assert.equal(s.throughputMbps, 8)
  assert.equal(Object.hasOwn(s, 'bytes'), false)
  assert.equal(Object.hasOwn(s, 'elapsedMs'), false)
})
