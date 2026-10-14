import type { DecisionId, GenerationId, RepresentationId, RouteAffinity } from '../domain/model.ts'
import type { SessionSnapshot } from './session-model.ts'

export interface SessionPort {
  get(): SessionSnapshot
  isGeneration(generation: GenerationId): boolean
  beginGeneration(disabled?: boolean): SessionSnapshot
  beginEpoch(): SessionSnapshot
  setRepresentation(representation: RepresentationId | null): void
  setAffinity(affinity: RouteAffinity | null): void
  setRecovering(recovering: boolean): void
  noteDecision(id: DecisionId): void
}
