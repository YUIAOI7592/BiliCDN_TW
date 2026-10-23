import type { StoragePort } from '../platform/storage-port.ts'
import type { MeasurementMeta, MeasurementMetaPort } from './measurement-meta-ports.ts'
export type { MeasurementMeta } from './measurement-meta-ports.ts'

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

export class MeasurementMetaStore implements MeasurementMetaPort {
  constructor(
    private readonly storage: StoragePort,
    private readonly now: () => number,
  ) {}
  get(): MeasurementMeta {
    return parse(this.storage.get<unknown>(MEASUREMENT_META_KEY, null), timeValue(this.now()) ?? 0)
  }
  update(change: Partial<MeasurementMeta>): void {
    const now = timeValue(this.now()) ?? 0
    const current = parse(this.storage.get<unknown>(MEASUREMENT_META_KEY, null), now)
    this.storage.set(MEASUREMENT_META_KEY, {
      schema: 2,
      catalogCursor: cursorValue(field(change, 'catalogCursor')) ?? current.catalogCursor,
      lastChallengeAt: timeValue(field(change, 'lastChallengeAt'), now) ?? current.lastChallengeAt,
      updatedAt: now,
    })
  }
  withLock<T>(task: () => Promise<T> | T): Promise<T> {
    return this.storage.withLock('measurement', task)
  }
  clear(): void {
    this.storage.delete(MEASUREMENT_META_KEY)
  }
}
