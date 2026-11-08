import { type StoragePort, type StorageLock } from '../platform/storage-port.ts'
import { type RuntimeIdPort } from '../platform/runtime-id-port.ts'
import { sameCircuitStamp } from '../domain/circuit-policy.ts'
import { type CurrentCircuitControlReader } from './evidence-ports.ts'
import {
  type MeasurementMeta,
  type MeasurementMetaPort,
  type MeasurementCoordination,
  type RevalidationClaim,
} from './measurement-meta-ports.ts'
export const MEASUREMENT_META_KEY = 'bilicdn.v2.meta'

// Read only own data fields: stored values are data, never coercion or accessor hooks.
const field = (value: unknown, key: string): unknown => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const descriptor = Object.getOwnPropertyDescriptor(value, key)
  return descriptor && 'value' in descriptor ? descriptor.value : undefined
}
const cursorValue = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : undefined
const timeValue = (value: unknown, ceiling = Number.MAX_SAFE_INTEGER): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= ceiling
    ? value
    : undefined
const parse = (raw: unknown, now: number): MeasurementMeta => ({
  catalogCursor: field(raw, 'schema') === 2 ? (cursorValue(field(raw, 'catalogCursor')) ?? 0) : 0,
  lastChallengeAt:
    field(raw, 'schema') === 2 ? (timeValue(field(raw, 'lastChallengeAt'), now) ?? 0) : 0,
})

const id = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-zA-Z0-9:_-]{1,64}$/.test(value)
const parseCoordination = (raw: unknown): MeasurementCoordination | null => {
  const generation = field(raw, 'coordinationGeneration'),
    rows = field(raw, 'revalidationClaims')
  if (
    field(raw, 'coordinationProtocol') !== 1 ||
    !id(generation) ||
    !Array.isArray(rows) ||
    rows.length > 96
  )
    return null
  const claims: RevalidationClaim[] = [],
    keys = new Set<string>()
  for (const row of rows) {
    const host = field(row, 'host'),
      kind = field(row, 'kind'),
      stamp = field(row, 'stamp')
    const stampGeneration = field(stamp, 'generation'),
      recordId = field(stamp, 'recordId'),
      revision = field(stamp, 'revision')
    const claimId = field(row, 'claimId'),
      roundId = field(row, 'roundId')
    if (
      typeof host !== 'string' ||
      !/^[a-z0-9.-]{1,253}$/.test(host) ||
      !host.includes('.') ||
      (kind !== 'video' && kind !== 'audio') ||
      !id(stampGeneration) ||
      !id(recordId) ||
      !Number.isSafeInteger(revision) ||
      Number(revision) < 0 ||
      !id(claimId) ||
      !id(roundId)
    )
      return null
    const key = `${kind}:${host}`
    if (keys.has(key)) return null
    keys.add(key)
    claims.push(
      Object.freeze({
        host,
        kind,
        claimId,
        roundId,
        stamp: Object.freeze({ generation: stampGeneration, recordId, revision: Number(revision) }),
      }),
    )
  }
  return Object.freeze({ generation, claims: Object.freeze(claims) })
}
const coordinationFields = (value: MeasurementCoordination | null) =>
  value
    ? {
        coordinationProtocol: 1,
        coordinationGeneration: value.generation,
        revalidationClaims: value.claims,
      }
    : {}

