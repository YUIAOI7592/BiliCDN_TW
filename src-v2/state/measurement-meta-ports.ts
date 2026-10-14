import type { MeasurementMeta } from './measurement-meta-model.ts'

export interface MeasurementMetaPort {
  get(): MeasurementMeta
  update(change: Partial<MeasurementMeta>): void
  withLock<T>(task: () => Promise<T> | T): Promise<T>
  clear(): void
}
