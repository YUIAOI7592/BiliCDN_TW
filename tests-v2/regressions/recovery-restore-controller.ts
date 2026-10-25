import { test, type TestContext } from 'node:test'
import assert from 'node:assert/strict'
import { RecoveryController } from '../../src-v2/application/recovery-controller.ts'
import type {
  RecoveryPlayerPort,
  RestoreAttempt,
  RestoreCommand,
  RestoreReadback,
} from '../../src-v2/application/recovery-ports.ts'
import type { VideoSnapshot } from '../../src-v2/application/ports.ts'
import { FakeClock } from '../support/clock.ts'
import { testScope } from '../support/scope.ts'
import { idleControls } from '../support/player.ts'

function fixture(t: TestContext, rate: number, target = 120) {
  const scope = testScope(t),
    clock = scope.own(new FakeClock())
  let active = true,
    pending = false,
    nativeUsed = false,
    effect = true
  let onRead = () => {}
  const calls: string[] = [],
    controls = { ...idleControls() }
  const video: { -readonly [K in keyof VideoSnapshot]: VideoSnapshot[K] } = {
    available: true,
    paused: false,
    seeking: false,
    ended: false,
    readyState: 4,
    currentTime: target,
    duration: 600,
    width: 1280,
    height: 720,
    playbackRate: rate,
    effectiveRate: rate,
    bufferAheadSec: 30,
    playableBufferSec: 30,
    bufferedToEnd: false,
    frames: 100,
    mediaError: false,
    coreInitialized: true,
    manifestHasVideo: true,
  }
  const records = new Map<
    object,
    { command: RestoreCommand; landing: RestoreReadback['landing'] }
  >()
  const player = {
    controls: () => ({ ...controls }),
    currentTime: () => video.currentTime,
    playbackRate: () => video.playbackRate,
    snapshot: () => ({ ...video }),
    captureResumePosition: () => ({ positionSec: target, proof: null }),
    validateResumePosition: () => true,
    observePlayIntent: () => () => {},
    reload() {
      calls.push('reload')
      controls.reloadRevision++
      controls.coreReloadRevision = controls.reloadRevision
      Object.assign(video, {
        paused: true,
        currentTime: 0,
        readyState: 0,
        width: 0,
        height: 0,
        coreInitialized: false,
      })
    },
    ownedReload: (revision) => active && revision === controls.reloadRevision,
    seek() {
      throw Error('The controller must use the verified restore port')
    },
    setRate() {
      throw Error('The controller must use the verified restore port')
    },
    play() {
      calls.push('play')
      video.paused = false
    },
    performRestore(command) {
      calls.push(`sdk:${command.kind}:${command.value}`)
      const attempt: RestoreAttempt = { kind: command.kind, proof: {} }
      records.set(attempt.proof, { command, landing: null })
      if (command.kind === 'rate') video.playbackRate = command.value
      return attempt
    },
    readRestore(attempt) {
      onRead()
      const record = records.get(attempt.proof)!
      if (
        record.command.kind === 'position' &&
        !video.seeking &&
        Math.abs(video.currentTime - record.command.value) <= 1
      )
        record.landing ??= { positionSec: video.currentTime, at: clock.now() }
      return {
        owned: active,
        channel: nativeUsed ? 'native' : 'sdk',
        status: pending ? 'pending' : 'settled',
        positionSec: Number.isFinite(video.currentTime) ? video.currentTime : null,
        rate: video.playbackRate,
        paused: video.paused,
        seeking: video.seeking,
        readyState: video.readyState,
        landing: record.landing,
      }
    },
    correctRestore(attempt) {
      calls.push(`native:${attempt.kind}`)
      nativeUsed = true
      const record = records.get(attempt.proof)!
      if (effect && attempt.kind === 'position') video.currentTime = record.command.value
    },
  } satisfies RecoveryPlayerPort
  const recovery = scope.own(new RecoveryController(player, clock.now, () => active))
  scope.defer(() => {
    recovery.dispose()
    assert.equal(clock.pendingCount, 0)
  })
  recovery.tick(video)
  recovery.armStall(video, {
    id: 1,
    startedAt: clock.now(),
    targetSec: target,
    reloadAfterMs: 12000,
    valid: () => active,
  })
  clock.advance(12000)
  recovery.tick(video)
  assert.deepEqual(calls, ['reload'])
  Object.assign(video, { readyState: 4, width: 1280, height: 720, coreInitialized: true })
  const tick = (ms = 0) => {
    clock.advance(ms)
    recovery.tick(video)
  }
  return {
    recovery,
    video,
    calls,
    tick,
    pending: (value: boolean) => {
      pending = value
    },
    effect: (value: boolean) => {
      effect = value
    },
    used: () => {
      nativeUsed = true
    },
    onRead: (fn: () => void) => {
      onRead = fn
    },
    revoke: () => {
      active = false
    },
  }
}

