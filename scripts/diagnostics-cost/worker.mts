import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { performance } from 'node:perf_hooks'
import { createHash } from 'node:crypto'
import { Session } from 'node:inspector'
import { runInContext } from 'node:vm'
import { ComparisonPage, PageEvent } from '../upstream-compare/page.mts'
import { commonHosts } from '../upstream-compare/inputs.mts'
import { testScope } from '../../tests-v2/support/scope.ts'
import { proof } from './model.mts'
import type { Workload } from './model.mts'

const [configPath] = process.argv.slice(2)
if (!configPath) throw Error('Missing worker configuration')
const config = JSON.parse(readFileSync(configPath, 'utf8')) as {
  side: string
  rate: 1 | 2
  workload: Workload
  profile: boolean
  script: string
  recorder: string
  bytes: number
  sha256: string
  recorderBytes: number
  recorderSha256: string
}
await test('diagnostics-cost isolated worker', { timeout: 5000 }, async (t) => {
  const caseStarted = performance.now()
  const scope = testScope(t),
    data = readFileSync(config.script)
  proof(data, config.bytes, config.sha256)
  proof(readFileSync(config.recorder), config.recorderBytes, config.recorderSha256)
  const counts: Record<string, number> = {
    stringifyCalls: 0,
    stringifyBytes: 0,
    encodeCalls: 0,
    encodeBytes: 0,
    cloneCalls: 0,
  }
  let counting = false
  const count = (kind: string, value: number | string) => {
    const length = typeof value === 'string' ? Buffer.byteLength(value) : value
    if (counting) {
      counts[kind + 'Calls']!++
      if (kind !== 'clone') counts[kind + 'Bytes']! += length
    }
  }
  const session = config.profile ? new Session() : null
  if (session) {
    session.connect()
    scope.defer(() => session.disconnect())
  }
  const post = (method: string, params = {}) =>
    new Promise<any>((resolve, reject) =>
      session!.post(method as 'Profiler.enable', params, (error, result) =>
        error ? reject(error) : resolve(result),
      ),
    )
  if (config.profile) {
    const Encoder = TextEncoder,
      clone = structuredClone
    scope.defineGlobal('TextEncoder', {
      configurable: true,
      writable: true,
      value: class extends Encoder {
        override encode(input?: string) {
          const result = super.encode(input)
          count('encode', result.length)
          return result
        }
      },
    })
    scope.defineGlobal('structuredClone', {
      configurable: true,
      writable: true,
      value: <T,>(value: T, options?: Parameters<typeof structuredClone>[1]) => {
        count('clone', 0)
        return clone(value, options)
      },
    })
  }
  const digest = createHash('sha256'),
    times: number[] = []
  let start = performance.now(),
    startupMs = 0
  let cleanup: Record<string, number> = {},
    tick: () => Promise<void>
  let close: () => Promise<void> = async () => {}
  if (config.workload === 'healthy') {
    const page = new ComparisonPage(config.rate, commonHosts())
    scope.defer(() => page.close().then(() => {}))
    if (config.profile) {
      page.context.__costCount = count
      runInContext(
        `globalThis.__savedStringify = JSON.stringify; JSON.stringify = function(...args) {
        const output = Reflect.apply(__savedStringify, this, args);
        __costCount('stringify', typeof output === 'string' ? output : 0); return output;
      }`,
        page.context,
      )
      scope.defer(() => {
        runInContext(
          'JSON.stringify = __savedStringify; delete globalThis.__savedStringify; delete globalThis.__costCount',
          page.context,
        )
      })
    }
    page.load(data.toString('utf8'), 'fixed-product-version')
    await page.clock.advance(50)
    const fetch = page.window.fetch as typeof globalThis.fetch
    const api = fetch('https://api.bilibili.com/x/player/wbi/playurl?cid=100001').then((r) =>
      r.json(),
    )
    await page.clock.advance(50)
    await api
    startupMs = performance.now() - start
    tick = async () => {
      page.input(() => {
        page.video.currentTime += config.rate
        page.video.frames += 30
        page.video.buffer = 30 * config.rate
        page.video.dispatchEvent(new PageEvent('timeupdate'))
      })
      const requests = (['video', 'audio'] as const).map((kind) =>
        fetch(page.mediaUrl(kind), { headers: { 'x-comparison-role': 'website' } }).then((r) =>
          r.arrayBuffer(),
        ),
      )
      await page.clock.advance(1000)
      await Promise.all(requests)
    }
    for (let i = 0; i < 60; i++) await tick()
    assert.equal(page.hooksInstalled(), true)
    assert.ok(page.observations.some((o) => o.kind === 'complete' && o.media === 'video'))
    close = async () => {
      digest.update(
        JSON.stringify({
          observations: page.observations,
          storage: [...page.memory],
          media: {
            position: page.video.currentTime,
            rate: page.video.playbackRate,
            frames: page.video.frames,
          },
        }),
      )
      const result = await page.close()
      assert.deepEqual(page.invalid, [])
      cleanup = {
        ...result.after,
        unclassified: result.unclassified,
        callbacksAfterClose: result.callbacksAfterClose,
      }
    }
  } else {
    const { create } = (await import(pathToFileURL(config.recorder).href)) as {
      create: (
        rate: 1 | 2,
        workload: Workload,
      ) => (i: number) => { before: unknown; after: unknown; report: string }
    }
    let i = 0
    const exercise = create(config.rate, config.workload)
    startupMs = performance.now() - start
    if (config.profile) {
      const stringify = JSON.stringify
      // Host-only isolated worker. Global restoration is owned by testScope.
      scope.defineGlobal('JSON', {
        configurable: true,
        writable: true,
        value: Object.create(Object.getPrototypeOf(JSON), {
          ...Object.getOwnPropertyDescriptors(JSON),
          stringify: {
            configurable: true,
            writable: true,
            enumerable: false,
            value: (...args: Parameters<typeof JSON.stringify>) => {
              const output = stringify(...args)
              count('stringify', output ?? 0)
              return output
            },
          },
        }),
      })
    }
    tick = async () => {
      const value = exercise(i++)
      assert.deepEqual(value.after, value.before)
      digest.update(JSON.stringify(value))
    }
    cleanup = { timers: 0, listeners: 0, requests: 0, subscriptions: 0 }
  }
  if (session) {
    await post('Profiler.enable')
    await post('Profiler.setSamplingInterval', { interval: 100 })
    await post('Profiler.start')
  }
  counting = true
  const heapStart = process.memoryUsage().heapUsed,
    cpuStart = process.cpuUsage()
  let heapPeak = heapStart
  for (let i = 0; i < 600; i++) {
    start = performance.now()
    await tick()
    times.push(performance.now() - start)
    heapPeak = Math.max(heapPeak, process.memoryUsage().heapUsed)
  }
  const cpu = process.cpuUsage(cpuStart),
    heapEnd = process.memoryUsage().heapUsed
  counting = false
  let hotspots: { name: string; hits: number }[] = []
  if (session) {
    const { profile } = await post('Profiler.stop')
    const hits = new Map<string, number>()
    for (const node of profile.nodes) {
      const name = node.callFrame.functionName || '(anonymous)'
      hits.set(name, (hits.get(name) ?? 0) + (node.hitCount ?? 0))
    }
    hotspots = [...hits]
      .map(([name, hits]) => ({ name, hits }))
      .sort((a, b) => b.hits - a.hits)
      .slice(0, 40)
  }
  await close()
  assert.ok(Object.values(cleanup).every((n) => n === 0))
  await scope.dispose()
  const caseDurationMs = performance.now() - caseStarted
  assert.ok(caseDurationMs <= 5000, 'case and cleanup exceeded five seconds')
  process.stdout.write(
    'DIAGNOSTICS_RESULT ' +
      JSON.stringify({
        validity: 'valid',
        side: config.side,
        rate: config.rate,
        workload: config.workload,
        times,
        startupMs,
        caseDurationMs,
        cpu,
        heap: { start: heapStart, end: heapEnd, peak: heapPeak },
        digest: digest.digest('hex'),
        cleanup,
        ...(config.profile ? { counts, hotspots } : {}),
      }) +
      '\n',
  )
})
