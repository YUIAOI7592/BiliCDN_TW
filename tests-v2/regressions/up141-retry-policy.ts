import { test } from 'node:test'
import assert from 'node:assert/strict'
import { evaluateEarlyRetry } from '../../src-v2/domain/early-retry.ts'
import { EarlyRetryController } from '../../src-v2/application/early-retry-controller.ts'
import type {
  EarlyRetryActionState,
  EarlyRetryAlternative,
  EarlyRetryStatus,
  InFlightVideoSample,
} from '../../src-v2/application/early-retry-model.ts'
import {
  generationId,
  epochId,
  representationId,
  decisionId,
  requestId,
} from '../../src-v2/domain/model.ts'
import { SettingsStore, SETTINGS_KEY, defaultSettings } from '../../src-v2/state/settings-store.ts'
import { FakeStorage, DelayedSettingsStorage } from '../support/storage.ts'
import { testScope } from '../support/scope.ts'

function facts() {
  return {
    now: 10_000,
    startedAt: 8_500,
    currentHost: 'upos-sz-mirrorali.bilivideo.com',
    loadedBytes: 100_000,
    totalBytes: 1_000_000,
    recentBytesPerSec: 50_000,
    playableBufferSec: 4,
    requiredMbps: 4,
    alternative: {
      host: 'upos-sz-mirrorbos.bilivideo.com',
      safeMbps: 40,
      ttfbMs: 100,
      successCount: 2,
      oldestAt: 0,
    },
  }
}

function status(): EarlyRetryStatus {
  return {
    enabled: true,
    disabled: false,
    originalComparison: false,
    catalogOnly: true,
    fixedHost: false,
    visible: true,
    recovering: false,
    stableProgressSec: 10,
    video: {
      available: true,
      paused: false,
      seeking: false,
      ended: false,
      readyState: 3,
      currentTime: 100,
      duration: 600,
      width: 1920,
      height: 1080,
      playbackRate: 2,
      effectiveRate: 2,
      bufferAheadSec: 8,
      playableBufferSec: 4,
      bufferedToEnd: false,
      frames: 100,
      mediaError: false,
      coreInitialized: true,
      manifestHasVideo: true,
    },
    controls: {
      mediaId: 1,
      coreId: 1,
      seekRevision: 0,
      userRevision: 0,
      dragging: false,
      targetSec: null,
      reloadRevision: 0,
      coreReloadRevision: 0,
    },
    demand: { kind: 'video', requiredMbps: 4, highDemand: false },
  }
}

function sample(serial = 1, host = 'upos-sz-mirrorali.bilivideo.com'): InFlightVideoSample {
  return {
    request: {
      requestId: requestId(`retry-${serial}`),
      generation: generationId(1),
      epoch: epochId(1),
      representation: representationId('video'),
      decisionId: decisionId('decision'),
      routePolicyRevision: 1,
      authorityRevision: 1,
      kind: 'video',
      attributionStatus: 'matched',
      attributionSource: 'exact',
      decisionStage: 'request',
      routeType: 'catalog-generated',
      originalHost: host,
      targetHost: host,
      sourceHost: host,
      playurlHostChanged: false,
      playurlOutput: null,
      urlChanged: false,
      hostChanged: false,
      startedAt: 0,
    },
    loadedBytes: 100_000,
    totalBytes: 1_000_000,
    recentBytesPerSec: 50_000,
  }
}

function fixture(t: Parameters<typeof testScope>[0]) {
  const scope = testScope(t)
  let now = 10_000
  let samples: readonly InFlightVideoSample[] = [sample()]
  let actionState: EarlyRetryActionState | null = 'pending'
  let arms = 0
  let revokes = 0
  let cancellations = 0
  let alternate: EarlyRetryAlternative | null = facts().alternative
  let armAllowed = true
  const controller = scope.own(
    new EarlyRetryController(
      {
        alternative: () => alternate,
        prepare: () => ({ id: `permit-${arms + 1}`, expiresAt: now + 2000 }),
        revoke: () => {
          revokes++
        },
      },
      {
        samples: () => samples,
        arm: () => {
          arms++
          return armAllowed
        },
        state: () => actionState,
        cancel: () => {
          cancellations++
        },
      },
      () => now,
    ),
  )
  return {
    controller,
    status: status(),
    advance: (ms: number) => {
      now += ms
    },
    setSamples: (next: readonly InFlightVideoSample[]) => {
      samples = next
    },
    state: (next: EarlyRetryActionState | null) => {
      actionState = next
    },
    alternate: (next: EarlyRetryAlternative | null) => {
      alternate = next
    },
    armAllowed: (next: boolean) => {
      armAllowed = next
    },
    arms: () => arms,
    revokes: () => revokes,
    cancellations: () => cancellations,
  }
}

