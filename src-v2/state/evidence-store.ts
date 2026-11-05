import {
  addEvidenceSample,
  emptyEvidence,
  EVIDENCE_TTL_MS,
  MAX_EVIDENCE_SAMPLES,
  sampleTiming,
} from '../domain/evidence.ts'
import type {
  EvidenceSample,
  MediaKind,
  RouteEvidence,
  CircuitControlStamp,
  CircuitRecordControl,
} from '../domain/model.ts'
import type { StoragePort } from '../platform/storage-port.ts'
import type { EvidencePort, EvidenceCommitResult } from './evidence-ports.ts'
import { timingBasis } from '../domain/measurement-time.ts'
import { sameCircuitStamp } from '../domain/circuit-policy.ts'
import type { RuntimeIdPort } from '../platform/runtime-id-port.ts'

export const EVIDENCE_KEY = 'bilicdn.v2.routeEvidence'
const MAX_VIDEO_HOSTS = 64
const MAX_AUDIO_HOSTS = 32

interface EvidencePayload {
  readonly controlProtocol?: 1
  readonly generation?: string
  readonly dataRevision?: number
  readonly schema: 2
  readonly records: Readonly<Record<string, RouteEvidence>>
  readonly updatedAt: number
}
const recordKey = (host: string, kind: MediaKind): string => `${kind}:${host}`
const identifier = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-zA-Z0-9:_-]{1,64}$/.test(value)
const revision = (value: unknown): value is number =>
  Number.isSafeInteger(value) && Number(value) >= 0
const parseControl = (value: unknown): CircuitRecordControl | undefined => {
  if (!value || typeof value !== 'object') return undefined
  const row = value as Record<string, unknown>
  if (
    !identifier(row.recordId) ||
    !revision(row.revision) ||
    (row.lastCommitId !== null && !identifier(row.lastCommitId))
  )
    return undefined
  return Object.freeze({
    recordId: row.recordId,
    revision: row.revision,
    lastCommitId: row.lastCommitId,
  })
}

const safeHost = (value: unknown): string | null => {
  const host = String(value ?? '')
    .trim()
    .toLowerCase()
  return /^[a-z0-9.-]{1,253}$/.test(host) && host.includes('.') ? host : null
}

const parsePayload = (value: unknown, now: number): EvidencePayload => {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const source =
    raw.records && typeof raw.records === 'object' ? (raw.records as Record<string, unknown>) : {}
  const records: Record<string, RouteEvidence> = {}
  for (const item of Object.values(source).slice(0, MAX_VIDEO_HOSTS + MAX_AUDIO_HOSTS)) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>,
      host = safeHost(row.host),
      kind = row.kind
    if (!host || (kind !== 'video' && kind !== 'audio')) continue
    const samples: EvidenceSample[] = []
    for (const rawSample of (Array.isArray(row.samples) ? row.samples : []).slice(
      -MAX_EVIDENCE_SAMPLES,
    )) {
      if (!rawSample || typeof rawSample !== 'object') continue
      const sample = rawSample as Record<string, unknown>,
        at = Number(sample.at)
      if (!Number.isFinite(at) || at > now + 5 * 60_000 || now - at > EVIDENCE_TTL_MS) continue
      const outcome =
        sample.outcome === 'failure' ? 'failure' : sample.outcome === 'success' ? 'success' : null
      if (!outcome) continue
      const timing =
        outcome === 'success' ? sampleTiming(sample.bytes, sample.elapsedMs, sample.ttfbMs) : null
      samples.push(
        Object.freeze({
          requestId: String(sample.requestId ?? '').slice(0, 64),
          at,
          source: sample.source === 'challenge' ? 'challenge' : 'transport',
          outcome,
          throughputMbps: Number.isFinite(sample.throughputMbps)
            ? Math.min(100_000, Math.max(0, Number(sample.throughputMbps)))
            : null,
          ttfbMs: Number.isFinite(sample.ttfbMs)
            ? Math.min(120_000, Math.max(0, Number(sample.ttfbMs)))
            : null,
          failureKind: ['network', 'body', 'timeout', 'http-5xx', 'native-invalid'].includes(
            String(sample.failureKind),
          )
            ? (sample.failureKind as EvidenceSample['failureKind'])
            : null,
          ...(timing ?? {}),
          ...(timingBasis(sample.timingBasis)
            ? { timingBasis: timingBasis(sample.timingBasis)! }
            : {}),
        }),
      )
    }
    const updatedAt = Math.min(now + 5 * 60_000, Math.max(0, Number(row.updatedAt) || 0))
    const control = parseControl(row.circuitControl)
    const evidence: RouteEvidence = Object.freeze({
      host,
      kind,
      samples: Object.freeze(samples),
      circuitLevel: Math.max(0, Math.min(4, Math.ceil(Number(row.circuitLevel) || 0))),
      circuitUntil: Math.min(
        now + 7 * 24 * 60 * 60_000,
        Math.max(0, Number(row.circuitUntil) || 0),
      ),
      ...(control ? { circuitControl: control } : {}),
      updatedAt,
    })
    records[recordKey(host, kind)] = evidence
  }
  return Object.freeze({
    ...(raw.controlProtocol === 1 && identifier(raw.generation) && revision(raw.dataRevision)
      ? { controlProtocol: 1 as const, generation: raw.generation, dataRevision: raw.dataRevision }
      : {}),
    schema: 2,
    records: Object.freeze(records),
    updatedAt: Number(raw.updatedAt) || now,
  })
}

