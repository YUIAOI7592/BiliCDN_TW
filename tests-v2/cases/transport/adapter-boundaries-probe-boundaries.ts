import { test } from 'node:test'
import assert from 'node:assert/strict'
import { RangeProbeAdapter } from '../../../src-v2/adapters/transport/range-probe.ts'

const host = 'upos-sz-mirrorcos.bilivideo.com',
  url = `https://${host}/test.m4s`
const input = () => ({
  url,
  host,
  limit: 16,
  signal: new AbortController().signal,
  completionReason: 'enough',
})

function responseFixture(status: number, responseUrl: string, redirected = false) {
  const cancelReasons: unknown[] = []
  let reads = 0
  const body = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        reads++
        controller.enqueue(new Uint8Array(32))
      },
      cancel(reason) {
        cancelReasons.push(reason)
      },
    },
    { highWaterMark: 0 },
  )
  const response = new Response(body, { status })
  Object.defineProperties(response, {
    url: { value: responseUrl },
    redirected: { value: redirected },
  })
  return {
    body,
    response,
    cancelReasons,
    get reads() {
      return reads
    },
  }
}

test('probe caps consumed bytes at its declared limit [1]', { timeout: 5000 }, async () => {
  const f = responseFixture(206, url)
  let requestInit: RequestInit | undefined
  const measured = await new RangeProbeAdapter(
    async (_url, init) => {
      requestInit = init
      return f.response
    },
    () => 10,
  ).read(input())
  assert.equal(measured.directRange, true)
  assert.equal(measured.bytes, 16)
  assert.equal(requestInit?.redirect, 'error')
  assert.equal(requestInit?.credentials, 'omit')
  assert.equal(requestInit?.cache, 'no-store')
  assert.equal(new Headers(requestInit?.headers).get('range'), 'bytes=0-15')
  assert.deepEqual(f.cancelReasons, ['enough'])
  assert.equal(f.body.locked, false)
})

for (const [index, [status, target, redirected]] of (
  [
    [200, url, false],
    [206, 'https://other.example/test', false],
    [206, '', false],
    [206, url, true],
    [206, `http://${host}/test`, false],
    [206, `https://${host}:444/test`, false],
  ] as const
).entries()) {
  test(
    `probe rejects status/response authority: ${status}, ${target}, ${redirected} [2] / ${index}`,
    { timeout: 5000 },
    async () => {
      const f = responseFixture(status, target, redirected),
        result = await new RangeProbeAdapter(
          async () => f.response,
          () => 10,
        ).read(input())
      assert.equal(result.directRange, false)
      assert.equal(result.reason, status === 200 ? 'http-200' : 'redirected-response')
      assert.equal(f.reads, 0, 'rejected response cannot be consumed')
      assert.deepEqual(f.cancelReasons, [status === 200 ? 'range-required' : 'redirected-response'])
      assert.equal(f.body.locked, false)
    },
  )
}

test('already cancelled probe does not start network work [3]', { timeout: 5000 }, async () => {
  const aborted = new AbortController()
  aborted.abort('generation')
  let fetchCalls = 0
  const cancelled = await new RangeProbeAdapter(
    async () => {
      fetchCalls++
      return new Response(null, { status: 206 })
    },
    () => 10,
  ).read({ ...input(), signal: aborted.signal })
  assert.equal(fetchCalls, 0)
  assert.equal(cancelled.reason, 'cancelled')

  const duringRead = new AbortController()
  let releaseCount = 0,
    readCount = 0
  const cancelReasons: unknown[] = []
  const stream = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        readCount++
        duringRead.abort('timeout')
        controller.enqueue(new Uint8Array(4))
      },
      cancel(reason) {
        cancelReasons.push(reason)
      },
    },
    { highWaterMark: 0 },
  )
  const originalGetReader = stream.getReader.bind(stream)
  Object.defineProperty(stream, 'getReader', {
    value: () => {
      const reader = originalGetReader(),
        release = reader.releaseLock.bind(reader)
      reader.releaseLock = () => {
        releaseCount++
        release()
      }
      return reader
    },
  })
  const delayedResponse = new Response(stream, { status: 206 })
  Object.defineProperty(delayedResponse, 'url', { value: url })
  const timed = await new RangeProbeAdapter(
    async () => delayedResponse,
    () => 10,
  ).read({ ...input(), signal: duringRead.signal })
  assert.equal(timed.reason, 'timeout')
  assert.equal(timed.directRange, false)
  assert.equal(readCount, 1)
  assert.deepEqual(cancelReasons, ['timeout'])
  assert.equal(releaseCount, 1)
})