test('UP141-RETRY policy uses current buffer seconds once and full redownload cost', (t) => {
  testScope(t)
  assert.equal(evaluateEarlyRetry(facts()).eligible, true)
  const result = evaluateEarlyRetry({
    ...facts(),
    alternative: { ...facts().alternative, safeMbps: 2 },
  })
  assert.equal(result.eligible, false)
  assert.equal(evaluateEarlyRetry({ ...facts(), recentBytesPerSec: 0 }).eligible, true)
  assert.ok(
    !JSON.stringify(evaluateEarlyRetry({ ...facts(), recentBytesPerSec: 0 })).includes('Infinity'),
  )
})

test('UP141-RETRY policy rejects threshold boundaries and unknown or stale evidence', (t) => {
  testScope(t)
  const base = facts()
  for (const change of [
    { startedAt: base.now - 1499 },
    { loadedBytes: 800_000 },
    { playableBufferSec: 0 },
    { playableBufferSec: 6 },
    { totalBytes: Number.NaN },
    { recentBytesPerSec: null },
    { recentBytesPerSec: -1 },
    { recentBytesPerSec: 500_000 },
    { alternative: { ...base.alternative, successCount: 1 } },
    { alternative: { ...base.alternative, oldestAt: base.now - 60_001 } },
    { alternative: { ...base.alternative, oldestAt: base.now + 1 } },
    { alternative: { ...base.alternative, host: base.currentHost } },
  ])
    assert.equal(evaluateEarlyRetry({ ...base, ...change }).eligible, false, JSON.stringify(change))
})

test('UP141-RETRY controller arms once and observes successful website retry', (t) => {
  const f = fixture(t)
  f.controller.tick(f.status)
  assert.equal(f.arms(), 1)
  assert.equal(f.controller.snapshot().state, 'armed')
  f.state('dispatched')
  f.advance(1000)
  f.controller.tick(f.status)
  assert.equal(f.controller.snapshot().state, 'dispatched')
  f.state('succeeded')
  f.controller.tick(f.status)
  f.controller.tick(f.status)
  assert.equal(f.arms(), 1)
  assert.equal(f.controller.snapshot().attempts, 1)
})

test('UP141-RETRY controller respects all playback and mode exclusions', (t) => {
  const f = fixture(t)
  const base = f.status
  const variants: EarlyRetryStatus[] = [
    { ...base, enabled: false },
    { ...base, disabled: true },
    { ...base, originalComparison: true },
    { ...base, catalogOnly: false },
    { ...base, fixedHost: true },
    { ...base, visible: false },
    { ...base, recovering: true },
    { ...base, stableProgressSec: 9 },
    { ...base, demand: null },
    ...[
      { paused: true },
      { seeking: true },
      { ended: true },
      { mediaError: true },
      { coreInitialized: null },
    ].map((video) => ({ ...base, video: { ...base.video, ...video } })),
    { ...base, controls: { ...base.controls, dragging: true } },
    { ...base, controls: { ...base.controls, pendingSeekGoal: true } },
  ]
  for (const variant of variants) f.controller.tick(variant)
  assert.equal(f.arms(), 0)
})

test('UP141-RETRY owner changes revoke without restoring stale operations', (t) => {
  const f = fixture(t)
  f.controller.tick(f.status)
  f.controller.tick({ ...f.status, controls: { ...f.status.controls, userRevision: 1 } })
  assert.equal(f.revokes(), 1)
  assert.equal(f.cancellations(), 1)
  assert.equal(f.controller.snapshot().state, 'cancelled')
})

test('UP141-RETRY missing or failed handoff suspends the document across reset', (t) => {
  const f = fixture(t)
  f.controller.tick(f.status)
  f.advance(2000)
  f.controller.tick(f.status)
  assert.equal(f.controller.snapshot().state, 'suspended')
  f.controller.reset()
  f.setSamples([sample(2, 'upos-sz-mirrorcos.bilivideo.com')])
  f.advance(40_000)
  f.controller.tick(f.status)
  assert.equal(f.arms(), 1)
})

