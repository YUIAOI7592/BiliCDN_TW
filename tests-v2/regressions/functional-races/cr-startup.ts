import test from 'node:test'
import assert from 'node:assert/strict'
import { MeasurementController } from '../../../src-v2/application/measurement-controller.ts'
import type { RangeProbePort, RangeProbeResult } from '../../../src-v2/application/ports.ts'
import { fixture, media } from '../../support/runtime-fixture.ts'
import { deferred } from '../../support/deferred.ts'

function controlledProbe() {
  const pending: { complete: (value: RangeProbeResult) => void; signal: AbortSignal }[] = []
  const probe: RangeProbePort = {
    async read({ signal }) {
      const result = deferred<RangeProbeResult>()
      const abort = () =>
        result.resolve({
          bytes: 0,
          elapsedMs: 1,
          ttfbMs: null,
          status: null,
          directRange: false,
          reason: 'cancelled',
        })
      signal.addEventListener('abort', abort, { once: true })
      pending.push({ complete: result.resolve, signal })
      try {
        return await result.promise
      } finally {
        signal.removeEventListener('abort', abort)
      }
    },
  }
  return {
    probe,
    pending,
    succeed: () => {
      for (const item of pending)
        if (!item.signal.aborted)
          item.complete({
            bytes: 256 * 1024,
            elapsedMs: 100,
            ttfbMs: 10,
            status: 206,
            directRange: true,
            reason: 'measured',
          })
    },
  }
}

test('CR-03 content reset during startup must not reopen the per-tab probe budget', async (t) => {
  const probe = controlledProbe(),
    f = fixture(t, undefined, probe.probe)
  assert.ok(f.measurement instanceof MeasurementController)
  const first = media(100),
    firstUrl = first.data.dash.video[0]!.base_url
  assert.equal(f.playurl.transform(first, 'trusted-api').accepted, true)
  const oldEpoch = f.session.get().epoch
  const firstWaiter = f.measurement.prepareStartup(firstUrl)
  const used = probe.pending.length
  assert.ok(used > 0)
  const next = media(200),
    nextUrl = next.data.dash.video[0]!.base_url
  assert.equal(f.playurl.transform(next, 'trusted-api').accepted, true)
  assert.notEqual(f.session.get().epoch, oldEpoch)
  assert.ok(
    probe.pending.every((item) => item.signal.aborted),
    'Runtime synchronously cancels old content probes',
  )
  const secondWaiter = f.measurement.prepareStartup(nextUrl)
  const afterReset = probe.pending.length
  probe.succeed()
  await Promise.all([firstWaiter, secondWaiter])
  assert.equal(
    afterReset,
    used,
    'the same tab already started its one startup window; new content must not probe again',
  )
})

test('CR-03 control: completed startup keeps its consumed budget after content reset', async (t) => {
  const probe = controlledProbe(),
    f = fixture(t, undefined, probe.probe)
  assert.ok(f.measurement instanceof MeasurementController)
  const first = media(100),
    firstUrl = first.data.dash.video[0]!.base_url
  assert.equal(f.playurl.transform(first, 'trusted-api').accepted, true)
  const firstWaiter = f.measurement.prepareStartup(firstUrl)
  const used = probe.pending.length
  probe.succeed()
  await firstWaiter
  const next = media(200),
    nextUrl = next.data.dash.video[0]!.base_url
  assert.equal(f.playurl.transform(next, 'trusted-api').accepted, true)
  await f.measurement.prepareStartup(nextUrl)
  assert.ok(used > 0)
  assert.equal(probe.pending.length, used)
})

test('CR-03 pending gate remains joinable after reservation and one abort preserves other waiters', async (t) => {
  const probe = controlledProbe(),
    f = fixture(t, undefined, probe.probe),
    payload = media(100),
    url = payload.data.dash.video[0]!.base_url
  assert.ok(f.measurement instanceof MeasurementController)
  f.playurl.transform(payload, 'trusted-api')
  const a = new AbortController(),
    reason = { synthetic: 'own cancellation' }
  const first = f.measurement.prepareStartup(url, a.signal),
    count = probe.pending.length
  assert.ok(f.measurement.willGateStartup(url))
  let completed = false
  const second = f.measurement.prepareStartup(url).then(() => {
    completed = true
  })
  a.abort(reason)
  await assert.rejects(first, (error) => error === reason)
  assert.equal(completed, false)
  assert.equal(probe.pending.length, count)
  probe.succeed()
  await second
  assert.equal(completed, true)
  assert.equal(f.measurement.willGateStartup(url), false)
})

test('CR-03 no legal candidate does not consume the startup budget', async (t) => {
  const probe = controlledProbe(),
    f = fixture(t, undefined, probe.probe)
  assert.ok(f.measurement instanceof MeasurementController)
  await f.measurement.prepareStartup('https://example.invalid/not-media')
  assert.equal(probe.pending.length, 0)
  const payload = media(100),
    url = payload.data.dash.video[0]!.base_url
  f.playurl.transform(payload, 'trusted-api')
  const pending = f.measurement.prepareStartup(url)
  assert.ok(probe.pending.length > 0)
  probe.succeed()
  await pending
})

test('CR-03 rejected startup probes clean timers and cannot reopen the tab budget', async (t) => {
  let probes = 0
  const f = fixture(t, undefined, {
    read: async () => {
      probes++
      throw Error('synthetic')
    },
  })
  assert.ok(f.measurement instanceof MeasurementController)
  const payload = media(100),
    url = payload.data.dash.video[0]!.base_url
  f.playurl.transform(payload, 'trusted-api')
  await f.measurement.prepareStartup(url)
  assert.equal(f.measurement.snapshot().startup?.reason, 'preflight-error')
  const count = probes
  f.measurement.reset()
  await f.measurement.prepareStartup(url)
  assert.equal(probes, count)
})
