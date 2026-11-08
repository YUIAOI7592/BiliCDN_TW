import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createXhrPreparation } from '../../src-v2/adapters/transport/xhr-dispatch.ts'

function preparation() {
  let owned = true,
    timeout = 5000,
    responseType: XMLHttpRequestResponseType = '',
    openCount = 0,
    headers = 0
  let afterType = () => {
    timeout = 9000
  }
  const xhr = {
    get responseType() {
      return responseType
    },
    set responseType(value: XMLHttpRequestResponseType) {
      responseType = value
      afterType()
    },
    get timeout() {
      return timeout
    },
    set timeout(value: number) {
      timeout = value
    },
    withCredentials: true,
  } as XMLHttpRequest
  const meta = {
    method: 'GET',
    async: true,
    headers: [['Range', 'bytes=0-65535']] as [string, string][],
    targetUrl: 'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/a/b/test.m4s',
    needsNativeOpen: false,
  }
  const native = {
    open: function () {
      openCount++
      timeout = 7000
    } as typeof XMLHttpRequest.prototype.open,
    setHeader: function () {
      headers++
    } as typeof XMLHttpRequest.prototype.setRequestHeader,
    readyState: { get: () => 1 },
  }
  return {
    xhr,
    meta,
    native,
    waiting: () => owned,
    loseDuringType: () => {
      afterType = () => {
        owned = false
      }
    },
    counts: () => ({ openCount, headers }),
    timeout: () => timeout,
  }
}
test('V2215 XHR native preparation preserves the latest timeout and the two-open bound', () => {
  const f = preparation(),
    work = createXhrPreparation(f.xhr, f.meta, f.waiting, f.native)
  work.reopen('https://upos-sz-mirrorcos.bilivideo.com/upgcxcode/a/b/test.m4s')
  assert.equal(f.timeout(), 9000)
  assert.equal(work.nativeReady(), true)
  work.reopen('https://upos-sz-mirrorali.bilivideo.com/upgcxcode/a/b/test.m4s')
  assert.throws(
    () => work.reopen('https://upos-sz-mirrorcos.bilivideo.com/upgcxcode/a/b/test.m4s'),
    { name: 'InvalidStateError' },
  )
  assert.deepEqual(f.counts(), { openCount: 2, headers: 2 })
})
test('V2215 XHR preparation stops after responseType reentry loses metadata ownership', () => {
  const f = preparation(),
    original = f.meta.targetUrl
  const work = createXhrPreparation(f.xhr, f.meta, f.waiting, f.native)
  f.loseDuringType()
  work.reopen('https://upos-sz-mirrorcos.bilivideo.com/upgcxcode/a/b/test.m4s')
  assert.equal(work.nativeReady(), false)
  assert.equal(f.meta.targetUrl, original)
  assert.deepEqual(f.counts(), { openCount: 1, headers: 0 })
})