test('UP141-RETRY low-buffer episode needs ten separate healthy ticks before another action', (t) => {
  const f = fixture(t)
  f.controller.tick(f.status)
  f.state('succeeded')
  f.controller.tick(f.status)
  f.setSamples([sample(2, 'upos-sz-mirrorcos.bilivideo.com')])
  f.advance(8000)
  f.controller.tick(f.status)
  assert.equal(f.arms(), 1)
  const healthy = { ...f.status, video: { ...f.status.video, playableBufferSec: 10 } }
  for (let i = 0; i < 9; i++) {
    f.advance(1000)
    f.controller.tick(healthy)
  }
  f.controller.tick(f.status)
  assert.equal(f.arms(), 1)
  for (let i = 0; i < 10; i++) {
    f.advance(1000)
    f.controller.tick(healthy)
  }
  f.state('pending')
  f.controller.tick(f.status)
  assert.equal(f.arms(), 2)
})

test('UP141-RETRY failure to arm consumes the attempt and breaks the document', (t) => {
  const f = fixture(t)
  f.armAllowed(false)
  f.controller.tick(f.status)
  assert.equal(f.controller.snapshot().state, 'suspended')
  assert.equal(f.controller.snapshot().attempts, 1)
  assert.equal(f.revokes(), 1)
  f.armAllowed(true)
  f.controller.reset()
  f.advance(40_000)
  f.controller.tick(f.status)
  assert.equal(f.arms(), 1)
})

test('UP141-RETRY reset never reopens a consumed low-buffer episode', (t) => {
  const f = fixture(t)
  f.controller.tick(f.status)
  f.state('succeeded')
  f.controller.tick(f.status)
  f.controller.reset()
  f.setSamples([sample(2, 'upos-sz-mirrorcos.bilivideo.com')])
  f.advance(40_000)
  f.controller.tick(f.status)
  assert.equal(f.arms(), 1)
  assert.equal(f.controller.snapshot().attempts, 1)
})

test('UP141-RETRY unknown healthy readings cannot reopen a consumed episode', (t) => {
  const f = fixture(t)
  f.controller.tick(f.status)
  f.state('succeeded')
  f.controller.tick(f.status)
  f.setSamples([sample(2, 'upos-sz-mirrorcos.bilivideo.com')])
  const unknown = { ...f.status, video: { ...f.status.video, playableBufferSec: Number.NaN } }
  for (let i = 0; i < 10; i++) {
    f.advance(1000)
    f.controller.tick(unknown)
  }
  f.state('pending')
  f.controller.tick(f.status)
  assert.equal(f.arms(), 1)
})

test('UP141-RETRY failed website retry and lost pending state both suspend', (t) => {
  for (const state of ['failed', null] as const) {
    const f = fixture(t)
    f.controller.tick(f.status)
    f.state(state)
    f.controller.tick(f.status)
    assert.equal(f.controller.snapshot().state, 'suspended')
    assert.equal(f.revokes(), 1)
  }
})

test('UP141-RETRY cancelled controller exposes bounded detached read-only history', (t) => {
  const f = fixture(t)
  const old = f.controller.snapshot()
  for (let i = 0; i < 30; i++) {
    f.advance(1000)
    f.controller.cancel(i % 2 === 0 ? 'hidden' : 'user-operation')
  }
  assert.equal(old.history.length, 0)
  assert.equal(f.controller.snapshot().history.length, 16)
  assert.ok(Object.isFrozen(f.controller.snapshot()))
  assert.ok(Object.isFrozen(f.controller.snapshot().history))
  assert.ok(f.controller.snapshot().history.every(Object.isFrozen))
})

test('UP141-RETRY prototype settings remain off and preserve explicit values in schema 2', async (t) => {
  const scope = testScope(t)
  const storage = new FakeStorage()
  storage.set(SETTINGS_KEY, { ...defaultSettings(100), earlyRetryEnabled: undefined })
  const settings = scope.own(new SettingsStore(storage, () => 100))
  assert.equal(settings.get().earlyRetryEnabled, false)
  assert.equal(settings.get().schema, 2)
  await settings.update({ earlyRetryEnabled: true })
  assert.equal(settings.get().earlyRetryEnabled, true)
  await settings.update({ earlyRetryEnabled: false })
  assert.equal(settings.get().earlyRetryEnabled, false)
})

test('UP141-RETRY turning off suppresses immediately while settings lock is pending', async (t) => {
  const scope = testScope(t)
  const storage = new DelayedSettingsStorage()
  const settings = scope.own(new SettingsStore(storage, () => 100))
  await settings.update({ earlyRetryEnabled: true })
  storage.holdNextSettingsLock = true
  const pending = settings.update({ earlyRetryEnabled: false })
  assert.equal(settings.get().earlyRetryEnabled, false)
  storage.releaseSettingsLock()
  await pending
  assert.equal(settings.get().earlyRetryEnabled, false)
})