for (const rate of [1, 2]) {
  test(`SR2-U-R01 Recovery waits 999/1000 ms then confirms native position before rate and play rate=${rate}`, (t) => {
    const f = fixture(t, rate)
    f.tick()
    f.tick(999)
    assert.equal(f.calls.filter((v) => v.startsWith('native:')).length, 0)
    f.tick(1)
    assert.deepEqual(f.calls, [
      'reload',
      'sdk:position:120',
      'native:position',
      `sdk:rate:${rate}`,
      'play',
    ])
    assert.equal(f.recovery.snapshot().state, 'waiting')
    assert.equal(f.recovery.snapshot().restoration?.phase, 'progress')
  })
  test(`SR2-U-R02 pending command never authorizes forced correction rate=${rate}`, (t) => {
    const f = fixture(t, rate)
    f.pending(true)
    f.tick()
    f.tick(5000)
    assert.deepEqual(f.calls, ['reload', 'sdk:position:120'])
    f.video.currentTime = 120
    f.tick()
    assert.equal(
      f.calls.at(-1),
      'play',
      'actual landing can be confirmed while the SDK promise is pending',
    )
  })
  test(`SR2-U-R03 an ineffective correction cannot become recovered from wrong-position frames rate=${rate}`, (t) => {
    const f = fixture(t, rate)
    f.effect(false)
    f.tick()
    f.tick(1000)
    for (let i = 0; i < 13; i++) {
      f.video.currentTime += 0.1
      f.video.frames! += 30
      f.tick(1000)
    }
    assert.notEqual(f.recovery.snapshot().state, 'recovered')
    f.tick(999)
    assert.equal(f.recovery.isRecovering(), true)
    f.tick(1)
    assert.equal(f.recovery.snapshot().reason, 'reload-timeout')
    for (let i = 0; i < 120; i++) f.tick(1000)
    assert.deepEqual(f.calls, ['reload', 'sdk:position:120', 'native:position'])
  })
  test(`SR2-U-R04 native fallback already consumed cannot obtain a second correction rate=${rate}`, (t) => {
    const f = fixture(t, rate)
    f.used()
    f.tick()
    f.tick(1000)
    f.tick(1000)
    assert.deepEqual(f.calls, ['reload', 'sdk:position:120'])
  })
  test(`SR2-U-R05 readback reentry cannot commit rate or play after qualification loss rate=${rate}`, (t) => {
    const f = fixture(t, rate)
    f.onRead(f.revoke)
    f.tick()
    f.tick(1000)
    assert.deepEqual(f.calls, ['reload', 'sdk:position:120'])
    assert.equal(f.recovery.isRecovering(), false)
  })
  test(`SR2-U-R06 a true zero is acknowledged without native correction rate=${rate}`, (t) => {
    const f = fixture(t, rate, 0)
    f.tick()
    assert.deepEqual(f.calls, ['reload', 'sdk:position:0', `sdk:rate:${rate}`, 'play'])
  })
  test(`SR2-U-R07 the existing end-of-media clipping remains exact rate=${rate}`, (t) => {
    const f = fixture(t, rate, 600)
    f.tick()
    f.tick(1000)
    assert.equal(f.video.currentTime, 599.9)
    assert.deepEqual(f.calls, [
      'reload',
      'sdk:position:599.9',
      'native:position',
      `sdk:rate:${rate}`,
      'play',
    ])
  })
}
