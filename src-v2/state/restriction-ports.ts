import type { MediaKind } from '../domain/model.ts'
import type {
  RestrictionRecord,
  RestrictionSnapshot,
  RestrictionType,
} from './restriction-model.ts'

export interface RestrictionPort {
  has(host: string, kind: MediaKind, type?: RestrictionType): boolean
  snapshot(kind: MediaKind): RestrictionSnapshot
  list(): readonly RestrictionRecord[]
  add(record: Omit<RestrictionRecord, 'createdAt' | 'updatedAt'>): Promise<void>
  remove(host: string, type?: RestrictionType): Promise<void>
  clear(): Promise<void>
  dispose(): void
}
