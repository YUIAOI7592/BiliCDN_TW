import { createHash } from 'node:crypto'
import { FakeClock } from '../../tests-v2/support/clock.ts'

export type Version = '1.3.4' | '2.1.27'
export type Rate = 1 | 2
export const scenarios = [
  'healthy',
  'network-jitter',
  'short-stall',
  'buffer-drain',
  'video-held',
  'goal-nonzero',
  'goal-zero',
  'long-seek',
  'new-seek',
  'new-pause',
  'new-rate',
] as const
export type Scenario = (typeof scenarios)[number]
export interface Observation {
  readonly seq: number
  readonly at: number
  readonly origin: 'input' | 'product' | 'platform'
  readonly kind: string
  readonly media?: 'video' | 'audio' | 'other'
  readonly value?: number | string | boolean
  readonly host?: string
  readonly logicalRequest?: number
}
export interface Assertion {
  readonly id: string
  readonly applicability: 'applicable' | 'not-applicable'
  readonly expected: string
  readonly actual: string
  readonly evidence: readonly number[]
  readonly verdict: 'pass' | 'fail' | 'undetermined'
}
export interface Cleanup {
  readonly before: { timers: number; listeners: number; requests: number; subscriptions: number }
  readonly after: { timers: number; listeners: number; requests: number; subscriptions: number }
  readonly unclassified: number
  readonly callbacksAfterClose: number
}
export interface CaseResult {
  readonly id: string
  readonly version: Version
  readonly scenario: Scenario
  readonly rate: Rate
  readonly scenarioHash: string
  readonly validity: 'valid' | 'invalid' | 'not-executed'
  readonly verdict: 'pass' | 'fail' | 'undetermined'
  readonly reasons: readonly string[]
  readonly assertions: readonly Assertion[]
  readonly observations: readonly Observation[]
  readonly cleanup: Cleanup | null
  readonly calibration: readonly string[]
  readonly metrics: ReturnType<typeof comparisonMetrics>
}
export const sha256 = (data: string | Uint8Array): string =>
  createHash('sha256').update(data).digest('hex')
export function checkSource(data: Uint8Array, bytes: number, hash: string): void {
  if (data.byteLength !== bytes || sha256(data) !== hash)
    throw Error('Immutable comparison input mismatch')
}
export function scenarioHash(scenario: Scenario, rate: Rate): string {
  return sha256(
    JSON.stringify({ schemaVersion: 1, scenario, rate, preludeMs: 60000, durationMs: 180000 }),
  )
}
export async function drainJobs(): Promise<void> {
  // A bounded host turn also lets Node's Response body jobs settle. No wall-clock sleep.
  for (let i = 0; i < 16; i++) await Promise.resolve()
  await new Promise<void>((resolve) => setImmediate(resolve))
  for (let i = 0; i < 16; i++) await Promise.resolve()
}

