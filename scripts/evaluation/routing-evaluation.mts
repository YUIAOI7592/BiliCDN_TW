import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { posix, resolve } from 'node:path'
import { build } from 'esbuild'
import { evaluateMeasurement } from './measurement-evaluation.mts'
import { evaluateDeadlines } from './deadline-evaluation.mts'
import { evaluateOptimization } from './optimization-evaluation.mts'

export const baselineRevision = '048b0f94e6bb98922ee5bcc0d1b30003cf3b12a9'
const now = 2_000_000_000_000,
  probeBytes = 192 * 1024
interface RankingRow {
  readonly candidate: { readonly host: string }
  readonly eligible: boolean
  readonly capacityConfidence: string
  readonly safeThroughputMbps: number | null
  readonly demandRatio: number | null
}
type Baseline = {
  chooseRoute(
    input: ReturnType<typeof facts>,
    clock: { now(): number },
    id: string,
  ): { host: string | null }
  rankRoutes(input: ReturnType<typeof facts>, now: number): RankingRow[]
}
type Policy = Baseline & {
  evidenceMetrics(evidence: unknown, now: number): { revalidationRequired: boolean }
  startupCapacityPool(rows: RankingRow[]): { ranked: RankingRow[]; exploration: RankingRow | null }
  startupSelection(rows: RankingRow[], exploration: RankingRow | null): RankingRow[]
}
let currentPolicy: Promise<Policy> | undefined
function current(): Promise<Policy> {
  return (currentPolicy ??= (async () => {
    const compiled = await build({
      stdin: {
        contents:
          "export {chooseRoute,rankRoutes} from './src-v2/domain/routing.ts'; export {evidenceMetrics} from './src-v2/domain/evidence.ts'; export {startupCapacityPool,startupSelection} from './src-v2/domain/startup-policy.ts'",
        resolveDir: process.cwd(),
      },
      bundle: true,
      write: false,
      platform: 'node',
      format: 'esm',
      logLevel: 'silent',
    })
    return import(
      `data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0]!.contents).toString('base64')}`
    ) as Promise<Policy>
  })())
}
let reference: Promise<Baseline> | undefined
function baseline(): Promise<Baseline> {
  return (reference ??= (async () => {
    // Compile the immutable pre-change pure policy, never a release bundle or runtime entry.
    const result = await build({
      entryPoints: ['src-v2/domain/routing.ts'],
      bundle: true,
      write: false,
      platform: 'node',
      format: 'esm',
      logLevel: 'silent',
      plugins: [
        {
          name: 'fixed-git-domain',
          setup(builder) {
            builder.onResolve({ filter: /.*/ }, (args) => {
              const path = posix.normalize(
                args.kind === 'entry-point'
                  ? args.path
                  : posix.join(posix.dirname(args.importer), args.path),
              )
              if (!path.startsWith('src-v2/domain/') || !path.endsWith('.ts'))
                throw Error('Non-domain baseline import: ' + path)
              return { path, namespace: 'git-domain' }
            })
            builder.onLoad({ filter: /.*/, namespace: 'git-domain' }, (args) => ({
              loader: 'ts',
              contents: execFileSync('git', ['show', `${baselineRevision}:${args.path}`], {
                encoding: 'utf8',
              }),
            }))
          },
        },
      ],
    })
    return import(
      `data:text/javascript;base64,${Buffer.from(result.outputFiles[0]!.contents).toString('base64')}`
    ) as Promise<Baseline>
  })())
}
interface Scenario {
  readonly id: string
  readonly rates: readonly (number | null)[]
  readonly ttfb: readonly number[]
  readonly age?: number
  readonly bytes?: number | null
  readonly buffer?: number
  readonly current?: boolean
  readonly probes?: boolean
  readonly revalidation?: boolean
  readonly delivery?: readonly number[]
}
function frozenScenarios(): readonly Scenario[] {
  return [
    { id: 'original-faster', rates: [30, 20], ttfb: [50, 50] },
    { id: 'healthy-current', rates: [10, 40], ttfb: [50, 50], current: true },
    { id: 'fresh-insufficient', rates: [4, 20], ttfb: [50, 50], current: true },
    { id: 'historical-capacity', rates: [30, 20], ttfb: [50, 50], age: 300001 },
    { id: 'small-response', rates: [10, 20], ttfb: [10, 300], bytes: 65536, buffer: 0.1 },
    { id: 'large-body', rates: [10, 20], ttfb: [10, 300], bytes: 8000000 },
    { id: 'unknown-size', rates: [30, 20], ttfb: [50, 50], bytes: null },
    { id: 'reserved-exploration', rates: [30, 20, 15, null], ttfb: [50, 50, 50, 50], probes: true },
    { id: 'expired-isolation', rates: [30, 20], ttfb: [50, 50], revalidation: true },
    { id: 'future-divergence', rates: [30, 20], ttfb: [50, 50], delivery: [5000, 300] },
  ]
}
function facts(scenario: Scenario) {
  const hosts = ['original.example', 'catalog.example', 'third.example', 'unknown.example']
  const records = scenario.rates.map((rate, index) => ({
    host: hosts[index]!,
    kind: 'video' as const,
    circuitLevel: 0,
    circuitUntil: scenario.revalidation && index === 0 ? now - 1 : 0,
    updatedAt: now,
    samples:
      rate === null
        ? []
        : [0, 1].map((request) => ({
            requestId: `${index}-${request}`,
            at: now - (scenario.age ?? 0),
            source: 'transport',
            outcome: 'success',
            throughputMbps: rate,
            ttfbMs: scenario.ttfb[index]!,
            failureKind: null,
            bytes: 1000000,
            elapsedMs: 8000 / rate,
            timingBasis: 'xhr-terminal',
          })),
  }))
  return {
    candidates: scenario.rates.map((_, index) =>
      index === 0
        ? {
            type: 'root-original',
            host: hosts[index]!,
            kind: 'video',
            catalogIndex: index,
            route: null,
            handle: null,
          }
        : { type: 'catalog-generated', host: hosts[index]!, kind: 'video', catalogIndex: index },
    ),
    evidenceFor: (host: string) => records.find((row) => row.host === host) ?? null,
    restrictions: {
      disabledCatalogHosts: new Set(),
      defaultUnavailableHosts: new Set(),
      blackHosts: new Set(),
      deadHosts: new Set(),
      hostLocked: new Set(),
    },
    demand: { kind: 'video', requiredMbps: 5, highDemand: false },
    fixedHost: null,
    current: scenario.current ? { type: 'root-original', host: hosts[0]! } : null,
    boundary: scenario.current ? 'request' : 'startup',
    failedHost: null,
    completionBudget: {
      requestBytes: scenario.bytes === undefined ? 1000000 : scenario.bytes,
      playableBufferSec: scenario.buffer ?? 1,
      sampledAt: now,
      timingBasis: 'xhr-terminal',
    },
  }
}
export async function evaluateRouting() {
  const old = await baseline(),
    { rankRoutes, chooseRoute, evidenceMetrics, startupCapacityPool, startupSelection } =
      await current(),
    inputs = frozenScenarios()
  const scenarios = inputs.map((scenario) => {
    const input = facts(scenario),
      oldRows = old.rankRoutes(input, now),
      rows = rankRoutes(input, now)
    const oldDecision = old.chooseRoute(input, { now: () => now }, 'reference')
    const decision = chooseRoute(input, { now: () => now }, 'current')
    const pool = startupCapacityPool(
      rows.map((row) => ({
        ...row,
        revalidationRequired: evidenceMetrics(input.evidenceFor(row.candidate.host), now)
          .revalidationRequired,
      })),
    )
    const oldProbes = scenario.probes
      ? oldRows
          .filter((row) => row.eligible)
          .slice(0, 3)
          .map((row) => row.candidate.host)
      : []
    const currentProbes = scenario.probes
      ? startupSelection(pool.ranked, pool.exploration).map((row) => row.candidate.host)
      : []
    // Future delivery is held out from both policies. It can contradict all past estimates.
    const measure = (host: string | null, probes: readonly string[]) => {
      const index = input.candidates.findIndex((row) => row.host === host)
      const bytes = scenario.bytes ?? 1000000,
        rate = scenario.rates[index]
      const latency = scenario.ttfb[index] ?? 0
      const delivery =
        scenario.delivery?.[index] ??
        (rate ? latency + (bytes / 1000000) * (8000 / rate - latency) : 3000)
      const startupMs = delivery + (probes.length ? 3000 : 0)
      return {
        host,
        startupMs,
        stallMs: Math.max(0, startupMs - (scenario.buffer ?? 1) * 1000),
        switches: Number(!!input.current && input.current.host !== host),
        downloadBytes: bytes + probes.length * probeBytes,
        probeCount: probes.length,
        probeBytes: probes.length * probeBytes,
        reloadCount: 0,
      }
    }
    return {
      id: scenario.id,
      baseline: measure(oldDecision.host, oldProbes),
      current: measure(decision.host, currentProbes),
      oldProbes,
      currentProbes,
    }
  })
  return {
    baselineRevision,
    inputSha256: createHash('sha256').update(JSON.stringify(inputs)).digest('hex'),
    scope:
      'Frozen route/first-segment model; probe accounting uses the same worst-case caps. No recovery-controller or browser simulation; reloads are zero by construction. Unselected delivery is never treated as failure.',
    scenarios,
  }
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === resolve('scripts/evaluation/routing-evaluation.mts')
)
  if (
    process.argv.includes('--optimization') &&
    (process.argv.length !== 3 || process.argv[2] !== '--optimization')
  ) {
    console.error('Usage: npm run evaluate:routing -- --optimization')
    process.exitCode = 2
  } else
    console.log(
      JSON.stringify(
        process.argv.includes('--optimization')
          ? await evaluateOptimization()
          : process.argv.includes('--deadlines')
            ? await evaluateDeadlines()
            : process.argv.includes('--measurement')
              ? await evaluateMeasurement()
              : await evaluateRouting(),
        null,
        2,
      ),
    )
