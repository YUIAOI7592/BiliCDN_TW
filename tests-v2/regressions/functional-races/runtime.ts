import test from 'node:test'
import assert from 'node:assert/strict'
import { createRuntimeIds } from '../../../src-v2/platform/runtime-ids.ts'
import { TransportContext } from '../../../src-v2/adapters/transport-context.ts'
import { TRUSTED_CATALOG } from '../../../src-v2/domain/catalog.ts'
import { fixture, media, blankVideo } from '../../support/runtime-fixture.ts'

test('R01 epoch notification resets runtime synchronously before registration; quality changes preserve the epoch', t => {
  const f = fixture(t)
  f.playurl.transform(media(100), 'trusted-api')
  const before = f.calls.resets, initial = f.session.get()
  const quality = media(100); quality.data.dash.video[0]!.id = 64
  f.playurl.transform(quality, 'trusted-api')
  assert.equal(f.session.get().epoch, initial.epoch); assert.equal(f.calls.resets, before)
  let notices = 0
  f.scope.defer(f.content.subscribeEpoch(state => {
    notices++; assert.equal(f.calls.resets, before + 1)
    assert.deepEqual(Object.keys(state).sort(), ['epoch', 'generation'])
    assert.equal(f.vault.match(media(200).data.dash.video[0]!.base_url).context, null)
  }))
  f.playurl.transform(media(200), 'trusted-api')
  assert.equal(notices, 1)
})

test('R01 disposed runtime releases the content subscription', t => {
  const f = fixture(t); f.playurl.transform(media(100), 'trusted-api')
  f.runtime.dispose(); const resets = f.calls.resets
  f.playurl.transform(media(200), 'trusted-api'); assert.equal(f.calls.resets, resets)
})

for (const boundary of ['generation', 'epoch'] as const) {
  test(`${boundary === 'epoch' ? 'R01' : 'CONTROL R01'} new ${boundary} must not restore previous content position`, t => {
    const f = fixture(t)
    const initial = media(100)
    assert.equal(f.playurl.transform(initial, 'trusted-api', 'initial').accepted, true)
    f.setVideo({ ...blankVideo(), readyState: 4, width: 1920, height: 1080, playableBufferSec: 40, coreInitialized: true })
    f.clock.advance(1000)
    const identity = f.vault.match(initial.data.dash.video[0]!.base_url).context
    assert.ok(identity)
    f.request(initial.data.dash.video[0]!.base_url)
    // Real route fallback event reaches RuntimeController, which arms core recovery.
    f.routes.recover(identity.representation, { kind: 'video', requiredMbps: 8, highDemand: false }, 'verified-failure', TRUSTED_CATALOG[0])
    assert.equal(f.recovery.isRecovering(), true)
    f.setVideo(blankVideo())
    f.clock.advance(4000)
    assert.equal(f.calls.reloads, 1, 'fixture reached a pending real recovery reload')
    const previous = f.session.get()
    if (boundary === 'generation') f.navigate()
    assert.equal(f.playurl.transform(media(200), 'trusted-api', 'next').accepted, true)
    const next = f.session.get()
    if (boundary === 'epoch') { assert.equal(next.generation, previous.generation); assert.equal(Number(next.epoch), Number(previous.epoch) + 1) }
    else assert.notEqual(next.generation, previous.generation)
    f.setVideo({ ...blankVideo(), currentTime: 0, playbackRate: 1, effectiveRate: 1, readyState: 3,
      width: 1920, height: 1080, playableBufferSec: 5, coreInitialized: true, frames: 1 })
    f.clock.advance(1000)
    assert.deepEqual(f.calls.seeks, [], 'old recovery must not seek new content to previous 120-second position')
    assert.deepEqual(f.calls.rates, [], 'old recovery must not restore previous content playback rate')
    assert.equal(f.calls.plays, 0)
  })
}

