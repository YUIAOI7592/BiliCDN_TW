import { test } from 'node:test'
import assert from 'node:assert/strict'
import { BrowserNavigation } from '../../../src-v2/adapters/navigation.ts'
import { testScope } from '../../support/scope.ts'

for (const [label, pathname, before, after, equal] of [
  ['tracking and ordering', '/video/test/', '?p=1&cid=7&vd_source=a', '?spm_id_from=b&cid=7', true],
  ['duplicate order', '/video/test', '?x=1&x=2', '?x=2&x=1', false],
  ['duplicate p', '/video/test', '?p=1&p=1', '', false],
  ['different part', '/video/test', '?p=1', '?p=2', false],
  ['content parameter', '/video/test', '?cid=7', '?cid=8', false],
  ['unknown parameter', '/video/test', '?unknown=a', '?unknown=b', false],
  ['OGV tracking', '/bangumi/play/ep123/', '?vd_source=a', '?spm_id_from=b', true],
  ['OGV p remains significant', '/bangumi/play/ep123', '', '?p=1', false],
  ['unknown path', '/other/', '?vd_source=a', '?vd_source=b', false],
  [
    'long query suffix',
    '/video/test',
    '?x=' + 'a'.repeat(600) + '&p=1',
    '?x=' + 'a'.repeat(600) + '&p=2',
    false,
  ],
] as const) {
  test(`V224 navigation identity: ${label}`, (t) => {
    const scope = testScope(t),
      location = { pathname, search: before }
    scope.defineGlobal('location', { configurable: true, value: location })
    const navigation = new BrowserNavigation(),
      key = navigation.key()
    location.search = after
    assert.equal(navigation.key() === key, equal)
  })
}

test('V224 navigation normalizes supported trailing slashes without merging video or episode paths', (t) => {
  const scope = testScope(t),
    location = { pathname: '/video/test/', search: '' }
  scope.defineGlobal('location', { configurable: true, value: location })
  const navigation = new BrowserNavigation(),
    key = navigation.key()
  location.pathname = '/video/test'
  assert.equal(navigation.key(), key)
  location.pathname = '/video/another'
  assert.notEqual(navigation.key(), key)
  location.pathname = '/bangumi/play/ep123'
  const episode = navigation.key()
  location.pathname = '/bangumi/play/ep124'
  assert.notEqual(navigation.key(), episode)
})
