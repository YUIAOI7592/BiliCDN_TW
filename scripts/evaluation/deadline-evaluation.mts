import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { posix } from 'node:path'
import { build } from 'esbuild'

const baselineRevision = '304c63196a2110943387848765cf5156a01af066',
  now = 2_000_000_000_000
interface Row {
  candidate: { host: string }
  estimatedCompletionMs: number | null
}
interface Policy {
  rankRoutes(input: unknown, now: number): Row[]
  chooseRoute(input: unknown, clock: { now(): number }, id: string): { host: string | null }
  evaluateEarlyRetry(input: unknown): {
    eligible: boolean
    alternativeSec: number | null
    reason: string
  }
}
interface Scenario {
  id: string
  bytes: number
  past: readonly [number, number]
  wait: readonly [number, number]
  future: readonly [number | null, number | null]
  buffer?: number
  rate?: number
  bandwidth?: number
  age?: number
  counts?: readonly [number, number]
  delays?: readonly [number, number, number]
  early?: boolean
  fps?: number
  auto?: boolean
  current?: boolean
}
const definitions: readonly Scenario[] = [
  { id: 'short-response', bytes: 65536, past: [10, 20], wait: [10, 300], future: [9, 18] },
  {
    id: 'large-vbr-segment',
    bytes: 8000000,
    past: [10, 20],
    wait: [10, 300],
    future: [8, 16],
    buffer: 3,
  },
  {
    id: 'single-faster-completion',
    bytes: 65536,
    past: [20, 10],
    wait: [800, 10],
    future: [18, 9],
    counts: [2, 1],
  },
  { id: 'wait-dominated', bytes: 65536, past: [30, 15], wait: [800, 10], future: [25, 14] },
  {
    id: 'competing-flow',
    bytes: 2000000,
    past: [30, 20],
    wait: [40, 80],
    future: [3, 15],
    buffer: 2,
  },
  {
    id: 'capacity-drop',
    bytes: 4000000,
    past: [40, 20],
    wait: [20, 50],
    future: [2, 18],
    buffer: 3,
  },
  { id: 'capacity-recovery', bytes: 1000000, past: [5, 15], wait: [40, 80], future: [40, 14] },
  {
    id: 'stale-buffer-two-x',
    bytes: 1000000,
    past: [10, 20],
    wait: [10, 300],
    future: [8, 18],
    buffer: 2,
    rate: 2,
    age: 1900,
  },
  {
    id: 'expired-buffer',
    bytes: 1000000,
    past: [10, 20],
    wait: [10, 300],
    future: [8, 18],
    buffer: 2,
    age: 2001,
  },
  {
    id: 'early-not-whole-round-fastest',
    bytes: 1000000,
    past: [12, 40],
    wait: [20, 20],
    future: [12, 40],
    delays: [800, 1800, 3000],
  },
  {
    id: 'faster-route-not-worth-extra-wait',
    bytes: 65536,
    past: [10, 30],
    wait: [10, 10],
    future: [10, 30],
    delays: [800, 1800, 3000],
  },
  {
    id: 'early-toggle-off',
    bytes: 1000000,
    past: [12, 40],
    wait: [20, 20],
    future: [12, 40],
    delays: [800, 1800, 3000],
    early: false,
  },
  {
    id: 'healthy-affinity',
    bytes: 1000000,
    past: [12, 40],
    wait: [20, 20],
    future: [12, 40],
    current: true,
  },
  {
    id: 'unknown-unselected-service',
    bytes: 1000000,
    past: [30, 20],
    wait: [20, 20],
    future: [28, null],
  },
  {
    id: 'unknown-selected-service',
    bytes: 1000000,
    past: [30, 20],
    wait: [20, 20],
    future: [null, 18],
  },
  {
    id: 'auto-assumption-4k60-vbr',
    bytes: 8000000,
    past: [35, 22],
    wait: [40, 100],
    future: [20, 18],
    bandwidth: 12_000_000,
    fps: 60000 / 1001,
    rate: 2,
    buffer: 6,
    auto: true,
  },
]
async function policy(revision?: string): Promise<Policy> {
  const contents =
    "export {rankRoutes,chooseRoute} from './src-v2/domain/routing.ts';export {evaluateEarlyRetry} from './src-v2/domain/early-retry.ts'"
  const compiled = await build({
    ...(revision
      ? {
          entryPoints: ['evaluation-entry'],
          plugins: [
            {
              name: 'immutable-domain',
              setup(builder) {
                builder.onResolve({ filter: /.*/ }, (args) => {
                  if (args.path === 'evaluation-entry')
                    return { path: args.path, namespace: 'reference' }
                  const path = posix.normalize(posix.join(posix.dirname(args.importer), args.path))
                  if (!path.startsWith('src-v2/domain/') || !path.endsWith('.ts'))
                    throw Error('Non-domain reference input')
                  return { path, namespace: 'reference' }
                })
                builder.onLoad({ filter: /.*/, namespace: 'reference' }, (args) => ({
                  loader: 'ts',
                  contents:
                    args.path === 'evaluation-entry'
                      ? contents
                      : execFileSync('git', ['show', `${revision}:${args.path}`], {
                          encoding: 'utf8',
                        }),
                }))
              },
            },
          ],
        }
      : { stdin: { contents, resolveDir: process.cwd() } }),
    bundle: true,
    write: false,
    platform: 'node',
    format: 'esm',
    logLevel: 'silent',
  })
  return import(
    `data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0]!.contents).toString('base64')}`
  ) as Promise<Policy>
}
export async function evaluateDeadlines() {
  const [prior, current] = await Promise.all([policy(baselineRevision), policy()])
  const scenarios = definitions.map((s) => {
    const hosts = ['a.example', 'b.example'],
      rate = s.rate ?? 1,
      bandwidth = s.bandwidth ?? 4_000_000,
      demand = Math.max(2, (bandwidth / 1e6) * rate * 1.25)
    const evidence = s.past.map((mbps, i) => ({
      host: hosts[i],
      kind: 'video',
      samples: Array.from({ length: s.counts?.[i] ?? 2 }, (_, j) => ({
        requestId: `${i}-${j}`,
        at: now - 200 + j * 100,
        source: 'transport',
        outcome: 'success',
        throughputMbps: 8000 / (s.wait[i]! + 8000 / mbps),
        ttfbMs: s.wait[i],
        failureKind: null,
        bytes: 1_000_000,
        elapsedMs: s.wait[i]! + 8000 / mbps,
        timingBasis: 'xhr-terminal',
      })),
      circuitLevel: 0,
      circuitUntil: 0,
      updatedAt: now - 100,
    }))
    if (evidence.some((e) => e.samples.some((p) => p.at >= now)))
      throw Error('Future training leakage')
    const run = (p: Policy, isCurrent: boolean) => {
      const age = s.age ?? 0,
        budget = isCurrent
          ? age <= 2000
            ? Math.max(0, (s.buffer ?? 4) / rate - age / 1000)
            : null
          : (s.buffer ?? 4) / rate
      const input = {
        candidates: hosts.map((host) => ({
          type: 'catalog-generated',
          host,

          kind: 'video',
        })),
        evidenceFor: (host: string) => evidence.find((e) => e.host === host) ?? null,
        restrictions: {
          disabledCatalogHosts: new Set(),
          defaultUnavailableHosts: new Set(),
          blackHosts: new Set(),
          deadHosts: new Set(),
          hostLocked: new Set(),
        },
        demand: { kind: 'video', requiredMbps: demand, highDemand: bandwidth > 8e6 },
        fixedHost: null,
        current: s.current ? { type: 'catalog-generated', host: hosts[0] } : null,
        boundary: s.current ? 'request' : 'startup',
        failedHost: null,
        completionBudget: {
          requestBytes: s.bytes,
          playableBufferSec: budget,
          sampledAt: now - age,
          ageMs: isCurrent ? age : undefined,
          timingBasis: 'xhr-terminal',
        },
      }
      const rows = p.rankRoutes(input, now),
        decision = p.chooseRoute(input, { now: () => now }, 'evaluation')
      let host = decision.host,
        waitingMs = 0
      if (s.delays) {
        const first = s.past.findIndex(
            (mbps, i) => (8000 / (s.wait[i]! + 8000 / mbps)) * 0.7 >= demand,
          ),
          early = s.early !== false && isCurrent
        waitingMs = early && first >= 0 ? s.delays[first]! : 3000
        if (early && first >= 0) host = hosts[first]!
      }
      const index = hosts.indexOf(host ?? ''),
        future = s.future[index] ?? null,
        actualMs = future === null ? null : s.wait[index]! + (s.bytes * 8) / (future * 1000),
        prediction = rows.find((r) => r.candidate.host === host)?.estimatedCompletionMs ?? null,
        remainingMs = budget === null ? null : budget * 1000,
        trueRemainingMs = Math.max(0, ((s.buffer ?? 4) / rate) * 1000 - age)
      const probeBytes = s.delays
        ? s.delays.reduce((n, delay) => n + Math.floor(262144 * Math.min(1, waitingMs / delay)), 0)
        : 0
      return {
        host,
        startupWaitingMs: waitingMs,
        deliveryMs: actualMs,
        stallMs: actualMs === null ? null : Math.max(0, waitingMs + actualMs - trueRemainingMs),
        predictedMs: prediction,
        absoluteErrorMs:
          actualMs === null || prediction === null ? null : Math.abs(actualMs - prediction),
        underestimatedMs:
          actualMs === null || prediction === null ? null : Math.max(0, actualMs - prediction),
        falseDeadlineFit:
          actualMs === null || prediction === null || remainingMs === null
            ? null
            : prediction <= remainingMs && actualMs > trueRemainingMs,
        switches: Number(!!s.current && host !== hosts[0]),
        downloadBytes: s.bytes + probeBytes,
        extraDownloadedBytes: probeBytes,
        probeCount: s.delays ? 3 : 0,
        probeBytes,
        reloadCount: 0,
        status: actualMs === null ? 'unknown-service' : 'completed',
        representationTrajectory: [
          {
            bandwidth,
            fps: s.fps ?? 30,
            rate,
            bytes: s.bytes,
            mode: s.auto ? 'auto-assumption' : 'fixed',
          },
        ],
      }
    }
    return { id: s.id, baseline: run(prior, false), current: run(current, true) }
  })
  const facts = {
    now,
    startedAt: now - 2000,
    currentHost: 'a.example',
    loadedBytes: 100000,
    totalBytes: 1000000,
    recentBytesPerSec: 50000,
    playableBufferSec: 2,
    requiredMbps: 4,
    alternative: {
      host: 'b.example',
      safeMbps: 40,
      safePayloadMbps: 40,
      ttfbMs: 100,
      successCount: 2,
      oldestAt: now - 1000,
    },
  }
  const handoff = {
    id: 'handoff-suppresses-previous-retry',
    baseline: prior.evaluateEarlyRetry(facts),
    current: current.evaluateEarlyRetry(facts),
    heldOutContinueMs: 18000,
    heldOutRetryDeliveryMs: 300,
    assumedHandoffBudgetMs: 2000,
  }
  const summary = (key: 'baseline' | 'current') => {
    const completed = scenarios.map((s) => s[key]),
      errors = completed.flatMap((r) => (r.absoluteErrorMs === null ? [] : [r.absoluteErrorMs]))
    return {
      predictions: errors.length,
      meanAbsoluteErrorMs: errors.length ? errors.reduce((a, b) => a + b, 0) / errors.length : null,
      falseDeadlineFits: completed.filter((r) => r.falseDeadlineFit === true).length,
      unknownService: completed.filter((r) => r.status === 'unknown-service').length,
      cancelled: 0,
      incomplete: 0,
    }
  }
  return {
    baselineRevision,
    inputSha256: createHash('sha256').update(JSON.stringify({ definitions, facts })).digest('hex'),
    scope:
      'Synthetic service traces; predictions only use samples completed before dispatch. Auto is an exogenous representation assumption, not a reconstruction or closed-loop calibration of website ABR. Probe partial download uses linear delivery under equal 3x256KiB caps; recovery not simulated, reload=0 by construction. Unknown service is never failure. No real-world benefit or quantile guarantee.',
    summary: { baseline: summary('baseline'), current: summary('current') },
    scenarios,
    handoff,
  }
}
