import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bufferMonitor } from '../support/buffer-monitor.ts'
import { epochId, generationId, representationId } from '../../src-v2/domain/model.ts'

for (const rate of [1, 2]) {
  for (const invalid of [0, NaN, Infinity])
    test(`buffer-v3 Monitor raw rate ${invalid} rejects effective fallback rate=${rate}`, (t) => {
      const f = bufferMonitor(t, rate)
      f.monitor.tick()
      for (let i = 0; i < 60; i++) f.step(12)
      f.step(10)
      f.step(8)
      f.video.playbackRate = invalid
      f.video.effectiveRate = rate
      f.step(6, 1000, false)
      assert.equal(f.monitor.snapshot().bufferTrend!.candidate, null)
      assert.deepEqual(f.effects, [])
    })
  test(`buffer-v3 Monitor duplicate read preserves evidence rate=${rate}`, (t) => {
    const f = bufferMonitor(t, rate)
    f.monitor.tick()
    for (let i = 0; i < 60; i++) f.step(12)
    f.step(10)
    f.step(8)
    f.monitor.tick()
    assert.equal(f.monitor.snapshot().bufferTrend!.candidate, null)
    f.step(6)
    assert.equal(f.monitor.snapshot().bufferTrend!.candidate, true)
    assert.deepEqual(f.effects, [])
  })
  test(`buffer-v3 Monitor exception clears old confirmation rate=${rate}`, (t) => {
    const f = bufferMonitor(t, rate)
    f.monitor.tick()
    for (let i = 0; i < 60; i++) f.step(12)
    f.step(10)
    f.step(8)
    f.onQualification(() => {
      throw Error('diagnostic metadata unavailable')
    })
    f.step(6)
    assert.equal(f.monitor.snapshot().bufferTrend!.candidate, null)
    f.onQualification()
    f.monitor.tick()
    assert.equal(f.monitor.snapshot().bufferTrend!.candidate, null)
    for (let i = 0; i < 8; i++) f.step(12)
    f.step(10)
    assert.equal(f.monitor.snapshot().bufferTrend!.candidate, false)
    f.step(8)
    assert.equal(f.monitor.snapshot().bufferTrend!.candidate, false)
    f.step(6)
    assert.equal(f.monitor.snapshot().bufferTrend!.candidate, true)
    assert.deepEqual(f.effects, [])
  })
}

for (const rate of [1, 2])
  for (const confirmed of [false, true])
    for (const field of [
      'mediaId',
      'coreId',
      'seekRevision',
      'userRevision',
      'reloadRevision',
      'coreReloadRevision',
      'epoch',
      'generation',
      'representation',
      'policy',
      'authority',
      'host',
      'rate',
      'reset',
      'stop',
      'dispose',
    ] as const)
      test(`buffer-v3 Monitor ${field} clears confirmed=${confirmed} rate=${rate}`, (t) => {
        const f = bufferMonitor(t, rate)
        f.monitor.tick()
        for (let i = 0; i < 60; i++) f.step(12)
        f.step(11)
        f.step(10)
        if (confirmed) {
          f.step(9)
          f.step(8)
        }
        assert.equal(f.monitor.snapshot().bufferTrend!.candidate, confirmed)
        if (field === 'epoch') f.state.epoch = epochId(2)
        else if (field === 'generation') f.state.generation = generationId(2)
        else if (field === 'representation')
          f.changeRequest({ representation: representationId('new') })
        else if (field === 'policy') f.changeRequest({ routePolicyRevision: 2 })
        else if (field === 'authority') f.changeRequest({ authorityRevision: 2 })
        else if (field === 'host')
          f.changeRequest({ targetHost: 'upos-sz-mirrorali.bilivideo.com' })
        else if (field === 'rate') f.video.playbackRate = rate === 1 ? 2 : 1
        else if (field === 'reset' || field === 'stop' || field === 'dispose') f.monitor[field]()
        else f.controls[field]++
        f.step(7)
        assert.equal(f.monitor.snapshot().bufferTrend!.candidate, null)
        assert.deepEqual(f.effects, [])
        assert.equal(f.clock.pendingCount, 0)
      })

for (const rate of [1, 2])
  test(`buffer-v3 publishing callback reset cannot revive confirmation rate=${rate}`, (t) => {
    const f = bufferMonitor(t, rate)
    f.monitor.tick()
    for (let i = 0; i < 60; i++) f.step(12)
    f.scope.defer(
      f.monitor.subscribe((s) => {
        if (s.bufferTrend?.candidate) f.monitor.reset()
      }),
    )
    for (const b of [11, 10, 9, 8]) f.step(b)
    assert.equal(f.monitor.snapshot().bufferTrend!.candidate, null)
    f.step(7)
    assert.equal(f.monitor.snapshot().bufferTrend!.candidate, null)
    assert.deepEqual(f.effects, [])
  })