export class EvidenceStore implements EvidencePort {
  #payload: EvidencePayload
  #stopRemote: () => void
  #readable = true
  #writes = new WeakMap<object, Map<string, Promise<EvidenceCommitResult>>>()
  #downgrades = new WeakSet<CircuitControlStamp>()
  constructor(
    private readonly storage: StoragePort,
    private readonly now: () => number,
    private readonly ids?: RuntimeIdPort,
  ) {
    this.#payload = parsePayload(null, now())
    this.#refresh()
    this.#stopRemote = storage.listen<unknown>(EVIDENCE_KEY, (_value, remote) => {
      if (!remote) return
      // Notification order and wall timestamps cannot establish commit order.
      this.#refresh()
    })
  }

  #refresh(): EvidencePayload | null {
    try {
      const result = this.storage.readResult?.<unknown>(EVIDENCE_KEY, null)
      if (result && !result.ok) {
        this.#readable = false
        return null
      }
      const raw = result?.ok ? result.value : this.storage.get<unknown>(EVIDENCE_KEY, null)
      this.#payload = parsePayload(raw, this.now())
      this.#readable = true
      return this.#payload
    } catch {
      this.#readable = false
      return null
    }
  }

  control(host: string, kind: MediaKind) {
    const row = this.get(host, kind),
      control = row?.circuitControl
    return {
      level: row?.circuitLevel ?? 0,
      until: row?.circuitUntil ?? 0,
      stamp:
        this.#readable && this.#payload.generation && control
          ? Object.freeze({
              generation: this.#payload.generation,
              recordId: control.recordId,
              revision: control.revision,
            })
          : null,
      synchronized:
        this.#readable &&
        !!this.ids &&
        !!this.storage.readResult &&
        this.storage.sharedLockAvailable?.() === true,
    }
  }

  #result(
    status: EvidenceCommitResult['status'],
    host: string,
    kind: MediaKind,
  ): EvidenceCommitResult {
    return {
      status,
      evidence: this.get(host, kind) ?? emptyEvidence(host, kind),
      stamp: this.control(host, kind).stamp,
    }
  }

  #updatedPayload(latest: EvidencePayload, row: RouteEvidence | null): EvidencePayload {
    const records = { ...latest.records }
    if (row) records[recordKey(row.host, row.kind)] = row
    for (const kind of ['video', 'audio'] as const) {
      const rows = Object.entries(records)
        .filter(([, value]) => value.kind === kind)
        .sort((a, b) => b[1].updatedAt - a[1].updatedAt)
      for (const [key] of rows.slice(kind === 'video' ? MAX_VIDEO_HOSTS : MAX_AUDIO_HOSTS))
        delete records[key]
    }
    const rotate = !latest.generation || latest.dataRevision === Number.MAX_SAFE_INTEGER
    return Object.freeze({
      schema: 2,
      records: Object.freeze(records),
      updatedAt: this.now(),
      ...(this.ids
        ? {
            controlProtocol: 1 as const,
            generation: rotate ? this.ids.next('circuit') : latest.generation!,
            dataRevision: rotate ? 1 : (latest.dataRevision ?? 0) + 1,
          }
        : {}),
    })
  }

  #save(payload: EvidencePayload): { confirmed: boolean; error?: unknown } {
    let accepted = false
    let error: unknown
    try {
      this.storage.set(EVIDENCE_KEY, payload)
      accepted = true
    } catch (cause) {
      error = cause
    }
    const actual = this.#refresh()
    const confirmed =
      !!actual &&
      (payload.generation
        ? actual.generation === payload.generation && actual.dataRevision === payload.dataRevision
        : accepted)
    return { confirmed, ...(error !== undefined ? { error } : {}) }
  }

  get(host: string, kind: MediaKind): RouteEvidence | null {
    return this.#payload.records[recordKey(host, kind)] ?? null
  }
  list(kind?: MediaKind): readonly RouteEvidence[] {
    return Object.freeze(
      Object.values(this.#payload.records).filter((row) => !kind || row.kind === kind),
    )
  }

  async record(
    host: string,
    kind: MediaKind,
    sample: EvidenceSample,
    valid: () => boolean = () => true,
  ): Promise<RouteEvidence> {
    const result = await this.commit(host, kind, sample, sample, valid)
    if (result.status === 'unconfirmed') throw result.error ?? Error('Evidence write unconfirmed')
    return result.evidence
  }

  async commit(
    host: string,
    kind: MediaKind,
    sample: EvidenceSample,
    receipt: object,
    valid: () => boolean = () => true,
  ): Promise<EvidenceCommitResult> {
    const key = recordKey(host, kind)
    let operations = this.#writes.get(receipt)
    const previous = operations?.get(key)
    if (previous) return { ...(await previous), status: 'duplicate' }
    if (!operations) {
      operations = new Map()
      this.#writes.set(receipt, operations)
    }
    if (operations.size >= MAX_VIDEO_HOSTS + MAX_AUDIO_HOSTS)
      return this.#result('invalid', host, kind)
    // Register before invoking storage: native callbacks/storage doubles can synchronously reenter.
    const pending = Promise.resolve()
      .then(() =>
        this.storage.withLock('routeEvidence', () => {
          const latest = this.#refresh()
          if (!latest) return this.#result('unconfirmed', host, kind)
          if (!valid()) return this.#result('invalid', host, kind)
          const prior = latest.records[recordKey(host, kind)] ?? emptyEvidence(host, kind)
          const deduped = {
            ...prior,
            samples: prior.samples.filter((row) => row.requestId !== sample.requestId),
          }
          let updated = addEvidenceSample(deduped, sample, this.now())
          if (this.ids) {
            const old = prior.circuitControl
            const rotate = !old || old.revision === Number.MAX_SAFE_INTEGER
            updated = {
              ...updated,
              circuitControl: Object.freeze({
                recordId: rotate ? this.ids.next('circuit') : old.recordId,
                revision: rotate ? 0 : old.revision + (sample.outcome === 'failure' ? 1 : 0),
                lastCommitId:
                  sample.outcome === 'failure'
                    ? this.ids.next('commit')
                    : (old?.lastCommitId ?? null),
              }),
            }
          }
          if (!valid()) return this.#result('invalid', host, kind)
          const saved = this.#save(this.#updatedPayload(latest, updated))
          return {
            ...this.#result(saved.confirmed ? 'committed' : 'unconfirmed', host, kind),
            ...(saved.error !== undefined ? { error: saved.error } : {}),
          }
        }),
      )
      .catch(() => this.#result('unconfirmed', host, kind))
    operations.set(key, pending)
    return await pending
  }

  async tryDowngrade(
    host: string,
    kind: MediaKind,
    stamp: CircuitControlStamp,
    commitId: string,
    valid: () => boolean,
  ): Promise<EvidenceCommitResult> {
    if (this.#downgrades.has(stamp)) return this.#result('duplicate', host, kind)
    this.#downgrades.add(stamp)
    try {
      return await this.storage.withLock('routeEvidence', (lock) => {
        if (!lock?.exclusive || !this.ids || !this.storage.readResult)
          return this.#result('no-common-lock', host, kind)
        const latest = this.#refresh()
        if (!latest) return this.#result('unconfirmed', host, kind)
        if (!sameCircuitStamp(stamp, this.control(host, kind).stamp))
          return this.#result('stale', host, kind)
        const prior = this.get(host, kind)!
        if (
          !valid() ||
          prior.circuitLevel <= 0 ||
          prior.circuitUntil > this.now() ||
          !identifier(commitId)
        )
          return this.#result('invalid', host, kind)
        const old = prior.circuitControl!,
          rotate = old.revision === Number.MAX_SAFE_INTEGER
        const updated = {
          ...prior,
          circuitLevel: prior.circuitLevel - 1,
          circuitUntil: 0,
          updatedAt: this.now(),
          circuitControl: {
            recordId: rotate ? this.ids.next('circuit') : old.recordId,
            revision: rotate ? 0 : old.revision + 1,
            lastCommitId: commitId,
          },
        }
        const saved = this.#save(this.#updatedPayload(latest, updated))
        return {
          ...this.#result(saved.confirmed ? 'committed' : 'unconfirmed', host, kind),
          ...(saved.error !== undefined ? { error: saved.error } : {}),
        }
      })
    } catch {
      this.#refresh()
      return this.#result('unconfirmed', host, kind)
    }
  }

  async clear(): Promise<void> {
    await this.storage.withLock('routeEvidence', () => {
      const empty: EvidencePayload = {
        schema: 2,
        records: Object.freeze({}),
        updatedAt: this.now(),
        ...(this.ids
          ? { controlProtocol: 1 as const, generation: this.ids.next('circuit'), dataRevision: 0 }
          : {}),
      }
      const saved = this.#save(empty)
      if (!saved.confirmed) throw saved.error ?? Error('Evidence clear unconfirmed')
    })
  }
  dispose(): void {
    this.#stopRemote()
  }
}
