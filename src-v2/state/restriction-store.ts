import type { MediaKind } from '../domain/model.ts'
import type { StoragePort } from '../platform/storage-port.ts'
import type {
  RestrictionRecord,
  RestrictionSnapshot,
  RestrictionType,
} from './restriction-contracts.ts'
import type { RestrictionPort } from './restriction-contracts.ts'
export const RESTRICTIONS_KEY = 'bilicdn.v2.restrictions'

interface RestrictionPayload {
  readonly schema: 2
  readonly records: readonly RestrictionRecord[]
  readonly updatedAt: number
}

type RestrictionStorage = Pick<StoragePort, 'set' | 'listen' | 'withLock'> &
  Required<Pick<StoragePort, 'readResult'>>

interface AuthoritativeRestrictionRead {
  readonly raw: unknown
  readonly payload: RestrictionPayload
  readonly token: number
}

// Confirm persisted fields before normalization can discard malformed rows or coerce values.
const savedPayloadMatches = (raw: unknown, expected: RestrictionPayload): boolean => {
  if (!raw || typeof raw !== 'object') return false
  const payload = raw as Record<string, unknown>
  if (
    payload.schema !== 2 ||
    payload.updatedAt !== expected.updatedAt ||
    !Array.isArray(payload.records) ||
    payload.records.length !== expected.records.length
  )
    return false
  return payload.records.every((rawRecord, index) => {
    if (!rawRecord || typeof rawRecord !== 'object') return false
    const actual = rawRecord as Record<string, unknown>,
      row = expected.records[index]!
    return (
      actual.host === row.host &&
      actual.type === row.type &&
      actual.kind === row.kind &&
      actual.reason === row.reason &&
      actual.createdAt === row.createdAt &&
      actual.expireAt === row.expireAt &&
      actual.updatedAt === row.updatedAt
    )
  })
}

const safeHost = (value: unknown): string | null => {
  const host = String(value ?? '')
    .trim()
    .toLowerCase()
  return /^[a-z0-9.-]{1,253}$/.test(host) && host.includes('.') ? host : null
}

const parsePayload = (value: unknown, now: number): RestrictionPayload => {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const rows = Array.isArray(raw.records) ? raw.records : []
  const records: RestrictionRecord[] = []
  for (const item of rows.slice(0, 128)) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const host = safeHost(row.host)
    const type = row.type === 'black' || row.type === 'dead' ? row.type : null
    const storedKind =
      row.kind === 'video' || row.kind === 'audio' || row.kind === 'all' ? row.kind : 'all'
    const reason = String(row.reason ?? '').slice(0, 64)
    // The previous control-center button saved a video-only row despite presenting it as a host blacklist.
    const kind =
      type === 'black' && storedKind === 'video' && reason === 'user' ? 'all' : storedKind
    const expireAt = Number(row.expireAt)
    if (
      !host ||
      !type ||
      !Number.isFinite(expireAt) ||
      expireAt <= now ||
      expireAt > now + 30 * 24 * 60 * 60_000
    )
      continue
    records.push(
      Object.freeze({
        host,
        type,
        kind,
        reason,
        createdAt: Math.min(now, Math.max(0, Number(row.createdAt) || now)),
        expireAt,
        updatedAt: Math.min(now + 5 * 60_000, Math.max(0, Number(row.updatedAt) || now)),
      }),
    )
  }
  return Object.freeze({
    schema: 2,
    records: Object.freeze(records),
    updatedAt: Number(raw.updatedAt) || now,
  })
}

const mergePayload = (
  a: RestrictionPayload,
  b: RestrictionPayload,
  now: number,
): RestrictionPayload => {
  const merged = new Map<string, RestrictionRecord>()
  for (const row of [...a.records, ...b.records]) {
    if (row.expireAt <= now) continue
    const key = `${row.type}:${row.kind}:${row.host}`
    const old = merged.get(key)
    if (!old || row.updatedAt >= old.updatedAt) merged.set(key, row)
  }
  return Object.freeze({
    schema: 2,
    records: Object.freeze([...merged.values()].slice(-128)),
    updatedAt: Math.max(a.updatedAt, b.updatedAt, now),
  })
}

