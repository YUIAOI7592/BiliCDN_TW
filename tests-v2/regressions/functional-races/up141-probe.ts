import { test } from 'node:test'
import assert from 'node:assert/strict'
import { RangeProbeAdapter } from '../../../src-v2/adapters/range-probe.ts'
import { SignedRouteVault } from '../../../src-v2/state/signed-route-vault.ts'
import { generationId, epochId } from '../../../src-v2/domain/model.ts'
import type { RangeProbeInput } from '../../../src-v2/application/ports.ts'
import { testScope } from '../../support/scope.ts'
import { setImmediate as nextTurn } from 'node:timers/promises'
import { fixture, dash } from './routing-fixture.ts'
import { MeasurementController } from '../../../src-v2/application/measurement-controller.ts'
import { MeasurementMetaStore } from '../../../src-v2/state/measurement-meta-store.ts'
import type { RangeProbeResult } from '../../../src-v2/application/ports.ts'
import { deferred } from '../../support/deferred.ts'
import { probeStartByte } from '../../../src-v2/domain/probe-range.ts'

const host = 'upos-sz-mirrorali.bilivideo.com'
const url = `https://${host}/upgcxcode/1/2/3/video.m4s?fixture=1`
const length = 64 * 1024

test('UP141-PROBE middle selection is aligned, bounded, deterministic and conservative', (t) => {
  testScope(t)
  assert.equal(probeStartByte(null, length, 0.5), 0)
  assert.equal(probeStartByte(1048576 + length - 1, length, 0.5), 0)
  assert.equal(probeStartByte(1048576 + length, length, 0.999), 1048576)
  for (const draw of [0, 0.1, 0.5, 0.999999]) {
    const start = probeStartByte(4194304, length, draw)
    assert.equal(start % length, 0)
    assert.ok(start >= 1048576 && start + length <= 4194304)
    assert.equal(start, probeStartByte(4194304, length, draw))
  }
  for (const draw of [-1, 1, Infinity, NaN]) assert.equal(probeStartByte(4194304, length, draw), 0)
  for (const total of [NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, -1])
    assert.equal(probeStartByte(total, length, 0.5), 0)
})
function response(range: string | null, status = 206): Response {
  const value = new Response(new Uint8Array(length), {
    status,
    headers: range === null ? {} : { 'Content-Range': range },
  })
  Object.defineProperty(value, 'url', { value: url })
  return value
}

test('UP141-PROBE shifted Range uses exact validated Content-Range', async (t) => {
  testScope(t)
  let range = ''
  const probe = new RangeProbeAdapter(
    (async (_url, init) => {
      range = new Headers(init?.headers).get('Range') ?? ''
      return response('bytes 1048576-1114111/4194304')
    }) as typeof fetch,
    () => 1,
  )
  const result = await probe.read({
    url,
    host,
    startByte: 1048576,
    limit: length,
    signal: new AbortController().signal,
    completionReason: 'complete',
  } as RangeProbeInput)
  assert.equal(range, 'bytes=1048576-1114111')
  assert.equal(result.directRange, true)
  assert.deepEqual((result as unknown as { range: unknown }).range, {
    startByte: 1048576,
    endByte: 1114111,
    totalBytes: 4194304,
  })
})

for (const [name, header, status] of [
  ['missing', null, 206],
  ['wrong start', 'bytes 0-65535/4194304', 206],
  ['wrong end', 'bytes 1048576-1048600/4194304', 206],
  ['unsafe total', 'bytes 1048576-1114111/9007199254740992', 206],
  ['not range', 'bytes 1048576-1114111/4194304', 200],
] as const)
  test(`UP141-PROBE shifted response rejects ${name}`, async (t) => {
    testScope(t)
    const probe = new RangeProbeAdapter(
      (async () => response(header, status)) as typeof fetch,
      () => 1,
    )
    const result = await probe.read({
      url,
      host,
      startByte: 1048576,
      limit: length,
      signal: new AbortController().signal,
      completionReason: 'complete',
    } as RangeProbeInput)
    assert.equal(result.directRange, false)
    assert.equal(result.bytes, 0)
  })

test('UP141-PROBE head without exposed range preserves direct 206 but learns no size', async (t) => {
  testScope(t)
  const probe = new RangeProbeAdapter((async () => response(null)) as typeof fetch, () => 1)
  const result = await probe.read({
    url,
    host,
    limit: length,
    signal: new AbortController().signal,
    completionReason: 'complete',
  })
  assert.equal(result.directRange, true)
  assert.equal((result as unknown as { range: unknown }).range, null)
})

