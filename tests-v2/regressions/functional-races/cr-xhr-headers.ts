import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture, mediaUrl, ordinaryUrl } from './cr-xhr-fixture.ts'

test('CONTROL: immutable header survives a policy reopen', async (t) => {
  const f = await fixture(t),
    xhr = f.createXhr()
  await f.settings.update({ fixedHost: 'upos-sz-mirrorcos.bilivideo.com' })
  f.routes.invalidateForUserSetting()
  xhr.open('GET', mediaUrl)
  xhr.setRequestHeader('Range', 'bytes=0-99')
  await f.settings.update({ disabled: true })
  xhr.send()
  assert.equal(xhr.nativeOpens, 2)
  assert.equal(xhr.nativeSends, 1)
  assert.deepEqual(xhr.headers, [['Range', 'bytes=0-99']])
})

test('CONTROL: stateful header input is converted once without reopen', async (t) => {
  const f = await fixture(t),
    xhr = f.createXhr()
  xhr.open('GET', ordinaryUrl)
  let conversions = 0
  const value = {
    toString() {
      conversions++
      return conversions === 1 ? 'bytes=0-99' : 'bytes=100-199'
    },
  }
  Reflect.apply(xhr.setRequestHeader, xhr, ['Range', value])
  xhr.send()
  assert.equal(conversions, 1)
  assert.equal(xhr.nativeOpens, 1)
  assert.deepEqual(xhr.headers, [['Range', 'bytes=0-99']])
})

test('S-01: policy reopen preserves the once-converted request header value', async (t) => {
  const f = await fixture(t),
    xhr = f.createXhr()
  await f.settings.update({ fixedHost: 'upos-sz-mirrorcos.bilivideo.com' })
  f.routes.invalidateForUserSetting()
  xhr.open('GET', mediaUrl)
  let conversions = 0
  const value = {
    toString() {
      conversions++
      return conversions === 1 ? 'bytes=0-99' : 'bytes=100-199'
    },
  }
  Reflect.apply(xhr.setRequestHeader, xhr, ['Range', value])
  assert.deepEqual(xhr.headers, [['Range', 'bytes=0-99']])
  await f.settings.update({ disabled: true })
  xhr.send()
  assert.equal(xhr.nativeOpens, 2)
  assert.equal(xhr.nativeSends, 1)
  assert.deepEqual(
    xhr.headers,
    [['Range', 'bytes=0-99']],
    'internal reopen must replay native-accepted bytes, not a mutable input',
  )
  assert.equal(conversions, 1)
})

test('S-01 ByteString validation and conversion reentry preserve the current request', async (t) => {
  const f = await fixture(t),
    xhr = f.createXhr()
  xhr.open('GET', ordinaryUrl)
  let values = 0
  assert.throws(
    () =>
      Reflect.apply(xhr.setRequestHeader, xhr, [
        '\u0100',
        {
          toString() {
            values++
            return 'x'
          },
        },
      ]),
    TypeError,
  )
  assert.equal(values, 0)
  Reflect.apply(xhr.setRequestHeader, xhr, [
    'X-Own',
    {
      toString() {
        xhr.open('GET', ordinaryUrl + '/new')
        return 'saved'
      },
    },
  ])
  assert.deepEqual(xhr.headers, [['X-Own', 'saved']])
  xhr.send()
  assert.equal(xhr.nativeSends, 1)
  assert.ok(xhr.url.endsWith('/new'))
})
