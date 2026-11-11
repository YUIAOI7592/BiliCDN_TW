import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture, ordinaryUrl } from './cr-xhr-fixture.ts'

test('S-03: body conversion failure must preserve native retry capability', async (t) => {
  const f = await fixture(t)
  for (const channel of ['native', 'hooked'] as const) {
    const xhr = f.createXhr(),
      marker = new Error(channel + ' body conversion')
    xhr.open('POST', ordinaryUrl)
    const send = (body: unknown) =>
      Reflect.apply(channel === 'native' ? f.nativeSend : xhr.send, xhr, [body])
    const body = {
      toString() {
        throw marker
      },
    }
    assert.throws(
      () => send(body),
      (error) => error === marker,
      channel,
    )
    assert.equal(xhr.readyState, 1, channel)
    assert.equal(xhr.nativeSends, 0, channel)
    assert.doesNotThrow(() => send('valid'), channel + ' failed conversion leaves OPENED sendable')
    assert.equal(xhr.nativeSends, 1, channel)
    assert.throws(() => send('duplicate'), { name: 'InvalidStateError' }, channel)
    assert.equal(xhr.nativeSends, 1, channel)
  }
})

test('S-03 body conversion reentrant open sends the new request once', async (t) => {
  const f = await fixture(t),
    xhr = f.createXhr()
  xhr.open('POST', ordinaryUrl)
  let calls = 0
  xhr.send({
    toString() {
      calls++
      xhr.open('POST', ordinaryUrl + '/new')
      return 'converted'
    },
  })
  assert.equal(calls, 1)
  assert.equal(xhr.nativeSends, 1)
  assert.ok(xhr.url.endsWith('/new'))
  assert.throws(() => xhr.send('duplicate'), { name: 'InvalidStateError' })
})

test('S-03 abort during conversion before native send preserves native OPENED behavior', async (t) => {
  const f = await fixture(t),
    xhr = f.createXhr()
  xhr.open('POST', ordinaryUrl)
  xhr.send({
    toString() {
      xhr.abort()
      return 'converted'
    },
  })
  assert.equal(xhr.nativeSends, 1)
})
