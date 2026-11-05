import {
  advanceCircuitWindow,
  circuitWindowReady,
  startCircuitWindow,
  sameCircuitStamp,
  CIRCUIT_SUCCESS_GAP_MS,
  CIRCUIT_PENDING_LIMIT,
  type CircuitWindow,
} from '../../domain/circuit-policy.ts'
import type {
  CircuitControlStamp,
  MediaKind,
  RequestContext,
  CircuitObservationSnapshot,
} from '../../domain/model.ts'
import type { CircuitControlRead, EvidenceCommitResult } from '../../state/evidence-ports.ts'

interface LocalObservation {
  request: RequestContext
  readonly host: string
  readonly kind: MediaKind
  readonly scope: string
  epoch: number
  stamp: CircuitControlStamp | null
  period: CircuitWindow | null
  reason: string
  certain: boolean
  blocked: number
  committing: boolean
  pending: Map<object, number>
}
interface Receipt {
  readonly owner: LocalObservation
  readonly epoch: number
  readonly stamp: CircuitControlStamp | null
}
export interface CircuitProposal {
  readonly request: RequestContext
  readonly host: string
  readonly kind: MediaKind
  readonly period: CircuitWindow
  readonly epoch: number
}

/** Private coordinator-owned bookkeeping. It never selects routes, writes or starts work. */
export class CircuitObservations {
  #active = new Map<MediaKind, LocalObservation>()
  #receipts = new WeakMap<object, Receipt>()
  #proofs = new WeakMap<CircuitProposal, LocalObservation>()
  #last: { wall: number; tick: number } | null = null
  #clockOk = false
  #playbackActive = true
  playbackActive(active: boolean): void {
    this.#playbackActive = active
    if (!active) this.invalidate('playback-invalidated')
  }
  #close(state: LocalObservation, reason: string): void {
    state.epoch++
    state.period = null
    state.pending.clear()
    state.committing = false
    state.reason = reason
  }
  invalidate(reason: string): void {
    for (const state of this.#active.values()) this.#close(state, reason)
  }
  reset(reason: string): void {
    this.invalidate(reason)
    this.#active.clear()
    this.#last = null
  }

  step(
    wall: number,
    tick: number | null,
    control: (host: string, kind: MediaKind) => CircuitControlRead,
  ): void {
    const last = this.#last
    const invalid =
      tick === null ||
      !Number.isFinite(wall) ||
      (last &&
        (tick < last.tick ||
          wall < last.wall ||
          tick - last.tick > CIRCUIT_SUCCESS_GAP_MS ||
          Math.abs(wall - last.wall - (tick - last.tick)) > CIRCUIT_SUCCESS_GAP_MS))
    this.#last = tick === null ? null : { wall, tick }
    this.#clockOk = !invalid
    if (invalid) {
      this.invalidate('clock-gap')
      return
    }
    for (const state of this.#active.values()) {
      const shared = control(state.host, state.kind)
      if (!sameCircuitStamp(state.stamp, shared.stamp)) {
        this.#close(state, 'control-changed')
        state.stamp = shared.stamp
      }
      if (!shared.synchronized) {
        this.#close(state, 'no-common-lock')
        continue
      }
      if (shared.until > wall) {
        this.#close(state, 'isolated')
        continue
      }
      if (state.period) {
        const next = advanceCircuitWindow(state.period, tick!)
        if (!next.period) this.#close(state, next.reason!)
      }
    }
  }

  capture(
    receipt: object,
    request: RequestContext,
    shared: CircuitControlRead,
    tick: number | null,
    wall: number,
  ): void {
    if (
      !request.kind ||
      request.attributionStatus !== 'matched' ||
      tick === null ||
      !this.#clockOk ||
      !this.#playbackActive
    )
      return
    const kind = request.kind,
      host = request.targetHost
    const scope = [
      request.generation,
      request.epoch,
      request.representation,
      request.authorityRevision,
      request.routePolicyRevision,
      request.selectionRevision,
    ].join(':')
    let state = this.#active.get(kind)
    if (!state || state.host !== host || state.scope !== scope) {
      if (state) this.#close(state, 'route-changed')
      state = {
        request,
        host,
        kind,
        scope,
        epoch: 0,
        stamp: shared.stamp,
        period: null,
        reason: 'awaiting-new-transfer',
        certain: true,
        blocked: 0,
        committing: false,
        pending: new Map(),
      }
      this.#active.set(kind, state)
    }
    state.request = request
    if (
      !shared.synchronized ||
      !shared.stamp ||
      shared.level <= 0 ||
      shared.until > wall ||
      state.blocked ||
      !state.certain
    )
      return
    if (state.pending.size >= CIRCUIT_PENDING_LIMIT) {
      this.#close(state, 'capacity-exceeded')
      return
    }
    if (state.pending.has(receipt)) return
    state.pending.set(receipt, tick)
    this.#receipts.set(receipt, { owner: state, epoch: state.epoch, stamp: shared.stamp })
  }

  failure(host: string, kind: MediaKind): () => void {
    const state = this.#active.get(kind)
    if (!state || state.host !== host) return () => undefined
    this.#close(state, 'failure-pending')
    state.blocked++
    let released = false
    return () => {
      if (!released) {
        released = true
        state.blocked--
      }
    }
  }

  persisted(host: string, kind: MediaKind, confirmed: boolean): void {
    const state = this.#active.get(kind)
    if (!state || state.host !== host) return
    state.certain = confirmed
    if (!confirmed) this.#close(state, 'storage-unconfirmed')
  }

  finish(
    receipt: object,
    success: boolean,
    certain: boolean,
    shared: CircuitControlRead | null,
    tick: number | null,
    nextId: () => string,
  ): MediaKind | null {
    const owned = this.#receipts.get(receipt)
    this.#receipts.delete(receipt)
    if (!owned) return null
    const state = owned.owner
    state.pending.delete(receipt)
    if (this.#active.get(state.kind) !== state) return null
    if (!certain) {
      state.certain = false
      this.#close(state, 'storage-unconfirmed')
      return null
    }
    // A later confirmed write may reconcile uncertainty, but old receipts cannot earn credit.
    state.certain = true
    if (owned.epoch !== state.epoch) return state.kind
    if (
      success &&
      this.#playbackActive &&
      shared &&
      shared.level > 0 &&
      shared.synchronized &&
      tick !== null &&
      sameCircuitStamp(owned.stamp, shared.stamp) &&
      !state.blocked
    ) {
      state.period = state.period
        ? Object.freeze({ ...state.period, lastSuccess: tick })
        : startCircuitWindow(nextId(), shared.stamp!, tick)
      state.reason = 'observing'
    }
    return state.kind
  }

  #pending(state: LocalObservation): number {
    const period = state.period
    return period ? [...state.pending.values()].filter((at) => at < period.deadline).length : 0
  }
  proposal(kind: MediaKind, tick: number | null): CircuitProposal | null {
    const state = this.#active.get(kind)
    if (
      !this.#playbackActive ||
      !state ||
      !state.period ||
      state.committing ||
      !state.certain ||
      state.blocked ||
      tick === null ||
      !circuitWindowReady(state.period, tick, this.#pending(state))
    )
      return null
    state.committing = true
    const proof = Object.freeze({
      request: state.request,
      host: state.host,
      kind,
      period: state.period,
      epoch: state.epoch,
    })
    this.#proofs.set(proof, state)
    return proof
  }
  ready(
    proof: CircuitProposal,
    shared: CircuitControlRead,
    wall: number,
    tick: number | null,
  ): boolean {
    const state = this.#proofs.get(proof)
    if (!state) return false
    return (
      this.#playbackActive &&
      this.#active.get(state.kind) === state &&
      state.period === proof.period &&
      state.epoch === proof.epoch &&
      !state.blocked &&
      state.certain &&
      tick !== null &&
      shared.until <= wall &&
      shared.synchronized &&
      sameCircuitStamp(proof.period.stamp, shared.stamp) &&
      circuitWindowReady(proof.period, tick, this.#pending(state))
    )
  }
  submitted(
    proof: CircuitProposal,
    result: EvidenceCommitResult,
    tick: number | null,
    nextId: () => string,
  ): void {
    const state = this.#proofs.get(proof)
    this.#proofs.delete(proof)
    if (!state) return
    if (
      this.#active.get(state.kind) !== state ||
      state.epoch !== proof.epoch ||
      state.period !== proof.period
    )
      return
    this.#close(state, result.status === 'committed' ? 'downgrade-committed' : result.status)
    state.stamp = result.stamp
    state.certain = result.status !== 'unconfirmed'
    if (
      result.status === 'committed' &&
      result.evidence.circuitLevel > 0 &&
      result.stamp &&
      tick !== null
    )
      state.period = startCircuitWindow(nextId(), result.stamp, tick)
  }

  snapshot(
    host: string,
    kind: MediaKind,
    shared: CircuitControlRead,
    wall: number,
    tick: number | null,
  ): CircuitObservationSnapshot {
    const state = this.#active.get(kind),
      local = state?.host === host ? state : null
    const period =
      local?.period && tick !== null && sameCircuitStamp(local.stamp, shared.stamp)
        ? advanceCircuitWindow(local.period, tick).period
        : null
    const phase =
      shared.until > wall
        ? 'isolated'
        : shared.level === 0
          ? 'clear'
          : period
            ? tick! >= period.deadline
              ? 'settling'
              : 'observing'
            : 'awaiting'
    const reason = !shared.synchronized
      ? 'no-common-lock'
      : !shared.stamp
        ? 'awaiting-control-version'
        : period
          ? local!.committing
            ? 'committing'
            : phase === 'settling'
              ? period.lastSuccess < period.deadline
                ? 'awaiting-end-success'
                : 'awaiting-pending-results'
              : 'observing'
          : local?.period && tick !== null
            ? (advanceCircuitWindow(local.period, tick).reason ?? 'control-changed')
            : (local?.reason ?? 'awaiting-new-transfer')
    return Object.freeze({
      host,
      kind,
      level: shared.level,
      until: shared.until,
      phase,
      reason,
      progressSec: period ? Math.min(300, Math.max(0, tick! - period.start) / 1000) : 0,
      remainingSec:
        phase === 'isolated'
          ? Math.max(0, shared.until - wall) / 1000
          : period
            ? Math.max(0, (phase === 'settling' ? period.hardDeadline : period.deadline) - tick!) /
              1000
            : null,
    })
  }
}
