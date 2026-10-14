import type { MediaKind } from '../domain/model.ts'

export type RestrictionType = 'black' | 'dead'

export interface RestrictionRecord {
  readonly host: string
  readonly type: RestrictionType
  readonly kind: MediaKind | 'all'
  readonly reason: string
  readonly createdAt: number
  readonly expireAt: number
  readonly updatedAt: number
}

export interface RestrictionSnapshot {
  readonly blackHosts: ReadonlySet<string>
  readonly deadHosts: ReadonlySet<string>
}