export class RestrictionStore implements RestrictionPort {
  #payload: RestrictionPayload
  #stopRemote: () => void
  #readToken = 0
  #disposed = false
  constructor(
    private readonly storage: RestrictionStorage,
    private readonly now: () => number,
  ) {
    this.#payload = parsePayload(null, now())
    this.#read()
    this.#stopRemote = storage.listen<unknown>(RESTRICTIONS_KEY, (_value, remote) => {
      if (!remote) return
      this.#read()
    })
  }

  #read(): AuthoritativeRestrictionRead | null {
    if (this.#disposed) return null
    const token = ++this.#readToken
    try {
      const result = this.storage.readResult<unknown>(RESTRICTIONS_KEY, null)
      if (!result.ok || token !== this.#readToken) return null
      const payload = parsePayload(result.value, this.now())
      if (token !== this.#readToken) return null
      this.#payload = payload
      return { raw: result.value, payload, token }
    } catch {
      return null
    }
  }

  async #write(
    build: (current: RestrictionPayload, now: number) => RestrictionPayload,
  ): Promise<void> {
    await this.storage.withLock('restrictions', () => {
      const current = this.#read()
      if (!current) throw Error('Restriction read unconfirmed')
      const now = this.now()
      if (!Number.isFinite(now) || now < 0) throw Error('Restriction clock invalid')
      const next = build(current.payload, now)
      if (current.token !== this.#readToken) throw Error('Restriction read superseded')
      let writeError: unknown
      try {
        this.storage.set(RESTRICTIONS_KEY, next)
      } catch (error) {
        writeError = error
      }
      const actual = this.#read()
      if (!actual || !savedPayloadMatches(actual.raw, next) || actual.token !== this.#readToken)
        throw writeError ?? Error('Restriction write unconfirmed')
    })
  }

  has(host: string, kind: MediaKind, type?: RestrictionType): boolean {
    const now = this.now()
    return this.#payload.records.some(
      (row) =>
        row.host === host &&
        row.expireAt > now &&
        (row.kind === 'all' || row.kind === kind) &&
        (!type || row.type === type),
    )
  }

  snapshot(kind: MediaKind): RestrictionSnapshot {
    const now = this.now(),
      black = new Set<string>(),
      dead = new Set<string>()
    for (const row of this.#payload.records) {
      if (row.expireAt <= now || (row.kind !== 'all' && row.kind !== kind)) continue
      ;(row.type === 'black' ? black : dead).add(row.host)
    }
    return Object.freeze({ blackHosts: black, deadHosts: dead })
  }

  list(): readonly RestrictionRecord[] {
    return Object.freeze(this.#payload.records.filter((row) => row.expireAt > this.now()))
  }

  async add(record: Omit<RestrictionRecord, 'createdAt' | 'updatedAt'>): Promise<void> {
    await this.#write((current, now) => {
      const incoming = parsePayload(
        { schema: 2, updatedAt: now, records: [{ ...record, createdAt: now, updatedAt: now }] },
        now,
      )
      return mergePayload(current, incoming, now)
    })
  }

  async remove(host: string, type?: RestrictionType): Promise<void> {
    await this.#write((current, now) =>
      Object.freeze({
        schema: 2,
        updatedAt: now,
        records: Object.freeze(
          current.records.filter((row) => row.host !== host || (!!type && row.type !== type)),
        ),
      }),
    )
  }

  async clear(): Promise<void> {
    await this.#write((_current, now) =>
      Object.freeze({ schema: 2, records: Object.freeze([]), updatedAt: now }),
    )
  }

  dispose(): void {
    this.#disposed = true
    this.#readToken++
    this.#stopRemote()
  }
}