export class MeasurementMetaStore implements MeasurementMetaPort {
  #lock: StorageLock | undefined
  #seenProtocol = false
  #protocolLost = false
  constructor(
    private readonly storage: StoragePort,
    private readonly now: () => number,
    private readonly ids?: RuntimeIdPort,
    private readonly readControl?: CurrentCircuitControlReader['readCurrentControl'],
  ) {}
  #read(): unknown {
    const result = this.storage.readResult?.<unknown>(MEASUREMENT_META_KEY, null)
    if (!result?.ok) throw Error('Measurement metadata read unconfirmed')
    return result.value
  }
  #save(payload: Record<string, unknown>): void {
    try {
      this.storage.set(MEASUREMENT_META_KEY, payload)
    } catch {
      /* Read back even after an unknown write result. */
    }
    const raw = this.#read()
    const expectedCoordination = parseCoordination(payload),
      actualCoordination = parseCoordination(raw)
    if (
      field(raw, 'schema') !== 2 ||
      field(raw, 'catalogCursor') !== payload.catalogCursor ||
      field(raw, 'lastChallengeAt') !== payload.lastChallengeAt ||
      field(raw, 'updatedAt') !== payload.updatedAt ||
      JSON.stringify(actualCoordination) !== JSON.stringify(expectedCoordination)
    )
      throw Error('Measurement metadata write unconfirmed')
  }
  get(): MeasurementMeta {
    return parse(this.storage.get<unknown>(MEASUREMENT_META_KEY, null), timeValue(this.now()) ?? 0)
  }
  update(change: Partial<MeasurementMeta>): void {
    const now = timeValue(this.now()) ?? 0
    const result = this.storage.readResult?.<unknown>(MEASUREMENT_META_KEY, null)
    if (result && !result.ok) throw Error('Measurement metadata read unconfirmed')
    const raw = result?.ok ? result.value : this.storage.get<unknown>(MEASUREMENT_META_KEY, null)
    const current = parse(raw, now),
      coordination = parseCoordination(raw)
    if (field(raw, 'coordinationProtocol') !== undefined && !coordination)
      throw Error('Invalid measurement coordination')
    if (this.#seenProtocol && !coordination) this.#protocolLost = true
    this.storage.set(MEASUREMENT_META_KEY, {
      schema: 2,
      catalogCursor: cursorValue(field(change, 'catalogCursor')) ?? current.catalogCursor,
      lastChallengeAt: timeValue(field(change, 'lastChallengeAt'), now) ?? current.lastChallengeAt,
      updatedAt: now,
      ...coordinationFields(coordination),
    })
  }
  withLock<T>(task: (lock?: StorageLock) => Promise<T> | T): Promise<T> {
    return this.storage.withLock('measurement', async (lock) => {
      const previous = this.#lock
      this.#lock = lock
      try {
        return await task(lock)
      } finally {
        this.#lock = previous
      }
    })
  }
  coordination(lock?: StorageLock): MeasurementCoordination | null {
    if (
      !lock?.exclusive ||
      lock !== this.#lock ||
      !this.ids ||
      !this.storage.readResult ||
      this.#protocolLost
    )
      return null
    let raw: unknown
    try {
      raw = this.#read()
    } catch {
      return null
    }
    const existing = parseCoordination(raw)
    if (existing) {
      this.#seenProtocol = true
      return existing
    }
    if (this.#seenProtocol || field(raw, 'coordinationProtocol') !== undefined) {
      this.#protocolLost = true
      return null
    }
    this.#seenProtocol = true
    const initialized = { generation: this.ids.next('challenge'), claims: Object.freeze([]) }
    try {
      this.#save({
        schema: 2,
        ...parse(raw, timeValue(this.now()) ?? 0),
        updatedAt: this.now(),
        ...coordinationFields(initialized),
      })
      return initialized
    } catch {
      return null
    }
  }
  coordinationCurrent(generation: string): boolean {
    if (!this.#lock?.exclusive || this.#protocolLost) return false
    try {
      const value = parseCoordination(this.#read())
      if (!value && this.#seenProtocol) this.#protocolLost = true
      return value?.generation === generation
    } catch {
      return false
    }
  }
  claimRevalidation(generation: string, claim: RevalidationClaim): boolean {
    if (!this.coordinationCurrent(generation)) return false
    let raw: unknown
    try {
      raw = this.#read()
    } catch {
      return false
    }
    const current = parseCoordination(raw)
    if (!current || current.generation !== generation) return false
    const previous = current.claims.find(
      (row) => row.host === claim.host && row.kind === claim.kind,
    )
    if (previous && sameCircuitStamp(previous.stamp, claim.stamp)) return false
    if (!previous && current.claims.length >= 96) return false
    const claims = Object.freeze([
      ...current.claims.filter((row) => row !== previous),
      Object.freeze(claim),
    ])
    const next = { generation, claims }
    const payload = {
      schema: 2,
      ...parse(raw, timeValue(this.now()) ?? 0),
      updatedAt: this.now(),
      ...coordinationFields(next),
    }
    if (!parseCoordination(payload)) return false
    try {
      const control = this.readControl?.(claim.host, claim.kind),
        now = timeValue(this.now())
      if (
        !control?.synchronized ||
        !sameCircuitStamp(control.stamp, claim.stamp) ||
        now === undefined ||
        control.until <= 0 ||
        control.until > now ||
        !this.coordinationCurrent(generation)
      )
        return false
      this.#save(payload)
      return true
    } catch {
      return false
    }
  }
  async clear(): Promise<void> {
    await this.withLock(() => {
      this.#read()
      const next = this.ids
        ? { generation: this.ids.next('challenge'), claims: Object.freeze([]) }
        : null
      this.#save({
        schema: 2,
        catalogCursor: 0,
        lastChallengeAt: 0,
        updatedAt: this.now(),
        ...coordinationFields(next),
      })
      this.#seenProtocol = next !== null
      this.#protocolLost = false
    })
  }
}
