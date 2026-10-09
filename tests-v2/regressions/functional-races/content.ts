import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture as runtimeFixture } from '../../support/runtime-fixture.ts'
import { blankVideo } from '../../support/runtime-fixture.ts'
import { FakeStorage } from '../../support/storage.ts'
import { TRUSTED_CATALOG } from '../../../src-v2/domain/catalog.ts'
import { MeasurementController } from '../../../src-v2/application/measurement-controller.ts'
import type { RangeProbeResult } from '../../../src-v2/application/ports.ts'
import { deferred } from '../../support/deferred.ts'
const ingest = (f: ReturnType<typeof runtimeFixture>, body: unknown, contentId: string | null,
  source: 'trusted-api' | 'page-hint' | 'player-mpd' = 'trusted-api') =>
  f.playurl.transform(body, source, undefined, { contentId })

// The inventory is identical; only the array order changes.
const payload = (reverse = false, sameDirectory = false, content = 'content-A') => {
  const video = [
    { id: 80, codecid: 7, height: 1080, bandwidth: 4_000_000,
      base_url: `https://upos-sz-mirrorali.bilivideo.com/upgcxcode/${content}/avc/100-1-30080.m4s?fixture=synthetic`, backup_url: [] },
    { id: 120, codecid: 13, height: 2160, bandwidth: 12_000_000,
      base_url: `https://upos-sz-mirrorali.bilivideo.com/upgcxcode/${content}/${sameDirectory ? 'avc' : 'av1'}/100-1-30120.m4s?fixture=synthetic`, backup_url: [] },
  ]
  if (reverse) video.reverse()
  return { code: 0, data: { dash: { video, audio: [
    { id: 30280, codecid: 0, bandwidth: 192_000,
      base_url: `https://upos-sz-mirrorali.bilivideo.com/upgcxcode/${content}/audio/100-1-30280.m4s?fixture=synthetic`, backup_url: [] },
  ] } } }
}

test('BR-03 identical DASH inventory reordered across representation directories keeps the content epoch', t => {
  const f = runtimeFixture(t), first = payload(), second = payload(true)
  assert.deepEqual(first.data.dash.video.map(x => x.base_url).sort(), second.data.dash.video.map(x => x.base_url).sort())
  assert.equal(f.playurl.transform(first, 'trusted-api').accepted, true)
  const before = f.session.get(), resets = f.calls.resets
  assert.equal(f.playurl.transform(second, 'trusted-api').accepted, true)
  assert.equal(f.session.get().generation, before.generation)
  assert.equal(f.session.get().epoch, before.epoch, 'array order must not become new content')
  assert.equal(f.calls.resets, resets, 'same-content permutation must not reset Runtime')
})

test('BR-03 same-content permutation preserves the issued audio authority identity', t => {
  const f = runtimeFixture(t), first = payload()
  assert.equal(f.playurl.transform(first, 'trusted-api').accepted, true)
  const audio = f.vault.match(first.data.dash.audio[0]!.base_url).context
  assert.ok(audio)
  assert.equal(f.vault.isCurrentIdentity(audio), true)
  assert.equal(f.playurl.transform(payload(true), 'trusted-api').accepted, true)
  assert.equal(f.vault.isCurrentIdentity(audio), true, 'array order must not revoke in-flight audio ownership')
})

test('BR-03 control: same-directory DASH permutation preserves epoch and runtime', t => {
  const f = runtimeFixture(t)
  assert.equal(f.playurl.transform(payload(false, true), 'trusted-api').accepted, true)
  const before = f.session.get(), resets = f.calls.resets
  assert.equal(f.playurl.transform(payload(true, true), 'trusted-api').accepted, true)
  assert.equal(f.session.get().epoch, before.epoch)
  assert.equal(f.calls.resets, resets)
})

test('BR-03 control: genuinely disjoint content revokes previous audio and resets runtime', t => {
  const f = runtimeFixture(t), first = payload()
  assert.equal(f.playurl.transform(first, 'trusted-api').accepted, true)
  const before = f.session.get(), resets = f.calls.resets
  const audio = f.vault.match(first.data.dash.audio[0]!.base_url).context
  assert.ok(audio)
  assert.equal(f.playurl.transform(payload(false, false, 'content-B'), 'trusted-api').accepted, true)
  assert.equal(Number(f.session.get().epoch), Number(before.epoch) + 1)
  assert.equal(f.calls.resets, resets + 1)
  assert.equal(f.vault.isCurrentIdentity(audio), false)
})

test('BR-03 same request cid permits an entirely different quality and codec inventory', t => {
  const f = runtimeFixture(t)
  ingest(f, payload(), '90071992547409931234')
  const epoch = f.session.get().epoch, resets = f.calls.resets
  const next = payload(false, false, 'different-codecs')
  next.data.dash.video = next.data.dash.video.slice(1)
  assert.equal(ingest(f, next, '90071992547409931234').accepted, true)
  assert.equal(f.session.get().epoch, epoch); assert.equal(f.calls.resets, resets)
})

