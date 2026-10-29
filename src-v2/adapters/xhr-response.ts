import type { PlayurlPort } from '../application/ports.ts'
import type {
  PlayurlEndpointKind,
  PlayurlRequestContext,
  PlayurlTransformResult,
} from '../domain/playurl-model.ts'
import { blockedPlayurl, blockedPlayurlText, rejectedPlayurl } from './transport-context.ts'

interface XhrResponseContext {
  readonly playurl: PlayurlPort
  notePlayurl(
    transport: 'xhr',
    status: number,
    result: PlayurlTransformResult,
    endpoint?: PlayurlEndpointKind,
  ): void
}

interface XhrResponseState {
  readonly responseKey: string
  readonly requestContext: PlayurlRequestContext
  readonly apiEndpoint?: PlayurlEndpointKind | null
  transformedText: string | null
  transformedJson: unknown
}

// The hook selects the request owner and resets these caches when policy changes.
// Conversion keeps only that owner's state, including during synchronous reentry.
export function transformXhrText(
  context: XhrResponseContext,
  state: XhrResponseState,
  raw: string,
  strict: boolean,
  status: () => number,
): string {
  if (state.transformedText === null) {
    try {
      const payload: unknown = JSON.parse(raw),
        result = context.playurl.transform(
          payload,
          'trusted-api',
          state.responseKey,
          state.requestContext,
        )
      context.notePlayurl('xhr', status(), result, state.apiEndpoint ?? 'playurl')
      state.transformedText =
        strict && !result.accepted ? blockedPlayurlText() : JSON.stringify(payload)
    } catch {
      context.notePlayurl(
        'xhr',
        status(),
        rejectedPlayurl('malformed-payload'),
        state.apiEndpoint ?? 'playurl',
      )
      state.transformedText = strict ? blockedPlayurlText() : raw
    }
  }
  return state.transformedText
}

export function transformXhrJson(
  context: XhrResponseContext,
  state: XhrResponseState,
  raw: unknown,
  strict: boolean,
  status: () => number,
): unknown {
  if (state.transformedJson === undefined) {
    try {
      const result = context.playurl.transform(
        raw,
        'trusted-api',
        state.responseKey,
        state.requestContext,
      )
      context.notePlayurl('xhr', status(), result, state.apiEndpoint ?? 'playurl')
      state.transformedJson = strict && !result.accepted ? blockedPlayurl() : raw
    } catch {
      context.notePlayurl(
        'xhr',
        status(),
        rejectedPlayurl('malformed-payload'),
        state.apiEndpoint ?? 'playurl',
      )
      state.transformedJson = strict ? blockedPlayurl() : raw
    }
  }
  return state.transformedJson
}
