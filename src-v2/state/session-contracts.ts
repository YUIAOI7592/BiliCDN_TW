import {
  type DecisionId,
  type EpochId,
  type GenerationId,
  type RepresentationId,
  type RouteAffinity,
} from '../domain/model.ts'
export interface SessionSnapshot {
  readonly generation: GenerationId
  readonly epoch: EpochId
  readonly representation: RepresentationId | null
  readonly affinity: RouteAffinity | null
  readonly disabled: boolean
  readonly recovering: boolean
  readonly lastDecisionId: DecisionId | null
}

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
