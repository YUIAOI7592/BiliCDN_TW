import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture, media } from './routing-fixture.ts'
import { start, finish } from '../../support/route-dispatch.ts'
import { testScope } from '../../support/scope.ts'

function permutations(values: readonly number[]): number[][] {
  if (!values.length) return [[]]
  return values.flatMap((value, index) =>
    permutations(values.filter((_, i) => i !== index)).map((rest) => [value, ...rest]),
  )
}

for (const boundary of ['none', 'policy', 'content', 'authority'] as const)
  for (const order of permutations([0, 1, 2, 3]))
    test(`V226 ownership: two hosts two representations order=${order.join('')} boundary=${boundary}`, async (t) => {
      const scope = testScope(t),
        f = fixture(scope),
        initial = f.session.get()
      const a = media('matrix', 'a.m4s'),
        b = media('matrix', 'b.m4s')
      const input = (key: string, height: number, url: string) => ({
        generation: initial.generation,
        epoch: initial.epoch,
        kind: 'video' as const,
        key,
        height,
        codec: 'avc',
        bandwidth: 4_000_000,
        urls: [url],
        source: 'trusted-api' as const,
      })
      f.vault.register(input('a', 1080, a))
      const bRep = f.vault.register(input('b', 2160, b))!
      const a1 = start(f, a, 1),
        a2 = start(f, a, 2)
      const alternative = f.routes
        .startupOptions(b)!
        .candidates.find((c) => c.host !== a1.request.targetHost)!
      assert.ok(alternative)
      assert.ok(f.routes.commitStartupChoice(b, alternative, 'matrix-new-route'))
      const b1 = start(f, b, 3),
        b2 = start(f, b, 4),
        work = [a1, a2, b1, b2]
      assert.notEqual(a1.request.targetHost, b1.request.targetHost)
      assert.equal(f.routes.snapshot().currentCapacity, null)
      if (boundary === 'policy') f.routes.invalidateForUserSetting()
      if (boundary === 'content') {
        const next = f.session.beginEpoch()
        f.vault.reset(next.generation, next.epoch)
        f.routes.resetEpoch()
      }
      if (boundary === 'authority') {
        assert.equal(
          f.vault.register({
            ...input('b', 2160, media('matrix', 'b-new.m4s')),
            refreshTrustedSources: true,
          }),
          bRep,
        )
        assert.notEqual(f.vault.identity(bRep)?.authorityRevision, b1.request.authorityRevision)
      }
      const events: string[] = []
      scope.defer(
        f.routes.subscribe((event) => {
          if (event.type === 'route-confirmed')
            events.push(String(event.observation.request?.requestId))
        }),
      )
      let completedB = 0
      for (const index of order) {
        await finish(f, work[index]!)
        if (index >= 2) completedB++
        if (boundary === 'none' && completedB === 2)
          assert.equal(f.session.get().representation, bRep)
        else assert.equal(f.session.get().representation, null)
        if (boundary !== 'none') assert.equal(f.session.get().affinity, null)
      }
      if (boundary === 'none') {
        assert.equal(f.session.get().affinity?.host, b1.request.targetHost)
        assert.equal(f.routes.snapshot().activePlan?.host, b1.request.targetHost)
        assert.deepEqual(
          events,
          order.filter((i) => i >= 2).map((i) => String(work[i]!.request.requestId)),
        )
      } else assert.deepEqual(events, [])
      const aSamples = f.evidence.get(a1.request.targetHost, 'video')?.samples.length ?? 0
      const bSamples = f.evidence.get(b1.request.targetHost, 'video')?.samples.length ?? 0
      assert.equal(aSamples, boundary === 'content' ? 0 : 2)
      assert.equal(bSamples, boundary === 'none' || boundary === 'policy' ? 2 : 0)
      assert.equal(f.clock.pendingCount, 0)
    })
