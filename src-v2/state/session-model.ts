import type {
  DecisionId,
  EpochId,
  GenerationId,
  RepresentationId,
  RouteAffinity,
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