for (const kind of ['video', 'audio'] as const) {
  test(`${kind === 'audio' ? 'R04' : 'CONTROL R04'} ${kind} route fallback preserves media recovery ownership`, t => {
    const f = fixture(t), state = f.session.get()
    const original = `https://upos-sz-mirrorali.bilivideo.com/upgcxcode/01/02/100/100-1-${kind === 'video' ? 30080 : 30280}.m4s?fixture=ownership`
    const rep = f.vault.register({ generation: state.generation, epoch: state.epoch, kind, key: `ownership-${kind}`,
      height: kind === 'video' ? 1080 : 0, codec: kind === 'video' ? 'avc' : 'aac', bandwidth: kind === 'video' ? 4_000_000 : 192_000,
      urls: [original], source: 'trusted-api' })
    assert.ok(rep)
    if (kind === 'video') f.request(original)
    f.setVideo({ ...blankVideo(), readyState: 4, width: 1920, height: 1080, playableBufferSec: 40, coreInitialized: true })
    f.clock.advance(1000)
    const fallback = f.routes.recover(rep, { kind, requiredMbps: kind === 'video' ? 8 : 0.5, highDemand: false }, 'verified-failure', TRUSTED_CATALOG[0])
    assert.ok(fallback.host && fallback.host !== TRUSTED_CATALOG[0], 'real coordinator emitted a legal different-host fallback')
    f.setVideo(blankVideo())
    f.clock.advance(4000)
    assert.equal(f.calls.reloads, kind === 'video' ? 1 : 0, 'audio fallback alone must not arm the video core reload path')
  })
}

test('CONTROL R04 audio fallback does not reload a video that continues progressing', t => {
  const f = fixture(t), state = f.session.get()
  const rep = f.vault.register({ generation: state.generation, epoch: state.epoch, kind: 'audio', key: 'healthy-audio',
    height: 0, codec: 'aac', bandwidth: 192_000,
    urls: ['https://upos-sz-mirrorali.bilivideo.com/upgcxcode/01/02/100/100-1-30280.m4s?fixture=healthy'], source: 'trusted-api' })
  assert.ok(rep)
  const healthy = { ...blankVideo(), readyState: 4, width: 1920, height: 1080, playableBufferSec: 40, coreInitialized: true }
  f.setVideo(healthy); f.clock.advance(1000)
  f.routes.recover(rep, { kind: 'audio', requiredMbps: 0.5, highDemand: false }, 'verified-failure', TRUSTED_CATALOG[0])
  f.setVideo({ ...healthy, currentTime: 121 }); f.clock.advance(1000)
  assert.equal(f.recovery.isRecovering(), false)
  assert.equal(f.calls.reloads, 0)
})

for (const late of [false, true]) {
  test(`${late ? 'CROSS A03' : 'CONTROL CROSS A03'} actual runtime fixed-host update survives ${late ? 'late' : 'prior'} transfer`, async t => {
    const f = fixture(t), payload = media(100)
    assert.equal(f.playurl.transform(payload, 'trusted-api', 'initial').accepted, true)
    const url = payload.data.dash.video[0]!.base_url
    const context = new TransportContext(f.session, f.settings, f.routes, f.playurl,
      { willGateStartup: () => false, prepareStartup: async () => undefined, noteUnpreflighted: () => undefined }, f.clock.now, createRuntimeIds())
    f.scope.defineGlobal('location', { configurable: true, value: new URL('https://www.bilibili.com/video/synthetic') })
    const dispatch = () => {
      const applied = f.routes.apply(url); assert.ok(applied.url)
      const at = f.clock.now(), request = context.request(applied, url, applied.url, at, 'GET')
      f.routes.requestStarted(request)
      return async () => {
        f.clock.advance(100)
        await f.routes.observe(context.observation(request, applied, url, applied.url!, applied.url!, 206,
          256 * 1024, at, at + 10, 'success', undefined, true))
      }
    }
    await dispatch()(); await dispatch()()
    assert.equal(f.session.get().affinity?.host, TRUSTED_CATALOG[0])
    const complete = dispatch()
    if (!late) await complete()
    const fixed = TRUSTED_CATALOG[5]
    await f.commands.updateSettings({ fixedHost: fixed })
    assert.equal(f.session.get().affinity, null, 'actual Runtime subscription invalidated old route')
    if (late) await complete()
    const quality = media(100)
    quality.data.dash.video[0]!.id = 64; quality.data.dash.video[0]!.height = 720
    quality.data.dash.video[0]!.base_url = quality.data.dash.video[0]!.base_url.replace('30080.m4s', '30064.m4s')
    assert.equal(f.playurl.transform(quality, 'trusted-api', 'quality').accepted, true)
    assert.equal(new URL(quality.data.dash.video[0]!.base_url).hostname, fixed,
      'completed old transfer may add evidence but must not override current fixed host on new quality')
  })
}
