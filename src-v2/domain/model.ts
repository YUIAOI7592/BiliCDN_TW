export type Brand<T, Name extends string> = T & { readonly __brand: Name }

export type GenerationId = Brand<number, 'GenerationId'>

export type EpochId = Brand<number, 'EpochId'>

export type RepresentationId = Brand<string, 'RepresentationId'>

export type DecisionId = Brand<string, 'DecisionId'>

export type RequestId = Brand<string, 'RequestId'>

export type RecoveryActionId = Brand<string, 'RecoveryActionId'>

export type SignedRouteHandle = Brand<string, 'SignedRouteHandle'>

export type MediaKind = 'video' | 'audio'

export interface Clock {
  now(): number
  monotonicNow?(): number | null
}

export const generationId = (value: number): GenerationId => value as GenerationId

export const epochId = (value: number): EpochId => value as EpochId

export const representationId = (value: string): RepresentationId => value as RepresentationId

export const decisionId = (value: string): DecisionId => value as DecisionId

export const requestId = (value: string): RequestId => value as RequestId

export const recoveryActionId = (value: string): RecoveryActionId => value as RecoveryActionId

export const signedRouteHandle = (value: string): SignedRouteHandle => value as SignedRouteHandle

export interface FlowTransition<S, E> {
  readonly next: S
  readonly effects: readonly E[]
  readonly reason: 'accepted' | 'illegal-event' | 'terminal'
}
