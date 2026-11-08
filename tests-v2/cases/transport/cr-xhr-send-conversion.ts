import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture, ordinaryUrl } from './cr-xhr-fixture.ts'

test('CONTROL: native rejected body conversion keeps OPENED sendable', async (t) => {
  const f = await fixture(t),
    xhr = f.createXhr(),
    marker = new Error('synthetic body conversion')
  xhr.open('POST', ordinaryUrl)
  const body = {
    toString() {
      throw marker
    },
  }
  assert.throws(
    () => Reflect.apply(f.nativeSend, xhr, [body]),
    (error) => error === marker,
  )
  assert.equal(xhr.readyState, 1)
  assert.equal(xhr.nativeSends, 0)
  Reflect.apply(f.nativeSend, xhr, ['valid'])
  assert.equal(xhr.nativeSends, 1)
})

test('CONTROL: hooked valid body sends once and rejects duplicate send', async (t) => {
  const f = await fixture(t),
    xhr = f.createXhr()
  xhr.open('POST', ordinaryUrl)
  xhr.send('valid')
  assert.equal(xhr.nativeSends, 1)
  assert.throws(() => xhr.send('second'), { name: 'InvalidStateError' })
})

test('S-03: body conversion failure must preserve native retry capability', async (t) => {
  const f = await fixture(t),
    xhr = f.createXhr(),
    marker = new Error('synthetic body conversion')
  xhr.open('POST', ordinaryUrl)
  const body = {
    toString() {
      throw marker
    },
  }
  assert.throws(
    () => xhr.send(body),
    (error) => error === marker,
  )
  assert.equal(xhr.readyState, 1)
  assert.equal(xhr.nativeSends, 0)
  assert.doesNotThrow(
    () => xhr.send('valid'),
    'failed Web IDL conversion never set native send flag',
  )
  assert.equal(xhr.nativeSends, 1)
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
