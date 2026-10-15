export interface MeasurementMeta {
  readonly catalogCursor: number
  readonly lastChallengeAt: number
}

export interface MeasurementMetaPort {
  get(): MeasurementMeta
  update(change: Partial<MeasurementMeta>): void
  withLock<T>(task: () => Promise<T> | T): Promise<T>
  clear(): void
}
