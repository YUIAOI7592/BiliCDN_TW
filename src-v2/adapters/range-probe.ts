import type { RangeProbeInput, RangeProbePort, RangeProbeResult } from '../application/ports.ts'

export class RangeProbeAdapter implements RangeProbePort {
  constructor(private readonly nativeFetch: typeof fetch, private readonly now: () => number) {}
  async read(input: RangeProbeInput): Promise<RangeProbeResult> {
    const startedAt = this.now()
    let bytes = 0, responseAt: number | null = null
    const result = (status: number | null, directRange: boolean, reason: string): RangeProbeResult => ({
      status, directRange, reason, bytes, elapsedMs: Math.max(1, this.now() - startedAt),
      ttfbMs: responseAt === null ? null : responseAt - startedAt,
    })
    try {
      if (input.signal.aborted) return result(null, false, input.signal.reason === 'timeout' ? 'timeout' : 'cancelled')
      const response = await this.nativeFetch(input.url, { method: 'GET', headers: { Range: `bytes=0-${input.limit - 1}` },
        credentials: 'omit', cache: 'no-store', redirect: 'error', signal: input.signal })
      responseAt = this.now()
      let direct = false
      try {
        const url = new URL(response.url)
        direct = !response.redirected && !!input.host && url.protocol === 'https:' && !url.port && url.hostname.toLowerCase() === input.host
      } catch { /* missing response URL is not evidence */ }
      if (!direct) {
        await response.body?.cancel('redirected-response')
        return result(null, false, 'redirected-response')
      }
      if (response.status !== 206 || !response.body) {
        await response.body?.cancel('range-required')
        return result(response.status, false, `http-${response.status}`)
      }
      const reader = response.body.getReader()
      try {
        while (bytes < input.limit && !input.signal.aborted) {
          const item = await reader.read()
          if (item.done) break
          bytes = Math.min(input.limit, bytes + item.value.byteLength)
          if (bytes >= input.limit) { await reader.cancel(input.completionReason); break }
        }
      } finally {
        if (input.signal.aborted) { try { await reader.cancel(input.signal.reason) } catch { /* already aborted by Fetch */ } }
        try { reader.releaseLock() } catch { /* browser-owned */ }
      }
      if (input.signal.aborted) return result(null, false, input.signal.reason === 'timeout' ? 'timeout' : 'cancelled')
      return result(response.status, true, 'measured')
    } catch {
      return result(null, false, input.signal.aborted ? input.signal.reason === 'timeout' ? 'timeout' : 'cancelled' : 'network')
    }
  }
}