test('UP141-PROBE invalid outgoing range never starts a fetch', async (t) => {
  testScope(t)
  let calls = 0
  const probe = new RangeProbeAdapter(
    (async () => {
      calls++
      return response(null)
    }) as typeof fetch,
    () => 1,
  )
  for (const startByte of [-1, NaN, Number.MAX_SAFE_INTEGER]) {
    const result = await probe.read({
      url,
      host,
      startByte,
      limit: length,
      signal: new AbortController().signal,
      completionReason: 'complete',
    })
    assert.equal(result.reason, 'invalid-range')
  }
  assert.equal(calls, 0)
})

test('UP141-PROBE size belongs to current exact source handle and expires with authority', (t) => {
  testScope(t)
  const vault = new SignedRouteVault()
  const generation = generationId(1),
    epoch = epochId(1)
  vault.reset(generation, epoch)
  const input = {
    generation,
    epoch,
    kind: 'video' as const,
    key: 'video',
    height: 1080,
    codec: 'avc',
    bandwidth: 4_000_000,
    urls: [url],
    source: 'page-hint' as const,
  }
  const rep = vault.register(input)!
  const identity = vault.identity(rep)!,
    handle = vault.catalogSourceHandle(rep)!
  const port = vault
  assert.equal(typeof port.recordRangeSize, 'function')
  port.recordRangeSize(identity, handle, 4194304)
  assert.equal(port.rangeSize(identity, handle), 4194304)
  vault.register({ ...input, source: 'trusted-api' })
  assert.equal(port.rangeSize(identity, handle), null)
  port.recordRangeSize(identity, handle, 8388608)
  const current = vault.identity(rep)!,
    currentHandle = vault.catalogSourceHandle(rep)!
  assert.equal(port.rangeSize(current, currentHandle), null)
  port.recordRangeSize(current, currentHandle, 8388608)
  port.recordRangeSize(current, currentHandle, null)
  assert.equal(port.rangeSize(current, currentHandle), null)
})

for (const outcome of ['success', '416', 'cancelled'] as const)
  test(`UP141-PROBE round shares one middle range and ${outcome} handles metadata safely`, async (t) => {
    const scope = testScope(t),
      f = fixture(scope)
    f.adapter.transform(dash(url))
    const identity = f.vault.contextForUrl(url)!,
      handle = f.vault.catalogSourceHandle(identity.representation)!
    f.vault.recordRangeSize(identity, handle, 4194304)
    const starts: number[] = [],
      pending = deferred<RangeProbeResult>()
    const controller = scope.own(
      new MeasurementController(
        f.routes,
        new MeasurementMetaStore(f.storage, f.clock.now),
        {
          read: async (input) => {
            starts.push(input.startByte ?? 0)
            if (outcome === 'cancelled') return await pending.promise
            return {
              bytes: outcome === '416' ? 0 : input.limit,
              elapsedMs: 100,
              ttfbMs: 5,
              status: outcome === '416' ? 416 : 206,
              directRange: outcome !== '416',
              reason: outcome === '416' ? 'http-416' : 'measured',
              range:
                outcome === '416'
                  ? null
                  : {
                      startByte: input.startByte ?? 0,
                      endByte: (input.startByte ?? 0) + input.limit - 1,
                      totalBytes: 4194304,
                    },
            }
          },
        },
        f.clock.now,
        f.clock,
        f.vault,
        () => 0.5,
      ),
    )
    controller.tick({
      generationActive: true,
      representation: identity.representation,
      demand: { kind: 'video', requiredMbps: 8, highDemand: false },
      stableProgressSec: 25,
      playableBufferSec: 40,
      visible: true,
      seeking: false,
      recovering: false,
      disabled: false,
    })
    await nextTurn()
    assert.ok(starts[0]! >= 1048576)
    if (outcome === 'cancelled') {
      controller.reset()
      pending.resolve({
        bytes: 384 * 1024,
        elapsedMs: 100,
        ttfbMs: 5,
        status: 206,
        directRange: true,
        reason: 'measured',
        range: { startByte: starts[0]!, endByte: starts[0]! + 384 * 1024 - 1, totalBytes: 8388608 },
      })
      await nextTurn()
      assert.equal(f.vault.rangeSize(identity, handle), 4194304)
    } else {
      assert.equal(starts.length, 3)
      assert.ok(starts.every((start) => start === starts[0]))
      assert.equal(f.vault.rangeSize(identity, handle), outcome === '416' ? null : 4194304)
    }
    assert.equal(f.clock.pendingCount, 0)
  })