test('BR-03 different cid revokes authority despite identical paths and shared audio', t => {
  const f = runtimeFixture(t), first = payload()
  ingest(f, first, '100')
  const old = f.vault.match(first.data.dash.audio[0]!.base_url).context
  assert.ok(old)
  const before = f.session.get().epoch, resets = f.calls.resets
  let notices = 0
  f.scope.defer(f.content.subscribeEpoch(event => {
    notices++
    assert.deepEqual(Object.keys(event).sort(), ['epoch', 'generation'])
    assert.equal(f.vault.isCurrentIdentity(old), false)
    assert.equal(f.calls.resets, resets + 1, 'Runtime reset precedes new registration')
    assert.equal(f.vault.match(first.data.dash.audio[0]!.base_url).context, null)
  }))
  ingest(f, payload(), '101')
  assert.equal(Number(f.session.get().epoch), Number(before) + 1); assert.equal(notices, 1)
})

for (const aligns of [true, false]) test(`BR-03 first cid binding ${aligns ? 'aligns with' : 'revokes disjoint'} fallback baseline`, t => {
  const f = runtimeFixture(t)
  ingest(f, payload(), null)
  const epoch = Number(f.session.get().epoch)
  ingest(f, payload(true, false, aligns ? 'content-A' : 'content-B'), '123')
  assert.equal(Number(f.session.get().epoch), epoch + (aligns ? 0 : 1))
  ingest(f, payload(false, false, 'completely-new-inventory'), '123')
  assert.equal(Number(f.session.get().epoch), epoch + (aligns ? 0 : 1))
})

test('BR-03 missing cid uses overlap without forgetting cid; a disjoint fallback unbinds it', t => {
  const f = runtimeFixture(t)
  ingest(f, payload(), '123')
  const epoch = Number(f.session.get().epoch)
  ingest(f, payload(true), null)
  ingest(f, payload(false, false, 'B'), '123')
  assert.equal(Number(f.session.get().epoch), epoch)
  ingest(f, payload(false, false, 'C'), null)
  assert.equal(Number(f.session.get().epoch), epoch + 1)
  ingest(f, payload(false, false, 'B'), '123')
  assert.equal(Number(f.session.get().epoch), epoch + 2)
})

test('BR-03 full inventory to disjoint subsets and back retains observed directories', t => {
  const f = runtimeFixture(t)
  ingest(f, payload(), null)
  const epoch = f.session.get().epoch
  for (const index of [0, 1, 0, 1]) {
    const next = payload(); next.data.dash.video = [next.data.dash.video[index]!]
    ingest(f, next, null)
    assert.equal(f.session.get().epoch, epoch)
  }
})

test('BR-03 shared audio cannot hide a video change; pure audio uses its own directories', t => {
  const f = runtimeFixture(t)
  ingest(f, payload(), null)
  const before = Number(f.session.get().epoch), next = payload(false, false, 'B')
  next.data.dash.audio = payload().data.dash.audio
  ingest(f, next, null)
  assert.equal(Number(f.session.get().epoch), before + 1)
  const audioOnly = () => { const p = payload(); p.data.dash.video = []; return p }
  ingest(f, audioOnly(), null)
  assert.equal(Number(f.session.get().epoch), before + 2)
  ingest(f, audioOnly(), null)
  assert.equal(Number(f.session.get().epoch), before + 2)
  const otherAudio = audioOnly(); otherAudio.data.dash.audio[0]!.base_url = otherAudio.data.dash.audio[0]!.base_url.replace('content-A', 'C')
  ingest(f, otherAudio, null)
  assert.equal(Number(f.session.get().epoch), before + 3)
})

test('BR-03 invalid first primary and protocol-relative signed URLs do not create a false epoch', t => {
  const f = runtimeFixture(t), first = payload()
  first.data.dash.video[0]!.base_url = 'not-a-media-url'
  ingest(f, first, null)
  const epoch = f.session.get().epoch
  const next = payload(true)
  next.data.dash.video = [next.data.dash.video[0]!]
  next.data.dash.video[0]!.base_url = next.data.dash.video[0]!.base_url.replace('https:', '').replace('synthetic', 'renewed')
  ingest(f, next, null)
  assert.equal(f.session.get().epoch, epoch)
  const invalid = payload(); invalid.data.dash.video.forEach(x => x.base_url = 'invalid'); invalid.data.dash.audio = []
  ingest(f, invalid, null)
  ingest(f, payload(true), null)
  assert.equal(f.session.get().epoch, epoch, 'invalid inventory did not replace the baseline')
})

