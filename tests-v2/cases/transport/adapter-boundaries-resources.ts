import { type TestContext } from 'node:test'
import { RangeProbeAdapter } from '../../../src-v2/adapters/transport/range-probe.ts'
import { testScope } from '../../support/scope.ts'

export async function createRangeProbeResources(t: TestContext) {
  const scope = testScope(t)
  const host = 'upos-sz-mirrorcos.bilivideo.com'
  const url = `https://${host}/test.m4s`
  const input = {
    url: url,
    host: host,
    limit: 16,
    signal: new AbortController().signal,
    completionReason: 'enough',
  }
  let body: ReadableStream<Uint8Array> | null = null
  const response = (status: number, responseUrl: string, redirected = false): Response => {
    body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(32))
      },
      cancel(_value) {},
    })
    const result = new Response(body, { status })
    Object.defineProperties(result, {
      url: { value: responseUrl },
      redirected: { value: redirected },
    })
    return result
  }
  const direct = new RangeProbeAdapter(
    async (_url, _init) => {
      return response(206, url)
    },
    () => 10,
  )
  void (await direct.read(input))
  const aborted = new AbortController()
  aborted.abort('generation')
  let fetchCalls = 0
  const cancelled = await new RangeProbeAdapter(
    async () => {
      fetchCalls++
      return response(206, url)
    },
    () => 10,
  ).read({ ...input, signal: aborted.signal })
  return {
    cancelled,
    get fetchCalls() {
      return fetchCalls
    },
    set fetchCalls(value: typeof fetchCalls) {
      fetchCalls = value
    },
    input,
    scope,
    url,
  }
}
