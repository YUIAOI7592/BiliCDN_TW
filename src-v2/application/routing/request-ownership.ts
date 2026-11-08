import { type RepresentationId } from '../../domain/model.ts'
import { type RequestContext, type TransportObservation } from '../../domain/transport-model.ts'

interface Selection {
  readonly representation: RepresentationId
  readonly revision: number
  phase: 'pending' | 'confirmed'
}

/** Private request bookkeeping. The coordinator supplies facts and performs every control effect. */
export class RequestOwnership {
  #dispatchSequence = 0
  #selectionSerial = 0
  #owners = new WeakMap<RequestContext, RequestContext>()
  #preparedVideo: RequestContext | null = null
  #selection: Selection | null = null
  #tentativeRepresentation: RepresentationId | null = null
  #successes = new Set<string>()
  #observed = new WeakSet<object>()

  get selection(): Readonly<Selection> | null {
    return this.#selection
  }
  get tentativeRepresentation(): RepresentationId | null {
    return this.#tentativeRepresentation
  }
  get sampleCount(): number {
    return this.#successes.size
  }
  owner(request: RequestContext): RequestContext | undefined {
    return this.#owners.get(request)
  }
  has(request: RequestContext): boolean {
    return this.#owners.has(request)
  }

  prepare(
    request: RequestContext,
    revisionFor: (representation: RepresentationId) => number,
  ): RequestContext {
    const owned = this.#owners.get(request)
    if (owned) return owned
    let selectionRevision = 0
    if (request.kind === 'video' && request.representation) {
      const previous = this.#preparedVideo
      const same =
        previous?.representation === request.representation &&
        previous.generation === request.generation &&
        previous.epoch === request.epoch &&
        previous.authorityRevision === request.authorityRevision &&
        previous.routePolicyRevision === request.routePolicyRevision
      selectionRevision = same ? previous.selectionRevision! : ++this.#selectionSerial
    }
    const stamped = Object.freeze({
      ...request,
      dispatchSequence: ++this.#dispatchSequence,
      routeRevision: request.representation ? revisionFor(request.representation) : 0,
      selectionRevision,
    })
    this.#owners.set(request, stamped)
    this.#owners.set(stamped, stamped)
    if (request.kind === 'video' && request.representation) this.#preparedVideo = stamped
    return stamped
  }

  started(request: RequestContext): void {
    if (
      request.kind === 'video' &&
      request.representation &&
      this.#selection?.revision !== request.selectionRevision
    ) {
      this.#selection = {
        representation: request.representation,
        revision: request.selectionRevision!,
        phase: 'pending',
      }
      this.clearSuccesses()
    }
  }

  success(representation: RepresentationId, key: string): boolean {
    if (this.#tentativeRepresentation === representation) this.#successes.add(key)
    else {
      this.#tentativeRepresentation = representation
      this.#successes = new Set([key])
    }
    return this.#successes.size >= 2
  }

  confirm(representation: RepresentationId): void {
    if (this.#selection?.representation === representation) this.#selection.phase = 'confirmed'
    this.clearSuccesses()
  }

  clearSuccesses(): void {
    this.#tentativeRepresentation = null
    this.#successes.clear()
  }

  forgetRepresentation(representation: RepresentationId): void {
    if (this.#tentativeRepresentation === representation) this.#tentativeRepresentation = null
  }

  commitRoute(request: RequestContext, revision: number): RequestContext | null {
    const owner = this.#owners.get(request)
    if (!owner) return null
    const committed = Object.freeze({ ...owner, routeRevision: revision })
    this.#owners.set(request, committed)
    this.#owners.set(owner, committed)
    return committed
  }

  beginObservation(observation: TransportObservation): object | null {
    const receipt = observation.request
      ? (this.#owners.get(observation.request) ?? observation.request)
      : observation
    if (this.#observed.has(receipt)) return null
    this.#observed.add(receipt)
    return receipt
  }

  reset(reason: 'policy' | 'content'): void {
    this.#preparedVideo = null
    this.#selection = null
    this.#successes.clear()
    if (reason === 'content') this.#tentativeRepresentation = null
  }
}
