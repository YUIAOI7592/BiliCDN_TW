import { epochId, generationId, type DecisionId, type EpochId, type GenerationId, type RepresentationId, type RouteAffinity } from '../domain/model.ts'

export interface SessionSnapshot {
  readonly generation: GenerationId
  readonly epoch: EpochId
  readonly representation: RepresentationId | null
  readonly affinity: RouteAffinity | null
  readonly disabled: boolean
  readonly recovering: boolean
  readonly lastDecisionId: DecisionId | null
}

export class SessionStore {
  #state: SessionSnapshot = Object.freeze({ generation: generationId(0), epoch: epochId(0), representation: null,
    affinity: null, disabled: false, recovering: false, lastDecisionId: null })

  get(): SessionSnapshot { return this.#state }
  isGeneration(generation: GenerationId): boolean { return generation === this.#state.generation }

  beginGeneration(disabled = false): SessionSnapshot {
    this.#state = Object.freeze({ generation: generationId(Number(this.#state.generation) + 1), epoch: epochId(0),
      representation: null, affinity: null, disabled, recovering: false, lastDecisionId: null })
    return this.#state
  }

  beginEpoch(): SessionSnapshot {
    this.#state = Object.freeze({ ...this.#state, epoch: epochId(Number(this.#state.epoch) + 1),
      representation: null, affinity: null, recovering: false, lastDecisionId: null })
    return this.#state
  }

  setRepresentation(representation: RepresentationId | null): void { this.#state = Object.freeze({ ...this.#state, representation }) }
  setAffinity(affinity: RouteAffinity | null): void { this.#state = Object.freeze({ ...this.#state, affinity }) }
  setRecovering(recovering: boolean): void { this.#state = Object.freeze({ ...this.#state, recovering }) }
  noteDecision(id: DecisionId): void { this.#state = Object.freeze({ ...this.#state, lastDecisionId: id }) }
}
