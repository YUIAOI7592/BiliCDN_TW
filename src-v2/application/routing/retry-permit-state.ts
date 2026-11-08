import { type RequestContext } from '../../domain/transport-model.ts'
import { type PlaybackDemand } from '../../domain/playback-demand.ts'
import { type AppliedRouteDecision } from './route-contracts.ts'
import { type EarlyRetryPermit } from './early-retry-contracts.ts'

interface PermitRecord {
  readonly permit: EarlyRetryPermit
  readonly request: RequestContext
  readonly host: string
  readonly demand: PlaybackDemand
  stage:
    | { readonly phase: 'prepared' }
    | { readonly phase: 'materialized'; readonly applied: AppliedRouteDecision }
}

/** One coordinator-owned permit; eligibility, clocks, materialization and commits stay outside. */
export class RetryPermitState {
  #current: PermitRecord | null = null
  get current(): Readonly<PermitRecord> | null {
    return this.#current
  }

  prepare(
    permit: EarlyRetryPermit,
    request: RequestContext,
    host: string,
    demand: PlaybackDemand,
  ): void {
    this.#current = { permit, request, host, demand, stage: { phase: 'prepared' } }
  }
  applied(record: Readonly<PermitRecord> | null = this.#current): AppliedRouteDecision | null {
    return record?.stage.phase === 'materialized' ? record.stage.applied : null
  }
  materialize(record: Readonly<PermitRecord>, applied: AppliedRouteDecision): AppliedRouteDecision {
    if (this.#current === record) this.#current.stage = { phase: 'materialized', applied }
    return applied
  }
  consume(record: Readonly<PermitRecord>): boolean {
    if (this.#current !== record) return false
    this.#current = null
    return true
  }
  revoke(permit: EarlyRetryPermit): void {
    if (this.#current?.permit === permit) this.#current = null
  }
  clear(): void {
    this.#current = null
  }
}
