import assert from 'node:assert/strict'
import { test } from 'node:test'
import { RangeProbeAdapter } from '../../../../src-v2/adapters/transport/range-probe.ts'
import { MeasurementController } from '../../../../src-v2/application/measurement/measurement-controller.ts'
import { MeasurementMetaStore } from '../../../../src-v2/state/measurement-meta-store.ts'
import { finish, start } from '../../../support/route-dispatch.ts'
import { testScope } from '../../../support/scope.ts'
import { fixture, media } from '../routing-fixture.ts'

for (const mode of ['native-enabled', 'catalog-only'])
  for (const status of [403, 404, 410, 416, 429])
    test(`startup Catalog ${status} in ${mode} routes the next request after a network failure`, async (t) => {
      const scope = testScope(t)
      const f = fixture(scope)
      await f.settings.update({ considerNativeSources: mode === 'native-enabled' })
      const { generation, epoch } = f.session.get()
      const resource = media('startup-status', 'video.m4s')
      const otherResource = media('another-resource', 'video.m4s')
      for (const [key, url] of [
        ['current', resource],
        ['other', otherResource],
      ] as const)
        assert.ok(
          f.vault.register({
            generation,
            epoch,
            kind: 'video',
            key,
            height: 1080,
            codec: 'avc',
            bandwidth: 4_000_000,
            urls: [url],
            source: 'trusted-api',
          }),
        )

      const candidates = f.routes.startupOptions(resource)!.candidates
      const catalog = candidates.find((candidate) => candidate.type === 'catalog-generated')!
      const available = candidates.find((candidate) => candidate.host !== catalog.host)!
      await f.evidence.record(catalog.host, 'video', {
        requestId: 'previous-fast-transfer',
        at: f.clock.now(),
        source: 'transport',
        outcome: 'success',
        throughputMbps: 100,
        ttfbMs: 10,
        failureKind: null,
        bytes: 1_000_000,
        elapsedMs: 80,
      })
      const prior = f.evidence.get(catalog.host, 'video')
      const probes: string[] = []
      let tick = 0
      const reader = new RangeProbeAdapter(
        async (input) => {
          const url = String(input)
          const host = new URL(url).hostname
          probes.push(host)
          const response =
            host === available.host
              ? new Response(new Uint8Array(65536), {
                  status: 206,
                  headers: { 'Content-Range': 'bytes 0-65535/65536' },
                })
              : new Response(null, { status: host === catalog.host ? status : 503 })
          Object.defineProperty(response, 'url', { value: url })
          return response
        },
        () => ++tick,
      )
      const controller = scope.own(
        new MeasurementController(
          f.routes,
          new MeasurementMetaStore(f.storage, f.clock.now),
          reader,
          f.clock.now,
          f.clock,
          undefined,
          () => 0,
          f.settings,
          f.clock.now,
        ),
      )
      await controller.prepareStartup(resource)
      const startup = controller.snapshot().startup!
      assert.equal(startup.result, 'adequate')
      assert.equal(startup.selectedHost, available.host)
      assert.equal(startup.results?.find((row) => row.host === catalog.host)?.status, status)
      assert.deepEqual(f.evidence.get(catalog.host, 'video'), prior)
      assert.deepEqual(f.restrictions.list(), [])

      const first = start(f, resource, 1)
      assert.equal(first.request.targetHost, available.host)
      await finish(f, first, true)
      const next = start(f, resource, 2)
      assert.equal(next.request.generation, generation)
      assert.equal(next.request.epoch, epoch)
      assert.equal(next.request.targetHost, f.routes.snapshot().fallback.video?.plannedHost)
      assert.equal(new URL(next.applied.url!).hostname, next.request.targetHost)
      assert.notEqual(next.request.targetHost, available.host)
      assert.ok(
        f.routes.startupOptions(otherResource)?.candidates.some((row) => row.host === catalog.host),
        'the same Catalog host remains eligible for another resource',
      )
      assert.equal(new URL(start(f, otherResource, 3).applied.url!).hostname, catalog.host)
      await controller.prepareStartup(resource)
      assert.equal(probes.length, 3)
      assert.equal(new Set(probes).size, 3)
      assert.equal(
        next.request.targetHost === catalog.host,
        status === 416 || status === 429,
        'the next request respects the resource-specific Catalog status',
      )
    })
