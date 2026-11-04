import type { RangeProbeInput, RangeProbePort, RangeProbeResult } from '../application/ports.ts'
import { parseProbeRange } from '../domain/probe-range.ts'
import type { ProbeRange } from '../domain/probe-model.ts'
import { measuredTiming, readMonotonic } from '../domain/measurement-time.ts'

export class RangeProbeAdapter implements RangeProbePort {
  constructor(
    private readonly nativeFetch: typeof fetch,
    private readonly now: () => number | null,
  ) {}
  async read(input: RangeProbeInput): Promise<RangeProbeResult> {
    let startedAt: number | null = null
    let bytes = 0,
      receivedBytes = 0,
      responseAt: number | null = null
    let endedAt: number | null = null,
      frozen = false,
      payloadValid = true
    const freeze = (): void => {
      if (frozen) return
      frozen = true
      endedAt = readMonotonic(this.now)
    }
    let range: ProbeRange | null = null
    const result = (
      status: number | null,
      directRange: boolean,
      reason: string,
    ): RangeProbeResult => {
      freeze()
      const timing = measuredTiming(startedAt, responseAt, endedAt)
      return {
        status,
        range,
        directRange,
        reason,
        bytes,
        receivedBytes,
        payloadValid,
        timingBasis: 'probe-reader',
        elapsedMs: timing.elapsedMs,
        ttfbMs: timing.ttfbMs,
        speedEligible:
          directRange && payloadValid && timing.speedEligible && receivedBytes >= 64 * 1024,
      }
    }
    try {
      const startByte = input.startByte ?? 0
      if (
        !Number.isSafeInteger(startByte) ||
        startByte < 0 ||
        !Number.isSafeInteger(input.limit) ||
        input.limit <= 0 ||
        !Number.isSafeInteger(startByte + input.limit - 1)
      )
        return result(null, false, 'invalid-range')
      if (input.signal.aborted)
        return result(null, false, input.signal.reason === 'timeout' ? 'timeout' : 'cancelled')
      startedAt = readMonotonic(this.now)
      const response = await this.nativeFetch(input.url, {
        method: 'GET',
        headers: { Range: `bytes=${startByte}-${startByte + input.limit - 1}` },
        credentials: 'omit',
        cache: 'no-store',
        redirect: 'error',
        signal: input.signal,
      })
      responseAt = readMonotonic(this.now)
      let direct = false
      try {
        const url = new URL(response.url)
        direct =
          !response.redirected &&
          !!input.host &&
          url.protocol === 'https:' &&
          !url.port &&
          url.hostname.toLowerCase() === input.host
      } catch {
        /* missing response URL is not evidence */
      }
      if (!direct) {
        freeze()
        await response.body?.cancel('redirected-response')
        return result(null, false, 'redirected-response')
      }
      if (response.status !== 206 || !response.body) {
        freeze()
        await response.body?.cancel('range-required')
        return result(response.status, false, `http-${response.status}`)
      }
      const header = response.headers.get('Content-Range')
      if (header !== null) range = parseProbeRange(header, startByte, input.limit)
      if ((header !== null && !range) || (startByte > 0 && !range)) {
        freeze()
        await response.body.cancel('range-mismatch')
        return result(response.status, false, 'range-mismatch')
      }
      const reader = response.body.getReader()
      const declaredLength = response.headers.get('Content-Length')
      const expected = range ? range.endByte - range.startByte + 1 : null
      try {
        while (bytes < input.limit && !input.signal.aborted) {
          const item = await reader.read()
          if (item.done) {
            freeze()
            break
          }
          receivedBytes += item.value.byteLength
          bytes = Math.min(input.limit, receivedBytes)
          if (bytes >= input.limit) {
            freeze()
            try {
              await reader.cancel(input.completionReason)
            } catch {
              /* measurement is already frozen */
            }
            break
          }
        }
      } catch (error) {
        freeze()
        throw error
      } finally {
        if (input.signal.aborted) {
          try {
            await reader.cancel(input.signal.reason)
          } catch {
            /* already aborted by Fetch */
          }
        }
        try {
          reader.releaseLock()
        } catch {
          /* browser-owned */
        }
      }
      payloadValid =
        receivedBytes <= input.limit &&
        (expected === null || receivedBytes === expected) &&
        (declaredLength === null ||
          (/^\d+$/.test(declaredLength) && Number(declaredLength) === receivedBytes))
      if (input.signal.aborted)
        return result(null, false, input.signal.reason === 'timeout' ? 'timeout' : 'cancelled')
      return result(response.status, true, 'measured')
    } catch {
      return result(
        null,
        false,
        input.signal.aborted
          ? input.signal.reason === 'timeout'
            ? 'timeout'
            : 'cancelled'
          : 'network',
      )
    }
  }
}