/** Owns only page timers, retaining FIFO task/microtask checkpoints with the existing FakeClock. */
export class PageClock {
  readonly clock = new FakeClock()
  readonly start = this.clock.now()
  #serial = 0
  #closed = false
  #tasks = new Map<number, { at: number; every: number; run: () => void; cancel: () => void }>()
  #ready: number[] = []
  #microtasks: (() => void)[] = []
  callbacksAfterClose = 0
  now = (): number => this.clock.now()
  relative = (): number => this.now() - this.start
  get pendingCount(): number {
    return this.#tasks.size + this.#microtasks.length
  }
  set(run: () => void, delay: number, every = false): number {
    if (this.#closed) {
      this.callbacksAfterClose++
      return 0
    }
    if (!Number.isFinite(delay) || delay < 0) throw Error('Invalid page timer delay')
    const interval = every ? Math.max(1, delay) : 0
    const id = ++this.#serial
    const enqueue = (): void => {
      const task = this.#tasks.get(id)
      if (!task) return
      if (task.every) task.at += task.every
      this.#ready.push(id)
    }
    const cancel = every
      ? this.clock.interval(enqueue, interval)
      : this.clock.timeout(enqueue, delay)
    this.#tasks.set(id, { at: this.now() + (interval || delay), every: interval, run, cancel })
    return id
  }
  clear = (id: number): void => {
    this.#tasks.get(id)?.cancel()
    this.#tasks.delete(id)
  }
  microtask = (run: () => void): void => {
    if (this.#closed) {
      this.callbacksAfterClose++
      return
    }
    this.#microtasks.push(run)
  }
  async advance(ms: number): Promise<void> {
    if (this.#closed || !Number.isFinite(ms) || ms < 0) throw Error('Invalid page clock advance')
    const end = this.now() + ms
    let callbacks = 0
    for (;;) {
      while (this.#microtasks.length || this.#ready.length) {
        if (++callbacks > 10000) throw Error('Page callback limit exceeded')
        const micro = this.#microtasks.shift()
        if (micro) micro()
        else {
          const id = this.#ready.shift()!,
            task = this.#tasks.get(id)
          if (task) {
            if (!task.every) this.#tasks.delete(id)
            task.run()
          }
        }
        await drainJobs()
      }
      await drainJobs()
      if (this.#microtasks.length || this.#ready.length) continue
      const next = Math.min(...[...this.#tasks.values()].map((task) => task.at))
      if (next > end) break
      this.clock.advance(Math.max(0, next - this.now()))
    }
    this.clock.advance(end - this.now())
  }
  close(): void {
    for (const id of [...this.#tasks.keys()]) this.clear(id)
    this.#ready.length = 0
    this.#microtasks.length = 0
    this.#closed = true
  }
  dispose(): void {
    if (this.pendingCount || this.clock.pendingCount) throw Error('Page clock was not released')
    this.clock.dispose()
  }
}

export function sustainedPlayback(samples: readonly Observation[], rate: number): boolean {
  const times = samples.filter((e) => e.kind === 'tail-time')
  const frames = samples.filter((e) => e.kind === 'tail-frames')
  const rates = samples.filter((e) => e.kind === 'tail-rate')
  const qualified = samples.filter((e) => e.kind === 'tail-qualified')
  return (
    times.length === 16 &&
    frames.length === 16 &&
    rates.length === 16 &&
    qualified.length === 16 &&
    qualified.every((e) => e.value === true) &&
    rates.every((e) => e.value === rate) &&
    times.every(
      (e, i) =>
        i === 0 ||
        (typeof e.value === 'number' &&
          typeof times[i - 1]!.value === 'number' &&
          e.value - Number(times[i - 1]!.value) > 0.05 &&
          Number(frames[i]!.value) > Number(frames[i - 1]!.value) &&
          e.at - times[i - 1]!.at === 1000),
    )
  )
}
export function restorationFacts(events: readonly Observation[], target: number, rate: number) {
  const effects = events.filter((e) => e.origin === 'product')
  const reloads = effects.filter((e) => e.kind === 'reload')
  const seeks = effects.filter((e) => e.kind === 'seek')
  const rates = effects.filter((e) => e.kind === 'setRate')
  const plays = effects.filter((e) => e.kind === 'play')
  return {
    position:
      seeks.length === 1 &&
      typeof seeks[0]?.value === 'number' &&
      Number.isFinite(seeks[0].value) &&
      Math.abs(seeks[0].value - target) <= 0.000001,
    rate: rates.length === 1 && rates[0]?.value === rate,
    order:
      reloads.length === 1 &&
      seeks.length === 1 &&
      rates.length === 1 &&
      plays.length === 1 &&
      reloads[0]!.seq < seeks[0]!.seq &&
      seeks[0]!.seq < rates[0]!.seq &&
      rates[0]!.seq < plays[0]!.seq,
    actual: {
      reloads: reloads.map((e) => e.at),
      seeks: seeks.map((e) => e.value),
      rates: rates.map((e) => e.value),
      plays: plays.map((e) => e.at),
    },
  }
}
export function parseComparisonArgs(args: readonly string[]) {
  if (
    args.some((e) => !['--json', '--calibrate'].includes(e)) ||
    new Set(args).size !== args.length
  )
    throw Error('Invalid comparison arguments')
  return { json: args.includes('--json'), calibration: args.includes('--calibrate') }
}

export function validCaseResult(value: unknown, id: string): value is CaseResult {
  if (!value || typeof value !== 'object') return false
  const e = value as Record<string, unknown>
  return (
    e.id === id &&
    ['1.3.4', '2.1.27'].includes(String(e.version)) &&
    scenarios.includes(e.scenario as Scenario) &&
    [1, 2].includes(Number(e.rate)) &&
    typeof e.scenarioHash === 'string' &&
    /^[a-f0-9]{64}$/.test(e.scenarioHash) &&
    ['valid', 'invalid', 'not-executed'].includes(String(e.validity)) &&
    ['pass', 'fail', 'undetermined'].includes(String(e.verdict)) &&
    Array.isArray(e.reasons) &&
    e.reasons.every((v) => typeof v === 'string') &&
    Array.isArray(e.calibration) &&
    e.calibration.every((v) => typeof v === 'string') &&
    Array.isArray(e.observations) &&
    e.observations.every((v, i) => {
      if (!v || typeof v !== 'object') return false
      const row = v as Record<string, unknown>
      return (
        row.seq === i + 1 &&
        typeof row.at === 'number' &&
        Number.isFinite(row.at) &&
        row.at >= 0 &&
        ['input', 'product', 'platform'].includes(String(row.origin)) &&
        typeof row.kind === 'string' &&
        (row.value === undefined ||
          typeof row.value === 'boolean' ||
          (typeof row.value === 'number' && Number.isFinite(row.value)) ||
          (typeof row.value === 'string' && /^[A-Za-z0-9_.@ -]+$/.test(row.value))) &&
        (row.media === undefined || ['video', 'audio', 'other'].includes(String(row.media))) &&
        (row.host === undefined ||
          (typeof row.host === 'string' &&
            /^(?:[a-z0-9-]+\.bilivideo\.com|api\.bilibili\.com)$/.test(row.host))) &&
        (row.logicalRequest === undefined ||
          (Number.isSafeInteger(row.logicalRequest) && Number(row.logicalRequest) > 0)) &&
        !Object.keys(row).some(
          (key) =>
            !['seq', 'at', 'origin', 'kind', 'media', 'value', 'host', 'logicalRequest'].includes(
              key,
            ),
        )
      )
    }) &&
    Array.isArray(e.assertions) &&
    e.assertions.every((v) => {
      if (!v || typeof v !== 'object') return false
      const row = v as Record<string, unknown>
      return (
        typeof row.id === 'string' &&
        typeof row.expected === 'string' &&
        typeof row.actual === 'string' &&
        ['applicable', 'not-applicable'].includes(String(row.applicability)) &&
        ['pass', 'fail', 'undetermined'].includes(String(row.verdict)) &&
        Array.isArray(row.evidence) &&
        row.evidence.every((n) => Number.isSafeInteger(n) && Number(n) > 0)
      )
    }) &&
    e.cleanup !== undefined &&
    e.metrics !== undefined
  )
}
export function newOperationProtected(
  events: readonly Observation[],
  at: number,
  kind: 'seek' | 'pause' | 'rate',
  value: number,
): boolean {
  return !events.some(
    (e) =>
      e.origin === 'product' &&
      e.at >= at &&
      ((kind === 'pause' && e.kind === 'play') ||
        (kind === 'rate' && e.kind === 'setRate' && e.value !== value) ||
        (kind === 'seek' && e.kind === 'seek' && e.value !== value)),
  )
}
export function comparisonMetrics(events: readonly Observation[], start: number) {
  const after = events.filter((e) => e.at >= start)
  const onset = after.find((e) => e.kind === 'fault-start')?.at ?? start
  let previous = events
    .filter(
      (e) => e.at < start && e.kind === 'dispatch' && e.media === 'video' && e.value === 'website',
    )
    .at(-1)?.host
  const switches: number[] = []
  for (const e of after)
    if (e.kind === 'dispatch' && e.media === 'video' && e.value === 'website') {
      if (previous && previous !== e.host) switches.push(e.at - start)
      previous = e.host
    }
  const reloads = after.filter((e) => e.kind === 'reload' && e.origin === 'product')
  const seen = new Set<number>()
  let retryDispatches = 0
  for (const e of after)
    if (e.kind === 'dispatch' && e.value === 'website' && e.logicalRequest !== undefined) {
      if (seen.has(e.logicalRequest)) retryDispatches++
      seen.add(e.logicalRequest)
    }
  return {
    faultOffsetMs: onset - start,
    firstReloadFromFaultMs: reloads[0] ? reloads[0].at - onset : null,
    firstVideoHostChangeFromFaultMs:
      switches.find((at) => at >= onset - start) !== undefined
        ? switches.find((at) => at >= onset - start)! - (onset - start)
        : null,
    retryDispatches,
    firstVideoHostChangeMs: switches[0] ?? null,
    videoHostChanges: switches.length,
    firstReloadMs: reloads[0] ? reloads[0].at - start : null,
    reloads: reloads.length,
    wireDispatches: after.filter((e) => e.kind === 'dispatch' && e.value === 'website').length,
    probeDispatches: after.filter((e) => e.kind === 'dispatch' && e.value === 'probe').length,
    aborts: after.filter((e) => e.kind === 'abort').length,
    connectionHints: after.filter((e) => e.kind === 'connection-hint').length,
    sdkEffects: after.filter(
      (e) =>
        e.origin === 'product' && ['reload', 'seek', 'setRate', 'play', 'pause'].includes(e.kind),
    ).length,
  }
}
export function outcomeCode(results: readonly Pick<CaseResult, 'validity' | 'verdict'>[]): number {
  return results.length > 0 && results.every((e) => e.validity === 'valid' && e.verdict === 'pass')
    ? 0
    : 1
}
export function audioPassesDuringHold(events: readonly Observation[], start: number): boolean {
  const audio = events.filter(
    (e) => e.kind === 'complete' && e.media === 'audio' && e.value === 'website',
  )
  return Array.from({ length: 45 }, (_, i) => start + i * 1000).every((at) =>
    audio.some((e) => e.at >= at && e.at < at + 1000),
  )
}
