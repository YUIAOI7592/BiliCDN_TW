import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bufferMonitor } from '../support/buffer-monitor.ts'
import { continuityCases } from '../../scripts/buffer-shadow/continuity-inputs.mts'
import { epochId, generationId, representationId } from '../../src-v2/domain/model.ts'

const profile = continuityCases.find((c) => c.id === 'tail-normal-microdecline')!.profile
for (const rate of [1, 2])
  for (const spent of [false, true])
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
      'paused',
      'seeking',
      'hidden',
      'recovering',
    ] as const)
      test(`buffer-v6 U-O Monitor ${field} spent=${spent} rate=${rate}`, (t) => {
        const f = bufferMonitor(t, rate)
        f.video.bufferAheadSec = rate
        f.monitor.tick()
        for (let i = 0; i < 60; i++) f.step(1)
        for (const sample of profile.samples.slice(0, spent ? 18 : 17)) f.step(sample.buffer)
        assert.equal(f.monitor.snapshot().bufferTrend!.candidate, spent)
        if (spent) assert.equal(f.monitor.snapshot().bufferTrend!.reason, 'low-buffer-tail')
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
        else if (field === 'paused' || field === 'seeking') f.video[field] = true
        else if (field === 'hidden') f.flags.visible = false
        else if (field === 'recovering') f.flags.recovering = true
        else f.controls[field]++
        f.step(0.52)
        assert.equal(f.monitor.snapshot().bufferTrend!.candidate, null)
        assert.deepEqual(f.effects, [])
        f.monitor.dispose()
        assert.equal(f.clock.pendingCount, 0)
      })
for (const rate of [1, 2])
  test(`buffer-v6 U-O publishing reset cannot revive consumed proof rate=${rate}`, (t) => {
    const f = bufferMonitor(t, rate)
    f.video.bufferAheadSec = rate
    f.monitor.tick()
    for (let i = 0; i < 60; i++) f.step(1)
    let calls = 0
    const off = f.monitor.subscribe((s) => {
      if (s.bufferTrend?.reason === 'low-buffer-tail') {
        calls++
        f.monitor.reset()
      }
    })
    f.scope.defer(off)
    for (const s of profile.samples.slice(0, 19)) f.step(s.buffer)
    assert.equal(calls, 1)
    assert.equal(f.monitor.snapshot().bufferTrend!.candidate, null)
    assert.deepEqual(f.effects, [])
    off()
    f.monitor.dispose()
    assert.equal(f.clock.pendingCount, 0)
  })
