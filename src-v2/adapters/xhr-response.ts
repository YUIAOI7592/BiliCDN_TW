import type { PlayurlPort } from '../application/ports.ts'
import type { PlayurlRequestContext, PlayurlTransformResult } from '../domain/playurl-model.ts'
import { blockedPlayurl, blockedPlayurlText, rejectedPlayurl } from './transport-context.ts'

interface XhrResponseContext {
  readonly playurl: PlayurlPort
  notePlayurl(transport: 'xhr', status: number, result: PlayurlTransformResult): void
}

interface XhrResponseState {
  readonly responseKey: string
  readonly requestContext: PlayurlRequestContext
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
      context.notePlayurl('xhr', status(), result)
      state.transformedText =
        strict && !result.accepted ? blockedPlayurlText() : JSON.stringify(payload)
    } catch {
      context.notePlayurl('xhr', status(), rejectedPlayurl('malformed-payload'))
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
      context.notePlayurl('xhr', status(), result)
      state.transformedJson = strict && !result.accepted ? blockedPlayurl() : raw
    } catch {
      context.notePlayurl('xhr', status(), rejectedPlayurl('malformed-payload'))
      state.transformedJson = strict ? blockedPlayurl() : raw
    }
  }
  return state.transformedJson
}
