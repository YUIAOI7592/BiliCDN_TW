import type { StoragePort } from '../platform/storage-port.ts'
import type { MeasurementMeta } from './measurement-meta-model.ts'
import type { MeasurementMetaPort } from './measurement-meta-ports.ts'
export type { MeasurementMeta } from './measurement-meta-model.ts'

export const MEASUREMENT_META_KEY = 'bilicdn.v2.meta'
export class MeasurementMetaStore implements MeasurementMetaPort {
  constructor(
    private readonly storage: StoragePort,
    private readonly now: () => number,
  ) {}
  get(): MeasurementMeta {
    const raw = this.#raw()
    return {
      catalogCursor: Math.max(0, Number(raw.catalogCursor) || 0),
      lastChallengeAt: Number(raw.lastChallengeAt) || 0,
    }
  }
  update(change: Partial<MeasurementMeta>): void {
    this.storage.set(MEASUREMENT_META_KEY, {
      ...this.#raw(),
      ...change,
      schema: 2,
      updatedAt: this.now(),
    })
  }
  withLock<T>(task: () => Promise<T> | T): Promise<T> {
    return this.storage.withLock('measurement', task)
  }
  clear(): void {
    this.storage.delete(MEASUREMENT_META_KEY)
  }
  #raw(): Record<string, unknown> {
    const raw = this.storage.get<unknown>(MEASUREMENT_META_KEY, null)
    return raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  }
}
