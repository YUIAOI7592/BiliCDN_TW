import { test } from 'node:test'
import assert from 'node:assert/strict'
import { performance } from 'node:perf_hooks'
import { readFileSync } from 'node:fs'
import { checkSource } from '../upstream-compare/model.mts'
import { ComparisonPage, PageEvent } from '../upstream-compare/page.mts'
import { commonHosts } from '../upstream-compare/inputs.mts'
import { loadCostInput } from './inputs.mts'
import { testScope } from '../../tests-v2/support/scope.ts'
import type { CostResult } from './model.mts'

const [version, speed, sourcePath, sourceBytes, sourceHash] = process.argv.slice(2)
if (!version || !['1', '2'].includes(speed ?? '')) throw Error('Invalid cost invocation')
const rate = Number(speed) as 1 | 2
let result: CostResult | undefined
await test(`full-script healthy cost ${version}@${rate}x`, { timeout: 5000 }, async (t) => {
  let source: string
  if (version === 'working-source') {
    if (!sourcePath || !sourceHash || !Number.isSafeInteger(Number(sourceBytes)))
      throw Error('Missing source proof')
    const data = readFileSync(sourcePath)
    checkSource(data, Number(sourceBytes), sourceHash)
    source = data.toString('utf8')
  } else source = loadCostInput(version)
  const scope = testScope(t)
  const clone = structuredClone
  let diagnosticCloneCalls = 0
  let diagnosticCloneRows = 0
  scope.defineGlobal('structuredClone', {
    configurable: true,
    writable: true,
    value: <T,>(value: T, options?: Parameters<typeof structuredClone>[1]): T => {
      if (Array.isArray(value) && value[0]?.algorithm?.startsWith('buffer-window-v')) {
        diagnosticCloneCalls++
        diagnosticCloneRows += value.length
      }
      return clone(value, options)
    },
  })
  const page = new ComparisonPage(rate, commonHosts())
  scope.defer(async () => {
    await page.close()
  })
  const start = performance.now()
  page.load(source, version)
  await page.clock.advance(50)
  const fetch = page.window.fetch as typeof globalThis.fetch
  const api = fetch('https://api.bilibili.com/x/player/wbi/playurl?cid=100001').then((r) =>
    r.json(),
  )
  await page.clock.advance(50)
  await api
  const startupMs = performance.now() - start
  const tick = async () => {
    page.input(() => {
      page.video.currentTime += rate
      page.video.frames += 30
      page.video.buffer = 30 * rate
      page.video.dispatchEvent(new PageEvent('timeupdate'))
    })
    const requests = (['video', 'audio'] as const).map((kind) =>
      fetch(page.mediaUrl(kind), {
        headers: { 'x-comparison-role': 'website' },
      }).then((r) => r.arrayBuffer()),
    )
    await page.clock.advance(1000)
    await Promise.all(requests)
  }
  for (let i = 0; i < 60; i++) await tick()
  assert.equal(page.hooksInstalled(), true)
  assert.ok(page.video.bindings.get('seeking')?.length)
  assert.ok(page.observations.some((o) => o.kind === 'complete' && o.media === 'video'))
  const heapStart = process.memoryUsage().heapUsed,
    cpuStart = process.cpuUsage(),
    times: number[] = []
  let heapPeak = heapStart
  diagnosticCloneCalls = 0
  diagnosticCloneRows = 0
  for (let i = 0; i < 600; i++) {
    const begin = performance.now()
    await tick()
    times.push(performance.now() - begin)
    heapPeak = Math.max(heapPeak, process.memoryUsage().heapUsed)
  }
  const cpu = process.cpuUsage(cpuStart),
    heapEnd = process.memoryUsage().heapUsed
  const ordered = times.slice().sort((a, b) => a - b)
  const quantile = (p: number) => ordered[Math.floor((ordered.length - 1) * p)]!
  const effects = page.observations.filter(
    (o) =>
      o.origin === 'product' &&
      ['reload', 'seek', 'setRate', 'play', 'dispatch', 'cancel'].includes(o.kind),
  )
  const cleanup = await page.close()
  assert.deepEqual(cleanup.after, { timers: 0, listeners: 0, requests: 0, subscriptions: 0 })
  assert.equal(cleanup.unclassified, 0)
  assert.equal(cleanup.callbacksAfterClose, 0)
  assert.deepEqual(page.invalid, [])
  result = {
    version,
    rate,
    validity: 'valid',
    verdict: 'pass',
    startupMs,
    tickMs: {
      min: ordered[0]!,
      median: quantile(0.5),
      p95: quantile(0.95),
      max: ordered.at(-1)!,
      samples: times,
    },
    cpuMicroseconds: cpu,
    diagnosticClones: { calls: diagnosticCloneCalls, rows: diagnosticCloneRows },
    heapBytes: { start: heapStart, end: heapEnd, peak: heapPeak, delta: heapEnd - heapStart },
    calibration: [
      'full-script',
      'playurl',
      'fetch-xhr-hooks',
      'media-controls',
      'healthy-60s',
      'completed-video',
    ],
    measurementMs: 600000,
    effects,
    cleanup,
  }
})
if (result) process.stdout.write('SHADOW_RESULT ' + JSON.stringify(result) + '\n')