for (const source of ['page-hint', 'player-mpd'] as const) test(`BR-03 ${source} cannot bind cid or expand fallback directories`, t => {
  const f = runtimeFixture(t)
  ingest(f, payload(), '123')
  const epoch = Number(f.session.get().epoch)
  ingest(f, payload(false, false, 'B'), '456', source)
  assert.equal(Number(f.session.get().epoch), epoch)
  ingest(f, payload(false, false, 'C'), '123')
  assert.equal(Number(f.session.get().epoch), epoch, 'hint must not replace the cid')
  ingest(f, payload(false, false, 'B'), null)
  assert.equal(Number(f.session.get().epoch), epoch + 1, 'hint must not expand directory history')
})

test('BR-03 a repeated trusted object cannot change cid or authorize tampered directories', t => {
  const f = runtimeFixture(t), first = payload()
  ingest(f, first, '123')
  const epoch = f.session.get().epoch
  first.data.dash.video[0]!.base_url = payload(false, false, 'tampered').data.dash.video[0]!.base_url
  ingest(f, first, '456')
  assert.equal(f.session.get().epoch, epoch)
  ingest(f, payload(false, false, 'B'), '123')
  assert.equal(f.session.get().epoch, epoch)
})

test('BR-03 generation boundary clears both cid and all fallback directories', t => {
  const f = runtimeFixture(t)
  ingest(f, payload(), '123')
  f.navigate()
  const epoch = f.session.get().epoch
  ingest(f, payload(false, false, 'B'), '456')
  assert.equal(f.session.get().epoch, epoch, 'new generation starts a fresh baseline')
  ingest(f, payload(), null)
  assert.equal(Number(f.session.get().epoch), Number(epoch) + 1, 'old generation directories are not retained')
})

for (const changed of [false, true]) test(`BR-03 pending recovery ${changed ? 'is revoked by new cid' : 'survives same-content permutation'}`, t => {
  const f = runtimeFixture(t), first = payload()
  ingest(f, first, '123')
  f.setVideo({ ...blankVideo(), readyState: 4, width: 1920, height: 1080, playableBufferSec: 40, coreInitialized: true })
  f.clock.advance(1000)
  const identity = f.vault.match(first.data.dash.video[0]!.base_url).context
  assert.ok(identity)
  f.routes.recover(identity.representation, { kind: 'video', requiredMbps: 8, highDemand: false }, 'verified-failure', TRUSTED_CATALOG[0])
  f.setVideo(blankVideo()); f.clock.advance(4000)
  assert.equal(f.calls.reloads, 1)
  ingest(f, payload(true), changed ? '456' : '123')
  f.setVideo({ ...blankVideo(), currentTime: 0, playbackRate: 1, effectiveRate: 1, readyState: 3,
    width: 1920, height: 1080, playableBufferSec: 5, coreInitialized: true, frames: 1 })
  f.clock.advance(1000)
  assert.equal(f.calls.seeks.length, changed ? 0 : 1)
  assert.equal(f.calls.plays, changed ? 0 : 1)
})

test('BR-03 cid and directories never enter persistent settings or diagnostic events', t => {
  const storage = new FakeStorage(), f = runtimeFixture(t, storage), notices: unknown[] = []
  f.scope.defer(f.content.subscribeEpoch(event => notices.push(event)))
  ingest(f, payload(false, false, 'private-directory-marker'), '98765432109876543210')
  ingest(f, payload(false, false, 'private-directory-marker'), '98765432109876543211')
  const output = JSON.stringify({ stored: [...storage.values], notices, diagnostics: f.diagnostics.snapshot() })
  assert.ok(!output.includes('private-directory-marker'))
  assert.ok(!output.includes('9876543210987654321'))
  assert.equal(notices.length, 1)
})

for (const changed of [false, true]) test(`BR-03 deferred startup measurement ${changed ? 'cannot commit after new cid' : 'survives a permutation'}`, async t => {
  const result = deferred<RangeProbeResult>(), signals: AbortSignal[] = []
  const f = runtimeFixture(t, new FakeStorage(), { read: input => { signals.push(input.signal); return result.promise } })
  assert.ok(f.measurement instanceof MeasurementController)
  const first = payload()
  ingest(f, first, '123')
  const pending = f.measurement.prepareStartup(first.data.dash.video[0]!.base_url)
  assert.ok(signals.length > 0, 'real route options launched the deferred probes')
  ingest(f, payload(true), changed ? '456' : '123')
  assert.equal(signals.every(signal => signal.aborted), changed)
  const afterBoundary = f.measurement.snapshot()
  result.resolve({ bytes: 256 * 1024, elapsedMs: 100, ttfbMs: 10, status: 206, directRange: true, reason: 'measured' })
  await pending
  if (changed) assert.deepEqual(f.measurement.snapshot(), afterBoundary, 'late results cannot publish a measurement state')
  else assert.equal(f.measurement.snapshot().startup?.state, 'complete')
  assert.equal(f.measurement.snapshot().startup?.selectedHost !== null, !changed, 'only a current probe may commit a startup route')
})
