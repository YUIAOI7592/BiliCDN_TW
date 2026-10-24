import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bufferMonitor } from '../support/buffer-monitor.ts'
import { epochId, generationId, representationId } from '../../src-v2/domain/model.ts'

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
      test(`buffer-v5 low Monitor ${field} clears confirmed=${confirmed} rate=${rate}`, (t) => {
        const f = bufferMonitor(t, rate)
        f.video.bufferAheadSec = 4.8 * rate
        f.monitor.tick()
        for (let i = 0; i < 60; i++) f.step(4.8)
        for (let i = 1; i <= 8; i++) f.step(4.8 - i / 10)
        if (confirmed) {
          f.step(3.9)
          f.step(3.8)
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
        f.step(3.7)
        assert.equal(f.monitor.snapshot().bufferTrend!.candidate, null)
        assert.deepEqual(f.effects, [])
        assert.equal(f.clock.pendingCount, 0)
      })

for (const rate of [1, 2])
  test(`buffer-v5 low publishing callback reset cannot revive confirmation rate=${rate}`, (t) => {
    const f = bufferMonitor(t, rate)
    f.video.bufferAheadSec = 4.8 * rate
    f.monitor.tick()
    for (let i = 0; i < 60; i++) f.step(4.8)
    f.scope.defer(
      f.monitor.subscribe((s) => {
        if (s.bufferTrend?.candidate) f.monitor.reset()
      }),
    )
    for (let i = 1; i <= 10; i++) f.step(4.8 - i / 10)
    assert.equal(f.monitor.snapshot().bufferTrend!.candidate, null)
    f.step(3.7)
    assert.equal(f.monitor.snapshot().bufferTrend!.candidate, null)
    assert.deepEqual(f.effects, [])
  })
